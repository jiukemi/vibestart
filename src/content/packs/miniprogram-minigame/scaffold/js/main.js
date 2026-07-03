/**
 * 微信小游戏入口 — 请在 AI 助手帮助下实现 Canvas 绘制与触摸得分逻辑
 */
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

const state = {
  score: 0,
  width: canvas.width,
  height: canvas.height,
};

function render() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = '#eaeaea';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`得分：${state.score}`, state.width / 2, 48);

  ctx.fillStyle = '#07c160';
  ctx.beginPath();
  ctx.arc(state.width / 2, state.height / 2, 56, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('点我加分', state.width / 2, state.height / 2 + 6);
}

function hitTarget(x, y) {
  const cx = state.width / 2;
  const cy = state.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= 56 * 56;
}

wx.onTouchStart((e) => {
  const touch = e.touches[0];
  if (hitTarget(touch.clientX, touch.clientY)) {
    state.score += 1;
    render();
  }
});

render();
