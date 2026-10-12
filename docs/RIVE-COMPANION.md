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
| 语音 | 聆听波形；暂停时休息 |
| 流式回答 | 轻微律动与波形 |
| 招呼 / 点击 | 眯眼、摇摆回应 |
| 拖动 | 轻拉伸与回摆 |
| 工作台 | 轻微点缀与呼吸 |

Rive 状态机 `Feimo` 绑定 ViewModel `Feimo.mode`。23 个模式（14 个情境、9 个随机待机动作）编号见 `assets/pets/feimo-rive/modes.json`。动画以 60 fps 创作，状态间使用 320 ms 混合；系统减少动态效果时，过渡后暂停为静态画面。隐藏窗口暂停渲染。运行时、WASM 与素材均随应用本地分发，无 CDN 依赖。

待机动作间隔随机为 8–18 秒，连续两次不会相同。每次动作结束回到正面；打盹需至少闲置一分钟。提醒、录音和任务立即打断待机动作，随机待机不发提示音。系统减少动态效果设置会禁用随机待机。

## 可编辑资产

- `assets/pets/feimo-rive/feimo.riv`：发布用 Rive 二进制。
- `assets/pets/feimo-rive/source/scene.rml`：完整矢量、时间轴、状态机。
- `scripts/build-feimo-rive.cjs`：可重复生成源文件与二进制。安装官方 [Rive CLI](https://rive.app/docs/cli/getting-started)，设置 `RIVE_CLI` 为可执行文件路径后运行 `npm run build:rive`。已验证 CLI 1.5.1。
- `npm run build:companion-runtime`：从锁定的 npm 依赖复制本地 Rive runtime 并构建 uisfx 播放器。

本资产未嵌入 Rive Scripts，不需要在线签名才能播放。保留 RML 源文件供后续调整动作。

## 提示音

采用 [romainsimon/uisfx](https://github.com/romainsimon/uisfx)，在本地 Web Audio 中合成短提示音。设置 → 常规 → 伙伴提示音可关闭、调音量或选 Soft / Minimal / Zen。

全应用只运行一个提示音播放器，重复状态不重播，同类事件有冷却。录音准备、聆听、暂停、结束与校对阶段停止提示音，避免影响语音。不会为每次眨眼、鼠标经过或每一秒倒计时发声。

## 许可

原创角色、RML、状态映射与构建脚本沿用本项目 MIT 许可。Rive Web runtime 使用 MIT 许可（`assets/vendor/rive/LICENSE`）；uisfx 代码 MIT、音频 CC0，见 `assets/vendor/uisfx/`。角色仅参考简洁机器人表达方式，未复制 Grok 或 OpenAI 的图形资产。
