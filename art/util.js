// Small maths and colour helpers shared by all the art code.
// The art never uses Math.random: gameplay depends on its sequence, so
// anything decorative uses the seeded generators below instead.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const easeInOut = t =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOutBack = t => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const mod = (a, n) => ((a % n) + n) % n;

// repeatable pseudo-random number (0..1) for an integer
export function h01(n) {
  n = (n | 0) * 374761393 + 668265263;
  n = (n ^ (n >>> 13)) * 1274126177;
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

// smooth 1D value noise
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(h01(i), h01(i + 1), smooth(f));
}

// seeded random generator
export function mulberry(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- colour ---------- */
const rgbCache = new Map();
export function rgb(h) {
  let c = rgbCache.get(h);
  if (!c) {
    const n = parseInt(h.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(h, c);
  }
  return c;
}
export function hex(r, g, b) {
  const v = x => Math.round(clamp(x, 0, 255));
  return (
    '#' + ((1 << 24) | (v(r) << 16) | (v(g) << 8) | v(b)).toString(16).slice(1)
  );
}
export function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return hex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
export function rgba(h, a) {
  const c = rgb(h);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// makes a small offscreen canvas and lets `draw` paint it
export function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  if (draw) draw(c.getContext('2d'), c.width, c.height);
  return c;
}
