'use strict';
/** 模型网关（P0-2）：OpenAI 兼容接口，用户自带凭据，流式输出。
 *  密钥经 safeStorage(DPAPI) 加密存储；无凭据时给出明确空状态，不猜测默认服务。
 */

class LlmGateway {
  constructor({ getSecret, settings }) {
    this.getSecret = getSecret;       // async (name) => string|null
    this.settings = settings;         // settings store
    this.abort = null;
  }

  isConfigured() {
    const s = this.settings.get('llm', {});
    return !!(s.baseUrl && s.model);
  }

  async chatStream({ messages, onDelta, signal }) {
    const s = this.settings.get('llm', {});
    if (!s.baseUrl || !s.model) {
      const err = new Error('未配置模型服务：请在 设置 → 模型服务 中填写接口地址与模型名');
      err.code = 'NOT_CONFIGURED';
      throw err;
    }
    const apiKey = await this.getSecret('llmApiKey');
    const url = s.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const body = {
      model: s.model,
      messages: [
        ...(s.systemPrompt ? [{ role: 'system', content: s.systemPrompt }] : []),
        ...messages,
      ],
      stream: true,
      // DeepSeek's official Chat Completions switch disables server-side thinking.
      // Do not send provider-specific fields to unrelated compatible endpoints.
      ...(/(^|\.)deepseek\.com$/i.test(new URL(s.baseUrl).hostname)
        ? { thinking: { type: 'disabled' } } : {}),
    };
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      const err = new Error('网络错误：无法连接 ' + s.baseUrl + '（' + (e.cause?.code || e.message) + '）');
      err.code = 'NETWORK';
      throw err;
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      const err = new Error(`接口错误 HTTP ${res.status}：${detail || res.statusText}`);
      err.code = res.status === 401 ? 'AUTH' : res.status === 429 ? 'RATE_LIMIT' : 'HTTP_' + res.status;
      throw err;
    }
    const emitContent = (content) => {
      const delta = Array.isArray(content)
        ? content.map((part) => typeof part === 'string' ? part : part?.text || '').join('')
        : content;
      if (typeof delta === 'string' && delta) { full += delta; onDelta?.(delta, full); }
    };
    let full = '';
    if ((res.headers?.get('content-type') || '').includes('application/json')) {
      const obj = await res.json();
      if (obj.error) throw new Error('模型返回错误：' + (obj.error.message || JSON.stringify(obj.error)));
      emitContent(obj.choices?.[0]?.message?.content || obj.choices?.[0]?.delta?.content);
      return full;
    }
    if (!res.body) throw new Error('接口未返回数据流');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    const processLine = (line) => {
      if (!line.startsWith('data:')) return false;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return true;
      let obj;
      try { obj = JSON.parse(data); } catch { return false; }
      const errMsg = obj.choices?.[0]?.delta?.error || obj.error;
      if (errMsg) throw new Error('模型返回错误：' + (errMsg.message || JSON.stringify(errMsg)));
      emitContent(obj.choices?.[0]?.delta?.content || obj.choices?.[0]?.message?.content);
      return false;
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (processLine(line)) { reader.cancel().catch(() => {}); return full; }
      }
    }
    buf += decoder.decode();
    if (buf.trim()) processLine(buf.trim());
    return full;
  }

  /** 一次性（非流式）调用，用于 AI 校对等辅助动作 */
  async complete(text, { signal } = {}) {
    let acc = '';
    await this.chatStream({ messages: [{ role: 'user', content: text }], onDelta: (d) => { acc += d; }, signal });
    return acc;
  }

  async testConnection() {
    const s = this.settings.get('llm', {});
    if (!s.baseUrl) return { ok: false, message: '未填写接口地址' };
    try {
      const r = await fetch(s.baseUrl.replace(/\/+$/, '') + '/models', {
        headers: { Authorization: `Bearer ${(await this.getSecret('llmApiKey')) || ''}` },
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) return { ok: true, message: '连接成功' };
      return { ok: false, message: `HTTP ${r.status}：${r.statusText}` };
    } catch (e) {
      return { ok: false, message: '连接失败：' + e.message };
    }
  }
}

module.exports = { LlmGateway };
