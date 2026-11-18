---
name: study-flow
description: Interaction protocol for DSH learning mode. Use whenever the user wants to learn something, take a quiz, plan a study path, review results, draw a function graph or diagram, or see a process animated step by step. Turns learning actions into clickable choices (ask_user_question), renders quizzes as selectable GenUI cards with local grading, shows results as visual cards, draws inline charts (plot/echart/svg/mermaid), and builds single-file interactive HTML steppers for procedural animations. Use instead of generating markdown/HTML files for quizzes.
---

# 学习模式交互协议

> 路径都从工作区的 `.dsh-study/env.json` 读取（插件启动时写入），不要假设固定目录。

把「学习」做成**点选**而不是**打字**。默认全部使用 DSH 原生能力：
`ask_user_question`（选择）、GenUI 组件（题目卡片 / 结果卡片）、`deeptutor_*`（内容生产）。

## 铁律

1. **不让用户手打命令**。任何动作选择、参数选择都用 `ask_user_question` 的选项。
2. **不生成 md / html 文件来承载题目**。题目一律渲染成 GenUI `quiz` 卡片，本地判分。
   仅当用户明确说「导出成网页 / PDF / 文件」时才走 html-doc。
3. **答案与解析不放在用户可见区域**。放进 radio 组件的 `answer` / `explanation` 字段，提交后本地揭示。
4. **一次只问一件事**。菜单 → 参数 → 出题，分步进行，别一口气抛出十个问题。
5. **deeptutor 工具必须串行**，共享同一个工作区锁，禁止同一轮并发调用。
6. **用户只做点选**。书籍生成等重活的命令全部由你在后台执行，不要把命令行、路径或参数甩给用户让他自己跑。
7. **动画与可视化由你生成，不让用户写代码、开网页或找工具**。看形状用内联图表，要动手调才落 HTML 文件。
8. **错题必须落库**。判分后把每道错题写进 `.dsh-study/wrong-answers.json`（格式见流程二附），左侧栏「错题本」页面读的就是这个文件；写进 DeepTutor 笔记本不算入错题本。

## 流程一：入口菜单

用户提出学习需求（或说「开始学习」）时，先给动作菜单：

```json
{"questions":[{
  "id":"action","header":"学习动作","question":"这次想做什么？",
  "options":[
    {"label":"深度讲解一个知识点","description":"用 deep_solve 讲透概念、原理与易错点"},
    {"label":"出选择题自测","description":"生成可点选的选择题，提交后本地判分"},
    {"label":"规划学习路径","description":"用 mastery_path 排学习顺序与里程碑"},
    {"label":"专题研究","description":"用 deep_research 调研一个主题（较慢）"},
    {"label":"管理知识库","description":"查看/检索已有知识库，或准备导入新资料"},
    {"label":"写一本书","description":"按主题或知识库生成一本分章小册子，自动撰写并导出 Markdown"},
    {"label":"画个图 / 看动画","description":"函数图像、数据结构示意；排序等过程可生成能单步播放的动画"}
  ]}]}
```

选定后，再问**参数**（同样用选项）：

- 出题：题量（5 / 10 / 15）、难度（easy / medium / hard / 混合）、是否挂知识库
- 讲解：深度（概念级 / 原理级 / 面试级）、是否挂知识库
- 写书：主题（知识库选题 / 自己描述 / 让我定）、篇幅（brief / standard / deep）、是否挂知识库
- 画图：要看什么（函数图像 / 数据结构 / 算法过程 / 概念关系）、要不要能单步调

## 流程二：出题（核心）

### 1. 取题

```
deeptutor_run(
  capability="deep_question",
  prompt="<知识点>，共 N 题，难度 <easy|medium|hard>",
  kbs=["<知识库名>"],          // 有知识库就挂
  config={"num_questions": N, "difficulty": "medium"}
)
```

### 2. 渲染成可点选的题目卡片

把 DeepTutor 返回的题目**改写成 GenUI `quiz`**：每题一个 `radio`，全部题共用一个 `submit`。
选项固定 4 个，由你生成；`answer` 填正确项，`explanation` 填解析。示例：

