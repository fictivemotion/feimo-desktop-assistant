'use strict';
const fs=require('node:fs');const version=require('../package.json').version,notes=fs.readFileSync('RELEASE_NOTES.md','utf8'),section=notes.split(/^## /m).find(s=>s.startsWith(version+'\n')||s.startsWith(version+'\r\n'));
if(!section)throw new Error('Missing release notes for '+version);
const base='https://github.com/fictivemotion/feimo-desktop-assistant/blob/v'+version,raw='https://raw.githubusercontent.com/fictivemotion/feimo-desktop-assistant/v'+version+'/';
process.stdout.write('![斐墨与 Bloub 功能总览]('+raw+'docs/images/feimo-overview.png)\n\n'+section.replace(/^[^\n]+\n/,'').trim()+'\n\n[完整功能与隐私说明]('+base+'/README.md) · [支持开发者]('+base+'/README.md#支持开发者)\n\n![Bloub 原版动作与斐墨场景]('+raw+'docs/images/bloub-states.png)\n\n![语音工作台（演示数据）]('+raw+'docs/images/voice-workbench.png)\n');
