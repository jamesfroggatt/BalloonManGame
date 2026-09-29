// Particles: little sprites (smoke, sparks, stars, splashes, confetti...) that
// live for a moment. Positions are kept in world coordinates (screen x plus
// the camera) so they drift with the scenery, and each is painted from a
// pre-rendered sprite, which the graphics chip draws in batches.
import { style } from './style.js';

const MAX = 900;
const pool = [];
const live = [];
let cam = 0;

// the particles' own random numbers: the game's Math.random sequence must
// never change, so this never uses it
let seed = 20240929;
export function rand(a = 0, b = 1) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return a + (b - a) * (seed / 4294967296);
}

// which kinds are drawn in front of the game objects (the rest behind)
const FRONT = {
  spark: 1,
  ember: 1,
  twinkle: 1,
  star: 1,
  confetti: 1,
  scrap: 1,
  frost: 1,
  drop: 1,
};

export function setCamera(x) {
  cam = x;
}

// start a particle at screen position x, y. Options: vx, vy (px/s), g
// (gravity px/s^2), drag (0..1 per second), life (s), size, grow (size gained
// over its life), rot, spin, hue, front, screen (stays put on screen)
export function emit(kind, x, y, o = {}) {
  if (live.length >= MAX) return null;
  const p = pool.pop() || {};
  p.kind = kind;
  p.screen = !!o.screen;
  p.x = p.screen ? x : x + cam;
  p.y = y;
  p.vx = o.vx || 0;
  p.vy = o.vy || 0;
  p.g = o.g || 0;
  p.drag = o.drag || 0;
  p.age = 0;
  p.life = o.life || 1;
  p.size = o.size || 8;
  p.grow = o.grow || 0;
  p.rot = o.rot || 0;
  p.spin = o.spin || 0;
  p.hue = o.hue || 0;
  p.front = o.front !== undefined ? o.front : !!FRONT[kind];
  live.push(p);
  return p;
}

export function update(dt) {
  if (dt <= 0) return;
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i];
    p.age += dt;
    if (p.age >= p.life) {
      live[i] = live[live.length - 1];
      live.pop();
      pool.push(p);
      continue;
    }
    if (p.drag) {
      const k = Math.pow(1 - p.drag, dt);
      p.vx *= k;
      p.vy *= k;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
  }
}

export function draw(ctx, front) {
  for (const p of live) {
    if (p.front !== front) continue;
    drawOne(ctx, p, p.screen ? p.x : p.x - cam, p.y, p.age / p.life);
  }
}

export function clear() {
  while (live.length) pool.push(live.pop());
}

export function count() {
  return live.length;
}

function drawOne(ctx, p, x, y, u) {
  if (x < -120 || x > 2040 || y < -120 || y > 1200) return;
  const fadeIn = Math.min(1, u * 6);
  switch (p.kind) {
    case 'smoke':
      style.spr(
        ctx,
        'smoke',
        x,
        y,
        p.size + p.grow * u + 1.5,
        (1 - u) * 0.95 * fadeIn
      );
      break;
    case 'dust':
      style.spr(
        ctx,
        'dust',
        x,
        y,
        p.size + p.grow * u + 1.5,
        (1 - u) * 0.8 * fadeIn
      );
      break;
    case 'snowPuff':
      style.spr(
        ctx,
        'snowPuff',
        x,
        y,
        p.size + p.grow * u + 1.5,
        (1 - u) * 0.9 * fadeIn
      );
      break;
    case 'spark':
    case 'ember':
      style.spr(
        ctx,
        'spark' + (u < 0.4 ? 0 : u < 0.7 ? 1 : 2),
        x,
        y,
        p.size * (1 - u * 0.6) * 1.6,
        1,
        p.rot
      );
      break;
    case 'twinkle':
      style.spr(
        ctx,
        'twinkle',
        x,
        y,
        Math.sin(Math.PI * u) * p.size * 1.3,
        1,
        p.rot
      );
      break;
    case 'star':
      style.spr(
        ctx,
        'star',
        x,
        y,
        p.size * (u < 0.15 ? u / 0.15 : 1) * (1 - u * 0.4) + 2,
        u > 0.7 ? (1 - u) / 0.3 : 1,
        p.rot
      );
      break;
    case 'confetti':
      style.spr(
        ctx,
        'conf' + p.hue,
        x,
        y,
        p.size / 2,
        u > 0.8 ? (1 - u) / 0.2 : 1,
        p.rot,
        Math.abs(Math.sin(p.age * 9)) + 0.2
      );
      break;
    case 'scrap':
      style.spr(
        ctx,
        'scrap' + p.hue,
        x,
        y,
        p.size,
        u > 0.8 ? (1 - u) / 0.2 : 1,
        p.rot,
        Math.abs(Math.sin(p.age * 7)) * 0.8 + 0.2
      );
      break;
    case 'mist':
      style.spr(
        ctx,
        'mist',
        x,
        y,
        (p.size + p.grow * u) * 1.4,
        0.75 * (1 - u) * fadeIn
      );
      break;
    case 'frost':
      style.spr(ctx, 'frost', x, y, p.size * 1.5, 1 - u, p.rot);
      break;
    case 'drop':
      style.spr(ctx, 'drop', x, y, p.size + 1.2, 1);
      break;
    case 'foam':
      style.spr(ctx, 'foam', x, y, p.size + p.grow * u, 1 - u);
      break;
    case 'ripple':
      style.spr(ctx, 'ring', x, y, p.size + p.grow * u, 0.8 * (1 - u), 0, 0.22);
      break;
    case 'bubble':
      style.spr(
        ctx,
        'bubble',
        x,
        y,
        p.size + 1,
        u > 0.85 ? (1 - u) / 0.15 : 0.95
      );
      break;
    case 'seed':
      style.spr(ctx, 'seed', x, y, 7, u > 0.8 ? (1 - u) / 0.2 : 1, p.rot * 0.3);
      break;
    case 'leaf':
      style.spr(
        ctx,
        'leaf',
        x,
        y,
        p.size + 2,
        u > 0.8 ? (1 - u) / 0.2 : 1,
        p.rot,
        0.4 + 0.6 * Math.abs(Math.sin(p.age * 2.2))
      );
      break;
  }
}