```json
{"type":"quiz","title":"C 字符串与数组 · 5 题","items":[
  {"type":"radio","group":"q1","label":"1. sizeof(\"abc\") 的值是？",
   "options":["3","4","8","编译错误"],"answer":"4",
   "explanation":"字符串字面量含结尾 '\\0'，共 4 字节。"},
  {"type":"radio","group":"q2","label":"2. 以下哪个操作会复制数组？",
   "options":["char *p = arr","char b[] = arr","memcpy(b, arr, sizeof arr)","p = &arr[0]"],
   "answer":"memcpy(b, arr, sizeof arr)","explanation":"数组不能整体赋值，必须逐字节复制。"}
],
 "groups":["q1","q2"],
 "submit":{"label":"提交并查看成绩","groups":["q1","q2"]}}
```

要点：
- `group` 每题唯一；`submit.groups` **必须列全**，否则判分不完整
- 判分在客户端完成，零往返
- 不要在题目文本里写「答案：B」；不要在卡片外再贴一份答案

### 3. 结果卡片（提交后）

用户点提交后，用**新的一组卡片**汇报成绩，例如：

```json
{"type":"grid","items":[
  {"type":"stat","label":"得分","value":"4 / 5"},
  {"type":"stat","label":"正确率","value":"80%"},
  {"type":"progress","value":80}
]}
```

再补一张逐题明细与薄弱点：

```json
{"type":"table","columns":["题号","考点","结果","说明"],
 "rows":[["1","sizeof 语义","✅ 正确",""],["2","数组复制","❌ 错误","数组不能整体赋值"]]}
```

```json
{"type":"callout","tone":"warning","content":"薄弱点：数组与指针的区别。建议让我用 deep_solve 针对这一点再讲一遍。"}
```

需要多轮记录时，可用 `chart`（kind=bars）展示各考点正确率。

### 判分后写错题（必做）

左侧栏的「错题本」页面只读一个文件：`<工作区根>/.dsh-study/wrong-answers.json`。判分完成后，把每道答错的题追加进去，缺这一步用户就看不到。

```json
{
  "version": 1,
  "updatedAt": "2026-11-18T13:10:00.000Z",
  "items": [
    {
      "id": "wa-2026-11-18-001",
      "topic": "ROS 2 回调组与执行器",
      "question": "题干原文",
      "options": ["选项 A 原文", "选项 B 原文", "选项 C 原文", "选项 D 原文"],
      "correctIndex": 1,
      "userAnswer": "用户选的那一项原文",
      "correctAnswer": "正确项原文",
      "explanation": "为什么错，一两句说清机制",
      "wrongAt": "2026-11-18T12:30:00.000Z",
      "dueAt": "2026-11-19T12:30:00.000Z",
      "mastered": false,
      "masteredAt": null
    }
  ]
}
```

细节要求：

- `options` + `correctIndex` **必填**。错题本页面靠这两个字段把题目渲染成可点的选项卡片，缺了就只能看文字、不能练。`correctIndex` 从 0 开始数。
- `topic` 用知识点，不要用章节号；同一知识点反复错就复用同一个 `topic`，页面自动归到一组。
- `dueAt` 首次 = `wrongAt` + 1 天；页面点「再练一次」会自己改。
- 文件不存在就新建（先 `mkdir -p .dsh-study`），已存在则读出整个 JSON 再追加，**不要覆盖别人的条目**。
- 用 Python 写、`ensure_ascii=False`、UTF-8 无 BOM，不要用 echo 拼 JSON。
- 写完回一句「已收录 N 道到错题本」，不要贴文件路径或原始 JSON。

## 流程三：讲解

```
deeptutor_run(capability="deep_solve", prompt="<知识点>", kbs=[...], config={"depth":"principle"})
```

输出后用**内联卡片**组织，不要先写一堆纯文本：

- `keyvalue` 核心结论
- `steps` 推导步骤 / 使用流程
- `table` 对比项
- `callout` 易错点
- 代码示例用 `code` 组件

## 流程四：收尾

学完一轮，问一句「要不要把要点存进笔记本？」→ 用户确认后调用
`deeptutor_note(notebook="<专题名>", type="solve|question", content="...")`。

## 流程六：画图 / 做动画

用户说「画个图」「做个动画」「让我看看…的过程」「动态演示一下」「可视化一下」时走这里。
分两条腿，先判断一句：**他是想看一眼，还是想动手调？**

| 判断 | 走哪条 | 产物 |
| --- | --- | --- |
| 只想知道形状 / 关系 / 趋势 | **A 内联图表** | 直接在回答里出现，不落文件 |
| 想停在第 3 步看、想拖参数、想回放 | **B 交互 HTML** | `<工作区>\viz\<主题>.html`，在预览面板打开 |

