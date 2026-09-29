'use strict';

const HOVER_LINES = [
  '嗨，我在这里。要不要把刚复制的文字整理一下？',
  '今天也一起慢慢来，先完成眼前这一小步。',
  '我正在留意你的日程和 Coding 会话。',
  '看到我啦！点一下就可以开始聊天。',
  '如果图片里有文字，直接粘贴给我就好。',
  '喝口水吧，灵感有时会在休息时冒出来。',
  '我刚刚眨了下眼，有没有被你发现？',
  '你负责想法，我负责把小事照看好。',
  '给今天的进度点个赞，已经走了这么远。',
  '遇到乱糟糟的文字？交给我梳梳毛。',
  '嘿，别让肩膀一直绷着，放松一下。',
  '点开日程，我们看看下一件重要的事。',
  '我会安静待着，有需要再叫我。',
];
const MORNING = ['早上好！今天想先处理哪件小事？', '新的一天开始啦，我陪你一起安排节奏。'];
const EVENING = ['晚上好。别忘了给今天的自己留一点休息时间。', '今天辛苦啦，想聊聊或整理一下思路吗？'];
const BREAK = ['已经专注好一阵子啦，起来活动一下肩颈吧。', '休息两分钟、看看远处，我会继续帮你留意进展。'];
const PLAY = ['被你发现啦！今天也要开心一点。', '转个圈圈，给你补充一点好心情。', '收到摸摸！我会继续乖乖守着桌面。', '嘿嘿，我也在等你和我说话。'];

function pickLine(kind, now = new Date(), random = Math.random) {
  const pool = kind === 'break' ? BREAK : kind === 'play' ? PLAY : kind === 'ambient'
    ? (now.getHours() < 11 ? MORNING : now.getHours() >= 19 ? EVENING : HOVER_LINES)
    : HOVER_LINES;
  const n = Math.max(0, Math.min(pool.length - 1, Math.floor(random() * pool.length)));
  return pool[n];
}

function noticeLine(n) {
  const title = String(n?.title || '这件事').replace(/[\r\n\t]+/g, ' ').slice(0, 42);
  const detail = String(n?.summary || '').replace(/[\r\n\t]+/g, ' ').slice(0, 72);
  switch (n?.kind) {
    case 'reminder': return `提醒你：${title}${detail ? '，' + detail : '，时间到啦。'}`;
    case 'needs_input': return `${title} 在等你的回复，我帮你看着呢。`;
    case 'completed': return `${title} 完成啦！要不要看看结果？`;
    case 'failed': return `${title} 遇到问题了，点我查看详情。`;
    default: return detail || `${title} 有新进展。`;
  }
}

module.exports = { pickLine, noticeLine };
