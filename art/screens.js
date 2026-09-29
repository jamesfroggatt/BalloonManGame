// The screens around the flying: the title (with the choices), loading,
// pause, game over, you win, credits and the cloud wipe between them. Buttons
// are drawn here and report where they are, so clicks and taps can find them.
import { TAU, clamp, easeOutBack, easeInOut, h01 } from './util.js';
import { style, OUT, FONT } from './style.js';
import { rrect, starPath } from './shapes.js';
import * as fx from './particles.js';

const W = 1920;
const H = 1080;

/* ---------- buttons ---------- */
export const ui = { hits: [], pointer: [-1, -1], focus: null };
export function beginUi() {
  ui.hits.length = 0;
}
// which button (if any) is under the point x, y (game coordinates)
export function hitTest(x, y) {
  for (let i = ui.hits.length - 1; i >= 0; i--) {
    const b = ui.hits[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}
// a chunky pill button; `on` for a selected choice
function button(ctx, id, x, y, w, h, label, o = {}) {
  ui.hits.push({ id, x, y, w, h });
  const hover =
    ui.pointer[0] >= x &&
    ui.pointer[0] <= x + w &&
    ui.pointer[1] >= y &&
    ui.pointer[1] <= y + h;
  const focus = ui.focus === id;
  const lift = hover || focus ? -3 : 0;
  const fill = o.on ? o.onFill || '#FFD23F' : o.fill || '#FFFFFF';
  ctx.fillStyle = 'rgba(27,42,74,0.3)';
  ctx.beginPath();
  rrect(ctx, x, y + 7, w, h, h / 2);
  ctx.fill();
  ctx.beginPath();
  rrect(ctx, x, y + lift, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = o.on || focus ? 7 : 5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  rrect(ctx, x + h * 0.35, y + lift + 6, w - h * 0.7, h * 0.28, h * 0.14);
  ctx.fill();
  if (focus) {
    ctx.beginPath();
    rrect(ctx, x - 9, y + lift - 9, w + 18, h + 18, h / 2 + 9);
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const size = o.size || h * 0.5;
  style.text(ctx, label, x + w / 2, y + lift + h / 2 + size * 0.36, size, {
    align: 'center',
    fill: o.textFill || OUT,
  });
}

// band: where the pale strip behind the buttons goes (top y and height)
function panel(ctx, x, y, w, h, r = 36, band = [y + h * 0.62, h * 0.34]) {
  ctx.fillStyle = 'rgba(27,42,74,0.3)';
  ctx.beginPath();
  rrect(ctx, x, y + 12, w, h, r);
  ctx.fill();
  ctx.beginPath();
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = 'rgba(58,134,255,0.07)';
  ctx.beginPath();
  rrect(ctx, x + 12, band[0], w - 24, band[1], r * 0.7);
  ctx.fill();
}

// big bouncy lettering: candy gradient, thick outline, one letter at a time
function bouncyText(ctx, text, cx, y, size, t, o = {}) {
  ctx.font = `${size}px ${FONT}`;
  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  // the gradient is set in each letter's own coordinates (drawn at 0, 0)
  const grad = ctx.createLinearGradient(0, -size * 0.72, 0, 0);
  grad.addColorStop(0, o.top || '#FFE14A');
  grad.addColorStop(1, o.bot || '#FF9F1C');
  [...text].forEach((ch, i) => {
    const b = Math.sin(t * 3.2 - i * 0.45) * size * 0.05;
    const x0 = x + widths[i] / 2;
    ctx.save();
    ctx.translate(x0, y + b);
    ctx.rotate(Math.sin(t * 2.1 + i) * 0.04);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(27,42,74,0.35)';
    ctx.fillText(ch, 0, size * 0.08);
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = OUT;
    ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = grad;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    x += widths[i];
  });
}

/* ---------- title ---------- */
// o: { ready, progress (0..1), mode, sums, best, soundOn }
export function drawTitle(ctx, t, o, balloon) {
  bouncyText(ctx, 'The', 960, 150, 84, t, { top: '#FFFFFF', bot: '#DDEBFF' });
  bouncyText(ctx, 'Balloon Man', 960, 310, 176, t);
  balloon(ctx, 1500, 330 + Math.sin(t * 1.4) * 14, t);
  panel(ctx, 430, 440, 1060, 300);
  style.text(ctx, "Who's flying?", 480, 530, 46, { fill: OUT });
  button(ctx, 'mode:normal', 820, 478, 270, 76, 'Normal', {
    on: o.mode === 'normal',
  });
  button(ctx, 'mode:little', 1120, 478, 320, 76, 'Little Pilots', {
    on: o.mode === 'little',
  });
  style.text(ctx, 'Sums:', 480, 660, 46, { fill: OUT });
  button(ctx, 'sums:add', 640, 610, 250, 76, 'Adding +', {
    on: o.sums === 'add',
  });
  button(ctx, 'sums:sub', 910, 610, 290, 76, 'Taking away −', {
    on: o.sums === 'sub',
    size: 36,
  });
  button(ctx, 'sums:times', 1220, 610, 240, 76, 'Times ×', {
    on: o.sums === 'times',
  });
  if (o.best > 0)
    style.text(ctx, `Best: ${o.best} sums right`, 960, 800, 40, {
      align: 'center',
      fill: '#FFFFFF',
      outline: 9,
    });
  if (o.ready) {
    const bob = Math.sin(t * 4) * 6;
    const sc = 1 + Math.sin(t * 4) * 0.02;
    ctx.save();
    ctx.translate(960, 900 + bob);
    ctx.scale(sc, sc);
    button(
      ctx,
      'start',
      -330,
      -52,
      660,
      104,
      o.touch ? 'Tap here to fly!' : 'Press SPACE to fly!',
      { fill: '#FFD23F', size: 54 }
    );
    ctx.restore();
    // the start button moved with the bounce: record where it really is
    ui.hits[ui.hits.length - 1] = {
      id: 'start',
      x: 630,
      y: 848 + bob,
      w: 660,
      h: 104,
    };
  } else {
    // loading
    ctx.save();
    ctx.translate(960, 900);
    ctx.beginPath();
    rrect(ctx, -330, -32, 660, 64, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    rrect(ctx, -324, -26, 648, 52, 26);
    ctx.clip();
    const g = ctx.createLinearGradient(-324, 0, 324, 0);
    g.addColorStop(0, '#FF6070');
    g.addColorStop(0.33, '#FFE14A');
    g.addColorStop(0.66, '#4FDC7A');
    g.addColorStop(1, '#4A92FF');
    ctx.fillStyle = g;
    ctx.fillRect(-324, -26, 648 * clamp(o.progress, 0.02, 1), 52);
    ctx.restore();
    style.text(ctx, 'Getting ready…', 0, 14, 38, {
      align: 'center',
      fill: OUT,
    });
    ctx.restore();
  }
  button(
    ctx,
    'sound',
    1350,
    990,
    250,
    64,
    o.soundOn ? 'Sound: on' : 'Sound: off',
    { size: 32 }
  );
  button(ctx, 'full', 1620, 990, 250, 64, 'Full screen', { size: 32 });
  button(ctx, 'credits', 50, 990, 200, 64, 'Credits', { size: 32 });
}

/* ---------- pause ---------- */
export function drawPause(ctx, t, o) {
  ctx.fillStyle = 'rgba(15,26,46,0.45)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 640, 250, 640, 560);
  bouncyText(ctx, 'Paused', 960, 380, 110, t, {
    top: '#8FD3FF',
    bot: '#3A86FF',
  });
  button(ctx, 'resume', 740, 450, 440, 90, 'Keep flying', {
    fill: '#FFD23F',
    size: 46,
  });
  button(
    ctx,
    'sound',
    740,
    570,
    440,
    80,
    o.soundOn ? 'Sound: on' : 'Sound: off',
    { size: 38 }
  );
  button(ctx, 'full', 740, 680, 440, 80, 'Full screen', { size: 38 });
  style.text(ctx, 'P to carry on · M sound · F full screen', 960, 860, 30, {
    align: 'center',
    fill: '#FFFFFF',
    outline: 7,
  });
}

/* ---------- the end of a flight ---------- */
function stars(ctx, n, cx, y, t, since) {
  for (let i = 0; i < 3; i++) {
    const k = clamp((since - 0.5 - i * 0.28) / 0.35, 0, 1);
    const x = cx + (i - 1) * 130;
    const yy = y - (i === 1 ? 26 : 0);
    const r = i === 1 ? 62 : 50;
    ctx.save();
    ctx.translate(x, yy);
    ctx.rotate((i - 1) * 0.12);
    const filled = i < n && k > 0;
    const s = filled ? easeOutBack(k) : 1;
    ctx.scale(s, s);
    ctx.beginPath();
    starPath(ctx, 0, 0, r, 0, 5, 0.48);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    if (filled) {
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#FFF3A0');
      g.addColorStop(1, '#FFB800');
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#DCE4F0';
    ctx.fill();
    if (filled) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 0.3, r * 0.2, r * 0.1, -0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (filled && k > 0 && k < 0.2)
      fx.starBurst(x, yy, 3, { speed: 200, screen: true });
  }
}
// o: { win, since (s), progress (0..1), right, wrong, best, newBest }
export function drawEnd(ctx, t, o) {
  const k = clamp(o.since / 0.5, 0, 1);
  const drop = (1 - easeOutBack(k)) * -700;
  ctx.fillStyle = `rgba(15,26,46,${0.25 * k})`;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(0, drop);
  panel(ctx, 560, 150, 800, 700);
  if (o.win) {
    bouncyText(ctx, 'You made it!', 960, 280, 110, t);
    const answered = o.right + o.wrong;
    const ratio = answered ? o.right / answered : 0;
    const n = answered === 0 ? 1 : ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    stars(ctx, n, 960, 420, t, o.since);
  } else {
    bouncyText(ctx, 'Oh no, POP!', 960, 280, 110, t, {
      top: '#FF8A8A',
      bot: '#E23A4E',
    });
    style.text(
      ctx,
      `You flew ${Math.round(o.progress * 100)}% of the way`,
      960,
      360,
      46,
      { align: 'center', fill: OUT }
    );
    // a little journey bar showing how far
    const x0 = 700;
    const bw = 520;
    ctx.beginPath();
    rrect(ctx, x0, 392, bw, 26, 13);
    ctx.fillStyle = '#E6EEF8';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
    g.addColorStop(0, '#FF6070');
    g.addColorStop(0.33, '#FFE14A');
    g.addColorStop(0.66, '#4FDC7A');
    g.addColorStop(1, '#4A92FF');
    ctx.fillStyle = g;
    ctx.fillRect(
      x0,
      392,
      bw * clamp(o.progress, 0, 1) * easeInOut(clamp(o.since / 1.2, 0, 1)),
      26
    );
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
  // sums right, counting up
  const shown = Math.min(
    o.right,
    Math.floor(clamp((o.since - 0.4) / 1.2, 0, 1) * (o.right + 0.999))
  );
  style.text(ctx, 'Sums right:', 900, 560, 56, { align: 'right', fill: OUT });
  style.text(ctx, String(shown), 940, 562, 84, {
    fill: '#2FB45A',
    outline: 10,
    line: OUT,
  });
  if (o.newBest && o.since > 1.6) {
    const kb = clamp((o.since - 1.6) / 0.3, 0, 1);
    ctx.save();
    ctx.translate(1180, 530);
    ctx.rotate(0.14);
    ctx.scale(easeOutBack(kb), easeOutBack(kb));
    ctx.beginPath();
    rrect(ctx, -120, -38, 240, 64, 32);
    ctx.fillStyle = '#FF4F5E';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    style.text(ctx, 'New best!', 0, 8, 44, {
      align: 'center',
      fill: '#FFFFFF',
    });
    ctx.restore();
  } else if (o.best > 0)
    style.text(ctx, `Best: ${o.best}`, 960, 630, 38, {
      align: 'center',
      fill: '#52627F',
    });
  const bob = Math.sin(t * 4) * 5;
  button(
    ctx,
    'start',
    660,
    680 + bob,
    600,
    100,
    o.touch ? 'Tap to fly again!' : 'SPACE to fly again!',
    { fill: '#FFD23F', size: 50 }
  );
  ctx.restore();
  // buttons are drawn inside the drop: record where they really are
  for (const b of ui.hits) if (b.id === 'start') b.y += drop;
  button(ctx, 'title', 1620, 990, 250, 64, 'Title (T)', { size: 32 });
  // fireworks for a win
  if (o.win && o.since > 0.6) {
    const slot = Math.floor(t * 2.5);
    if (slot !== ui.lastBurst) {
      ui.lastBurst = slot;
      const x = 200 + h01(slot * 1.7) * 1520;
      const y = 120 + h01(slot * 3.1) * 260;
      fx.starBurst(x, y, 12, { speed: 340, screen: true });
      fx.confetti(x, y, 16, { power: 0.7, screen: true });
    }
  }
}

/* ---------- credits ---------- */
export function drawCredits(ctx, t) {
  ctx.fillStyle = 'rgba(15,26,46,0.45)';
  ctx.fillRect(0, 0, W, H);
  const entries = [
    ['The Balloon Man', 'made with love for learning sums'],
    ['Music and sounds', 'to be confirmed'],
    [
      'Lettering',
      'Lilita One (Juan Montoreano) and Fredoka (The Fredoka Project Authors), SIL Open Font License',
    ],
    ['Sound player', 'howler.js'],
  ].map(([head, text]) => [head, wrapLines(ctx, text, 860, 32)]);
  // the panel grows with the text: each heading, its lines and a gap
  const body = entries.reduce((h, [, lines]) => h + 90 + lines.length * 40, 0);
  const top = Math.max(20, (H - body - 330) / 2);
  panel(ctx, 460, top, 1000, body + 330, 36, [top + body + 196, 118]);
  bouncyText(ctx, 'Credits', 960, top + 130, 100, t, {
    top: '#8FD3FF',
    bot: '#3A86FF',
  });
  let y = top + 220;
  for (const [head, lines] of entries) {
    style.text(ctx, head, 960, y, 44, { align: 'center', fill: OUT });
    lines.forEach((line, i) =>
      style.text(ctx, line, 960, y + 48 + i * 40, 32, {
        align: 'center',
        fill: '#52627F',
        small: true,
      })
    );
    y += 90 + lines.length * 40;
  }
  button(ctx, 'back', 810, top + body + 220, 300, 76, 'Back', {
    fill: '#FFD23F',
    size: 40,
  });
}
// split text into lines no wider than maxW
function wrapLines(ctx, text, maxW, size) {
  ctx.font = `${size}px "Fredoka", sans-serif`;
  const lines = [];
  let line = '';
  for (const w of text.split(' ')) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------- the cloud wipe when a flight starts (k: 0 covered .. 1 clear) ---------- */
export function drawWipe(ctx, k) {
  if (k >= 1) return;
  const r = easeInOut(k) * 1300;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-20, -20, W + 40, H + 40);
  // a scalloped hole, like the edge of a cloud, opening from the middle
  const n = 22;
  const pt = (a, rr) => [
    W / 2 + Math.cos(a) * rr,
    H / 2 + Math.sin(a) * rr * 0.75,
  ];
  ctx.moveTo(...pt(0, r));
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 1) / n) * TAU;
    ctx.quadraticCurveTo(...pt((a0 + a1) / 2, r - 60 - r * 0.06), ...pt(a1, r));
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, '#DDEBFA');
  ctx.fillStyle = g;
  ctx.fill('evenodd');
  ctx.restore();
}

/* ---------- touch controls (tablets) ---------- */
export const TOUCH = {
  left: { x: 40, y: 870, w: 170, h: 170 },
  right: { x: 230, y: 870, w: 170, h: 170 },
  up: { cx: 1750, cy: 915, r: 125 },
  pause: { cx: 1535, cy: 88, r: 38 },
};
// which control (if any) a finger at x, y is on
export function touchControlAt(x, y) {
  if (Math.hypot(x - TOUCH.up.cx, y - TOUCH.up.cy) < TOUCH.up.r + 30)
    return 'up';
  for (const k of ['left', 'right']) {
    const b = TOUCH[k];
    if (
      x >= b.x - 20 &&
      x <= b.x + b.w + 20 &&
      y >= b.y - 40 &&
      y <= b.y + b.h + 30
    )
      return k;
  }
  return null;
}
export function drawTouch(ctx, t, held) {
  ctx.save();
  for (const k of ['left', 'right']) {
    const b = TOUCH[k];
    const on = held.has(k);
    ctx.globalAlpha = on ? 0.95 : 0.7;
    ctx.beginPath();
    rrect(ctx, b.x, b.y + (on ? 4 : 0), b.w, b.h, 36);
    ctx.fillStyle = on ? '#FFD23F' : 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 + (on ? 4 : 0);
    const s = k === 'left' ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + s * 38, cy);
    ctx.lineTo(cx - s * 26, cy - 42);
    ctx.lineTo(cx - s * 26, cy + 42);
    ctx.closePath();
    ctx.fillStyle = OUT;
    ctx.fill();
  }
  // the burner button: hold it to rise
  const u = TOUCH.up;
  const on = held.has('up');
  ctx.globalAlpha = on ? 0.97 : 0.8;
  if (on) style.glow(ctx, u.cx, u.cy, u.r * 1.6, '#FFB347', 0.6);
  ctx.beginPath();
  ctx.arc(u.cx, u.cy + (on ? 5 : 0), u.r, 0, TAU);
  const g = ctx.createRadialGradient(u.cx - 30, u.cy - 40, 10, u.cx, u.cy, u.r);
  g.addColorStop(0, on ? '#FFE9A0' : '#FFFFFF');
  g.addColorStop(1, on ? '#FF9F1C' : '#FFD9A0');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // a flame
  const fy = u.cy + (on ? 5 : 0) + 20;
  const fh = 70 + (on ? Math.sin(t * 30) * 8 : 0);
  ctx.beginPath();
  ctx.moveTo(u.cx - 30, fy);
  ctx.quadraticCurveTo(u.cx - 38, fy - fh * 0.5, u.cx, fy - fh);
  ctx.quadraticCurveTo(u.cx + 38, fy - fh * 0.5, u.cx + 30, fy);
  ctx.closePath();
  ctx.fillStyle = '#FF7A1E';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#C0391E';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(u.cx - 16, fy);
  ctx.quadraticCurveTo(u.cx - 20, fy - fh * 0.4, u.cx, fy - fh * 0.66);
  ctx.quadraticCurveTo(u.cx + 20, fy - fh * 0.4, u.cx + 16, fy);
  ctx.closePath();
  ctx.fillStyle = '#FFE14A';
  ctx.fill();
  style.text(ctx, 'UP', u.cx, fy + 58, 44, { align: 'center', fill: OUT });
  // pause
  const q = TOUCH.pause;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(q.cx, q.cy, q.r, 0, TAU);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = OUT;
  ctx.fillRect(q.cx - 14, q.cy - 15, 9, 30);
  ctx.fillRect(q.cx + 5, q.cy - 15, 9, 30);
  ctx.restore();
}

// shown on a tablet held upright
export function drawRotate(ctx, t) {
  ctx.fillStyle = '#0F1A2E';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(960, 420);
  ctx.rotate(
    (-Math.PI / 2) * clamp(((Math.sin(t * 1.6) + 1) / 2) * 1.4 - 0.2, 0, 1)
  );
  ctx.beginPath();
  rrect(ctx, -150, -250, 300, 500, 40);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#FFD23F';
  ctx.stroke();
  ctx.restore();
  style.text(ctx, 'Turn your tablet', 960, 850, 130, {
    align: 'center',
    fill: '#FFFFFF',
    outline: 18,
  });
  style.text(ctx, 'sideways to fly!', 960, 1000, 130, {
    align: 'center',
    fill: '#FFFFFF',
    outline: 18,
  });
}
