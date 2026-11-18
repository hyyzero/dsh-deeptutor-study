/**
 * Host half of dsh-deeptutor-study.
 *
 * Registers three authenticated exact routes for its own client pages, and on
 * startup drops a small `env.json` into the workspace so the agent and the
 * skills know where the plugin, the Python environment and the scripts live.
 *
 *   /api/study/wrong-answers   GET  read   POST mastered | practice
 *   /api/study/kb              GET  list | docs | file | job   POST actions
 *   /api/study/setup           GET  status | job               POST run
 *
 * Nothing here touches DeepTutor's internals: the knowledge-base routes read
 * `kb_config.json` and shell out to the DeepTutor CLI, and the setup route runs
 * the bundled `scripts/setup.ps1`, so DeepTutor keeps owning its own bookkeeping.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

/** Host services this plugin needs; without them no route is registered. */
export const inject = ['connection']

const STUDy_DIR = '.dsh-study'
const STUDy_FILE = 'wrong-answers.json'
const JOBS = new Map()
const JOB_KEEP = 20
const PLUGIN_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function resolveWorkspace(ctx) {
  let registry
  try {
    registry = ctx.get('workspaceRegistry')
  } catch {
    return undefined
  }
  if (!registry || typeof registry.list !== 'function') return undefined
  try {
    const rows = registry.list()
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined
  } catch {
    return undefined
  }
}

/** DeepTutor home: env override, else the workspace-relative default. */
function resolveHome(ctx) {
  const env = process.env.DEEPTUTOR_HOME
  if (typeof env === 'string' && env.trim() !== '') return env.trim()
  const workspace = resolveWorkspace(ctx)
  return workspace ? path.join(workspace.path, '.deeptutor-home') : undefined
}

/** Python used to run bookctl.py and the embedding server. */
function resolvePython() {
  const bin = process.env.DEEPTUTOR_LOCAL_BIN
  if (typeof bin === 'string' && bin.trim() !== '') {
    return bin.trim().replace(/[\\/]Scripts[\\/]deeptutor(\.exe)?$/i, '\\Scripts\\python.exe')
  }
  return undefined
}

// ---------------------------------------------------------------- wrong answers

async function readBook(file) {
  let text
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return { exists: false, book: { items: [] } }
    throw error
  }
  const parsed = JSON.parse(text)
  if (Array.isArray(parsed)) return { exists: true, book: { version: 1, items: parsed } }
  if (parsed === null || typeof parsed !== 'object') throw new Error(`not an object: ${file}`)
  if (!Array.isArray(parsed.items)) parsed.items = []
  return { exists: true, book: parsed }
}

async function writeBook(file, book) {
  book.version = typeof book.version === 'number' ? book.version : 2
  book.updatedAt = new Date().toISOString()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(temporary, `${JSON.stringify(book, null, 2)}\n`, 'utf8')
  await fs.rename(temporary, file)
}

