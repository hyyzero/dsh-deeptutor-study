# Changelog

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
