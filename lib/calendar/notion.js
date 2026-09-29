'use strict';
/** Notion 数据库日程连接器（§6.3）。
 *  用户在设置中提供：Integration Token（DPAPI 加密）、数据源 ID、标题属性名、日期属性名。
 *  通过官方 API 查询授权数据源的日期属性；结果标注"来源：Notion 数据库"，
 *  不声称等同 Notion Calendar。cron:// 仅在知道 iCalUID 时作跳转，此处不用。
 */
const NOTION_VERSION = '2025-09-03';
const API = 'https://api.notion.com/v1';

class NotionCalendarConnector {
  constructor({ getSecret, settings }) {
    this.getSecret = getSecret;
    this.settings = settings;
    this.lastError = null;
    this.lastSyncAt = null;
  }

  isConfigured() {
    const s = this.settings.get('notion', {});
    return !!(s.databaseId && s.dateProperty);
  }

  /** 拉取窗口 [-7d, +30d] 的事件，返回 CalendarItem[] */
  async sync() {
    const s = this.settings.get('notion', {});
    if (!s.databaseId || !s.dateProperty) {
      throw Object.assign(new Error('Notion 未配置：请在 设置 → 日程同步 中填写数据源 ID 与日期属性名'), { code: 'NOT_CONFIGURED' });
    }
    const token = await this.getSecret('notionToken');
    if (!token) {
      throw Object.assign(new Error('缺少 Notion Integration Token（ntn_ 开头）'), { code: 'NO_TOKEN' });
    }
    const titleProp = s.titleProperty || 'Name';
    const dateProp = s.dateProperty;
    const now = Date.now();
    const from = new Date(now - 7 * 86400000).toISOString();
    const to = new Date(now + 30 * 86400000).toISOString();

    const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' };
    // A database is a container; since the 2025 API the query requires its data source ID.
    let dataSourceId = s.dataSourceId;
    if (!dataSourceId) {
      const databaseRes = await fetch(`${API}/databases/${encodeURIComponent(s.databaseId)}`, { headers, signal: AbortSignal.timeout(20000) });
      if (!databaseRes.ok) throw Object.assign(new Error(`Notion 数据库不可访问（HTTP ${databaseRes.status}）`), { code: 'BAD_CONFIG' });
      const database = await databaseRes.json();
      dataSourceId = database.data_sources?.[0]?.id;
      if (!dataSourceId) throw Object.assign(new Error('Notion 数据库没有可查询的数据源'), { code: 'BAD_CONFIG' });
    }
    const query = {
      filter: { and: [
        { property: dateProp, date: { on_or_after: from.slice(0, 10) } },
        { property: dateProp, date: { on_or_before: to.slice(0, 10) } },
      ] },
      page_size: 100,
    };
    const pages = [];
    do {
      const res = await fetch(`${API}/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
        method: 'POST', headers, body: JSON.stringify(query), signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
        if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Notion 授权失败：Token 无效或未授权该数据源（' + detail + '）'), { code: 'AUTH' });
        if (res.status === 400 || res.status === 404) throw Object.assign(new Error('Notion 查询失败：请检查数据源 ID / 日期属性名（' + detail + '）'), { code: 'BAD_CONFIG' });
        if (res.status === 429) throw Object.assign(new Error('Notion 限流：请稍后重试'), { code: 'RATE_LIMIT' });
        throw new Error(`Notion 接口错误 HTTP ${res.status}：${detail || res.statusText}`);
      }
      const data = await res.json();
      pages.push(...(data.results || []));
      query.start_cursor = data.has_more ? data.next_cursor : undefined;
    } while (query.start_cursor);
    const items = [];
    for (const page of pages) {
      const props = page.properties || {};
      const dateVal = props[dateProp]?.date;
      if (!dateVal?.start) continue;
      const titleArr = props[titleProp]?.title || props.Name?.title || props[titleProp]?.rich_text || [];
      const title = titleArr.map((t) => t.plain_text || '').join('').trim() || '（无标题）';
      const isDateTime = /:\d\d/.test(dateVal.start);
      items.push({
        source: 'notion',
        externalId: page.id,
        title,
        startsAtUtc: isDateTime ? new Date(dateVal.start).toISOString() : new Date(dateVal.start + 'T00:00:00').toISOString(),
        endsAtUtc: dateVal.end ? (isDateTime ? new Date(dateVal.end).toISOString() : new Date(dateVal.end + 'T23:59:59').toISOString()) : null,
        allDay: !isDateTime,
        sourceUrl: page.url,
        updatedAt: page.last_edited_time || new Date().toISOString(),
        reminderOffsets: s.reminderOffsets || [15],
        syncStatus: 'ok',
      });
    }
    this.lastSyncAt = new Date().toISOString();
    this.lastError = null;
    return items;
  }
}

module.exports = { NotionCalendarConnector };
