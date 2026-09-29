// Path builders for every drawn thing. They only trace paths; the style
// decides how each one is filled, outlined and shaded. Sizes match the game
// objects' boxes and hitboxes (see imageCollisionData/*.json).
import { TAU, lerp, h01 } from './util.js';

export function polyPath(c, pts, close = true) {
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  if (close) c.closePath();
}

// quadratic smoothing through the midpoints of a point list
export function smoothPath(c, pts, close = true) {
  const n = pts.length;
  if (n < 3) return polyPath(c, pts, close);
  if (close) {
    c.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    for (let i = 1; i <= n; i++) {
      const p = pts[i % n];
      const q = pts[(i + 1) % n];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    c.closePath();
  } else {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    c.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

export function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function starPath(c, x, y, r, rot, points = 4, inner = 0.38) {
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
}

// a lumpy round outline (rocks, bushes)
export function blobPts(cx, cy, r, n, seed, amp = 0.12, sy = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const k = 1 + (h01(seed * 31 + i) - 0.5) * 2 * amp;
    pts.push([cx + Math.cos(t) * r * k, cy + Math.sin(t) * r * k * sy]);
  }
  return pts;
}

// a leaf-shaped ribbon along a centre line; serr adds leaflet notches
export function leafPoly(pts, width, serr = 0) {
  const left = [];
  const right = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n - 1, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    const dx = q[0] - o[0];
    const dy = q[1] - o[1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    const u = i / (n - 1);
    let w =
      width * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)) * (1 - 0.25 * u);
    if (serr) w *= 0.62 + 0.38 * Math.abs(Math.sin(u * Math.PI * serr));
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  }
  return left.concat(right.reverse());
}

// a stroke that tapers from w0 to w1, as a polygon (trunks, scarves)
export function ribbon(pts, w0, w1) {
  const left = [];
  const right = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n - 1, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    const dx = q[0] - o[0];
    const dy = q[1] - o[1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    const w = lerp(w0, w1, i / (n - 1));
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  }
  return left.concat(right.reverse());
}

