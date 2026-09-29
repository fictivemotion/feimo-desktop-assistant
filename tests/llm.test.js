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