async function wrongAnswers(ctx, request) {
  const workspace = resolveWorkspace(ctx)
  if (workspace === undefined) return jsonResponse({ error: 'workspace-unavailable', message: '没有可用的工作区。' }, 503)
  const file = path.join(workspace.path, STUDy_DIR, STUDy_FILE)

  if (request.method === 'GET') {
    const { exists, book } = await readBook(file)
    return jsonResponse({
      workspace: { id: workspace.id, title: workspace.title, path: workspace.path },
      file: { path: file, exists, updatedAt: typeof book.updatedAt === 'string' ? book.updatedAt : null },
      items: book.items,
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid-body', message: '请求体必须是 JSON。' }, 400)
  }
  const action = body && body.action
  if (action !== 'mastered' && action !== 'practice') {
    return jsonResponse({ error: 'invalid-action', message: 'action 必须是 mastered 或 practice。' }, 400)
  }
  const { book } = await readBook(file)
  const index = book.items.findIndex((item) => item && String(item.id) === String(body.id))
  if (index < 0) return jsonResponse({ error: 'item-not-found', message: `没有 id 为 ${body.id} 的错题。` }, 404)
  const now = new Date().toISOString()
  const current = book.items[index]
  book.items[index] =
    action === 'mastered'
      ? { ...current, mastered: true, masteredAt: now, updatedAt: now }
      : { ...current, mastered: false, masteredAt: null, dueAt: now, practiceRequestedAt: now, updatedAt: now }
  await writeBook(file, book)
  return jsonResponse({ ok: true, item: book.items[index] })
}

// -------------------------------------------------------------- knowledge bases

const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.text', '.json', '.jsonl', '.csv', '.tsv', '.yaml', '.yml',
  '.html', '.htm', '.xml', '.tex', '.log', '.py', '.js', '.ts', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rs', '.java', '.sql', '.sh', '.ps1', '.ini', '.toml',
])
const KB_ACTIONS = new Set(['create', 'rename', 'delete', 'setDefault', 'open'])

function kbRoot(home) {
  return path.join(home, 'data', 'knowledge_bases')
}

async function readConfig(home) {
  const text = await fs.readFile(path.join(kbRoot(home), 'kb_config.json'), 'utf8')
  const parsed = JSON.parse(text)
  if (parsed === null || typeof parsed !== 'object') throw new Error('kb_config.json is not an object')
  if (parsed.knowledge_bases === null || typeof parsed.knowledge_bases !== 'object') parsed.knowledge_bases = {}
  if (parsed.defaults === null || typeof parsed.defaults !== 'object') parsed.defaults = {}
  return parsed
}

async function writeConfig(home, config) {
  const target = path.join(kbRoot(home), 'kb_config.json')
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  await fs.rename(temporary, target)
}

function rawDir(home, config, name) {
  const entry = config.knowledge_bases[name]
  if (entry === undefined) return undefined
  const folder = typeof entry.path === 'string' ? entry.path : name
  return path.join(kbRoot(home), folder, 'raw')
}

function safeName(value) {
  if (typeof value !== 'string' || value === '') return undefined
  const base = path.basename(value)
  if (base !== value || base === '.' || base === '..') return undefined
  return base
}

async function countDocs(home, entry) {
  const folder = typeof entry.path === 'string' ? entry.path : undefined
  if (folder === undefined) return null
  try {
    const rows = await fs.readdir(path.join(kbRoot(home), folder, 'raw'))
    return rows.filter((row) => !row.startsWith('.')).length
  } catch {
    return null
  }
}

async function describe(home, name, entry, effectiveDefault) {
  const version = Array.isArray(entry.index_versions) ? entry.index_versions[0] : undefined
  return {
    name,
    status: typeof entry.status === 'string' ? entry.status : 'unknown',
    docs: await countDocs(home, entry),
    chunks: version && typeof version.doc_count === 'number' ? version.doc_count : null,
    model: typeof entry.embedding_model === 'string' ? entry.embedding_model : null,
    updatedAt: typeof entry.updated_at === 'string' ? entry.updated_at : null,
    isDefault: effectiveDefault === name,
  }
}

