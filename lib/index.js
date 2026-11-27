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
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import net from 'node:net'

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

function resolveWorkspace(ctx, requestedId) {
  let registry
  try {
    registry = ctx.get('workspaceRegistry')
  } catch {
    return undefined
  }
  if (!registry || typeof registry.list !== 'function') return undefined
  let rows
  try {
    rows = registry.list()
  } catch {
    return undefined
  }
  if (!Array.isArray(rows) || rows.length === 0) return undefined
  if (typeof requestedId === 'string' && requestedId !== '') {
    const hit = rows.find((row) => row && row.id === requestedId)
    if (hit !== undefined) return hit
  }
  return rows[0]
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
  const params = new URL(request.url).searchParams

  if (request.method === 'GET') {
    const workspace = resolveWorkspace(ctx, params.get('workspaceId') ?? undefined)
    if (workspace === undefined) return jsonResponse({ error: 'workspace-unavailable', message: '没有可用的工作区。' }, 503)
    const file = path.join(workspace.path, STUDy_DIR, STUDy_FILE)
    writeEnv(ctx, workspace).catch(() => {})
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
  if (body === null || typeof body !== 'object') {
    return jsonResponse({ error: 'invalid-body', message: '请求体必须是 JSON 对象。' }, 400)
  }
  const action = body.action
  if (action !== 'mastered' && action !== 'practice') {
    return jsonResponse({ error: 'invalid-action', message: 'action 必须是 mastered 或 practice。' }, 400)
  }
  const workspace = resolveWorkspace(ctx, typeof body.workspaceId === 'string' ? body.workspaceId : undefined)
  if (workspace === undefined) return jsonResponse({ error: 'workspace-unavailable', message: '没有可用的工作区。' }, 503)
  const file = path.join(workspace.path, STUDy_DIR, STUDy_FILE)

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

/** Extensions DeepTutor can actually parse; used to fail fast with a clear reason. */
const INDEXABLE_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS,
  '.pdf', '.docx', '.xlsx', '.pptx', '.epub', '.rtf', '.doc', '.xls', '.ppt',
])

/** Count the documents in a folder that DeepTutor could index. */
async function countIndexable(folder) {
  let entries
  try {
    entries = await fs.readdir(folder, { withFileTypes: true })
  } catch {
    return 0
  }
  let total = 0
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      total += await countIndexable(path.join(folder, entry.name))
      continue
    }
    if (INDEXABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) total += 1
  }
  return total
}
const KB_ACTIONS = new Set(['create', 'rename', 'delete', 'setDefault', 'open', 'openFolder', 'reindex', 'folderDelete', 'folderRestore'])

function kbRoot(home) {
  return path.join(home, 'data', 'knowledge_bases')
}

/** Names the folder picker hides: the DeepTutor data home and the trash. */
const FOLDER_SKIP = new Set(['data', '.trash'])
const TRASH_DIR = '.trash'

/** True when `target` is `root` or below it. */
function insideRoot(root, target) {
  const base = path.resolve(root)
  const resolved = path.resolve(target)
  return resolved === base || resolved.startsWith(base + path.sep)
}

/** Resolve a relative folder path under the study root, refusing escapes. */
function folderTarget(root, rel) {
  const clean = typeof rel === 'string' ? rel.replace(/\\/g, '/').trim().replace(/^\/+|\/+$/g, '') : ''
  const target = path.resolve(root, clean)
  if (!insideRoot(root, target)) throw new Error('路径越界')
  return { clean, target }
}

/** File/folder counts plus mtime for one folder; unreadable folders still list. */
async function folderStats(full) {
  let files = 0
  let dirs = 0
  let modifiedAt = null
  try {
    const entries = await fs.readdir(full, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) dirs += 1
      else files += 1
    }
    modifiedAt = (await fs.stat(full)).mtime.toISOString()
  } catch {
    /* keep the counts at zero */
  }
  return { files, dirs, modifiedAt }
}

