# Release notes

## 1.3.0

- 新增斐墨语音：全局 Ctrl+Alt+Space 切换听写，真实音量波形胶囊、暂停 / 继续、结束及取消。
- Qwen 最新 3.1 实时识别；离线 sherpa-onnx 双语模型按需下载，兼容 CapsWriter Float32 服务和 OpenAI 转录接口。
- 听写实时写入外部输入框；结束后热词纠正、AI 校对并复制全文。只替换本段，切换焦点、移动光标或编辑后停止替换。
- 语音工作台提供服务 / 麦克风 / 快捷键、热词与 TXT 导入导出、角色提示词、独立 DPAPI 密钥。DeepSeek Flash 显式关闭思考。
- 弧形工具新增语音组，工作台麦克风入口；遵循渐隐油画 Header、白色卡片、统一圆角及 Reicon Filled。
- 修复 Windows UI Automation 更新后的旧范围缓存问题，保留目标前后文；录音退出与取消释放资源，不保存音频历史。
- 96 项自动测试通过，并验证合成语音的离线识别、真实 Qwen + DeepSeek 校对与 Windows 选区替换。

## 1.2.4

- 消除 Header 下沿的横向硬切：背景整体末端更早完全透明，正文位于独立前景层。
- 内容滚动时，上沿 44 px 自然渐隐；回到顶部恢复完整显示，避免白色卡片被突然截断。
- 设计规范补充滚动交界、图层隔离与末端透明验收规则。

## 1.2.3

- Header 采用 2 / 6 / 14 px 分层 Progressive Blur，装饰背景延伸到下方内容起始处，再自然淡出；正文和按钮保持清晰。
- 修复安装版 OCR 不能执行 `app.asar` 内脚本的问题，改为在本机临时目录执行；自动语言优先已安装中文引擎，并兼容英文。
- 修复超大图片只计算缩放但未实际缩小、识别框坐标被重复缩放的问题；规范识别位图格式与临时文件清理。
- 图片识别失败按语言包、进程和超时分别提示，避免把所有故障误报为语言包缺失。
- 新增通用 UI 设计规范和可复用 CSS 原语，统一背景、圆角、HarmonyOS Sans、Reicon Filled、间距、状态和动效。

## 1.2.2

- 问答、处理、会话、用量、日程、倒计时、设置、快捷工具与学习空间共用像素半调油画 Header，白色毛玻璃遮罩与画面向下渐隐。
- 移除白噪音页面和快捷卡片内部的油画背景，使用简洁纯白主体，不添加外部阴影。
- 调整学习空间子页签顺序，声音资料库不会遮挡导航；长任务标签和知识卡片标题限制展示高度，正文仍完整可读。
- 保留已连接的学习账号、API 设置、双向计时与独立白噪音播放。

## 1.2.1

- 修复学习账号登录窗口唤起不可靠：显式显示、与工作台同屏居中及置顶；重复点击会恢复登录窗口，关闭后返回学习页。
- 学习页显示登录窗口状态，加载失败时给出反馈。

## 1.2.0

- 新增闪念上岸学习互联：网站与斐墨共享计时状态，完成记录按相同 ID 入账；离线队列、版本冲突与幂等补传。
- 网站待办 / 周期任务成为计时标签；可从斐墨创建待办、切换完成状态；支持大量学习标签。
- 新增知识 / 错题卡与刷题统计提示：实际总题数、正确 / 错误数、正确率、模块统计与考试计划；安全渲染富文本及 KaTeX 数学公式。
- 弧形快捷区扩展为五组，增加学习卡片、任务、统计与白噪音入口。
- 接入网站完整 Moodist 白噪音目录：84 个音源、8 类目录、4 组预设；最多三个声音混合、独立音量、播放 / 暂停、检索。
- 新增原创春日田园油画与像素半调的白噪音二级卡片；下半纯白、高斯模糊过渡，与其他卡片一致的圆角，无外部阴影。
- 白噪音播放器独立于卡片，关闭卡片仍继续播放；重启后恢复混音但不自动播放。账号令牌、学习缓存与离线队列使用系统加密。


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
