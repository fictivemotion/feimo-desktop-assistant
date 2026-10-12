'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{sectionFor}=require('../lib/release-section');
test('release titles with descriptions and Windows line endings produce correct version notes',()=>{const notes='# 发布记录\r\n\r\n## 1.8.10 · Future\r\nfuture\r\n## 1.8.1 · 动作更新\r\ncurrent\r\n## 1.8.0\r\nold';assert.match(sectionFor(notes,'1.8.1'),/current/);assert.match(sectionFor(notes,'1.8.0'),/old/);assert.equal(sectionFor(notes,'1.8.2'),undefined);});
