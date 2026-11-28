# dsh-deeptutor-study

把 DeepTutor 的学习能力接进 DeepSeek Harness：一个 agent 预设、三个侧栏页面、若干脚本。

由 [hyyzero](https://github.com/hyyzero) 与 SKADI03 维护，MIT 许可。

## 功能

### 学习动作

加载「学习模式」预设后，DSH 多出一组 `deeptutor_*` 工具，并附带一套交互约定：学习类请求先给出动作菜单，参数通过选项选择。

| 动作 | 说明 |
|---|---|
| 讲解 | 对单个概念做推导式讲解，可结合知识库原文 |
| 出题 | 生成选择题，提交后在本地判分 |
| 学习路径 | 把一个领域拆成有先后顺序的阶段 |
| 研究 | 多源检索后输出带引用的报告 |
| 画图 | 函数图像、数据结构示意、概念关系图；过程类可生成可单步播放的网页 |
| 写书 | 先出章节提案，确认后分页生成，最后导出 Markdown |
| 复习错题 | 错题按知识点分组，在页面内重做 |

### 错题本（左侧栏）

- 判分后自动收录，附带知识点标签与选项
- 页面内直接答题，答对自动标记为已掌握并移出复习队列
- 间隔复习：答对拉长间隔（1/3/7/21 天），答错回到 1 天
- 数据存于工作区的单个 JSON 文件

### 知识库管理（左侧栏）

- 列出全部知识库：文档数、索引块数、向量模型、默认库标记
- 新建：指定名称与文档目录，后台索引，展示进度与日志
- 创建空库：登记文件夹并建立记录，放入文档后再点索引
- 文件夹选择与统计，删除后可在回收站恢复
- 改名、删除、设为默认
- 展开查看库内文档；文本类可页内预览，其余用系统程序打开

### 温习（左侧栏）

- 选一个知识库，按「讲解 → 出题 → 判分」的顺序复习
- 判分后的错题写入错题本
- 可选择在新会话中进行，提示词同时复制到剪贴板

### 总结入库

读取最近的会话内容，生成摘要并写入知识库。实现位于 `scripts/digest.py` 与技能 `kb-digest`。

### 功能面板

输入框右侧的「功能」按钮，集中展示各开关与运行状态。

### 选段提问

在任意回复里选中一段文字，选区右侧会出现「我有疑问」。

- 写下问题后点「加入待发送」，可以攒多条，最后一次性发出；每条按编号拼进同一条消息
- 也可以点「单独回答」：开一个旁路会话，答案显示在浮动卡片里，不打断当前对话；关闭卡片时会话自动归档
- 待发送的条目按会话隔离，切走会话自动隐藏、切回来原样恢复
- 攒着的段落是琥珀色高亮，单独回答过的段落是蓝紫色，二者不冲突
- 浮窗里的答案按 Markdown 渲染；回复里的 `dsh-ui` 交互卡片会折叠成一行提示

作用范围在「功能 → 选段提问」里切换，和「温习用新对话」在同一块面板：

| 选项 | 行为 |
|---|---|
| 仅学习模式 | 只有当前会话用 `study` 预设时才出现「我有疑问」 |
| 所有会话 | 任何会话都能用 |

面板底部会显示「当前会话：学习模式 / 未识别」。读取的是会话投影 `agentPreset`；读不到时按「所有会话」处理，避免功能静默失效。

使用顺序：

1. 选中一段文字 → 点「我有疑问」
2. 写问题 → 点「加入待发送」（或直接回车）
3. 需要多条就重复 1–2
4. 在右下角的「待提问」栏里点「一起发送」

只想问一处、且不想占用当前对话时，点「单独回答」即可。

## 安装

两种安装方式：

```bash
# 方式一：从 GitHub 源安装
dsh plugin add github:hyyzero/dsh-deeptutor-study
```

```powershell
# 方式二：使用仓库根目录的安装脚本（装包、复制技能、写环境变量）
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

桌面版的 CLI 可能拒绝直接管理 profile，此时改用 Harness 界面中的「包名或自定义安装源」输入框。

重启 DSH 后：

1. 左侧栏新增「知识库管理」，顶部显示学习环境状态
2. 点击「准备学习环境」，首次下载约 500MB（Python 依赖与向量模型），耗时数分钟
3. 安装技能：`powershell -File <插件目录>/scripts/install-skills.ps1`
4. 再次重启 DSH，新建会话时选择「学习模式」

运行环境安装在插件目录的 `runtime/` 与 `models/` 下，删除插件目录即完成卸载。

## 环境要求

- DSH 桌面版（Web 版未验证）
- Windows（安装脚本为 PowerShell，打开文件依赖 `explorer.exe`）
- DeepSeek 凭据：插件从 DSH 已保存的凭据读取 key
- Python 3.11 及以上

## 模型与凭据

| 调用方 | 读取的配置 | 写入方 |
|---|---|---|
| DSH 本体 | DSH 的 provider 配置 | 用户自行配置 |
| DeepTutor | `model_catalog.json` | `scripts/configure.py` 自动生成 |

DeepSeek 不提供 embedding 接口，因此知识库检索使用本地模型：

- 模型：`BAAI/bge-small-zh-v1.5`，512 维，约 95MB，经 hf-mirror 下载
- 服务：`scripts/embed_server.py`，提供 OpenAI 兼容的 `/v1/embeddings`，默认端口 8787
- endpoint 需精确以 `/embeddings` 结尾，DeepTutor 不做路径拼接

未安装向量模型时，讲解、出题、画图与错题本仍可使用，知识库相关功能不可用。

## 数据文件

| 路径 | 内容 |
|---|---|
| `.dsh-study/wrong-answers.json` | 错题本，schema v2 |
| `.dsh-study/env.json` | 运行时路径指针，插件启动时写入 |
| `books/<书名>.md` | 导出的书籍 |
| `viz/<主题>.html` | 生成的可交互动画 |
| 浏览器 `localStorage` | 选段提问的待发送条目（`dsh-ask:stage:v2`）与作用范围（`dsh-study:ask-scope`） |

`.dsh-study/env.json` 由插件维护，记录了插件根目录、Python 解释器、脚本与模板位置；技能与 agent 据此定位脚本；插件启动时会重写该文件。

错题本结构：

```json
{
  "version": 2,
  "items": [
    {
      "id": "wa-2026-11-18-001",
      "topic": "ROS 2 回调组与执行器",
      "question": "定时器回调里 async_send_request 后 wait() 为什么卡死？",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 1,
      "userAnswer": "...",
      "correctAnswer": "...",
      "explanation": "...",
      "wrongAt": "2026-11-18T12:30:00.000Z",
      "dueAt": "2026-11-19T12:30:00.000Z",
      "mastered": false,
      "masteredAt": null
    }
  ]
}
```

## 目录结构

```
├── package.json
├── cordis.patch.yml        # 注册宿主插件与学习模式预设
├── lib/index.js            # 宿主：三条路由与运行时指针
├── client/client.js        # 三个侧栏页面，无构建步骤
├── skills/study-flow/      # 交互协议
├── install.ps1             # 装机脚本：装包、复制技能、写环境变量
├── scripts/
│   ├── setup.ps1           # 环境准备，幂等
│   ├── configure.py        # 生成 DeepTutor 的模型配置
│   ├── embed_server.py     # 本地向量服务
│   ├── bookctl.py          # 书籍生成封装
│   ├── digest.py           # 会话总结入库
│   ├── session-tool.py     # 读取会话记录
│   ├── viz-template.html   # 交互网页模板
│   └── install-skills.ps1
├── examples/kb/            # 示例知识库
└── CHANGELOG.md
```

## 与 DeepTutor 的关系

插件通过三种方式使用 DeepTutor：

1. 调用其 CLI：只读命令直接执行，写入类命令需要确认，交互式命令交给用户在终端运行
2. 读取其配置与知识库目录
3. 通过 `BookEngine` 生成书（CLI 未提供创作命令，因此绕过 FastAPI）

DeepTutor 版本锁定为 `1.7.2`。`BookEngine` 属于内部模块，版本升级可能改变路径。

## 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| 点击「准备学习环境」无响应 | 宿主路由未注册 | 重启 DSH，检查日志中是否出现 `connection service unavailable` |
| 建库报 502 | 本地向量请求经过系统代理 | 插件已注入 `NO_PROXY=127.0.0.1,localhost` |
| 建库报 `WinError 5` | 解析子进程临时目录权限不足 | 将 `TMP`/`TEMP` 指向普通目录后重试 |
| 索引读取 `PermissionError` | 目录属主与当前用户不一致 | `icacls <目录> /grant "Users:(OI)(CI)(M)" /T` |
| 预设显示「加载失败」 | 当前 DSH 版本缺少某个官方插件 | 按设置页的具体报错，对相应行设置 `disabled: true` |

## 开发

```bash
git clone https://github.com/hyyzero/dsh-deeptutor-study
node --check lib/index.js
node --check client/client.js
npm run probe           # 以桩状态渲染三个页面，检查注册与文案
```

客户端页面无打包步骤，DSH 直接加载 `client/client.js`，修改后重启 DSH 生效。

## 许可

MIT，见 [LICENSE](LICENSE)。

调用 DeepTutor（Apache-2.0），不包含其源码；工具层依赖 dsh-deeptutor（MIT）。
