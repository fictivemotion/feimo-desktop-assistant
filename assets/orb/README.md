# 流体球素材来源

本目录的两个自包含 HTML 使用 [LerSent001/orb](https://github.com/LerSent001/orb) 的完整 WebGPU/WGSL 着色器、uniform 布局、渲染管线和网页导出运行时生成。上游版本：`8d1736e1fc5b41a5037b524403f35b7952b038f0`。上游许可见 [LICENSE](LICENSE)。

- `iridescent-opal.html`：上游 Iridescent Opal 预设。
- `forest-flow.html`：上游 Frost Flow 流场和玻璃材质，使用斐墨的森林绿配色。上游并无名为 Forest Flow 的独立预设。

两款形象均以实时 WebGPU 绘制，不是预录视频或静态图片。斐墨为其增加了 `idle`、`thinking`、`listening`、`agentWorking`、`attention`、`completed`、`failed` 的 uniform 状态，并通过 `postMessage` 从宠物窗口驱动状态过渡。待机色彩比上游默认闲置配置更明亮，流速则较慢。需要支持 WebGPU 的运行环境。