/** Deleted folders live here so they can be restored. */
async function listTrash(root) {
  const dir = path.join(root, TRASH_DIR)
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const parts = entry.name.split('__')
      const origin = parts.length > 1 ? parts.slice(1).join('__') : entry.name
      return { entry: entry.name, origin, at: parts[0].replace(/-/g, ':').slice(0, 19) }
    })
    .sort((a, b) => (a.entry < b.entry ? 1 : -1))
}

async function listFolders(root, rel) {
  const { clean, target } = folderTarget(root, rel)
  const entries = await fs.readdir(target, { withFileTypes: true })
  const items = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (clean === '' && FOLDER_SKIP.has(entry.name)) continue
    const full = path.join(target, entry.name)
    const stats = await folderStats(full)
    items.push({
      name: entry.name,
      path: full,
      rel: clean === '' ? entry.name : `${clean}/${entry.name}`,
      canUp: false,
      ...stats,
    })
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  const parent = clean === '' ? null : clean.includes('/') ? clean.slice(0, clean.lastIndexOf('/')) : ''
  return { root, rel: clean, path: target, parent, items, trash: await listTrash(root) }
}

async function trashFolder(root, rel) {
  const { clean, target } = folderTarget(root, rel)
  if (clean === '') throw new Error('不能删除根目录')
  if (!insideRoot(root, target) || clean.split('/').some((part) => part === '.trash')) {
    throw new Error('不能删除这里')
  }
  const stat = await fs.stat(target)
  if (!stat.isDirectory()) throw new Error('只能删除文件夹')
  const dir = path.join(root, TRASH_DIR)
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = path.basename(target)
  let entry = `${stamp}__${base}`
  for (let n = 2; ; n += 1) {
    try {
      await fs.access(path.join(dir, entry))
      entry = `${stamp}-${n}__${base}`
    } catch {
      break
    }
  }
  await fs.rename(target, path.join(dir, entry))
  return { entry, origin: base }
}

async function restoreFolder(root, entry) {
  if (typeof entry !== 'string' || entry === '' || entry.includes('/') || entry.includes('\\')) {
    throw new Error('删除记录不合法')
  }
  const dir = path.join(root, TRASH_DIR)
  const source = path.join(dir, entry)
  if (!insideRoot(dir, source)) throw new Error('路径越界')
  const base = entry.includes('__') ? entry.split('__').slice(1).join('__') : entry
  let dest = path.join(root, base)
  for (let n = 2; ; n += 1) {
    try {
      await fs.access(dest)
      dest = path.join(root, `${base} (${n})`)
    } catch {
      break
    }
  }
  await fs.rename(source, dest)
  return { path: dest, name: path.basename(dest) }
}

async function readConfig(home) {
  let text
  try {
    text = await fs.readFile(path.join(kbRoot(home), 'kb_config.json'), 'utf8')
  } catch (error) {
    // A home that has never held a knowledge base has no config yet; the CLI
    // creates it on the first `kb create`, and this page has to survive that gap.
    if (error && error.code === 'ENOENT') {
      return {
        knowledge_bases: {},
        defaults: { default_kb: null, rag_provider: 'llamaindex', search_mode: 'hybrid', provider_modes: {} },
      }
    }
    throw error
  }
  const parsed = JSON.parse(text)
  if (parsed === null || typeof parsed !== 'object') throw new Error('kb_config.json is not an object')
  if (parsed.knowledge_bases === null || typeof parsed.knowledge_bases !== 'object') parsed.knowledge_bases = {}
  if (parsed.defaults === null || typeof parsed.defaults !== 'object') parsed.defaults = {}
  // The CLI leaves `default_kb` pointing at a deleted name behind.
  const declared = parsed.defaults.default_kb
  if (declared !== undefined && declared !== null && (typeof declared !== 'string' || parsed.knowledge_bases[declared] === undefined)) {
    parsed.defaults.default_kb = null
  }
  return parsed
}

async function writeConfig(home, config) {
  const root = kbRoot(home)
  await fs.mkdir(root, { recursive: true })
  const target = path.join(root, 'kb_config.json')
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  await fs.rename(temporary, target)
}

