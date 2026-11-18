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

check('注册了两个模块', loaded.length === 2, `got ${loaded.length}`)
check('模块 id 唯一', loaded[0].id !== loaded[1].id)

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

function renderOne(module) {
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
    slots: { inject(name, cb) { cb(); return () => {} }, register(options, component) { registrations.push({ options, component }); return () => {} } },
  })
  const main = registrations.find((row) => row.options.name === 'main')
  const side = registrations.find((row) => row.options.name === 'sidebar.panellist')
  check(`${module.id} 注册了主面板`, main !== undefined)
  check(`${module.id} 注册了侧栏项`, side !== undefined)
  return { tree: main ? main.component() : null, side }
}

for (const module of loaded) {
  const { tree, side } = renderOne(module)
  const all = texts(tree)
  check(`${module.id} 渲染出内容`, all.length > 3, `${all.length} nodes`)
  if (side) check(`${module.id} 侧栏有中文标签`, typeof side.options.label === 'function' && side.options.label().length > 0)
}

const allText = loaded
  .map((module) => {
    const React = makeReact()
    const plugin = module.factory(() => React)
    const regs = []
    plugin.apply({
      get(name) {
        if (name === 'locale') return { getSnapshot: () => ({ active: 'zh' }), register() {}, bind: () => (key) => key }
        if (name === 'layout') return { panelInfo: { getSnapshot: () => ({ activePanelId: module.id }), subscribe: () => () => {} }, selectPanel() {} }
        return undefined
      },
      effect(cb) { return cb() },
      slots: { inject(name, cb) { cb(); return () => {} }, register(o, c) { regs.push({ options: o, component: c }); return () => {} } },
    })
    return texts(regs.find((r) => r.options.name === 'main').component()).join(' ')
  })
  .join(' --- ')

check('错题本页面标题正确', allText.includes('错题本'))
check('知识库页面标题正确', allText.includes('知识库管理'))
check('知识库页面有新建入口', allText.includes('新建知识库'))

console.log(failures.length === 0 ? '\nALL PASS' : `\n${failures.length} FAILED`)
process.exit(failures.length === 0 ? 0 : 1)