/* ---------- ready-made bursts (screen coordinates) ---------- */
export function puffs(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(0.3, 1) * (o.speed || 60);
    emit(
      o.kind || 'smoke',
      x + Math.cos(a) * (o.spread || 8),
      y + Math.sin(a) * (o.spread || 8),
      {
        vx: Math.cos(a) * s + (o.vx || 0),
        vy: Math.sin(a) * s + (o.vy || 0),
        drag: 0.9,
        g: o.g || 0,
        life: rand(0.5, 1) * (o.life || 1.1),
        size: rand(0.7, 1.2) * (o.size || 12),
        grow: o.grow !== undefined ? o.grow : 14,
      }
    );
  }
}

export function sparks(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a =
      o.angle !== undefined
        ? o.angle + rand(-1, 1) * (o.cone || 0.6)
        : rand(0, Math.PI * 2);
    const s = rand(0.4, 1) * (o.speed || 260);
    emit(o.kind || 'spark', x, y, {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      g: o.g !== undefined ? o.g : 500,
      drag: 0.6,
      life: rand(0.35, 0.8) * (o.life || 1),
      size: rand(0.6, 1.1) * (o.size || 7),
      rot: rand(0, 6.28),
      spin: rand(-8, 8),
    });
  }
}

export function splash(x, y, n, o = {}) {
  const k = o.scale || 1;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rand(-0.9, 0.9);
    const s = rand(160, 420) * k;
    emit('drop', x + rand(-10, 10) * k, y, {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      g: 1100,
      life: rand(0.5, 0.9),
      size: rand(3, 6) * k,
    });
  }
  for (let i = 0; i < Math.ceil(n / 2); i++)
    emit('foam', x + rand(-26, 26) * k, y + rand(-2, 3), {
      vx: rand(-40, 40),
      life: rand(0.5, 0.9),
      size: rand(5, 10) * k,
      grow: 6,
    });
  emit('ripple', x, y + 2, { life: 0.9, size: 14 * k, grow: 70 * k });
}

export function starBurst(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
    const s = rand(0.6, 1) * (o.speed || 300);
    emit('star', x, y, {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      g: 260,
      drag: 0.8,
      life: rand(0.7, 1.1),
      size: rand(9, 15),
      rot: rand(0, 6.28),
      spin: rand(-5, 5),
      screen: o.screen,
    });
  }
  for (let i = 0; i < n; i++)
    emit('twinkle', x + rand(-50, 50), y + rand(-50, 50), {
      life: rand(0.4, 0.8),
      size: rand(8, 14),
      rot: rand(0, 1),
      screen: o.screen,
    });
}

export function confetti(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rand(-1.2, 1.2);
    const s = rand(200, 520) * (o.power || 1);
    emit('confetti', x, y, {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      g: 520,
      drag: 0.93,
      life: rand(1.2, 2.2),
      size: rand(9, 14),
      rot: rand(0, 6.28),
      spin: rand(-10, 10),
      hue: Math.floor(rand(0, 6)),
      screen: o.screen,
    });
  }
}
