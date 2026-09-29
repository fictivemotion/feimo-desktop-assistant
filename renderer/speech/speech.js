'use strict';
window.speechApi.onMessage((text) => { document.getElementById('message').textContent = text; });
window.speechApi.onPlacement((placement) => {
  document.body.dataset.placement = placement.side;
  document.body.style.setProperty('--arrow-anchor', `${placement.anchor}px`);
});