/** Embedding profile the model catalog has active, with the bundled BGE as fallback. */
async function embeddingDefaults(home) {
  const fallback = {
    embedding_selection: { profile_id: 'local-bge', model_id: 'bge-small-zh' },
    embedding_model: 'BAAI/bge-small-zh-v1.5',
    embedding_dim: 512,
    embedding_status: 'ready',
  }
  try {
    const text = await fs.readFile(path.join(home, 'data', 'user', 'settings', 'model_catalog.json'), 'utf8')
    const service = JSON.parse(text)?.services?.embedding
    const profiles = Array.isArray(service?.profiles) ? service.profiles : []
    const profile = profiles.find((row) => row && row.id === service.active_profile_id) ?? profiles[0]
    const models = Array.isArray(profile?.models) ? profile.models : []
    const model = models.find((row) => row && row.id === service.active_model_id) ?? models[0]
    if (profile === undefined || model === undefined) return fallback
    return {
      embedding_selection: { profile_id: profile.id, model_id: model.id },
      embedding_model: typeof model.model === 'string' ? model.model : model.id,
      embedding_dim: typeof model.dimension === 'number' ? model.dimension : null,
      embedding_status: 'ready',
    }
  } catch {
    return fallback
  }
}

/**
 * Create a knowledge base shell without documents.
 *
 * The CLI refuses to create a KB with no supported document ("Provide at least
 * one supported document"), so this writes the same layout `kb create` would —
 * a `raw/` folder plus the registry entries — with no index yet. Dropping files
 * into `raw/` and running `kb add … --docs-dir raw` then fills it in normally.
 */