/* ---------- the balloon: envelope in local space (origin = top centre) ---------- */
export const ENV = (() => {
  const R = 78;
  const cy = 78;
  const mouthY = 170;
  const mw = 19;
  const pts = [];
  const bez = (p0, p1, p2, p3, u) => {
    const v = 1 - u;
    return [
      v * v * v * p0[0] +
        3 * v * v * u * p1[0] +
        3 * v * u * u * p2[0] +
        u * u * u * p3[0],
      v * v * v * p0[1] +
        3 * v * v * u * p1[1] +
        3 * v * u * u * p2[1] +
        u * u * u * p3[1],
    ];
  };
  const right = [];
  for (let i = 0; i <= 24; i++)
    right.push(
      bez(
        [R, cy],
        [R * 1.01, cy + 50],
        [mw + 30, mouthY - 34],
        [mw, mouthY],
        i / 24
      )
    );
  for (let i = 24; i >= 0; i--) pts.push([-right[i][0], right[i][1]]);
  for (let i = 1; i < 40; i++) {
    const a = Math.PI + (i / 40) * Math.PI;
    pts.push([Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  for (let i = 0; i <= 24; i++) pts.push(right[i]);
  // half-width of the envelope at height y
  const W = y => {
    if (y <= cy) return Math.sqrt(Math.max(0, R * R - (cy - y) * (cy - y)));
    for (let i = 0; i < 24; i++)
      if (right[i + 1][1] >= y) {
        const u = (y - right[i][1]) / (right[i + 1][1] - right[i][1] || 1);
        return lerp(right[i][0], right[i + 1][0], u);
      }
    return mw;
  };
  // eight vertical panels (gores), like the meridians of a sphere
  const gores = [];
  const N = 8;
  for (let g = 0; g < N; g++) {
    const a0 = -Math.PI / 2 + (g / N) * Math.PI;
    const a1 = -Math.PI / 2 + ((g + 1) / N) * Math.PI;
    const poly = [];
    for (let i = 0; i <= 30; i++) {
      const y = (i / 30) * mouthY;
      poly.push([W(y) * Math.sin(a0), y]);
    }
    for (let i = 30; i >= 0; i--) {
      const y = (i / 30) * mouthY;
      poly.push([W(y) * Math.sin(a1), y]);
    }
    gores.push(poly);
  }
  return { R, cy, mouthY, mw, pts, gores, W };
})();

/* ---------- sharks (206x120 head box, eye at 82,42 = the laser origin) ---------- */
export function sharkHeadPath(c, x, y) {
  c.moveTo(x + 22, y + 128);
  c.bezierCurveTo(x + 8, y + 92, x + 18, y + 44, x + 42, y + 16);
  c.quadraticCurveTo(x + 54, y - 3, x + 70, y + 1);
  c.bezierCurveTo(x + 124, y + 12, x + 178, y + 60, x + 202, y + 128);
  c.closePath();
}
export function sharkBellyPath(c, x, y) {
  c.moveTo(x + 22, y + 128);
  c.bezierCurveTo(x + 8, y + 92, x + 18, y + 44, x + 42, y + 16);
  c.bezierCurveTo(x + 42, y + 52, x + 66, y + 98, x + 120, y + 128);
  c.closePath();
}
export function finPath(c, x, yb, h, dir) {
  const s = dir;
  c.moveTo(x - 36 * s, yb + 2);
  c.quadraticCurveTo(x - 8 * s, yb - h * 0.45, x - 10 * s, yb - h);
  c.quadraticCurveTo(x + 20 * s, yb - h * 0.5, x + 34 * s, yb + 2);
  c.closePath();
}

/* ---------- ice ghost (133x195 box, like its hitbox) ---------- */
export function ghostPath(c, x, y, t) {
  c.moveTo(x + 6, y + 118);
  c.bezierCurveTo(x - 2, y + 44, x + 36, y + 2, x + 70, y + 2);
  c.bezierCurveTo(x + 108, y + 2, x + 132, y + 36, x + 128, y + 96);
  const tails = [
    [142, 196],
    [100, 178],
    [66, 194],
    [26, 168],
  ];
  let px = x + 128;
  let py = y + 96;
  for (let i = 0; i < tails.length; i++) {
    const w = Math.sin(t * 4.2 + i * 1.3) * 7;
    const tx = x + tails[i][0] + w;
    const ty = y + tails[i][1] + Math.cos(t * 3.1 + i) * 4;
    c.quadraticCurveTo(px + 6, (py + ty) / 2 + 6, tx, ty);
    const nx = i < tails.length - 1 ? x + tails[i + 1][0] + 18 : x + 6;
    const ny = i < tails.length - 1 ? y + 150 : y + 118;
    c.quadraticCurveTo((tx + nx) / 2, ny - 8 + Math.sin(t * 3 + i) * 5, nx, ny);
    px = nx;
    py = ny;
  }
  c.closePath();
}

/* ---------- Easter Island head (148x328 box, facing left) ----------
   The mouth sits where the game spits its rings (box x+10, y+150). */
export function moaiPts(m) {
  const j = 17 * m;
  return [
    [36, 12],
    [62, 3],
    [118, 6],
    [139, 22],
    [147, 90],
    [143, 160],
    [137, 210],
    [146, 272],
    [152, 330],
    [16, 330],
    [20, 292],
    [31, 254 + j * 0.3],
    [12, 236 + j],
    [8, 212 + j],
    [14, 195 + j],
    [24, 189],
    [12, 180],
    [18, 166],
    [5, 158],
    [0, 140],
    [10, 110],
    [22, 90],
    [9, 76],
    [14, 56],
  ];
}

/* ---------- palm tree, built to cover its bump in the crash line ----------
   spec: { x (trunk world x), ground, top (canopy top y), left, right } */
export function palmGeom(spec, screenX, wind, t) {
  const base = spec.ground + 4;
  const bend = (wind - 0.42) * 14 + Math.sin(t * 1.15 + spec.x) * 3;
  const lean = ((spec.right - spec.left) / 2) * 0.5;
  const crownY = spec.top + 44;
  const h = base - crownY;
  const top = [screenX + lean + bend, crownY];
  const mid = [screenX + lean * 0.3 + bend * 0.35, base - h * 0.55];
  const trunk = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const v = 1 - u;
    trunk.push([
      v * v * screenX + 2 * v * u * mid[0] + u * u * top[0],
      v * v * base + 2 * v * u * mid[1] + u * u * top[1],
    ]);
  }
  const reach = Math.max(spec.left, spec.right) + 16;
  const fronds = [];
  [-2.75, -2.3, -1.85, -1.4, -0.95, -0.5, -0.1].forEach((a0, k) => {
    const side = Math.cos(a0) < 0 ? spec.left + 16 : spec.right + 16;
    const L0 =
      Math.max(
        80,
        (Math.abs(Math.cos(a0)) * side + (1 - Math.abs(Math.cos(a0))) * 70) *
          1.08
      ) * (k % 2 ? 0.94 : 1);
    const a = a0 + (wind - 0.42) * 0.12 + Math.sin(t * 1.9 + spec.x + k) * 0.04;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const droop = u * u * L0 * 0.5;
      pts.push([
        top[0] + Math.cos(a) * L0 * u + (wind - 0.3) * 20 * u * u,
        top[1] + Math.sin(a) * L0 * u * 0.9 + droop,
      ]);
    }
    fronds.push(pts);
  });
  return { base, top, trunk, fronds, sx: screenX, reach };
}

/* ---------- wind turbine blade from the hub (length ~ the hitbox reach) ---------- */
export function turbineBlade(hx, hy, a, length = 188) {
  const pts = [];
  const prof = u =>
    u < 0.18 ? lerp(7, 18, u / 0.18) : lerp(18, 4, (u - 0.18) / 0.82);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const d = 12 + u * length;
    const w = prof(u);
    pts.push([hx + ca * d - sa * w * 0.35, hy + sa * d + ca * w * 0.35]);
  }
  for (let i = 10; i >= 0; i--) {
    const u = i / 10;
    const d = 12 + u * length;
    const w = prof(u);
    pts.push([hx + ca * d + sa * w, hy + sa * d - ca * w]);
  }
  return pts;
}
