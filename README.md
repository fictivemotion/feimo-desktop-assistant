<div align="center">

# 斐墨 · Feimo

**A small desktop companion for quick everyday tasks.**

悬浮桌宠 · 剪贴板速清 · 本地 OCR · Coding 会话提醒 · Token 用量 · Notion 日程

[下载 Windows 版本](https://github.com/fictivemotion/feimo-desktop-assistant/releases/latest) · [功能介绍](#功能一览) · [隐私说明](docs/PRIVACY.md) · [发布记录](RELEASE_NOTES.md)

</div>

![斐墨桌面助手功能总览](docs/images/feimo-overview.svg)

斐墨是一款轻量 Windows 桌面助手。桌面上保留一个可拖动、可贴边的小宠物；需要处理事情时，用全局快捷键或点击宠物唤起工作栏。它适合快速问答、清理复制文本、从截图提取文字、查看 Coding Agent 状态、浏览 Token 用量和接收日程提醒。

斐墨只在用户主动操作时读取剪贴板；Agent 监控和 Notion 日程同步均为只读。模型接口、API 密钥和 Notion 凭据由用户自行配置。

## 功能一览

![斐墨常用操作流程图](docs/images/feimo-workflows.svg)

| 功能 | 用法 |
| --- | --- |
| 桌面小宠物 | 单击展开工作栏；拖动移动，靠近屏幕边缘时吸附；气泡会按屏幕位置选择朝向 |
| 快速文本清洗 | `Alt+Shift+O` 清理剪贴板文字并自动复制结果；支持删除段落空行、清除 OCR 字间空格、去除无效符号等 |
| 截图转文字 | `Alt+Shift+T` 识别剪贴板图片，在本机完成 OCR 与格式清洗，再把结果复制回剪贴板 |
| AI 问答与润色 | 配置 OpenAI 兼容服务后使用流式问答和显式触发的润色；可复制完整回答或纯文本 |
| Coding Agent 观察 | 只读观察本机 Codex、ZCode、WorkBuddy 的会话进度，提供状态变化提示 |
| 用量汇总 | 按工具和模型查看输入、输出与缓存 Token 用量，提供本地热力图与 CSV 导出 |
| 日程提醒 | 记录本地日程；可选连接 Notion 数据库进行只读同步 |

更多细节见[隐私说明](docs/PRIVACY.md)和[发布记录](RELEASE_NOTES.md)。

## 快捷键

| 快捷键 | 操作 |
| --- | --- |
| `Alt+Shift+P` | 唤起 / 收起工作栏 |
| `Alt+Shift+T` | 剪贴板图片 → 本地 OCR → 清洗并复制文字 |
| `Alt+Shift+O` | 剪贴板文本 → 清洗并复制结果 |
| `Esc` | 收起工作栏 |

快捷键可在“设置 → 全局热键”中更改。若按键冲突，应用会显示注册失败的组合键。

## 下载与启动

1. 从 [GitHub Releases](https://github.com/fictivemotion/feimo-desktop-assistant/releases/latest) 下载 Windows x64 安装程序，或选择便携版。
2. 安装后启动“斐墨”。托盘菜单可打开设置、管理提醒或退出应用。
3. AI 服务和 Notion 日历是可选配置；不配置时，桌宠、文本清洗、本机 OCR、Agent 监控和本地用量仍可使用。

Releases 提供 Windows x64 NSIS 安装程序和便携版。当前发行包未进行代码签名，Windows SmartScreen 可能显示发布者未知。

## 从源码运行

要求：Windows 10/11 x64、Node.js 22 或更新的 LTS 版本、npm。

桌面形象固定为伊埃斯。公开源码不附带伊埃斯图集；如需显示精灵动画，需自行提供允许本机使用的素材并放入 `assets/pets/eous/`。公开 Release 还要求素材授权明确允许再分发。

```powershell
npm ci
npm start
```

Windows 系统 OCR 通过 PowerShell 与 WinRT 调用，不需要额外下载 OCR 模型。要在 Windows 本机打包：

```powershell
npm ci
npm run dist:win
```

生成文件位于 `release/`。推送形如 `v1.0.1` 的版本标签后，GitHub Actions 会构建安装程序与便携版并创建 Release；发布流程见 [RELEASE.md](RELEASE.md)。

## 隐私与素材

- API 密钥和 Notion Token 只从设置中输入，并使用 Electron `safeStorage` 加密保存在本机用户数据目录。
- 剪贴板只在按下快捷键或主动使用处理页时读取；OCR 在 Windows 本机运行。
- Agent 会话日志和 Token 用量由本机读取与聚合，不会上传到斐墨服务。
- 调用 AI 服务时，用户明确发送的文本会发往用户配置的模型服务商。
- 本仓库不包含真实日程、问答历史、API 密钥、Notion Token、本机截图或应用用户数据。
- 桌面形象仅保留伊埃斯。伊埃斯图集按本机素材加载，不包含在公开源码或发行包中；公开 Release 需要先提供允许再分发的素材授权文件。
- 为避免擅自传播第三方形象，公开仓库不提供其他桌宠素材，也不提供替代桌宠。

## 许可证

应用源码按 [MIT License](LICENSE) 授权。第三方素材与依赖继续适用各自许可证。