async function listDocs(home, config, name) {
  const folder = rawDir(home, config, name)
  if (folder === undefined) return undefined
  let rows
  try {
    rows = await fs.readdir(folder, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const row of rows) {
    if (!row.isFile() || row.name.startsWith('.')) continue
    try {
      const stat = await fs.stat(path.join(folder, row.name))
      out.push({
        file: row.name,
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        text: TEXT_EXTENSIONS.has(path.extname(row.name).toLowerCase()),
      })
    } catch {
      continue
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file, 'zh'))
}

async function readDoc(home, config, name, file) {
  const folder = rawDir(home, config, name)
  const base = safeName(file)
  if (folder === undefined || base === undefined) return undefined
  const target = path.join(folder, base)
  const stat = await fs.stat(target)
  if (!TEXT_EXTENSIONS.has(path.extname(base).toLowerCase())) return { file: base, bytes: stat.size, text: null }
  const handle = await fs.open(target, 'r')
  try {
    const buffer = Buffer.alloc(Math.min(stat.size, 200000))
    await handle.read(buffer, 0, buffer.length, 0)
    return { file: base, bytes: stat.size, text: buffer.toString('utf8'), truncated: stat.size > buffer.length }
  } finally {
    await handle.close()
  }
}

function resolveCli(home) {
  const bin = process.env.DEEPTUTOR_LOCAL_BIN
  if (typeof bin === 'string' && bin.trim() !== '') return { command: bin, prefix: [] }
  const python = resolvePython()
  if (python !== undefined) return { command: python, prefix: ['-m', 'deeptutor'] }
  return { command: 'deeptutor', prefix: [] }
}

function startJob(args, label, cwd) {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const job = { id, label, status: 'running', log: '', startedAt: new Date().toISOString(), endedAt: null, code: null }
  JOBS.set(id, job)
  while (JOBS.size > JOB_KEEP) JOBS.delete(JOBS.keys().next().value)
  let child
  try {
    child = spawn(args[0], args.slice(1), {
      cwd,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        NO_PROXY: '127.0.0.1,localhost,::1',
        no_proxy: '127.0.0.1,localhost,::1',
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    job.status = 'failed'
    job.log = error instanceof Error ? error.message : String(error)
    job.endedAt = new Date().toISOString()
    return job
  }
  const append = (chunk) => { job.log = `${job.log}${String(chunk)}`.slice(-8000) }
  child.stdout?.on('data', append)
  child.stderr?.on('data', append)
  child.on('error', (error) => {
    job.status = 'failed'
    job.log = `${job.log}\n${error instanceof Error ? error.message : String(error)}`.trim()
    job.endedAt = new Date().toISOString()
  })
  child.on('close', (code) => {
    job.code = code
    job.status = code === 0 ? 'done' : 'failed'
    job.endedAt = new Date().toISOString()
  })
  return job
}

async function knowledge(ctx, request) {
  const home = resolveHome(ctx)
  if (home === undefined) return jsonResponse({ error: 'home-unknown', message: '找不到 DeepTutor 主目录（DEEPTUTOR_HOME）。' }, 503)

  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams
    const jobId = params.get('job')
    if (jobId !== null) {
      const job = JOBS.get(jobId)
      return job === undefined
        ? jsonResponse({ error: 'job-unknown', message: `任务 ${jobId} 不存在或已过期。` }, 404)
        : jsonResponse({ job })
    }
    const config = await readConfig(home)
    const owner = params.get('name')
    if (params.get('docs') !== null) {
      if (owner === null) return jsonResponse({ error: 'invalid-name', message: '缺少知识库名。' }, 400)
      const docs = await listDocs(home, config, owner)
      return docs === undefined
        ? jsonResponse({ error: 'not-found', message: `没有名为 ${owner} 的知识库。` }, 404)
        : jsonResponse({ name: owner, docs })
    }
    if (params.get('file') !== null) {
      if (owner === null) return jsonResponse({ error: 'invalid-name', message: '缺少知识库名。' }, 400)
      const doc = await readDoc(home, config, owner, params.get('file'))
      return doc === undefined
        ? jsonResponse({ error: 'not-found', message: '找不到该文件。' }, 404)
        : jsonResponse({ name: owner, doc })
    }
    const names = Object.keys(config.knowledge_bases).sort()
    const effectiveDefault = config.defaults.default_kb ?? (names.length === 1 ? names[0] : null)
    const items = []
    for (const name of names) items.push(await describe(home, name, config.knowledge_bases[name], effectiveDefault))
    return jsonResponse({ home, items, default: config.defaults.default_kb ?? null })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid-body', message: '请求体必须是 JSON。' }, 400)
  }
  if (body === null || typeof body !== 'object') return jsonResponse({ error: 'invalid-body', message: '请求体必须是 JSON 对象。' }, 400)
  const action = body.action
  if (typeof action !== 'string' || !KB_ACTIONS.has(action)) {
    return jsonResponse({ error: 'invalid-action', message: 'action 必须是 create / rename / delete / setDefault / open。' }, 400)
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name === '') return jsonResponse({ error: 'invalid-name', message: '知识库名不能为空。' }, 400)
  const config = await readConfig(home)

  if (action === 'setDefault') {
    if (config.knowledge_bases[name] === undefined) return jsonResponse({ error: 'not-found', message: `没有名为 ${name} 的知识库。` }, 404)
    config.defaults.default_kb = name
    await writeConfig(home, config)
    return jsonResponse({ ok: true })
  }

  if (action === 'open') {
    const folder = rawDir(home, config, name)
    const base = safeName(typeof body.file === 'string' ? body.file : '')
    if (folder === undefined) return jsonResponse({ error: 'not-found', message: `没有名为 ${name} 的知识库。` }, 404)
    if (base === undefined) return jsonResponse({ error: 'invalid-file', message: '文件名不合法。' }, 400)
    const target = path.join(folder, base)
    try {
      await fs.stat(target)
    } catch {
      return jsonResponse({ error: 'not-found', message: `找不到文件 ${base}。` }, 404)
    }
    const child = spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' })
    child.unref()
    return jsonResponse({ ok: true })
  }

  if (action === 'delete') {
    if (config.knowledge_bases[name] === undefined) return jsonResponse({ error: 'not-found', message: `没有名为 ${name} 的知识库。` }, 404)
    const cli = resolveCli(home)
    return jsonResponse({ ok: true, job: startJob([cli.command, ...cli.prefix, 'kb', 'delete', name, '--force'], `删除 ${name}`, path.dirname(home)) })
  }

  if (action === 'create') {
    const docsDir = typeof body.docsDir === 'string' ? body.docsDir.trim() : ''
    if (docsDir === '') return jsonResponse({ error: 'invalid-dir', message: '要指定一个装文档的目录。' }, 400)
    try {
      const stat = await fs.stat(docsDir)
      if (!stat.isDirectory()) return jsonResponse({ error: 'invalid-dir', message: `${docsDir} 不是一个目录。` }, 400)
    } catch {
      return jsonResponse({ error: 'invalid-dir', message: `读不到目录 ${docsDir}。` }, 400)
    }
    if (config.knowledge_bases[name] !== undefined) return jsonResponse({ error: 'exists', message: `已经有一个叫 ${name} 的知识库了。` }, 409)
    const cli = resolveCli(home)
    return jsonResponse({ ok: true, job: startJob([cli.command, ...cli.prefix, 'kb', 'create', name, '--docs-dir', docsDir], `新建 ${name}`, path.dirname(home)) })
  }

  const newName = typeof body.newName === 'string' ? body.newName.trim() : ''
  if (newName === '') return jsonResponse({ error: 'invalid-name', message: '新名字不能为空。' }, 400)
  if (newName === name) return jsonResponse({ ok: true })
  const entry = config.knowledge_bases[name]
  if (entry === undefined) return jsonResponse({ error: 'not-found', message: `没有名为 ${name} 的知识库。` }, 404)
  if (config.knowledge_bases[newName] !== undefined) return jsonResponse({ error: 'exists', message: `已经有一个叫 ${newName} 的知识库了。` }, 409)
  const from = path.join(kbRoot(home), typeof entry.path === 'string' ? entry.path : name)
  const to = path.join(kbRoot(home), newName)
  await fs.rename(from, to)
  entry.path = newName
  if (Array.isArray(entry.index_versions)) {
    for (const version of entry.index_versions) {
      for (const key of ['storage_path', 'version_path']) {
        if (typeof version[key] === 'string') version[key] = version[key].split(from).join(to)
      }
    }
  }
  config.knowledge_bases[newName] = entry
  delete config.knowledge_bases[name]
  if (config.defaults.default_kb === name) config.defaults.default_kb = newName
  await writeConfig(home, config)
  return jsonResponse({ ok: true })
}

// ---------------------------------------------------------------------- setup

async function setupStatus(ctx) {
  const home = resolveHome(ctx)
  const python = resolvePython()
  const venvPython = home ? path.join(path.dirname(path.dirname(home)), '.deeptutor-venv', 'Scripts', 'python.exe') : undefined
  let pythonOk = false
  if (python !== undefined) {
    try {
      await fs.access(python)
      pythonOk = true
    } catch {
      pythonOk = false
    }
  }
  let homeOk = false
  if (home !== undefined) {
    try {
      await fs.access(path.join(home, 'data', 'knowledge_bases', 'kb_config.json'))
      homeOk = true
    } catch {
      homeOk = false
    }
  }
  return jsonResponse({
    pluginRoot: PLUGIN_ROOT,
    deeptutorHome: home ?? null,
    python: python ?? null,
    pythonOk,
    deeptutorHomeReady: homeOk,
    setupScript: path.join(PLUGIN_ROOT, 'scripts', 'setup.ps1'),
  })
}

async function setup(ctx, request) {
  if (request.method === 'GET') {
    const jobId = new URL(request.url).searchParams.get('job')
    if (jobId !== null) {
      const job = JOBS.get(jobId)
      return job === undefined
        ? jsonResponse({ error: 'job-unknown', message: `任务 ${jobId} 不存在或已过期。` }, 404)
        : jsonResponse({ job })
    }
    return setupStatus(ctx)
  }
  const script = path.join(PLUGIN_ROOT, 'scripts', 'setup.ps1')
  try {
    await fs.access(script)
  } catch {
    return jsonResponse({ error: 'missing-script', message: '安装脚本缺失。' }, 500)
  }
  const job = startJob(
    ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
    '准备学习环境',
    path.dirname(PLUGIN_ROOT),
  )
  return jsonResponse({ ok: true, job })
}

// ------------------------------------------------------------------ workspace

/** Drop the pointer file the skills read to find this install. */
async function writeEnv(ctx) {
  const workspace = resolveWorkspace(ctx)
  if (workspace === undefined) return
  const home = resolveHome(ctx)
  const payload = {
    pluginRoot: PLUGIN_ROOT,
    deeptutorHome: home ?? null,
    python: resolvePython() ?? null,
    bookctl: path.join(PLUGIN_ROOT, 'scripts', 'bookctl.py'),
    embedServer: path.join(PLUGIN_ROOT, 'scripts', 'embed_server.py'),
    vizTemplate: path.join(PLUGIN_ROOT, 'scripts', 'viz-template.html'),
    updatedAt: new Date().toISOString(),
  }
  const file = path.join(workspace.path, STUDy_DIR, 'env.json')
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  } catch (error) {
    ctx.logger?.warn?.(`dsh-deeptutor-study: could not write ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function dispatch(handler) {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return jsonResponse({ error: 'study-route-failed', message }, 500)
    }
  }
}

export function apply(ctx) {
  const connection = ctx.get('connection')
  if (!connection || typeof connection.fetch?.register !== 'function') {
    ctx.logger?.warn?.('dsh-deeptutor-study: connection service unavailable, routes stay off')
    return
  }
  const register = (route, handler) =>
    connection.fetch.register({
      path: route,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: dispatch(handler),
    })
  register('/api/study/wrong-answers', (request) => wrongAnswers(ctx, request))
  register('/api/study/kb', (request) => knowledge(ctx, request))
  register('/api/study/setup', (request) => setup(ctx, request))
  writeEnv(ctx).catch(() => {})
}
