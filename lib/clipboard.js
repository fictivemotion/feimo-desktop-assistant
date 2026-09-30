'use strict';
/** Electron 44 clipboard uses asynchronous W3C-style reads and writes. */
const sharp = require('sharp');

async function readImageBuffer(clipboard) {
  const items = await clipboard.read();
  for (const item of items) {
    const type = ['image/png', 'image/jpeg', 'image/bmp', 'image/webp'].find((mime) => item.types.includes(mime));
    if (!type) continue;
    const blob = await item.getType(type);
    return Buffer.from(await blob.arrayBuffer());
  }
  return null;
}

async function snapshotClipboard(clipboard) {
  const image = await readImageBuffer(clipboard);
  if (image) {
    const png = await sharp(image).png().toBuffer();
    const meta = await sharp(png).metadata();
    return { kind: 'image', dataUrl: `data:image/png;base64,${png.toString('base64')}`, size: { width: meta.width, height: meta.height } };
  }
  const value = await clipboard.readText();
  return value ? { kind: 'text', text: value } : { kind: 'empty' };
}

async function writeTextVerified(clipboard, value) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await clipboard.writeText(value);
    if (await clipboard.readText() === value) return;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error('剪贴板写入后校验失败');
}

async function writeImageVerified(clipboard, ClipboardItem, dataUrl) {
  if (!/^data:image\/png;base64,[a-z\d+/=]+$/i.test(dataUrl)) throw new Error('无效图片');
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
  if (!(await readImageBuffer(clipboard))?.length) throw new Error('图片剪贴板写入校验失败');
}

module.exports = { readImageBuffer, snapshotClipboard, writeTextVerified, writeImageVerified };
