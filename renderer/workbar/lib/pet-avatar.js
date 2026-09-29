'use strict';
(() => {
  const sheet = new Image();
  sheet.src = '../../assets/pets/eous/spritesheet.webp';
  const canvases = new Set();

  function paint(canvas) {
    if (!sheet.complete || !sheet.naturalWidth || !canvas.isConnected) return;
    const size = Number(canvas.dataset.size) || 72;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Row 0, frame 0 is the upright three-dimensional Eous portrait.
    const height = size * .98;
    const width = height * 192 / 208;
    ctx.drawImage(sheet, 0, 0, 192, 208, (size - width) / 2, (size - height) / 2, width, height);
  }

  sheet.addEventListener('load', () => { for (const canvas of canvases) paint(canvas); });
  window.PetAvatar = {
    eous(size) {
      const canvas = document.createElement('canvas');
      canvas.className = 'eous-avatar';
      canvas.dataset.size = String(size);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', '伊埃斯');
      canvases.add(canvas);
      requestAnimationFrame(() => paint(canvas));
      return canvas;
    },
  };
})();
