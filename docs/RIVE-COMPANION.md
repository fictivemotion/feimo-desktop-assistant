# 斐墨 Rive 伙伴

原创黑色圆形主体、白色双眼，无嘴巴。视线居中朝向屏幕外，使用轻微弹性形变、呼吸、眨眼、开心眯眼和疑惑表情表达状态。小精灵、顶部胶囊和工作台使用同一份真实 `.riv` 文件与状态契约。

| 场景 | 动作 |
| --- | --- |
| 待机 | 呼吸与随机眼神、大小眼、左右 wink、双眨眼、左右看、点头、打盹、伸懒腰 |
| 音乐 / 白噪音 | 戴耳机、随节奏轻晃、浮动音符、眯眼笑 |
| 倒计时 / 专注 | 写字；约每 24 秒举杯喝咖啡 |
| 休息 | 喝咖啡 |
| 思考 / Coding | 疑惑眼神、浮动问号 |
| 提醒 / 需要输入 | 感叹号轻弹 |
| 完成 | 开心眼睛、轻跳、勾号 |
| 失败 | 轻摇、失落眼睛、错误标记 |
| 语音 | 快速双手敲键盘；暂停时休息 |
| 流式回答 | 轻微律动与波形 |
| 招呼 / 点击 | 眯眼、摇摆回应 |
| 拖动 | 轻拉伸与回摆 |
| 工作台 | 轻微点缀与呼吸 |

Rive 状态机 `Feimo` 绑定 ViewModel `Feimo.mode`。24 个模式（15 个情境、9 个随机待机动作）编号见 `assets/pets/feimo-rive/modes.json`。动画以 60 fps 创作，状态间使用 320 ms 混合；系统减少动态效果时，过渡后暂停为静态画面。隐藏窗口暂停渲染。运行时、WASM 与素材均随应用本地分发，无 CDN 依赖。

待机动作间隔随机为 8–18 秒，连续两次不会相同。每次动作结束回到正面；打盹需至少闲置一分钟。提醒、录音和任务立即打断待机动作，随机待机不发提示音。系统减少动态效果设置会禁用随机待机。

## 可编辑资产

- `assets/pets/feimo-rive/feimo.riv`：发布用 Rive 二进制。
- `assets/pets/feimo-rive/source/scene.rml`：完整矢量、时间轴、状态机。
- `scripts/build-feimo-rive.cjs`：可重复生成源文件与二进制。安装官方 [Rive CLI](https://rive.app/docs/cli/getting-started)，设置 `RIVE_CLI` 为可执行文件路径后运行 `npm run build:rive`。已验证 CLI 1.5.1。
- `npm run build:companion-runtime`：从锁定的 npm 依赖复制本地 Rive runtime 并构建 uisfx 播放器。

本资产未嵌入 Rive Scripts，不需要在线签名才能播放。保留 RML 源文件供后续调整动作。

## 提示音与顶部精灵

采用 Mochi UI Sounds 氛围音效：能量、弹泡、金币。设置可调整音量与关闭。全应用唯一播放器，本地 Web Audio 合成。语音开始提示在麦克风采集前完成，录音及校对期间停止音效；整理结束后金币提示。完整交互见 [顶部精灵说明](TOP-SPRITE.md)。

## 许可

原创角色、RML、状态映射与构建脚本沿用本项目 MIT 许可。Rive Web runtime 使用 MIT（assets/vendor/rive/LICENSE）。Mochi 来源及复制说明见 assets/vendor/mochi/UPSTREAM.md，上游模块没有被改标为本项目的原创代码。角色未复制 Grok 或 OpenAI 的图形资产。