async function createEmptyKb(home, name, config) {
  const folder = path.join(kbRoot(home), name)
  await fs.mkdir(path.join(folder, 'raw'), { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const metadata = {
    name,
    created_at: stamp,
    description: `Knowledge base: ${name}`,
    version: '1.0',
    rag_provider: 'llamaindex',
    needs_reindex: false,
    last_updated: stamp,
    indexing_state: 'empty',
  }
  await fs.writeFile(path.join(folder, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
  config.knowledge_bases[name] = {
    path: name,
    description: `Knowledge base: ${name}`,
    status: 'empty',
    updated_at: new Date().toISOString(),
    rag_provider: 'llamaindex',
    index_versions: [],
    ...(await embeddingDefaults(home)),
    needs_reindex: false,
  }
  if (config.defaults === undefined || config.defaults === null) config.defaults = {}
  if (config.defaults.default_kb === undefined || config.defaults.default_kb === null) config.defaults.default_kb = name
  await writeConfig(home, config)
  return folder
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
    rawPath: path.join(kbRoot(home), typeof entry.path === 'string' ? entry.path : name, 'raw'),
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
    if (params.get('folders') !== null) {
      try {
        return jsonResponse({ ok: true, ...(await listFolders(home, params.get('folders') ?? '')) })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return jsonResponse({ error: 'folders-failed', message }, 400)
      }
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
    return jsonResponse({ error: 'invalid-action', message: 'action 必须是 create / rename / delete / setDefault / open / reindex / folderDelete / folderRestore。' }, 400)
  }

  // Folder actions work on the study root, not on a knowledge base, so they run
  // before the name checks below.
  if (action === 'folderDelete' || action === 'folderRestore') {
    try {
      const result = action === 'folderDelete'
        ? await trashFolder(home, typeof body.rel === 'string' ? body.rel : '')
        : await restoreFolder(home, body.entry)
      return jsonResponse({ ok: true, ...result, ...(await listFolders(home, '')) })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return jsonResponse({ error: 'folder-action-failed', message }, 400)
    }
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

  if (action === 'openFolder') {
    const folder = rawDir(home, config, name)
    if (folder === undefined) return jsonResponse({ error: 'not-found', message: '没有这个知识库。' }, 404)
    await fs.mkdir(folder, { recursive: true }).catch(() => {})
    spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore' }).unref()
    return jsonResponse({ ok: true, folder })
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
    const job = startJob([cli.command, ...cli.prefix, 'kb', 'delete', name, '--force'], `删除 ${name}`, path.dirname(home))
    // `kb delete` drops the entry but leaves `default_kb` naming it, so tidy the
    // registry once the CLI is done (it rewrites the file itself while running).
    void (async () => {
      const deadline = Date.now() + 120000
      while (job.status === 'running' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      if (job.code !== 0) return
      try {
        // Read the raw file: readConfig() already hides a stale default.
        const text = await fs.readFile(path.join(kbRoot(home), 'kb_config.json'), 'utf8')
        const raw = JSON.parse(text)
        const bases = raw?.knowledge_bases && typeof raw.knowledge_bases === 'object' ? raw.knowledge_bases : {}
        if (bases[name] !== undefined) return
        if (!raw?.defaults || raw.defaults.default_kb !== name) return
        raw.defaults.default_kb = Object.keys(bases)[0] ?? null
        await writeConfig(home, raw)
      } catch {
        /* the next read sanitises this anyway */
      }
    })()
    return jsonResponse({ ok: true, job })
  }

  if (action === 'create') {
    if (config.knowledge_bases[name] !== undefined) return jsonResponse({ error: 'exists', message: `已经有一个叫 ${name} 的知识库了。` }, 409)
    if (body.folderOnly === true) {
      try {
        const folder = await createEmptyKb(home, name, config)
        return jsonResponse({ ok: true, empty: true, name, folder })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return jsonResponse({ error: 'create-failed', message }, 500)
      }
    }
    const docsDir = typeof body.docsDir === 'string' ? body.docsDir.trim() : ''
    if (docsDir === '') return jsonResponse({ error: 'invalid-dir', message: '要指定一个装文档的目录。' }, 400)
    try {
      const stat = await fs.stat(docsDir)
      if (!stat.isDirectory()) return jsonResponse({ error: 'invalid-dir', message: `${docsDir} 不是一个目录。` }, 400)
    } catch {
      return jsonResponse({ error: 'invalid-dir', message: `读不到目录 ${docsDir}。` }, 400)
    }
    const found = await countIndexable(docsDir)
    if (found === 0) {
      const tip = '目录里没有可索引的文件（支持 pdf/docx/xlsx/pptx/epub 与 md/txt 等文本格式）。' + '只想先建库可以勾选「仅建文件夹」。' + docsDir
      return jsonResponse({ error: 'no-documents', message: tip }, 400)
    }
    const cli = resolveCli(home)
    await ensureEmbedServer(ctx)
    return jsonResponse({ ok: true, job: startJob([cli.command, ...cli.prefix, 'kb', 'create', name, '--docs-dir', docsDir], `新建 ${name}`, path.dirname(home)) })
  }

  if (action === 'reindex') {
    const entry = config.knowledge_bases[name]
    if (entry === undefined) return jsonResponse({ error: 'not-found', message: `没有名为 ${name} 的知识库。` }, 404)
    const cli = resolveCli(home)
    const raw = path.join(kbRoot(home), typeof entry.path === 'string' ? entry.path : name, 'raw')
    await ensureEmbedServer(ctx)
    return jsonResponse({ ok: true, job: startJob([cli.command, ...cli.prefix, 'kb', 'add', name, '--docs-dir', raw], `索引 ${name}`, path.dirname(home)) })
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
async function writeEnv(ctx, workspace) {
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

/** Port the bundled local embedding service listens on. */
const EMBED_PORT = 8787

/** True when something already accepts TCP connections on the port. */
function portOpen(port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    const done = (value) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

/**
 * Bring the bundled embedding service up when nothing is serving the port.
 *
 * Indexing a knowledge base posts to `http://127.0.0.1:8787/v1/embeddings`, and
 * only the setup script spawns that service, so a fresh app start otherwise
 * leaves 新建知识库 failing on a refused connection.
 */
async function ensureEmbedServer(ctx) {
  const python = resolvePython()
  if (python === undefined) return false
  const script = path.join(PLUGIN_ROOT, 'scripts', 'embed_server.py')
  try {
    await fs.access(script)
    await fs.access(python)
  } catch {
    return false
  }
  if (await portOpen(EMBED_PORT)) return true
  try {
    const child = spawn(
      python,
      [script, '--port', String(EMBED_PORT), '--cache', path.join(PLUGIN_ROOT, 'models', 'bge')],
      {
        cwd: PLUGIN_ROOT,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          NO_PROXY: '127.0.0.1,localhost,::1',
          no_proxy: '127.0.0.1,localhost,::1',
        },
      },
    )
    child.on('error', (error) => {
      ctx.logger?.warn?.(`dsh-deeptutor-study: embedding service failed to start: ${error.message}`)
    })
    child.unref()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.logger?.warn?.(`dsh-deeptutor-study: embedding service failed to start: ${message}`)
    return false
  }
  // The model takes a few seconds to load before the port answers.
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 700))
    if (await portOpen(EMBED_PORT)) return true
  }
  ctx.logger?.warn?.('dsh-deeptutor-study: embedding service did not answer on port 8787 within 20s')
  return false
}

/** Newest session transcript on disk — normally the conversation being written now. */
async function newestSessionFile() {
  const home = process.env.DSH_HOME
  const root = path.join(home ?? path.join(os.homedir(), '.dsh'), 'sessions')
  let best = null
  const walk = async (dir) => {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.name === 'session.v4.jsonl.zstd') {
        try {
          const stat = await fs.stat(full)
          if (best === null || stat.mtimeMs > best.mtimeMs) best = { file: full, mtimeMs: stat.mtimeMs }
        } catch {
          /* skip unreadable entries */
        }
      }
    }
  }
  await walk(root)
  return best === null ? undefined : best.file
}

/**
 * Whole-conversation digest: transcript → model → knowledge base raw/ → index.
 *
 * Runs as a job so the composer button can show progress; the transcript comes
 * from the newest session file, which is the conversation being written now.
 */
async function digest(ctx, request) {
  const home = resolveHome(ctx)
  if (home === undefined) return jsonResponse({ error: 'home-unknown', message: '找不到 DeepTutor 主目录（DEEPTUTOR_HOME）。' }, 503)
  const params = new URL(request.url).searchParams
  if (request.method === 'GET') {
    const jobId = params.get('job')
    if (jobId === null) return jsonResponse({ error: 'missing-job', message: '缺少 job 参数。' }, 400)
    const job = JOBS.get(jobId)
    return job === undefined
      ? jsonResponse({ error: 'job-unknown', message: `任务 ${jobId} 不存在或已过期。` }, 404)
      : jsonResponse({ job })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid-body', message: '请求体必须是 JSON。' }, 400)
  }
  if (body === null || typeof body !== 'object') return jsonResponse({ error: 'invalid-body', message: '请求体必须是 JSON 对象。' }, 400)
  const kb = typeof body.kb === 'string' ? body.kb.trim() : ''
  if (kb === '') return jsonResponse({ error: 'missing-kb', message: '要选一个知识库。' }, 400)
  const config = await readConfig(home)
  if (config.knowledge_bases[kb] === undefined) return jsonResponse({ error: 'not-found', message: `没有名为 ${kb} 的知识库。` }, 404)
  const sessionFile = typeof body.session === 'string' && body.session.trim() !== '' ? body.session.trim() : await newestSessionFile()
  if (sessionFile === undefined) return jsonResponse({ error: 'no-session', message: '找不到可用的会话记录。' }, 404)
  const python = resolvePython() ?? path.join(PLUGIN_ROOT, 'runtime', 'venv', 'Scripts', 'python.exe')
  await ensureEmbedServer(ctx)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const args = [path.join(PLUGIN_ROOT, 'scripts', 'digest.py'), '--session', sessionFile, '--kb', kb, '--home', home]
  if (title !== '') args.push('--title', title)
  return jsonResponse({ ok: true, job: startJob([python, ...args], `总结入库 ${kb}`, PLUGIN_ROOT) })
}

export function apply(ctx) {  const connection = ctx.get('connection')
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
  register('/api/study/digest', (request) => digest(ctx, request))
  writeEnv(ctx, resolveWorkspace(ctx)).catch(() => {})
  void ensureEmbedServer(ctx)
}
