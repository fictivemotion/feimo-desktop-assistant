'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{JsonLines,decodeLine}=require('../lib/ocr-transport');
test('legacy frozen-worker Chinese is decoded from original GBK bytes without replacement characters',()=>{
 const raw=Buffer.from('7b226964223a20312c22726573756c74223a22d6d0cec4cec4d7d6cab6b1f0b2e2cad4227d','hex');assert.ok(raw.toString('utf8').includes('�'));const decoded=decodeLine(raw);assert.equal(decoded.message.result,'中文文字识别测试');assert.equal(decoded.encoding,'gb18030');
});
test('UTF-8 packets survive splits inside multibyte Chinese and emoji and multiple frames per chunk',()=>{
 const rows=[],parser=new JsonLines(r=>rows.push(r)),bytes=Buffer.from(JSON.stringify({id:1,result:'中文 · café · 🧐 · 𝑥²'})+'\r\n'+JSON.stringify({id:2,result:'| 项目 | 数量 |\n| 苹果 | 12 |'})+'\n');for(const byte of bytes)parser.push(Buffer.from([byte]));assert.equal(rows[0].result,'中文 · café · 🧐 · 𝑥²');assert.equal(rows[1].result,'| 项目 | 数量 |\n| 苹果 | 12 |');
});
test('ASCII JSON escapes preserve Chinese in text, table, translation boxes and error messages',()=>{
 const rows=[],parser=new JsonLines(r=>rows.push(r));parser.push(Buffer.from('{"ready":true,"protocol":"json-ascii-v1"}\n{"id":1,"result":"\\u4e2d\\u6587"}\n{"id":2,"result":{"lines":[{"text":"\\u4e2d\\u6587","x":1}]}}\n{"id":3,"error":"\\u4e2d\\u6587"}\n','ascii'));assert.equal(rows[1].result,'中文');assert.equal(rows[2].result.lines[0].text,'中文');assert.equal(rows[3].error,'中文');
});
test('legacy encoding is retained for subsequent short frames, new worker protocol resets it',()=>{
 const rows=[],parser=new JsonLines(r=>rows.push(r));parser.push(Buffer.concat([Buffer.from('{"result":"','ascii'),Buffer.from('d6d0cec4','hex'),Buffer.from('"}\n')]));assert.equal(parser.encoding,'gb18030');parser.push(Buffer.from('{"ready":true,"protocol":"json-ascii-v1"}\n'));assert.equal(parser.encoding,'utf-8');parser.push(Buffer.from('{"result":"你好"}\n'));assert.equal(rows.at(-1).result,'你好');
});
test('non-JSON diagnostics are ignored while malformed or oversized frames fail explicitly',()=>{
 const rows=[],parser=new JsonLines(r=>rows.push(r),{maxBytes:32});parser.push(Buffer.from('loading OCR\n'));assert.deepEqual(rows,[]);assert.throws(()=>parser.push(Buffer.from('{not json}\n')),/格式无效/);assert.throws(()=>new JsonLines(()=>{},{maxBytes:4}).push(Buffer.from('12345')),/过大/);
});
