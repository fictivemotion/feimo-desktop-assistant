# Release notes

## 1.1.1

- 修复 Codex 用量模型固定显示 `unknown`：从真实回合上下文识别 `gpt-6.1-sol` 等模型，切换模型后仍按对应回合归类。
- 自动补全已有记录的模型名称，保留原始 Token 和记录数量，重复采集不重复计数；没有价格配置的模型显示“价格未配置”。
- Codex 额度改为通过本机原生 CLI 的只读账户接口主动查询，启动和每分钟刷新；用量页新增“刷新额度”按钮、来源、更新时间和查询失败提示。
- 修复较旧会话覆盖新额度的问题；显示真实窗口时长、已用 / 剩余比例和重置时间，过期观测值明确标记等待刷新。
- 额度查询不创建会话、不发起模型请求，也不读取或复制账号密钥。

## 1.1.0

- 弧形工具新增三组快捷功能，支持滚轮、沿弧线拖动和方向键翻页；保留紧凑的三个按钮和逐个过渡动画。
- 新增剪贴板管理：文字与图片历史、搜索、固定、复制、删除，以及默认关闭的后台自动记录开关。
- 新增速记：助手旁直接记录，工作台编辑、检索、Markdown 预览、复制与导出。
- 新增配色工具：精选色卡、主色生成邻近 / 互补 / 三角色搭配、HEX / RGB / 文字对比度，以及复制与本机收藏。
- 工具箱内容由 Windows DPAPI 加密保存；历史数量和大小有上限，常见密钥格式不进入剪贴板历史。
- 新增日程和 Coding 状态提示卡片、Codex 额度卡片；额度提醒按 80% / 95% 阈值去重，只显示有效观测数据。已有回复保留时，提示嵌入回复卡片。

- 重构工作台：统一页标题、主要操作、卡片与表单；日程列表和新建日程、计时和统计记录分别显示；设置按常规、模型、快捷键、连接和隐私分类。
- 优化较小窗口和多显示器布局，默认工作台扩大到 520 × 740，并按当前显示器可用区域调整。
- 修复用量页从“暂无数据”切换到实时数据时的渲染错误。
- 快捷提问后立即显示“让我想想喔 💭”，随后逐步渲染流式回复。
- 分段回复保留为气泡组；点击后层气泡或翻页按钮切换到前台，支持复制全文、停止回答和关闭。长段落与代码块在气泡内滚动，完整内容不会截断。
- 气泡从下方淡入、向上淡出，切换采用轻柔过渡；浮层无阴影，并保留原生圆角抗锯齿空间。
- 两处问答共享安全 Markdown 渲染，支持标题、强调、列表、表格与代码块。修复旧消息的纯文本复制和重试，以及忙碌时新草稿丢失的问题。
- 官方 DeepSeek 接口显式发送 `thinking.type = disabled`，保留 SSE 流式输出；其他兼容接口不发送 DeepSeek 专属参数。
- 增加 Windows 开机自启动开关与创建桌面快捷方式，便携版指向原始 EXE 而非临时解压目录。
- 优化输入和二级编辑的焦点保留、贴边时的气泡交互，以及气泡组与快捷工具、计时器和工作栏的避让。

## 1.0.0

First public source release of 斐墨 (Feimo), a lightweight Windows desktop companion.

- Floating pet and compact workbar for quick tasks.
- Clipboard text cleanup and local screenshot OCR shortcuts.
- Streaming chat through a user-configured OpenAI-compatible endpoint.
- Read-only local Coding Agent status and token usage summaries.
- Optional local reminders and read-only Notion calendar sync.
- Hover quick chat, compact arc tools, a speech bubble with a round connector, and one-step schedule creation.
- Persistent countdown and Pomodoro sessions with task labels, a close button, yesterday/month/year bars, and a yearly activity heatmap.
- Forest Flow and Iridescent Opal WebGPU orb companions; the workbar icon follows the selected companion.
- Improved edge-peek artwork, rounded floating controls, and automatic collision avoidance near screen edges.
- Fixed duplicate completed Agent notices that could occur when the same status arrives again with a new timestamp.
- Windows x64 NSIS installer and portable package are built and published by the version-tag GitHub Actions workflow.

伊埃斯 is the only character-based companion; the other two appearances are shader-based orbs. The fan-made 伊埃斯 artwork is included under its separate CC BY-NC-SA 4.0 license; the root MIT license applies to software source code only. The original character and related IP belong to miHoYo / HoYoverse.
