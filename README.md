# dsh-deeptutor-study

把 [DeepTutor](https://github.com/HKUDS/DeepTutor) 变成 DSH 里的**学习模式**：
一个预设、两个侧栏页面、七项学习动作，全程点选，不用记命令。

> 非官方项目，与 DeepTutor 团队、DeepSeek 均无隶属关系。

## 它解决什么

DSH 擅长写代码和查资料，不擅长"教"。DeepTutor 擅长教——深度讲解、出题、研究、学习路径、写书——
但它只有命令行。

这个插件把两者接起来：加载预设后，DSH 多出一套教学工具和明确的交互协议；
答错的题自动进错题本，资料进知识库后讲解会引用原文。

## 功能

**学习动作**（每次都用选项菜单问）

| 动作 | 做什么 | 背后 |
|---|---|---|
| 讲解 | 把一个概念讲透，带推导与例子 | `deep_solve` + 知识库 RAG |
| 出题 | 生成可点选的选择题，提交后本地判分 | `deep_question` |
| 学习路径 | 把一个领域拆成有先后的路线 | `mastery_path` |
| 研究 | 多源检索后输出带引用的报告 | `deep_research` |
| 画图 / 动画 | 内联函数图、关系图；过程类可生成能单步播放的 HTML | GenUI + 单文件 HTML |
| 写一本书 | 提案 → 章节 → 分页编译 → 导出 Markdown | `BookEngine` |
| 复习错题 | 按知识点分组，页内直接重做 | 错题本页面 |

**错题本**（左侧栏）

- 判分后自动收录，带知识点标签
- 页内直接答题：选项可点，提交即判，答对自动移出复习队列
- 间隔复习：1 → 3 → 7 → 21 天，答错退回 1 天
- 数据是工作区里一个 JSON 文件，可读可备份

**知识库管理**（左侧栏）

- 列出全部知识库：文档数、索引块、embedding 模型、是否默认
- 新建（填名称 + 文档目录，后台索引，带进度与日志）
- 改名、删除、设为默认
- 展开看库里的文档；文本类页内预览，其余用系统程序打开

## 安装

```bash
dsh plugin add github:hyyzero/dsh-deeptutor-study
```

重启 DSH 后：

1. 左侧栏出现「知识库管理」，顶部有一条「学习环境」状态
2. 点**准备学习环境**——首次会下载约 500MB（Python 依赖 + 向量模型），可能要几分钟
3. 装技能：`powershell -File <插件目录>/scripts/install-skills.ps1`
4. 重启 DSH，新建会话时选「学习模式」

> 环境全部装在插件目录下的 `runtime/` 与 `models/`，卸载插件等于删文件夹。

## 前置条件

- **DSH 桌面版**（Web 版未验证）
- **Windows**（安装脚本用 PowerShell；`explorer.exe` 打开文件）
- **DeepSeek 账号**：插件从 DSH 已保存的凭据里读 key，不用你另外填
- **Python 3.11+**：没有的话安装脚本会报错并给下载链接

## 模型与凭据

| 谁在调模型 | 读哪份配置 | 谁写 |
|---|---|---|
| DSH 本体（对话） | DSH 的 provider 配置 | 你自己配过 |
| DeepTutor（讲解/出题/写书） | 它自己的 `model_catalog.json` | **`scripts/configure.py` 自动写** |

DeepSeek 没有 embedding 接口，所以知识库检索必须本地跑模型：

- 模型：`BAAI/bge-small-zh-v1.5`，512 维，约 95MB（走 hf-mirror 下载）
- 服务：`scripts/embed_server.py`，OpenAI 兼容 `/v1/embeddings`，默认端口 8787
- endpoint 必须精确以 `/embeddings` 结尾——DeepTutor 不做路径拼接

不装模型也能用讲解、出题、画图、错题本；只是知识库相关功能不可用。

## GenUI 是可选的

出题卡片、结果卡片、图表依赖 GenUI 组件。它是一个独立插件，本包**只声明可选依赖**：

```bash
dsh plugin add @changfenhuang/dsh-genui
```

没有它也能用：

| 场景 | 有 GenUI | 没有 GenUI |
|---|---|---|
| 出题 | `radio` 卡片，点选后本地判分 | `ask_user_question` 选项 + 文本判分 |
| 结果 | 统计卡片 | 普通表格 |
| 画图 | 内联图表 | 代码块或文字描述 |

**错题本页面不依赖 GenUI**——它的答题界面是自己画的，本地判分。

## 数据文件

| 路径 | 内容 |
|---|---|
| `.dsh-study/wrong-answers.json` | 错题本（schema v2，含选项与正确答案下标） |
| `.dsh-study/env.json` | 运行时指针：插件根、python、bookctl、模板路径 |
| `books/<书名>.md` | 导出的书籍 |
| `viz/<主题>.html` | 生成的可交互动画 |

`.dsh-study/env.json` 由插件启动时写入，技能和 agent 靠它定位脚本，不要手改。

错题本 schema：

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
├── cordis.patch.yml        # 注册：宿主插件 + 学习模式预设
├── lib/index.js            # 宿主：三条路由 + 运行时指针
├── client/client.js        # 两个侧栏页面（零构建，直接加载）
├── skills/study-flow/      # 交互协议（安装后生效）
├── scripts/
│   ├── setup.ps1           # 环境准备（幂等）
│   ├── configure.py        # 写 DeepTutor 的模型配置
│   ├── embed_server.py     # 本地 embedding 服务
│   ├── bookctl.py          # 书籍生成封装
│   ├── viz-template.html   # 交互 HTML 模板
│   └── install-skills.ps1
├── examples/kb/            # 示例知识库（两篇 ROS 2 笔记）
└── CHANGELOG.md
```

## 与 DeepTutor 的关系

本插件**不修改** DeepTutor，只做三件事：

1. 调它的 CLI（读命令直接跑，写命令要确认，交互式命令一律拒绝）
2. 读它的配置与知识库目录
3. 用它的 `BookEngine` 直接生成书（CLI 没有创作命令，必须绕过 FastAPI）

因此版本**精确锁定 `1.7.2`**。`BookEngine` 是内部模块，升级可能改路径。

## 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| 点「准备学习环境」无反应 | 宿主路由没注册 | 重启 DSH，看日志里有没有 `connection service unavailable` |
| 建库报 502 | 本地 embedding 请求走了系统代理 | 插件已注入 `NO_PROXY=127.0.0.1,localhost` |
| 建库报 `WinError 5` | 解析子进程临时目录权限不足 | 把 `TMP`/`TEMP` 指到普通目录后重试 |
| 索引读不了 `PermissionError` | 目录属主与当前用户不一致 | `icacls <目录> /grant "Users:(OI)(CI)(M)" /T` |
| 预设显示「加载失败」 | 该 DSH 版本缺某个官方插件 | 看设置页上的具体报错，对应行可临时 `disabled: true` |

## 开发

```bash
git clone https://github.com/hyyzero/dsh-deeptutor-study
node --check lib/index.js        # 零构建，只做语法检查
node --check client/client.js
npm run probe                    # 桩状态渲染两个页面，检查按钮与文案
```

客户端页面没有打包步骤——DSH 直接加载 `client/client.js`。改完重启 DSH 生效。

## 许可

MIT，见 [LICENSE](LICENSE)。

调用 [DeepTutor](https://github.com/HKUDS/DeepTutor)（Apache-2.0），不包含其源码；
工具层依赖 [dsh-deeptutor](https://www.npmjs.com/package/dsh-deeptutor)（MIT，smpower）。

## 致谢

- DeepTutor — HKUDS，Apache-2.0
- dsh-deeptutor — smpower，MIT
