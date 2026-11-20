/**
 * Render probe for the two client pages.
 *
 * Executes each page component once with an empty state queue and a shallow
 * React stub, so a broken render path fails here instead of inside the running
 * Harness. Nothing is written.
 */
const failures = []
const check = (name, ok, detail) => {
  if (ok) console.log(`ok   ${name}`)
  else {
    failures.push(name)
    console.log(`FAIL ${name}${detail ? ` (${detail})` : ''}`)
  }
}

const loaded = []
globalThis.window = { __ModuleLoader__: { load(module) { loaded.push(module) } } }
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' })

await import('../client/client.js')

check('注册了一个模块', loaded.length === 1, `got ${loaded.length}`)
check('模块 id 与包名一致', loaded[0].id === 'dsh-deeptutor-study', loaded[0].id)

function texts(node, out = []) {
  if (node === null || node === undefined || node === false) return out
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (Array.isArray(node)) { for (const child of node) texts(child, out); return out }
  if (typeof node === 'object' && Array.isArray(node.children)) for (const child of node.children) texts(child, out)
  return out
}

function makeReact() {
  return {
    createElement(type, props, ...children) { return { type, props, children } },
    useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] },
    useRef(value) { return { current: value } },
    useEffect() {},
    useCallback(cb) { return cb },
  }
}

function renderAll(module) {
  const React = makeReact()
  const plugin = module.factory(() => React)
  const registrations = []
  plugin.apply({
    get(name) {
      if (name === 'locale') return { getSnapshot: () => ({ active: 'zh' }), register() {}, bind: () => (key) => key }
      if (name === 'layout') return { panelInfo: { getSnapshot: () => ({ activePanelId: module.id }), subscribe: () => () => {} }, selectPanel() {} }
      return undefined
    },
    effect(cb) { return cb() },
    slots: {
      inject(name, cb) { cb(); return () => {} },
      register(options, component) { registrations.push({ options, component }); return () => {} },
    },
  })
  return registrations
}

for (const module of loaded) {
  const registrations = renderAll(module)
  const mains = registrations.filter((row) => row.options.name === 'main')
  const sides = registrations.filter((row) => row.options.name === 'sidebar.panellist')
  check(`${module.id} 注册三个主面板`, mains.length === 3, `got ${mains.length}`)
  check(`${module.id} 注册三个侧栏项`, sides.length === 3, `got ${sides.length}`)
  check(`${module.id} 侧栏 key 互不相同`, new Set(sides.map((r) => r.options.id)).size === sides.length)

  const allText = mains.map((row) => texts(row.component()).join(' ')).join(' --- ')
  check('错题本页面标题正确', allText.includes('错题本'))
  check('知识库页面标题正确', allText.includes('知识库管理'))
  check('知识库页面有新建入口', allText.includes('新建知识库'))
  const chip = registrations.filter((row) => row.options.name === 'conversation.input.right')
  check('注册了输入框功能面板', chip.length === 1, `got ${chip.length}`)
}

console.log(failures.length === 0 ? '\nALL PASS' : `\n${failures.length} FAILED`)
process.exit(failures.length === 0 ? 0 : 1)