### A 路线：内联图表（首选，秒出）

用 GenUI 组件，不要写文件：

- `plot` —— 函数图像。参数 `title`、`xMin`、`xMax`、`series:[{label, expr}]`，`expr` 写 `sin(x)`、`x*x-2*x` 这类表达式。
- `echart` —— 复杂图表，ECharts option 直通（多序列、双轴、极坐标、动画）。给 `option` 即可，不要 `preset` 和 `option` 混用。
- `svg` —— 精确手绘几何、示意图、标注。
- `mermaid` / `diagram` —— 流程、时序、状态机、依赖关系。
- `scene3d` —— 三维场景（向量、平面、几何体），坐标轴用 `axis`。

原则：**能在聊天里画清楚的，绝不落文件**。

### B 路线：交互 HTML（要动手时才用）

**静态兜底（必须做）**：DSH 预览 HTML 有两种模式 —— 开启「代码工作工具」时脚本可跑；关闭时预览被净化、脚本被 CSP 拦死，Canvas 动画会整块白屏。所以每个交互 HTML 都要在 `.stage` 里再叠一层纯 HTML/CSS 的「第一帧」兜底（`.static` + `.sb`），脚本启动时用 `staticLayer.remove()` 撤掉它。正常模式下看不到这层，脚本被禁时至少能看到初始画面和一句「双击用浏览器打开」的提示。模板 `.dsh-study/env.json` 里 `vizTemplate` 指向的模板 已内置这层。

#### 硬约束（沙箱决定，违反就白屏）

- 预览面板用 `sandbox="allow-scripts"` 且**不带** `allow-same-origin`：null-origin 沙箱。
- 所以：**不能引 CDN**（外链脚本/字体一律挂了没法保证）、**不能用 localStorage / cookie**、**不能访问父页面**、**不能 fetch 外部资源**。
- 必须**单文件自包含**：CSS 和 JS 全部内联。
- 必须带 `<meta name="viewport" content="width=device-width,initial-scale=1">`。

#### 生成方式

