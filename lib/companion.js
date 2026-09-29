'use strict';

const HOVER_LINES = [
  '嗨，我在这儿。',
  '今天也一起慢慢来。',
  '你的日程我帮你留意着。',
  '看到我啦！要聊聊吗？',
  '图片有字？交给我吧。',
  '喝口水，再继续也不迟。',
  '我刚眨眼啦，发现了吗？',
  '小事交给我，你放心想。',
  '今天又前进了一小步！',
  '乱糟糟的文字，我来梳理。',
  '肩膀放松一点，呼吸一下。',
  '下一项日程，我帮你记着。',
  '我会安静陪着你。',
  '嘿，今天感觉怎么样？',
  '想专注一会儿吗？',
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
