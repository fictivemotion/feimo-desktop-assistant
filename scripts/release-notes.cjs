'use strict';
const fs=require('node:fs');const version=require('../package.json').version,notes=fs.readFileSync('RELEASE_NOTES.md','utf8'),section=notes.split(/^## /m).find(s=>s.startsWith(version+'\n')||s.startsWith(version+'\r\n'));
if(!section)throw new Error('Missing release notes for '+version);
const base=`https://github.com/fictivemotion/feimo-desktop-assistant/blob/v${version}`;
process.stdout.write(section.replace(/^[^\n]+\n/,'').trim()+`\n\n[完整功能和隐私说明](${base}/README.md) · [语音使用指南](${base}/docs/斐墨-语音输入使用与技术说明.md)\n\n![斐墨语音统计（演示数据）](https://raw.githubusercontent.com/fictivemotion/feimo-desktop-assistant/v${version}/docs/images/voice-statistics.png)\n`);