1. 复制模板 `.dsh-study/env.json` 里 `vizTemplate` 指向的模板（已含深/浅色自适应、设备像素比处理、播放/单步/重置/速度、状态文字、键盘快捷键）。
2. 只改三处：`<title>`、`<h1>`、`__SUBTITLE__`，以及 JS 里的 `frames` 数组。
3. `frames` 是纯数据：每帧 `{ desc: "状态说明", draw(ctx, W, H) {...} }`。把算法过程先算成数组再画，不要在 draw 里跑算法。
4. 文件名用中文主题，存到 `<工作区>\viz\`。
5. 写完用 `node --check` 验一下抽出来的 `<script>` 语法，再交付。

#### 视觉规范

- 颜色一律读 CSS 变量：`getComputedStyle(document.documentElement).getPropertyValue('--accent')`，深色模式自动跟随。
- 语义固定：`--accent` 普通、`--warn` 正在交换、`--bad` 正在比较、`--good` 已完成。
- 数值标在柱子上方，索引标在下方；留 24px 边距。
- 最少控件：播放 / 上一步 / 下一步 / 重置 / 速度。**必须能单步**，否则就是视频不是教具。

#### 汇报

生成后一句：文件路径 + 一句话说明怎么看（「右侧预览里点播放，或按空格」）。
不要贴代码，不要让用户自己存文件。

### 不做的事

- ❌ 不为「看一眼」的需求生成 HTML 文件。
- ❌ 不在 HTML 里引 CDN、外链字体、外部图片。
- ❌ 不用 `deeptutor_run(capability="visualize")` 来画简单图——它走 analyzing→generating→reviewing 多阶段，30-90 秒，还常常要重试。直接画更快更可控。
- ❌ 不装 manim（需 LaTeX + ffmpeg，几百 MB，且视频不能单步）。

## 反模式（别做）

- ❌ 生成 `quiz-5.md` + `quiz-5.html` 让用户自己打开
- ❌ 用 `<details>` 手写折叠答案（渲染器不支持块级富文本）
- ❌ 把题目和答案一起贴在聊天里，用户只能自己对答案
- ❌ 让用户输入「1」或「A」来答题（用选项）
- ❌ 一轮里并发调用多个 deeptutor 工具（会锁死超时）
- ❌ 用 ASCII 或 markdown 表格「画」排序过程（该给动画）
- ❌ 让用户自己跑脚本或存 HTML 文件才看得到结果

## 流程五：生成一本书（DeepTutor BookEngine）

DSH 里通过 `bookctl.py` 直接驱动 `BookEngine`（不需要 fastapi 服务）。
所有调用都走 bash，stdout 是一行 JSON，进度在 stderr。

- **解释器**：`.dsh-study/env.json` 里的 `python`
- **脚本**：`.dsh-study/env.json` 里的 `bookctl`
- **先设环境变量**：`export PYTHONIOENCODING=utf-8`、`export DEEPTUTOR_HOME=<env.json 里的 deeptutorHome>`

### 触发条件

**入口一（首选）**：学习菜单里选「写一本书」——用户只点选，不碰命令行。
**入口二**：用户直接说「给我写一本关于 X 的书 / 小册子 / 教材」「把知识库整理成一本可读的东西」。

**不要**用 deep_solve 硬凑一本书，也不要把一本书拆成一堆 md 文件。

### 点选流程（用户全程不敲命令）

菜单选中后，用 `ask_user_question` 收参数，一次只问一组：

1. **主题** —— 从知识库选题 / 自己描述 / 让我帮你定
2. **篇幅** —— `brief`（3-6 章，约 10-15 分钟）/ `standard` / `deep`（最慢）
3. **知识库** —— 不挂 / 挂某个库（先跑 `deeptutor_kb list` 拿到库名）

参数齐了你在后台依次跑 create → spine → reorder，全程只在两处停下来让用户点选：

| 停点 | 给用户看什么 | 问什么 |
| --- | --- | --- |
| 提案确认 | `table` 章节表 + `keyvalue` 章数/深度/挂库 | 按这个写 / 改方向 / 换篇幅 |
| 编译范围 | `progress` 或页数清单 | 先编前 2 页看看 / 全部编完 |

> 下面所有命令都由你执行。**不要把命令行贴给用户**，也不要说「你自己跑一下」。

### 五步流水线（全部由你执行）

```bash
# 1. 构思（约 3-5 秒，一次 LLM 调用）
python bookctl.py create --intent "<主题/对象/范围>" --kb <知识库名> --depth brief --lang zh

# 2. 确认提案，生成章节目录（一次 LLM 调用）
python bookctl.py spine --book <bk_id>

# 3. 理清章节顺序（模型经常把前置关系倒过来）
python bookctl.py reorder --book <bk_id>

# 4. 逐页编译（90-120 秒/页，必须后台跑）
python bookctl.py compile --book <bk_id> [--max N] [--page <pg_id>]

# 5. 导出 Markdown
python bookctl.py export --book <bk_id> --out "books/<标题>.md"
```

辅助命令：`python bookctl.py list`、`python bookctl.py status --book <bk_id>`。

### 铁律与坑

1. **`create` 之后必须让用户点选确认**，不要自动往下跑。提案用 `table` 展示章节，
   再 `ask_user_question` 问「按这个目录写 / 改方向 / 换深度」。
2. **`spine` 之后一定要 `reorder`**。实测模型输出的第 0 章会依赖第 1 章，顺序是反的；
   `reorder` 按 `prerequisites` 做拓扑排序自动纠正。
3. **`compile` 是长任务，必须 `run_in_background: true`**，然后 `job_output` 收。
   一页 90-110 秒是常态，`deep` 深度更久；每页 10-12 个 block。
4. **一次只编译几页**（`--max 2`）。给用户看到第一页后再决定继续，别一上来编 20 页。
5. **`--depth`**：`brief`（3-6 章，先看效果）、`standard`（默认）、`deep`（最慢最贵）。
6. 书存在 `<deeptutorHome>\data\user\workspace\book\book_<id>\`，
   每页一个 JSON（`pages/<page_id>.json`），`log.md` 是追加式操作日志。
7. 单页重编：`python bookctl.py compile --book <bk_id> --page <pg_id>`。

### 汇报方式

- 提案阶段：`table`（章节 / 内容类型 / 学习目标）+ `keyvalue`（章数、深度、绑定知识库）
- 编译阶段：`progress` 展示「已完成页数 / 总页数」，别刷屏文字日志
- 完成后：`stat` 总字数 + 文件路径，并提示可用 html-doc 转成网页
