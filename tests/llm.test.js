'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LlmGateway } = require('../lib/llm');

const gateway = () => new LlmGateway({
  getSecret: async () => null,
  settings: { get: () => ({ baseUrl: 'https://example.test/v1', model: 'test' }) },
});

test('模型流分块到达时逐块输出并拼接完整回答', async () => {
  const original = global.fetch;
  const encoder = new TextEncoder();
  global.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你'));
      controller.enqueue(encoder.encode('好"}}]}\n\ndata: {"choices":[{"delta":{"content":"！"}}]}\n\ndata: [DONE]\n\n'));
      controller.close();
    },
  }), { headers: { 'content-type': 'text/event-stream' } });
  try {
    const deltas = [];
    const reply = await gateway().chatStream({ messages: [{ role: 'user', content: '问候' }], onDelta: (d, full) => deltas.push([d, full]) });
    assert.equal(reply, '你好！');
    assert.deepEqual(deltas, [['你好', '你好'], ['！', '你好！']]);
  } finally { global.fetch = original; }
});

test('兼容返回普通 JSON 的模型接口', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '已完成' } }] }), { headers: { 'content-type': 'application/json' } });
  try {
    const deltas = [];
    const reply = await gateway().chatStream({ messages: [], onDelta: (d) => deltas.push(d) });
    assert.equal(reply, '已完成');
    assert.deepEqual(deltas, ['已完成']);
  } finally { global.fetch = original; }
});

test('DeepSeek 请求关闭思考，保留流式模式，其他兼容接口不携带专属参数', async () => {
  const original = global.fetch, requests = [];
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: '你好' } }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const deepseek = new LlmGateway({ getSecret: async () => null, settings: { get: () => ({ baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' }) } });
    await deepseek.chatStream({ messages: [] });
    await gateway().chatStream({ messages: [] });
    assert.deepEqual(requests[0].thinking, { type: 'disabled' });
    assert.equal(requests[0].stream, true);
    assert.equal('thinking' in requests[1], false);
  } finally { global.fetch = original; }
});

test('首段文字在整个流结束前到达，思考字段不渲染进回答', async () => {
  const original = global.fetch, encoder = new TextEncoder();
  let stream, resolveFirst;
  const first = new Promise(resolve => { resolveFirst = resolve; });
  global.fetch = async () => new Response(new ReadableStream({ start(controller) { stream = controller; } }), { headers: { 'content-type': 'text/event-stream' } });
  try {
    let completed = false;
    const pending = gateway().chatStream({ messages: [], onDelta: d => resolveFirst(d) }).then(text => { completed = true; return text; });
    await new Promise(resolve => setImmediate(resolve));
    stream.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}\n\ndata: {"choices":[{"delta":{"content":"第一段"}}]}\n\n'));
    assert.equal(await first, '第一段');
    assert.equal(completed, false);
    stream.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"第二段"}}]}\n\ndata: [DONE]\n\n')); stream.close();
    assert.equal(await pending, '第一段第二段');
  } finally { global.fetch = original; }
});
