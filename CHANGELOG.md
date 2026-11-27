# Changelog

## 0.1.2

- 新增「选段提问」：选中回复里的一段文字，浮条上出现「我有疑问」，可合并进当前会话回答，也可开一个旁路会话单独回答（答案在浮动卡片里，关闭即归档）
- 「功能」面板新增作用范围选择器：仅学习模式 / 所有会话；读不到当前预设时按所有会话处理
- 高亮走 CSS Custom Highlight，并记录同一段文字是第几次出现，重渲染后仍能还原到原来那句
- 点击空白处立即收起浮条，滚出视口自动消失；正在提问的那一段用更醒目的待定色
## 0.1.1

- 新增侧栏页「温习」：选一个知识库，按「讲解 → 出题 → 判分」的节奏复习，错题自动进错题本
- 知识库管理支持创建空库（仅登记文件夹，稍后再放文档）与索引
- 知识库管理新增文件夹选择、文件夹统计、删除到回收站与恢复
- 新增「总结入库」：读取最近的会话，生成摘要写入知识库（`scripts/digest.py` + 技能 `kb-digest`）
- 新增输入框右侧「功能」面板：汇总开关与状态
- 环境准备增加向量服务端口探测与自动拉起
- 会话读取工具 `scripts/session-tool.py`
- 附带 `install.ps1`：装包、复制技能、写环境变量

## 0.1.0

首个可用版本。

- 学习模式预设 `study`：标准模式的超集，额外挂载 `deeptutor_*` 工具，并带交互协议
- 左侧栏「错题本」：判分后自动收录、按知识点分组、页内答题与本地判分、间隔复习
- 左侧栏「知识库管理」：列表 / 新建 / 改名 / 删除 / 设为默认 / 文档预览 / 外部打开
- 环境准备：页面上的「准备学习环境」按钮，调用 `scripts/setup.ps1` 建 venv、装依赖、写配置、拉模型、起 embedding 服务
- 运行时指针：启动时把 `pluginRoot` / `python` / `bookctl` / `vizTemplate` 写进工作区 `.dsh-study/env.json`
- 书籍生成：`scripts/bookctl.py` 封装 `BookEngine`，五步流水线（create → spine → reorder → compile → export）
- 画图模板：`scripts/viz-template.html`，含脚本被禁时的静态兜底

已知限制：

- 仅 Windows（`explorer.exe`、PowerShell 安装脚本、盘符路径）
- 依赖已有 DeepSeek 凭据；embedding 必须本地跑模型（DeepSeek 无 embedding 接口）
- GenUI 为可选依赖，缺失时出题降级为 `ask_user_question`
