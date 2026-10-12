# 区域截图与剪贴板

按 **Ctrl + Shift + A**，拖动选择屏幕区域。也可从顶部胶囊快捷工具、精灵弧形工具栏、工作台剪贴板中启动。快捷键可在设置中修改；如果与其他软件冲突，设置页会显示注册失败。

选区界面在应用启动时预加载，快捷键不再等待整屏截图。选择时显示实时桌面，选定后只捕获该区域的原始屏幕像素，不使用缩略图。拖动四边或四角可调整区域，鼠标右键重新选择；调整区域后重新抓取，原标注会清空。

选区工具栏支持矩形、圈选、线条、箭头、画笔、文字、颜色与线宽、马赛克、撤销、重新选区、识别文字/表格/公式、图片翻译、取色与保存。**✓** 将当前选区和标注复制到系统剪贴板并存入本机加密历史；**× / Esc** 取消。识别结果可编辑后复制，普通表格以 Markdown 输出，合并单元格表格以 HTML 保留合并关系，公式为 LaTeX。

在任意位置按住鼠标中键 **0.5 秒**，显示剪贴板浮窗。点击图片缩略图或文字记录进行复制；点击外部区域或 × 关闭。移动超过 8 像素不会触发，避免打断中键拖动。工作台剪贴板可关闭中键入口。该检测不安装拦截式键盘/鼠标钩子，不阻止其他程序接收输入。

## 快速本机 OCR（默认）

默认使用 RapidOCR 轻量文字识别、SLANet-plus 表格结构识别、LaTeX-OCR 公式识别，均通过 CPU ONNX Runtime 在本机运行。文字输出正文，表格输出 HTML 保留行列 / 合并，公式输出 LaTeX。选区不会上传；清洗 / 翻译只发送已识别的文字。

需要 Python 3.11 / 3.12。从源码运行 powershell -ExecutionPolicy Bypass -File scripts/install-fast-ocr.ps1，下载依赖及约 200 MB 模型。安装后在设置中选择“快速本机 OCR”。运行环境和模型位于 %LOCALAPPDATA%/Feimo/model-runtime/rapid；若经 MSIX 工具部署，可通过 capture.fastRuntime 保留实际运行目录。模型不随安装包发布。启动时预热，后续使用同一工作进程，退出时关闭。超时 / 失败会显示原因，可取消，不静默等待。

本机样例实测：文字 1.35 秒、表格 1.02 秒、公式 0.28 秒，模型缓存后的初始化约 3.3 秒。这些是样例耗时，完整页面和复杂公式的耗时会更高。

来源：[RapidOCR](https://github.com/RapidAI/RapidOCR)、[RapidTable](https://github.com/RapidAI/RapidTable)、[RapidLaTeXOCR](https://github.com/RapidAI/RapidLaTeXOCR)。依赖和权重的许可保留在独立本机环境中。

## 本机 Xiaomi-OCR-0（备选）

Xiaomi-OCR-0 仍可选用，选区图片不会上传。推荐 Windows Ollama：

1. 从 [Ollama 官方网站](https://ollama.com/download/windows) 安装 Windows 运行环境并启动本机服务。
2. 在终端运行 `ollama pull longwayxu/xiaomi-ocr-0:bf16` 下载约 1.8 GB 的社区 BF16 转换模型（含视觉投影）。
3. 设置 → 区域截图与识别：选择本机 Xiaomi-OCR-0、Ollama、地址 `http://127.0.0.1:11434`、模型 `longwayxu/xiaomi-ocr-0:bf16`。
4. 点击“检查本机模型”。首次提取会加载模型，后续保留约 5 分钟，闲置后释放显存。

本机托管运行环境放在 `%LOCALAPPDATA%\Feimo\model-runtime\ollama`，模型在相邻 `models` 文件夹。若该环境已部署，斐墨会按需启动它；你自己启动的 Ollama 服务会被复用，退出斐墨不会关闭它。模型不随安装包分发，不进入 Git 仓库。公共版与私人版使用相同的截图功能。

已有 SGLang / vLLM 服务的用户可选择 OpenAI 兼容运行方式，填写本机 `/v1` 地址和 `SeerRay-Lab/Xiaomi-OCR-0` 模型名。本机模式仅接受 loopback 地址。

模型来源：[Xiaomi-OCR-0](https://github.com/SeerRay-Lab/Xiaomi-OCR-0)。Ollama 为上游实验性运行路径，复杂公式可能遗漏符号；请核对原图。它的识别准确率不等同于原生 vLLM / SGLang 的基准结果。

## 清洗、翻译与可选在线识别

- 提取并清洗：本机 OCR 识别结果送到已配置的 **DeepSeek Flash 非思考模式**进行文本整理。
- 图片翻译：Windows 本机 OCR 获取文字位置，DeepSeek 翻译识别文字，译文覆盖到图片对应位置；可撤销。图片留在本机，翻译需要清洗页已有 DeepSeek 密钥和相应 Windows OCR 语言包。
- 可选 Qwen 视觉识别：设置中显式选择在线服务才发送当前选区图片；可填专用密钥或复用已有语音识别的 Qwen 密钥。密钥仅通过 Windows DPAPI 加密保存。

截图只在快捷键或按钮主动触发时读取屏幕。剪贴板自动记录默认关闭；手动截图确认会加入历史。单图最多约 18 MB PNG、总历史约 48 MB PNG 编码预算、最多 80 条；超限会淘汰未固定的旧记录。
