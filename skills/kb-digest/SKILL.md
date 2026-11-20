---
name: kb-digest
description: 把一段对话（尤其是「其他对话」）归纳成一份非常详细、带图表的知识文档，写进指定的 DeepTutor 知识库并建索引，最后报告落在哪个库、哪个文件。当用户说「把刚才/那个对话总结一下放进知识库」「整理成知识」「归档进知识库」「从对话里提炼知识点」时使用。
---

# 对话 → 知识库归纳

把一个已经结束的对话读进来，做成一份**能当资料用**的 markdown，落到知识库里，
并在最后明确告诉用户它进了哪个库、哪份文件、索引后有多少文档。

## 前置：先读环境指针

```powershell
Get-Content <workspace>\.dsh-study\env.json
```

里面有 `pluginRoot`、`python`、`deeptutorHome`。三处都要用**绝对路径**，
不要假设插件装在 `node_modules` 之外的别处。`deeptutor` 可执行文件在
`<pluginRoot>\runtime\venv\Scripts\deeptutor.exe`。

## 流程一：确认要归纳哪个对话

1. 列会话（只列出有内容的）：

```powershell
$env:PYTHONIOENCODING='utf-8'
& '<python>' '<pluginRoot>\scripts\session-tool.py' list --limit 20
```

2. 判断依据：
   - 用户给了会话 ID → 直接用。
   - 用户说「上一个对话 / 刚才那个」→ 取列表里**最近更新且不是当前会话**的那条；
     当前会话的 id 在 `$env:DSH_SESSION_ID` 里，跳过它。
   - 用户描述了内容（「讲 ROS 2 那个」）→ 按标题匹配。
   - 有多个候选 → 用 `ask_user_question` 给出选项（标题 + 时间 + 轮次），别让用户手打 ID。
   - 用户要归纳**当前对话** → 不需要 dump，直接用你手上的上下文。

3. 导出成可读文本（存到工作区，别放临时目录）：

```powershell
& '<python>' '<pluginRoot>\scripts\session-tool.py' dump <会话ID> `
  --out '<workspace>\.dsh-study\digest\<会话ID>.md' --max-chars 800000
```

`dump` 已经把 `system-reminder`、runtime context、时间戳等框架噪音清掉了；
工具调用保留成一行摘要。需要看助手当时的推理时加 `--reasoning`。

4. 用 `read` 读这份导出（大文件分几次读完，`offset` 往后翻）。

## 流程二：把内容归纳成知识文档

**详细优先。** 用户明确说过不用考虑 token 耗费，所以宁可写长：目标是别人只看这份文档
就能复现结论，不用回去翻对话。

必须包含的结构（缺哪块就说明「本对话未涉及」，不要省略标题）：

1. **一句话结论** —— 这个对话最后解决了什么 / 得出了什么。
2. **背景与目标** —— 用户一开始要干什么，约束是什么（环境、版本、权限）。
3. **时间线 / 过程** —— 按阶段分节；每一步做了什么、为什么这么选、失败过什么。
4. **关键结论与原理** —— 机制层面的解释，不要只写「改成 X 就好了」。
5. **可复现的步骤 / 命令 / 代码** —— 原始命令、路径、版本号照抄，标注哪些已实测。
6. **坑与修复** —— 现象 → 原因 → 处理，做成表格。
7. **未解决 / 待验证 / 风险** —— 明确区分「已验证」与「只是推测」。
8. **速查表** —— 关键路径、端口、命令、配置项一张表收尾。

**图表是硬要求**：至少 1 张 `mermaid`（流程 / 时序 / 依赖关系任选），
凡是「多步骤」「多组件」「前后对比」「多个方案取舍」的地方都画；
数据、选项、排障条目用表格，不要堆成一段段文字。

写作约定：

- 用对话里的原始语言（多数是中文），术语保留英文原词。
- 不编造：对话里没有验证过的东西，标「未验证」。
- 文件名安全：`<日期>-<主题>.md`，主题里去掉 `\ / : * ? " < > |`，长度控制在 60 字符内。
- 一个来源对话 = 一份文档；多个对话合并时，每份仍单独写，另加一份索引页互相链接。

## 流程三：选知识库

1. 读库清单：

```powershell
Get-Content '<deeptutorHome>\data\knowledge_bases\kb_config.json'
```

`knowledge_bases` 的键就是库名；`defaults.default_kb` 是默认库。

2. 选择规则：
   - 用户点名了库 → 用它（不存在就提示，别自动建同名空库之外的库）。
   - 用户没说 → 有默认库时用默认库，但**先问一句**确认（`ask_user_question`，
     选项里带上「新建一个空库」）。
   - 一个库都没有 → 让用户先在左侧栏「知识库管理」里新建（或告知可用「仅建文件夹」模式）。

## 流程四：落盘并建索引

```powershell
# 1. 写进库的 raw 目录
$kb = '<库名>'
$raw = Join-Path '<deeptutorHome>' "data\knowledge_bases\$kb\raw"
New-Item -ItemType Directory -Force -Path $raw | Out-Null
# 用 write 工具写文件；路径是 $raw\<日期>-<主题>.md，UTF-8

# 2. 建索引（写完文件之后）
$env:PYTHONIOENCODING='utf-8'
$env:DEEPTUTOR_HOME='<deeptutorHome>'
$env:NO_PROXY='127.0.0.1,localhost,::1'; $env:no_proxy=$env:NO_PROXY
& '<pluginRoot>\runtime\venv\Scripts\deeptutor.exe' kb add $kb --docs-dir $raw
```

- 这一步会调本地向量服务（127.0.0.1:8787）。插件启动时会自动拉起；如果报连接被拒，
  先跑一次「准备学习环境」或手动起 `scripts/embed_server.py`，再重试。
- 成功标志：退出码 0，最后一行是 `Done. Indexed N document(s).`
- 失败时把 stderr 原文贴给用户，不要只说「失败了」。

## 流程五：汇报（必须有）

结尾固定给出这五项，缺一不可：

| 项 | 内容 |
|---|---|
| 知识库 | 库名 + 是否为默认库 |
| 文件 | 写入的绝对路径 |
| 规模 | 文档字数 / 章节数 |
| 索引 | 成功与否、索引后该库文档数 |
| 检索 | 建议一句可用的检索词，方便用户验证 |

再用一两句话说明这份文档**应该被怎么用**（比如「下次问 ROS 2 回调组死锁，检索
`互斥组 死锁` 就能召回」）。如果用户想立刻验证，可以直接跑：

```powershell
& '<pluginRoot>\runtime\venv\Scripts\deeptutor.exe' kb search <库名> "<关键词>"
```

## 铁律

1. 先确认源对话再动手，不要凭猜测归纳一份「大概」的总结。
2. 不编造事实；不确定的写「未验证」。
3. 每份文档至少一张 mermaid 图，能用表格的地方不要用段落。
4. 命令全部由你执行，不要让用户自己跑；也不要让用户手打会话 ID。
5. `deeptutor` 调用串行执行，不要并发。
6. 汇报里的知识库名与文件路径必须是**实际写入**的那个，不能沿用猜测值。
