// The world: sky, parallax scenery, the ground (drawn from the crash line),
// lakes and the gently swaying details. Everything static is baked into
// tiles; swaying things are redrawn 20 times a second (see cache.js).
import {
  TAU,
  lerp,
  mod,
  h01,
  noise1,
  sstep,
  makeCanvas,
  mulberry,
} from './util.js';
import { TileStrip, timed } from './cache.js';
import { style, MATS, OUT, BLADES } from './style.js';
import {
  polyPath,
  smoothPath,
  rrect,
  starPath,
  leafPoly,
  ribbon,
  palmGeom,
  ENV,
} from './shapes.js';
import {
  level,
  crashY,
  groundY,
  lakeAt,
  biomeAt,
  seabedY,
  SURFACE_Y,
} from './level.js';

const VIEW_W = 1920;

// a parallax layer at factor f shows world x at the screen centre at layer
// x = layerX(wx, f); worldAtLayer is the reverse
const layerX = (wx, f) => (wx - VIEW_W / 2) * f + VIEW_W / 2;
const worldAtLayer = (x, f) => (x - VIEW_W / 2) / f + VIEW_W / 2;
// 0 on land, 1 over the middle of a lake (softened at the shores)
function lakeness(wx) {
  let k = 0;
  for (const [a, b] of level.lakes)
    k = Math.max(
      k,
      Math.min(sstep(a - 500, a + 300, wx), sstep(b + 500, b - 300, wx))
    );
  return k;
}

// wind: one shared breeze with gusts that roll across the screen (sx = screen x)
export function windAt(t, sx) {
  const base =
    0.36 + 0.14 * Math.sin(t * 0.47) + 0.07 * Math.sin(t * 1.63 + sx * 0.0035);
  const gx = mod(t * 360, 3400) - 700;
  const d = (sx - gx) / 280;
  return base + 0.9 * Math.exp(-d * d);
}

/* ================= sky ================= */
function paintSky(g) {
  const gr = g.createLinearGradient(0, 0, 0, 900);
  gr.addColorStop(0, '#2A97EC');
  gr.addColorStop(0.55, '#6FCAF8');
  gr.addColorStop(1, '#CFF0FF');
  g.fillStyle = gr;
  g.fillRect(0, 0, VIEW_W, 1080);
  style.glow(g, 1470, 176, 300, '#FFF6C0', 0.55);
}
function drawSun(ctx, t) {
  const sx = 1470;
  const sy = 176;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(t * 0.07);
  ctx.fillStyle = 'rgba(255,250,210,0.2)';
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 250, a, a + 0.12);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(sx, sy, 56, 0, TAU);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#F6A623';
  ctx.stroke();
  const sg = ctx.createRadialGradient(sx - 16, sy - 18, 4, sx, sy, 56);
  sg.addColorStop(0, '#FFFBE0');
  sg.addColorStop(0.6, '#FFE266');
  sg.addColorStop(1, '#FFC933');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(sx - 20, sy - 22, 14, 8, -0.6, 0, TAU);
  ctx.fill();
}

/* ================= clouds ================= */
// a lumpy cloud outline, fixed by its seed (about 486 x 245 at scale 1)
const cloudShapes = new Map();
function cloudShape(seed) {
  let c = cloudShapes.get(seed);
  if (!c) {
    const n = 5 + Math.floor(h01(seed * 7) * 3);
    const w = 360;
    const lumps = [];
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1);
      const r =
        (0.2 + 0.2 * Math.sin(Math.PI * u) + h01(seed * 13 + k) * 0.08) *
        w *
        0.55;
      lumps.push({
        dx: (u - 0.5) * w * 0.82,
        dy: -Math.sin(Math.PI * u) * w * 0.12 + h01(seed * 17 + k) * 6,
        r,
      });
    }
    lumps.push(
      { dx: -w * 0.1, dy: -w * 0.2, r: w * 0.2 },
      { dx: w * 0.14, dy: -w * 0.16, r: w * 0.17 }
    );
    c = { w, lumps };
    cloudShapes.set(seed, c);
  }
  return c;
}
function paintCloud(g, seed, depth) {
  const c = cloudShape(seed);
  g.beginPath();
  for (const l of c.lumps) {
    g.moveTo(l.dx + l.r, l.dy);
    g.arc(l.dx, l.dy, l.r, 0, TAU);
  }
  g.lineWidth = [2.4, 3, 3.6][depth] * 2;
  g.lineJoin = 'round';
  g.strokeStyle = ['#A6CBEE', '#8DB6E4', '#7AA5DA'][depth];
  g.stroke();
  const gr = g.createLinearGradient(0, -c.w * 0.32, 0, c.w * 0.2);
  gr.addColorStop(0, '#FFFFFF');
  gr.addColorStop(0.55, '#F6FAFF');
  gr.addColorStop(1, ['#DDE9FA', '#D2E1F7', '#C7DAF4'][depth]);
  g.fillStyle = gr;
  g.fill();
  if (depth === 2) {
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.ellipse(-c.w * 0.14, -c.w * 0.22, c.w * 0.09, c.w * 0.04, -0.3, 0, TAU);
    g.fill();
  }
}
// small far-off clouds drifting slowly
function drawFarClouds(ctx, cam, t) {
  for (let i = 0; i < 6; i++) {
    const x = mod(i * 640 + 200 - t * 5 - cam * 0.08, 3840) - 600;
    if (x < -400 || x > VIEW_W + 400) continue;
    const s = 0.5 + (i % 2) * 0.08;
    const spr = style.sprites.get('farCloud' + i, 576 * s, 360 * s, g => {
      g.scale(s, s);
      paintCloud(g, 50 + i, 0);
    });
    ctx.drawImage(
      spr,
      x - 288 * s,
      300 + (i % 3) * 30 - 180 * s,
      576 * s,
      360 * s
    );
  }
}
// the game's own clouds (same timing and box as before), in the new style;
// each one keeps its picture until it has drifted away
export function drawGameCloud(ctx, cloud) {
  const W = cloud.dWidth;
  const H = cloud.dHeight;
  let art = cloud.art;
  if (!art || art.px !== style.px) {
    const s = (H / 245) * 1.05;
    const k = Math.max(1, Math.round(W / (486 * s)));
    const depth = cloud.speedRandomAdjustment > 15 ? 2 : 1;
    const px = style.px;
    const cv = makeCanvas((W + 40) * px, (H + 40) * px, g => {
      for (let i = 0; i < k; i++) {
        const cx = k === 1 ? W / 2 : 243 * s + ((W - 486 * s) * i) / (k - 1);
        g.setTransform(
          px * s,
          0,
          0,
          px * s,
          (20 + cx) * px,
          (20 + H * 0.59) * px
        );
        paintCloud(g, cloud.random * 3 + i, depth);
      }
    });
    art = cloud.art = { cv, px };
  }
  ctx.drawImage(art.cv, cloud.dX - 20, cloud.dY - 20, W + 40, H + 40);
}

/* ================= far-off hot air balloons ================= */
const FAR_BALLOONS = [
  ['#FF6070', '#FFE14A'],
  ['#4A92FF', '#FFFFFF'],
  ['#4FDC7A', '#FF9F1C'],
];
function paintFarBalloon(g, [c0, c1]) {
  g.save();
  g.translate(0, -100);
  g.beginPath();
  polyPath(g, ENV.pts);
  g.lineWidth = 7;
  g.lineJoin = 'round';
  g.strokeStyle = '#6D8FC0';
  g.stroke();
  g.fillStyle = c0;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = c1;
  g.beginPath();
  ENV.gores.forEach((p, i) => i % 2 && polyPath(g, p));
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(-30, 50, 20, 34, -0.3, 0, TAU);
  g.fill();
  g.restore();
  g.strokeStyle = '#6D8FC0';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-ENV.mw, ENV.mouthY);
  g.lineTo(-14, 196);
  g.moveTo(ENV.mw, ENV.mouthY);
  g.lineTo(14, 196);
  g.stroke();
  g.fillStyle = '#C98A48';
  g.fillRect(-16, 194, 32, 22);
  g.strokeRect(-16, 194, 32, 22);
  g.restore();
}
function drawFarBalloons(ctx, cam, t) {
  FAR_BALLOONS.forEach((colours, i) => {
    const x = mod(i * 910 + 260 - cam * 0.12 + t * 7, 2730) - 300;
    if (x < -60 || x > VIEW_W + 60) return;
    const y = 250 + i * 55 + Math.sin(t * 0.6 + i * 2) * 9;
    const s = 0.2 + i * 0.04;
    const spr = style.sprites.get('farBalloon' + i, 200, 250, g =>
      paintFarBalloon(g, colours)
    );
    ctx.drawImage(spr, x - 100 * s, y - 125 * s, 200 * s, 250 * s);
  });
}

/* ================= filling the ground and the hills ================= */
// runs of one material between x0 and x1: [from, to, material]
function runsOf(x0, x1, matAt, step) {
  const runs = [];
  let start = x0;
  let mat = matAt(x0);
  for (let x = x0 + step; x < x1; x += step) {
    const m = matAt(x);
    if (m !== mat) {
      runs.push([start, x, mat]);
      start = x;
      mat = m;
    }
  }
  runs.push([start, x1, mat]);
  return runs;
}
// where the ground type changes, the two blend softly over 2h px around c
// (a = material on the left, b = on the right)
function blendsAt(xs, matAt, shift = () => 0, h) {
  return xs.map(x => ({
    c: x + shift(x),
    h,
    a: matAt(x - 1),
    b: matAt(x + 1),
  }));
}
// fill everything under a top line: outlined along the top only, with soft
// blends where the material changes (no hard seams)
function layerFill(g, x0, x1, topY, bottom, matAt, blends, gy0, gy1, step) {
  // sample on a grid shared by every slice of every tile
  x0 = Math.floor(x0 / step) * step;
  x1 = Math.ceil(x1 / step) * step;
  const topLine = (p, q) => {
    for (let x = p + step; x < q; x += step) g.lineTo(x, topY(x));
    g.lineTo(q, topY(q));
  };
  const body = (p, q) => {
    g.beginPath();
    g.moveTo(p, bottom);
    g.lineTo(p, topY(p));
    topLine(p, q);
    g.lineTo(q, bottom);
    g.closePath();
  };
  const grad = m => {
    const gr = g.createLinearGradient(0, gy0, 0, gy1);
    gr.addColorStop(0, MATS[m].top);
    gr.addColorStop(1, MATS[m].bot);
    return gr;
  };
  const runs = runsOf(x0, x1, matAt, step);
  // outline first: the fill then covers its lower half
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const [p, q, m] of runs) {
    if (!MATS[m].lw) continue;
    g.beginPath();
    g.moveTo(p, topY(p));
    topLine(p, q);
    g.lineWidth = MATS[m].lw * 2;
    g.strokeStyle = MATS[m].line || OUT;
    g.stroke();
  }
  for (const [p, q, m] of runs) {
    body(p, q + 0.5);
    g.fillStyle = grad(m);
    g.fill();
  }
  for (const bl of blends) {
    const p = Math.max(x0, bl.c - bl.h);
    const q = Math.min(x1, bl.c + bl.h);
    if (q <= p) continue;
    // material a across the blend, then b faded in through a gradient mask
    // (both reach a little past the blend so no clip edge shows)
    g.save();
    body(p, q + 1);
    g.clip();
    g.fillStyle = grad(bl.a);
    g.fillRect(p, gy0 - 600, q + 1 - p, 2400);
    g.restore();
    const layer = makeCanvas(g.canvas.width, g.canvas.height, o => {
      o.setTransform(g.getTransform());
      const gr = o.createLinearGradient(0, gy0, 0, gy1);
      gr.addColorStop(0, MATS[bl.b].top);
      gr.addColorStop(1, MATS[bl.b].bot);
      o.beginPath();
      o.moveTo(p - 1, bottom);
      o.lineTo(p - 1, topY(p - 1));
      for (let x = p + step; x < q + 3; x += step) o.lineTo(x, topY(x));
      o.lineTo(q + 3, topY(q + 3));
      o.lineTo(q + 3, bottom);
      o.closePath();
      o.fillStyle = gr;
      o.fill();
      const fade = o.createLinearGradient(bl.c - bl.h, 0, bl.c + bl.h, 0);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,1)');
      o.globalCompositeOperation = 'destination-in';
      o.fillStyle = fade;
      o.fillRect(p - 4, gy0 - 600, q - p + 8, 2400);
    });
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(layer, 0, 0);
    g.restore();
  }
}
// the biome boundaries along the level (world x)
const biomeEdges = () => level.biomes.slice(1).map(b => b[0]);

/* ================= far mountains (parallax 0.1) ================= */
// straight-sided peaks at seeded heights, with snow caps on the tall ones
const FAR_STEP = 170;
function farPoint(i) {
  return [
    i * FAR_STEP + (h01(i * 3.3 + 1) - 0.5) * 70,
    612 - 160 * Math.pow(h01(i * 7.7 + 2), 1.4),
  ];
}
const far = new TileStrip({
  y0: 430,
  h: 400,
  f: 0.1,
  draw(g, x0, x1) {
    const pts = [];
    for (
      let i = Math.floor(x0 / FAR_STEP) - 2;
      i <= Math.ceil(x1 / FAR_STEP) + 2;
      i++
    )
      pts.push(farPoint(i));
    style.paint(
      g,
      c => {
        c.moveTo(pts[0][0], 830);
        for (const p of pts) c.lineTo(p[0], p[1]);
        c.lineTo(pts[pts.length - 1][0], 830);
        c.closePath();
      },
      'far',
      [0, 450, 0, 820],
      { noLine: true }
    );
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i];
      if (py > 545 || pts[i - 1][1] < py || pts[i + 1][1] < py) continue;
      // follow the two slopes down 44 px, with a wavy lower edge
      const d = Math.min(44, pts[i - 1][1] - py, pts[i + 1][1] - py);
      const xl = px + (pts[i - 1][0] - px) * (d / (pts[i - 1][1] - py));
      const xr = px + (pts[i + 1][0] - px) * (d / (pts[i + 1][1] - py));
      const cap = [
        [px, py - 1],
        [xl - 1, py + d],
      ];
      for (let k = 1; k < 6; k++)
        cap.push([lerp(xl, xr, k / 6), py + d - (k % 2 ? 14 : 3)]);
      cap.push([xr + 1, py + d]);
      style.paint(g, c => polyPath(c, cap), 'farSnow', [0, py, 0, py + d], {
        noLine: true,
      });
    }
  },
});

/* ================= mid layer (parallax 0.3): farms, lighthouses, snowy hills ================= */
const MID_F = 0.3;
// the lighthouses stand on headlands at the far end of Splash Lake and Laser Lagoon
let lighthouses = null;
function lighthouseSpots() {
  if (!lighthouses)
    lighthouses = [level.lakes[0], level.lakes[2]].map(l =>
      layerX(l[1] - 250, MID_F)
    );
  return lighthouses;
}
function midRidge(x) {
  const hillsY = 700 - 34 * noise1(x * 0.006) - 18 * noise1(x * 0.017 + 11);
  let y = lerp(hillsY, 850, lakeness(worldAtLayer(x, MID_F)));
  for (const lx of lighthouseSpots()) {
    const d = (x - lx) / 92;
    if (d * d < 1) y = Math.min(y, 770 + 58 * d * d);
  }
  return y;
}
function midMat(x) {
  const b = biomeAt(worldAtLayer(x, MID_F));
  return b === 'snow' ? 'midSnow' : b === 'sand' ? 'midSand' : 'mid';
}
const mid = new TileStrip({
  y0: 596,
  h: 484,
  f: MID_F,
  draw(g, x0, x1) {
    const edges = biomeEdges().map(x => layerX(x, MID_F));
    layerFill(
      g,
      x0 - 24,
      x1 + 24,
      midRidge,
      1080,
      midMat,
      blendsAt(edges, midMat, undefined, 50),
      660,
      900,
      8
    );
    // farms, windmills, trees and cabins, depending on the ground below
    for (let x = Math.floor(x0 / 90) * 90 - 90; x <= x1 + 90; x += 90) {
      const w = worldAtLayer(x, MID_F);
      const y = midRidge(x);
      const r = h01(Math.floor(x / 90) * 7 + 3);
      const b = biomeAt(w);
      if (y > 780 || lighthouseSpots().some(lx => Math.abs(lx - x) < 140))
        continue;
      if (b === 'grass' && r < 0.18) farm(g, x, y);
      else if (b === 'grass' && r < 0.3) windmillTower(g, x, y + 2);
      else if (b === 'grass' && r < 0.75)
        poplar(g, x + r * 40, y + 4, 28 + r * 16);
      else if (b === 'snow' && r < 0.2) cabin(g, x, y + 2);
      else if (b === 'snow' && r < 0.8)
        pines(g, [[x + r * 30, y + 6, 34 + r * 16, 0]], true);
      else if (b === 'sand' && r < 0.55)
        palms(g, [[x + r * 30, y + 5, 46 + r * 16, 2]]);
    }
    for (const lx of lighthouseSpots())
      if (lx > x0 - 60 && lx < x1 + 60) lighthouse(g, lx, midRidge(lx) + 2);
  },
});
function farm(g, x, y) {
  style.paint(
    g,
    c => rrect(c, x - 30, y - 26, 44, 28, 2),
    'barn',
    [0, y - 26, 0, y],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(x - 34, y - 24);
      c.lineTo(x - 8, y - 44);
      c.lineTo(x + 18, y - 24);
      c.closePath();
    },
    'roof',
    [0, y - 44, 0, y - 24],
    { small: true }
  );
  style.paint(
    g,
    c => rrect(c, x + 18, y - 18, 26, 20, 2),
    'house',
    [0, y - 18, 0, y],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(x + 15, y - 16);
      c.lineTo(x + 31, y - 30);
      c.lineTo(x + 47, y - 16);
      c.closePath();
    },
    'roof2',
    [0, y - 30, 0, y - 16],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.rect(x - 14, y - 12, 8, 12);
      c.rect(x + 27, y - 12, 7, 7);
    },
    'sheepFace',
    [0, 0, 0, 0],
    { noLine: true }
  );
}
function windmillTower(g, x, y) {
  style.paint(
    g,
    c => {
      c.moveTo(x - 10, y);
      c.lineTo(x - 6, y - 44);
      c.lineTo(x + 6, y - 44);
      c.lineTo(x + 10, y);
      c.closePath();
    },
    'windmill',
    [0, y - 44, 0, y],
    { small: true }
  );
}
function poplar(g, x, y, h) {
  style.paint(
    g,
    c => c.ellipse(x, y - h * 0.62, h * 0.2, h * 0.5, 0, 0, TAU),
    'poplar',
    [0, y - h, 0, y],
    { small: true }
  );
}
function cabin(g, x, y) {
  style.paint(
    g,
    c => rrect(c, x - 22, y - 22, 44, 24, 2),
    'cabin',
    [0, y - 22, 0, y],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(x - 28, y - 20);
      c.lineTo(x, y - 40);
      c.lineTo(x + 28, y - 20);
      c.closePath();
    },
    'midSnow',
    [0, y - 40, 0, y - 20],
    { small: true }
  );
  style.paint(
    g,
    c => c.rect(x + 12, y - 44, 7, 14),
    'cabin',
    [0, y - 44, 0, y - 30],
    { small: true }
  );
  style.paint(g, c => c.rect(x - 8, y - 14, 9, 8), 'lamp', [0, 0, 0, 0], {
    noLine: true,
  });
}
// pine trees, batched: list of [x, ground y, height, bend]
function pines(g, list, snowy) {
  style.paint(
    g,
    c => {
      for (const [x, y, h] of list)
        c.rect(x - h * 0.05, y - h * 0.2, h * 0.1, h * 0.22);
    },
    'pineTrunk',
    [0, 0, 0, 0],
    { noLine: true }
  );
  const tier = (c, x, y, h, bend, k, s) => {
    const w = h * 0.3 * (1 - k * 0.22) * s;
    const peak = y - h * 0.16 - k * h * 0.24 - h * 0.4;
    const by = peak + h * 0.4 * s;
    const sh = (bend * (k + 1)) / 3;
    c.moveTo(x - w + sh * 0.3, by);
    c.lineTo(x + sh, peak);
    c.lineTo(x + w + sh * 0.3, by);
    c.closePath();
  };
  style.paint(
    g,
    c => {
      for (const [x, y, h, bend] of list)
        for (let k = 0; k < 3; k++) tier(c, x, y, h, bend, k, 1);
    },
    'pine',
    [0, 0, 0, 0],
    { small: true }
  );
  if (snowy)
    style.paint(
      g,
      c => {
        for (const [x, y, h, bend] of list)
          for (let k = 0; k < 3; k++) tier(c, x, y, h, bend, k, 0.45);
      },
      'pineSnow',
      [0, 0, 0, 0],
      { noLine: true }
    );
}
// small palms for the background, batched: list of [x, ground y, height, bend]
function palms(g, list) {
  const trunks = [];
  const fronds = [];
  for (const [x, y, h, bend] of list) {
    const top = [x + bend + h * 0.08, y - h];
    const mid = [x + bend * 0.3 + h * 0.08, y - h * 0.5];
    const trunk = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const v = 1 - u;
      trunk.push([
        v * v * x + 2 * v * u * mid[0] + u * u * top[0],
        v * v * y + 2 * v * u * mid[1] + u * u * top[1],
      ]);
    }
    trunks.push(ribbon(trunk, h * 0.05, h * 0.032));
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI + 0.3 + k * 0.51 + bend * 0.012;
      const L = h * (0.5 + (k % 2) * 0.12);
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        pts.push([
          top[0] + Math.cos(a) * L * u,
          top[1] + Math.sin(a) * L * u * 0.8 + u * u * L * 0.42,
        ]);
      }
      fronds.push(leafPoly(pts, h * 0.075, 5));
    }
  }
  style.paint(
    g,
    c => {
      for (const p of trunks) polyPath(c, p);
    },
    'pineTrunk',
    [0, 0, 0, 0],
    { noLine: true }
  );
  style.paint(
    g,
    c => {
      for (const p of fronds) polyPath(c, p);
    },
    'farPalm',
    [0, 0, 0, 0],
    { noLine: true }
  );
}
function lighthouse(g, x, y) {
  style.paint(
    g,
    c => {
      c.moveTo(x - 11, y);
      c.lineTo(x - 7, y - 70);
      c.lineTo(x + 7, y - 70);
      c.lineTo(x + 11, y);
      c.closePath();
    },
    'lighthouse',
    [0, y - 70, 0, y],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(x - 9.5, y - 22);
      c.lineTo(x - 8.5, y - 36);
      c.lineTo(x + 8.5, y - 36);
      c.lineTo(x + 9.5, y - 22);
      c.closePath();
      c.moveTo(x - 8, y - 50);
      c.lineTo(x - 7.5, y - 62);
      c.lineTo(x + 7.5, y - 62);
      c.lineTo(x + 8, y - 50);
      c.closePath();
    },
    'lhStripe',
    [0, 0, 0, 0],
    { noLine: true }
  );
  style.paint(
    g,
    c => rrect(c, x - 8, y - 84, 16, 14, 3),
    'lamp',
    [0, y - 84, 0, y - 70],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(x - 11, y - 84);
      c.lineTo(x, y - 95);
      c.lineTo(x + 11, y - 84);
      c.closePath();
    },
    'roof',
    [0, y - 95, 0, y - 84],
    { small: true }
  );
  style.paint(
    g,
    c => rrect(c, x - 17, y - 3, 34, 8, 3),
    'rock',
    [0, y - 3, 0, y + 5],
    { small: true, noGloss: true }
  );
}
// the rotating lamp seen from the side: the beam swings out, shortens as it
// turns away and flashes as it faces us
function lighthouseBeam(ctx, x, y, t) {
  const th = t * 0.9 + x * 0.001;
  const c = Math.cos(th);
  const face = Math.pow(Math.max(0, Math.sin(th)), 8);
  const len = 560 * Math.abs(c);
  const dir = c < 0 ? -1 : 1;
  if (len > 8) {
    const ex = x + dir * len;
    const ey = y - 36 * Math.abs(c);
    for (const [sp, a] of [
      [26 + 70 * Math.abs(c), 0.32],
      [12 + 40 * Math.abs(c), 0.62],
    ]) {
      const gr = ctx.createLinearGradient(x, y, ex, ey);
      gr.addColorStop(0, `rgba(255,246,190,${a})`);
      gr.addColorStop(1, 'rgba(255,246,190,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(ex, ey - sp);
      ctx.lineTo(ex, ey + sp);
      ctx.lineTo(x, y + 5);
      ctx.closePath();
      ctx.fill();
    }
  }
  style.glow(ctx, x, y, 26 + 60 * face, '#FFF3B0', 0.75 + 0.25 * face);
  if (face > 0.05) {
    ctx.fillStyle = `rgba(255,255,255,${face})`;
    ctx.beginPath();
    starPath(ctx, x, y, 10 + 22 * face, 0, 4, 0.2);
    ctx.fill();
  }
}

/* ================= near layer (parallax 0.55) ================= */
const NEAR_F = 0.55;
function nearRidge(x) {
  const hillsY = 772 - 30 * noise1(x * 0.005 + 20) - 14 * noise1(x * 0.02 + 4);
  return lerp(hillsY, 960, lakeness(worldAtLayer(x, NEAR_F)));
}
function nearMat(x) {
  const b = biomeAt(worldAtLayer(x, NEAR_F));
  return b === 'snow' ? 'nearSnow' : b === 'sand' ? 'nearSand' : 'near';
}
const near = new TileStrip({
  y0: 680,
  h: 400,
  f: NEAR_F,
  draw(g, x0, x1) {
    const edges = biomeEdges().map(x => layerX(x, NEAR_F));
    layerFill(
      g,
      x0 - 24,
      x1 + 24,
      nearRidge,
      1080,
      nearMat,
      blendsAt(edges, nearMat, undefined, 80),
      740,
      1000,
      8
    );
    // bushes
    for (let x = Math.floor(x0 / 70) * 70 - 70; x <= x1 + 70; x += 70) {
      const r = h01(Math.floor(x / 70) * 5 + 1);
      const w = worldAtLayer(x, NEAR_F);
      const y = nearRidge(x) + 4;
      if (r > 0.45 || y > 840 || biomeAt(w) === 'snow') continue;
      const s = 16 + r * 20;
      style.paint(
        g,
        c => {
          c.ellipse(x, y - s * 0.5, s * 1.2, s * 0.75, 0, 0, TAU);
          c.moveTo(x + s * 1.7, y - s * 0.3);
          c.ellipse(x + s * 0.9, y - s * 0.3, s * 0.8, s * 0.55, 0, 0, TAU);
        },
        biomeAt(w) === 'sand' ? 'bushSand' : 'bush',
        [0, y - s * 1.3, 0, y],
        { small: true }
      );
    }
  },
});
// trees on the near hills: painted once, bent by the wind with a shear that
// keeps their roots in place
function drawNearTrees(ctx, cam, t) {
  const lx = cam * NEAR_F;
  const m = ctx.getTransform();
  for (
    let x = Math.floor((lx - 150) / 110) * 110;
    x <= lx + VIEW_W + 150;
    x += 110
  ) {
    const r = h01(Math.floor(x / 110) * 3 + 9);
    if (r > 0.5) continue;
    const px = x + r * 50;
    const y = nearRidge(px) + 4;
    if (y > 850) continue;
    const b = biomeAt(worldAtLayer(px, NEAR_F));
    const sx = px - lx;
    const bend = (windAt(t, sx) - 0.4) * 6 + Math.sin(t * 1.4 + px) * 1.5;
    if (b === 'sand') {
      const h = r < 0.25 ? 110 : 140;
      const spr = sprite('nearPalm' + h, h * 1.5, h + 30, g =>
        palms(g, [[0, (h + 30) / 2 - 6, h, 0]])
      );
      bent(ctx, m, spr, h * 1.5, h + 30, h + 30 - 6, sx, y, (bend * 1.6) / h);
    } else {
      const h = 56 + Math.round(r * 2) * 15;
      const snowy = b === 'snow';
      const spr = sprite((snowy ? 'pineS' : 'pineG') + h, h * 0.75, h + 16, g =>
        pines(g, [[0, (h + 16) / 2 - 6, h, 0]], snowy)
      );
      bent(ctx, m, spr, h * 0.75, h + 16, h + 16 - 6, sx, y, bend / h);
    }
  }
  ctx.setTransform(m);
}
// draw sprite spr (w x h, its root on row `root`) with its root at x, y,
// sheared sideways by k (m is the transform to draw in)
function bent(ctx, m, spr, w, h, root, x, y, k) {
  ctx.setTransform(
    m.a,
    m.b,
    m.c - k * m.a,
    m.d - k * m.b,
    m.e + m.a * x + m.c * y,
    m.f + m.b * x + m.d * y
  );
  ctx.drawImage(spr, -w / 2, -root, w, h);
}
// sprites painted once, with small glossy highlights switched on
function sprite(key, w, h, paint) {
  return style.sprites.get(key, w, h, g => {
    style.caching = true;
    paint(g);
    style.caching = false;
  });
}

/* ================= live bits of the background (sails, sheep, boats, birds) ================= */
function drawMidLive(ctx, cam, t) {
  const off = -cam * MID_F;
  const x0 = cam * MID_F - 100;
  const x1 = x0 + VIEW_W + 200;
  const sheep = [];
  const sails = [];
  for (let x = Math.floor(x0 / 90) * 90; x <= x1; x += 90) {
    const r = h01(Math.floor(x / 90) * 7 + 3);
    const y = midRidge(x);
    if (y > 780 || biomeAt(worldAtLayer(x, MID_F)) !== 'grass') continue;
    if (lighthouseSpots().some(lx => Math.abs(lx - x) < 140)) continue;
    if (r >= 0.18 && r < 0.3) sails.push([x + off, y - 42, t * 0.9 + x]);
    else if (r >= 0.75 && r < 0.9)
      for (let k = 0; k < 3; k++)
        sheep.push([
          x + off + k * 26 + Math.sin(t * 0.3 + k + x) * 3,
          y + 8 - k * 2,
          Math.sin(t * 2 + k * 2 + x) > 0.7,
        ]);
  }
  if (sails.length)
    style.paint(
      ctx,
      c => {
        for (const [mx, my, sa] of sails)
          for (let k = 0; k < 4; k++) {
            const a = sa + (k * TAU) / 4,
              ca = Math.cos(a),
              s2 = Math.sin(a);
            c.moveTo(mx + ca * 4, my + s2 * 4);
            c.lineTo(mx + ca * 30 - s2 * 5, my + s2 * 30 + ca * 5);
            c.lineTo(mx + ca * 30 + s2 * 2, my + s2 * 30 - ca * 2);
            c.closePath();
          }
      },
      'millSail',
      [0, 0, 0, 0],
      { small: true }
    );
  if (sheep.length) {
    style.paint(
      ctx,
      c => {
        for (const [x, y] of sheep)
          for (const [dx, dy, r] of [
            [-5, -6, 6],
            [2, -8, 7],
            [8, -5, 5.5],
            [0, -3, 6],
          ]) {
            c.moveTo(x + dx + r, y + dy);
            c.arc(x + dx, y + dy, r, 0, TAU);
          }
      },
      'sheep',
      [0, 0, 0, 0],
      { small: true }
    );
    style.paint(
      ctx,
      c => {
        for (const [x, y, down] of sheep) {
          const fy = y - (down ? 1 : 6);
          c.moveTo(x + 16.6, fy);
          c.ellipse(x + 13, fy, 3.6, 4.4, 0.4, 0, TAU);
        }
      },
      'sheepFace',
      [0, 0, 0, 0],
      { noLine: true }
    );
  }
  // lighthouse beams and sailboats on the far water
  for (const lx of lighthouseSpots()) {
    const sx = lx + off;
    if (sx > -600 && sx < VIEW_W + 600)
      lighthouseBeam(ctx, sx, midRidge(lx) + 2 - 77, t);
  }
  for (const [a, b] of level.lakes) {
    const la = layerX(a, MID_F) + off;
    const lb = layerX(b, MID_F) + off;
    if (lb < -100 || la > VIEW_W + 100) continue;
    const span = Math.max(80, lb - la - 170);
    const u = mod(t * 7 + a, span * 2);
    const bx = la + 60 + (u < span ? u : span * 2 - u);
    const dir = u < span ? 1 : -1;
    const bob = Math.sin(t * 1.7 + a) * 1.2;
    style.paint(
      ctx,
      c => {
        c.moveTo(bx - 22, 788 + bob);
        c.lineTo(bx + 24, 788 + bob);
        c.lineTo(bx + 16, 797 + bob);
        c.lineTo(bx - 16, 797 + bob);
        c.closePath();
      },
      'boat',
      [0, 788, 0, 797],
      { small: true }
    );
    style.paint(
      ctx,
      c => {
        c.moveTo(bx, 740 + bob);
        c.lineTo(bx + 1, 786 + bob);
        c.lineTo(bx + 22 * dir, 786 + bob);
        c.closePath();
        c.moveTo(bx - 3 * dir, 748 + bob);
        c.lineTo(bx - 3 * dir, 786 + bob);
        c.lineTo(bx - 20 * dir, 786 + bob);
        c.closePath();
      },
      'boatSail',
      [0, 740, 0, 786],
      { small: true }
    );
  }
}
function drawBirds(ctx, cam, t) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#4F74A8';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const row = Math.abs(i - 2);
    const x = mod(1650 - t * 34 - cam * 0.22 + row * 26, 2600) - 300;
    const y = 172 + row * 15 + Math.sin(t * 0.8) * 5;
    const f = Math.sin(t * 8.5 + i * 0.9) * 4.5;
    ctx.moveTo(x - 8, y - f);
    ctx.quadraticCurveTo(x - 4, y - 4.5 - f * 0.3, x, y);
    ctx.quadraticCurveTo(x + 4, y - 4.5 - f * 0.3, x + 8, y - f);
  }
  ctx.stroke();
}

/* ================= the ground (parallax 1, from the crash line) ================= */
const ground = new TileStrip({
  y0: 560,
  h: 530,
  f: 1,
  draw(g, x0, x1) {
    const a = x0 - 30;
    const b = x1 + 30;
    // the body of the ground; at a lake shore the change of ground type
    // happens out of sight, under the lake
    const H = 150;
    const underLake = x => (lakeAt(x + 2) ? H : lakeAt(x - 2) ? -H : 0);
    layerFill(
      g,
      a,
      b,
      groundY,
      1100,
      biomeAt,
      blendsAt(biomeEdges(), biomeAt, underLake, H),
      760,
      1080,
      4
    );
    for (const [p, q, m] of runsOf(a, b, biomeAt, 4)) groundDetail(g, p, q, m);
    // sandy lake beds with a few pebbles
    for (const lake of level.lakes) {
      const p = Math.max(a, lake[0]);
      const q = Math.min(b, lake[1]);
      if (q <= p) continue;
      const band = x =>
        44 * sstep(0, 120, x - lake[0]) * sstep(0, 120, lake[1] - x);
      style.paint(
        g,
        c => {
          c.moveTo(p, seabedY(p, lake));
          for (let x = p; x <= q; x += 6) c.lineTo(x, seabedY(x, lake));
          c.lineTo(q, seabedY(q, lake));
          for (let x = q; x >= p; x -= 6)
            c.lineTo(x, seabedY(x, lake) + band(x));
          c.closePath();
        },
        'seabed',
        [0, 930, 0, 1080],
        { noLine: true }
      );
      style.paint(
        g,
        c => {
          for (let x = Math.ceil(p / 37) * 37; x < q; x += 37) {
            const k = x / 37;
            if (h01(k * 3.1) > 0.4 || x < lake[0] + 60 || x > lake[1] - 60)
              continue;
            const r = 5 + h01(k * 1.7) * 7;
            const y = seabedY(x, lake) + 3;
            c.moveTo(x + r, y);
            c.ellipse(x, y, r, r * 0.7, 0, 0, TAU);
          }
        },
        'pebble',
        [0, 0, 0, 0],
        { small: true }
      );
    }
    // rock outcrops: their tops ARE the crash line
    for (const r of level.rocks) if (r.x1 > a && r.x0 < b) rockOutcrop(g, r);
    staticDecor(g, a, b);
  },
});
function groundDetail(g, p, q, m) {
  g.save();
  g.beginPath();
  g.moveTo(p, 1100);
  g.lineTo(p, groundY(p));
  for (let x = Math.ceil(p / 4) * 4; x <= q; x += 4) g.lineTo(x, groundY(x));
  g.lineTo(q, groundY(q));
  g.lineTo(q, 1100);
  g.closePath();
  g.clip();
  // a lighter lip along the top edge
  g.beginPath();
  let first = true;
  for (let x = Math.ceil(p / 6) * 6; x <= q; x += 6) {
    if (lakeAt(x)) {
      first = true;
      continue;
    }
    const y = groundY(x) + 9;
    if (first) g.moveTo(x, y);
    else g.lineTo(x, y);
    first = false;
  }
  g.lineWidth = m === 'sand' ? 10 : 12;
  g.lineJoin = 'round';
  g.strokeStyle =
    m === 'grass'
      ? 'rgba(196,245,120,0.8)'
      : m === 'snow'
      ? 'rgba(255,255,255,0.95)'
      : 'rgba(255,244,200,0.9)';
  g.stroke();
  // speckles: grass dots, snow sparkles, sand grains
  g.fillStyle =
    m === 'grass'
      ? 'rgba(40,120,40,0.22)'
      : m === 'snow'
      ? 'rgba(120,160,210,0.35)'
      : 'rgba(196,128,50,0.45)';
  g.beginPath();
  for (let x = Math.ceil(p / 14) * 14; x < q; x += 14) {
    const k = Math.floor(x / 14);
    if (lakeAt(x)) continue;
    const y = groundY(x) + 16 + h01(k * 3) * 170;
    const r = 1.5 + h01(k * 5) * (m === 'grass' ? 3 : 2);
    g.moveTo(x + r, y);
    g.arc(x, y, r, 0, TAU);
  }
  g.fill();
  g.restore();
}
// a cluster of boulders: the top IS the crash line; the bottom sits just
// into the ground, and the ends round off
function rockOutcrop(g, r) {
  const n = Math.max(4, Math.round((r.x1 - r.x0) / 4));
  const xAt = i => r.x0 + ((r.x1 - r.x0) * i) / n;
  const top = [];
  for (let i = 0; i <= n; i++) top.push([xAt(i), crashY(xAt(i)) - 1]);
  const bottomY = i => {
    const x = xAt(i);
    return Math.max(
      crashY(x) + 4,
      groundY(x) + 5 + 14 * Math.pow(Math.sin((Math.PI * i) / n), 0.5)
    );
  };
  const base = [];
  for (let i = n; i >= 0; i -= 2) base.push([xAt(i), bottomY(i)]);
  const pts = top.concat(base);
  const yTop = Math.min(...top.map(p => p[1]));
  const yBot = Math.max(...base.map(p => p[1]));
  style.paint(g, c => smoothPath(c, pts), 'rock', [r.x0, yTop, r.x1, yBot], {
    gloss: true,
  });
  // shade the lower part
  g.save();
  g.beginPath();
  smoothPath(g, pts);
  g.clip();
  g.fillStyle = 'rgba(60,70,95,0.16)';
  g.beginPath();
  g.moveTo(r.x0, yBot + 10);
  for (let i = 0; i <= n; i += 2)
    g.lineTo(
      xAt(i),
      lerp(top[i][1], bottomY(i), 0.55) + 5 * Math.sin(xAt(i) * 0.05)
    );
  g.lineTo(r.x1, yBot + 10);
  g.closePath();
  g.fill();
  g.restore();
  // an outline down from each dip in the top, so a cluster reads as
  // separate boulders; small cracks on the wider faces
  const creases = [];
  for (let i = 6; i <= n - 6; i++) {
    const y = top[i][1];
    let lowest = true;
    let peak = y;
    for (let k = -15; k <= 15; k++) {
      const j = i + k;
      if (j < 0 || j > n) continue;
      if (Math.abs(k) <= 6 && top[j][1] > y + 0.01) lowest = false;
      peak = Math.min(peak, top[j][1]);
    }
    if (lowest && y - peak > 9 && !creases.some(c => Math.abs(c - i) < 10))
      creases.push(i);
  }
  style.stroke(
    g,
    c => {
      for (const i of creases) {
        const [x, y] = top[i];
        const yb = bottomY(i);
        c.moveTo(x, y + 2);
        c.quadraticCurveTo(x - 7, lerp(y, yb, 0.5), x - 2, lerp(y, yb, 0.85));
      }
    },
    'ink',
    4
  );
  style.stroke(
    g,
    c => {
      for (let x = r.x0 + 34; x < r.x1 - 24; x += 66) {
        if (creases.some(i => Math.abs(xAt(i) - x) < 30)) continue;
        const y = crashY(x) + 12;
        c.moveTo(x, y);
        c.lineTo(x + 8, y + 12);
        c.lineTo(x + 3, y + 22);
      }
    },
    'crack',
    2
  );
}
// low decorations that never move: pebbles, shells, starfish, sandcastles, snowmen
function staticDecor(g, a, b) {
  const d = level.deco;
  style.paint(
    g,
    c => {
      for (let x = Math.ceil(a / 90) * 90; x < b; x += 90) {
        const k = x / 90;
        if (h01(k * 2.7) > 0.22) continue;
        const px = x + h01(k * 4.1) * 50;
        if (
          lakeAt(px - 30) ||
          lakeAt(px + 30) ||
          level.rocks.some(r => px > r.x0 - 30 && px < r.x1 + 30)
        )
          continue;
        const y = groundY(px) + 7;
        for (const [dx, rr] of [
          [0, 8 + h01(k) * 5],
          [13, 5 + h01(k * 9) * 3],
        ]) {
          c.moveTo(px + dx + rr, y);
          c.ellipse(px + dx, y, rr, rr * 0.72, 0, 0, TAU);
        }
      }
    },
    'pebble',
    [0, 0, 0, 0],
    { small: true }
  );
  for (const s of d.shells)
    if (s.x > a && s.x < b) shell(g, s.x, groundY(s.x) + 4, s.i);
  for (const s of d.starfish) {
    if (s.x < a || s.x > b) continue;
    const y = groundY(s.x) - 1;
    style.paint(
      g,
      c => starPath(c, s.x, y, 14, s.rot, 5, 0.44),
      'starfish',
      [s.x - 14, y - 14, s.x + 14, y + 14],
      { small: true }
    );
  }
  for (const s of d.castles)
    if (s.x > a - 80 && s.x < b + 80) sandcastle(g, s.x, groundY(s.x) + 6);
  for (const s of d.snowmen)
    if (s.x > a - 60 && s.x < b + 60) snowman(g, s.x, groundY(s.x) + 4);
}
function shell(g, x, y, i) {
  const r = 9 + (i % 2) * 2;
  const a = -0.3 + i * 0.5;
  style.paint(
    g,
    c => {
      c.moveTo(x, y);
      c.arc(x, y, r, Math.PI + a, TAU + a);
      c.closePath();
    },
    'shell',
    [x - r, y - r, x + r, y],
    { small: true }
  );
  style.stroke(
    g,
    c => {
      for (let k = 1; k < 5; k++) {
        const aa = Math.PI + a + (k / 5) * Math.PI;
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(aa) * r * 0.9, y + Math.sin(aa) * r * 0.9);
      }
    },
    'shellLine',
    1.1
  );
}
function sandcastle(g, x, y) {
  style.paint(
    g,
    c => {
      c.moveTo(x - 28, y);
      c.lineTo(x - 25, y - 24);
      c.lineTo(x + 25, y - 24);
      c.lineTo(x + 28, y);
      c.closePath();
      for (const tx of [-22, 14]) {
        c.moveTo(tx + x - 2, y - 24);
        c.lineTo(tx + x - 1, y - 40);
        for (let k = 0; k < 3; k++) {
          c.lineTo(tx + x + k * 3.5, y - 40);
          c.lineTo(tx + x + k * 3.5, y - 45);
          c.lineTo(tx + x + k * 3.5 + 1.8, y - 45);
          c.lineTo(tx + x + k * 3.5 + 1.8, y - 40);
        }
        c.lineTo(tx + x + 9, y - 40);
        c.lineTo(tx + x + 10, y - 24);
        c.closePath();
      }
    },
    'castle',
    [0, y - 45, 0, y]
  );
  style.paint(
    g,
    c => rrect(c, x - 6, y - 16, 12, 16, 6),
    'castleDoor',
    [0, 0, 0, 0],
    { noLine: true }
  );
  style.stroke(
    g,
    c => {
      c.moveTo(x - 17, y - 45);
      c.lineTo(x - 17, y - 62);
    },
    'ink',
    2.4
  );
  style.paint(
    g,
    c => {
      c.moveTo(x - 17, y - 62);
      c.lineTo(x - 3, y - 57);
      c.lineTo(x - 17, y - 52);
      c.closePath();
    },
    'flag',
    [0, y - 62, 0, y - 52],
    { small: true }
  );
}
function snowman(g, x, y) {
  style.paint(
    g,
    c => {
      c.arc(x, y - 16, 17, 0, TAU);
      c.moveTo(x + 12, y - 44);
      c.arc(x, y - 44, 12, 0, TAU);
    },
    'snowman',
    [x - 17, y - 56, x + 17, y],
    { gloss: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(x + 3, y - 45);
      c.lineTo(x + 16, y - 43);
      c.lineTo(x + 3, y - 41);
      c.closePath();
    },
    'carrot',
    [0, 0, 0, 0],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(x - 12, y - 36);
      c.quadraticCurveTo(x, y - 30, x + 12, y - 36);
      c.lineTo(x + 12, y - 31);
      c.quadraticCurveTo(x, y - 25, x - 12, y - 31);
      c.closePath();
      c.moveTo(x + 6, y - 32);
      c.lineTo(x + 10, y - 20);
      c.lineTo(x + 3, y - 20);
      c.lineTo(x + 2, y - 31);
      c.closePath();
    },
    'scarf',
    [0, y - 36, 0, y - 20],
    { small: true }
  );
  g.fillStyle = OUT;
  g.beginPath();
  for (const [ex, ey, er] of [
    [-4, -48, 1.8],
    [3, -49, 1.8],
    [0, -16, 1.8],
    [0, -9, 1.8],
  ]) {
    g.moveTo(x + ex + er, y + ey);
    g.arc(x + ex, y + ey, er, 0, TAU);
  }
  g.fill();
  style.stroke(
    g,
    c => {
      c.moveTo(x - 12, y - 28);
      c.lineTo(x - 26, y - 40);
      c.moveTo(x - 20, y - 34);
      c.lineTo(x - 24, y - 30);
      c.moveTo(x + 12, y - 28);
      c.lineTo(x + 25, y - 38);
    },
    'trunkLine',
    2.4
  );
}

/* ================= water ================= */
// height of the water surface at world x
export function waveY(x, t) {
  return (
    SURFACE_Y +
    3.2 * Math.sin(x * 0.021 - t * 2.1) +
    1.8 * Math.sin(x * 0.053 + t * 2.9)
  );
}
export function drawWater(ctx, cam, t) {
  if (skip.water) return;
  for (const lake of level.lakes) {
    const a = Math.max(lake[0] - cam - 4, -40);
    const b = Math.min(lake[1] - cam + 4, VIEW_W + 40);
    if (b <= a) continue;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a, waveY(a + cam, t));
    for (let x = a; x <= b; x += 8) ctx.lineTo(x, waveY(x + cam, t));
    ctx.lineTo(b, waveY(b + cam, t));
    for (let x = b; x >= a; x -= 8)
      ctx.lineTo(x, Math.max(seabedY(x + cam, lake) + 2, waveY(x + cam, t)));
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, SURFACE_Y - 6, 0, 1060);
    gr.addColorStop(0, 'rgba(70,214,252,0.9)');
    gr.addColorStop(1, 'rgba(12,112,196,0.94)');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.clip();
    // seaweed swaying on the lake bed
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(46,178,112,0.6)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let wx = Math.ceil((a + cam) / 53) * 53; wx < b + cam; wx += 53) {
      const k = wx / 53;
      if (h01(k * 2.3) > 0.42) continue;
      const x = wx - cam;
      const yb = seabedY(wx, lake) + 4;
      const h = Math.min(30 + h01(k * 5.1) * 44, yb - SURFACE_Y - 22);
      if (h < 14) continue;
      const sw = Math.sin(t * 1.3 + k) * 8;
      ctx.moveTo(x, yb);
      ctx.bezierCurveTo(
        x + sw,
        yb - h * 0.33,
        x - sw,
        yb - h * 0.66,
        x + sw * 0.8,
        yb - h
      );
    }
    ctx.stroke();
    // light rays and drifting highlights
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const x = mod(i * 230 - t * 26 - cam, 2070) - 60;
      ctx.moveTo(x, SURFACE_Y);
      ctx.lineTo(x + 38, SURFACE_Y);
      ctx.lineTo(x - 26, 1060);
      ctx.lineTo(x - 78, 1060);
      ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const x = mod(i * 151 + t * 20 - cam, 2100) - 90;
      const y = SURFACE_Y + 18 + (i % 4) * 17;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18 + (i % 3) * 12, y);
    }
    ctx.stroke();
    ctx.restore();
    // the surface line: this is where the balloon pops, so it is crisp
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a, waveY(a + cam, t));
    for (let x = a; x <= b; x += 6) ctx.lineTo(x, waveY(x + cam, t));
    ctx.lineTo(b, waveY(b + cam, t));
    ctx.lineWidth = 10;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#EAFCFF';
    ctx.stroke();
    // foam where the water meets the shore
    ctx.beginPath();
    for (const x of [lake[0] - cam, lake[1] - cam]) {
      if (x < -60 || x > VIEW_W + 60) continue;
      for (let k = 0; k < 4; k++) {
        const fx = x + (k - 1.5) * 13 + Math.sin(t * 2.2 + k) * 4;
        const r = 6 + (k % 2) * 3;
        ctx.moveTo(fx + r, SURFACE_Y + 1);
        ctx.arc(fx, SURFACE_Y + 1, r, 0, TAU);
      }
    }
    ctx.lineWidth = 10;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    // sparkles on the water
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const cyc = t * 0.8 + i * 0.41;
      const ph = cyc - Math.floor(cyc);
      if (ph > 0.35) continue;
      const k = Math.floor(cyc) * 13 + i * 7;
      const x = a + 40 + h01(k) * Math.max(10, b - a - 80);
      const y = SURFACE_Y + 14 + h01(k + 3) * 70;
      starPath(ctx, x, y, Math.sin((ph / 0.35) * Math.PI) * 10, 0, 4, 0.3);
    }
    ctx.fill();
  }
}

/* ================= swaying ground details =================
   Grass clumps, flowers and tufts are painted once and drawn every frame,
   bent by the wind (a shear keeps their roots in place). The palms and the
   finish sign are repainted 20 times a second into pictures of their own. */
const TUFTS = 16;
const FLOWER_H = [21, 28, 35];
let details = null;
function groundDetails() {
  if (!details) {
    const d = level.deco;
    const tufts = [];
    const bl = d.blades;
    for (let i = 0; i < bl.length; ) {
      let j = i + 1;
      while (j < bl.length && bl[j].x - bl[i].x < 13 && j - i < 4) j++;
      const x = (bl[i].x + bl[j - 1].x) / 2;
      tufts.push({
        x,
        y: groundY(x) + 4,
        v: Math.floor(h01(Math.floor(x) * 0.37 + 5) * TUFTS),
        ph: bl[i].ph,
      });
      i = j;
    }
    const withY = (list, dy) => list.map(o => ({ ...o, y: groundY(o.x) + dy }));
    const flowers = withY(d.flowers, 3).map(f => ({
      ...f,
      hq: FLOWER_H.reduce((a, b) =>
        Math.abs(b - f.h) < Math.abs(a - f.h) ? b : a
      ),
    }));
    details = {
      tufts,
      flowers,
      dandelions: withY(d.dandelions, 3),
      snowTufts: withY(d.snowTufts, 2).map((o, i) => ({ ...o, v: i % 4 })),
      beachTufts: withY(d.beachTufts, 4).map((o, i) => ({ ...o, v: i % 3 })),
      butterflies: flowers.filter(f => h01(Math.floor(f.x)) <= 0.08),
    };
  }
  return details;
}
// the first item at or after x in a list sorted by x
function firstFrom(list, x) {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].x < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function paintTuft(g, v) {
  const r = mulberry(4000 + v * 17);
  const n = 3 + Math.floor(r() * 3);
  g.lineCap = 'round';
  g.lineWidth = 3.4;
  for (let i = 0; i < n; i++) {
    const bx = (i - (n - 1) / 2) * 3.8 + (r() - 0.5) * 2;
    const h = 15 + r() * 22;
    const lean = (r() - 0.5) * 7 + (i - (n - 1) / 2) * 1.6;
    g.beginPath();
    g.moveTo(bx, 24);
    g.quadraticCurveTo(bx + lean * 0.45, 24 - h * 0.6, bx + lean, 24 - h);
    g.strokeStyle = BLADES[Math.floor(r() * 3)];
    g.stroke();
  }
}
function paintFlower(g, kind, h) {
  const hy = 26 - h;
  style.stroke(
    g,
    c => {
      c.moveTo(0, 26);
      c.quadraticCurveTo(1.5, 26 - h * 0.5, 0, hy);
    },
    'stem',
    2.4
  );
  const r = kind === 'poppy' ? 6.2 : 5;
  const n = kind === 'poppy' ? 4 : 5;
  style.paint(
    g,
    c => {
      for (let i = 0; i < n; i++) {
        const a = 0.4 + (i / n) * TAU;
        const ex = Math.cos(a) * r * 0.9;
        const ey = hy + Math.sin(a) * r * 0.9;
        c.moveTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
        c.ellipse(ex, ey, r, r * 0.62, a, 0, TAU);
      }
    },
    'petal_' + kind,
    [0, 0, 0, 0],
    { small: true }
  );
  style.paint(g, c => c.arc(0, hy, 2.8, 0, TAU), 'flowerC', [0, 0, 0, 0], {
    noLine: true,
  });
}
function paintDandelion(g) {
  style.stroke(
    g,
    c => {
      c.moveTo(0, 26);
      c.quadraticCurveTo(1, 8, 0, -10);
    },
    'stem',
    2.2
  );
  style.paint(g, c => c.arc(0, -10, 11, 0, TAU), 'puff', [0, 0, 0, 0], {
    noLine: true,
  });
  style.stroke(
    g,
    c => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        c.moveTo(0, -10);
        c.lineTo(Math.cos(a) * 10, -10 + Math.sin(a) * 10);
      }
    },
    'puffLine',
    0.8
  );
}
function paintSnowTuft(g, v) {
  const h = 9 + v * 3;
  g.lineCap = 'round';
  g.lineWidth = 2.4;
  g.strokeStyle = '#9DB8DC';
  g.beginPath();
  for (let k = -1; k <= 1; k++) {
    const hh = h * (k ? 1 : 1.35);
    g.moveTo(k * 2, 12);
    g.quadraticCurveTo(k * 4, 12 - hh * 0.6, k * 7, 12 - hh);
  }
  g.stroke();
}
function paintBeachTuft(g, v) {
  style.stroke(
    g,
    c => {
      for (let k = 0; k < 7; k++) {
        const bx = (k - 3) * 3.4;
        const h = 16 + ((k + v) % 3) * 7;
        const lean = (k - 3) * 2;
        c.moveTo(bx, 18);
        c.quadraticCurveTo(bx + lean * 0.4, 18 - h * 0.6, bx + lean, 18 - h);
      }
    },
    'dune',
    2.4
  );
}
// a picture of its own for things too big and wobbly for a shear (palms, the
// finish sign), repainted 20 times a second; world box x0..x0+w, y0..y0+h.
// Each has its own moment in the 1/20 s, so they don't all repaint in the
// same frame
const livePics = new Map();
function livePicture(ctx, key, x0, y0, w, h, cam, t, paint) {
  const px = style.px;
  let s = livePics.get(key);
  if (!s || s.px !== px) {
    s = { cv: makeCanvas(w * px, h * px), px, slot: -1, phase: h01(x0) };
    livePics.set(key, s);
  }
  const slot = Math.floor(t * 20 + s.phase);
  if (s.slot !== slot) {
    const g = s.cv.getContext('2d');
    timed(
      'picture',
      () => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, s.cv.width, s.cv.height);
        g.setTransform(px, 0, 0, px, -x0 * px, -y0 * px);
        style.caching = true;
        paint(g);
        style.caching = false;
      },
      g
    );
    s.slot = slot;
  }
  ctx.drawImage(s.cv, x0 - cam, y0, w, h);
}
// the same for a picture that never changes (painted once per output scale)
const stillPics = new Map();
function stillPicture(key, x0, y0, w, h, paint) {
  const px = style.px;
  let s = stillPics.get(key);
  if (!s || s.px !== px) {
    s = { cv: makeCanvas(w * px, h * px), px };
    const g = s.cv.getContext('2d');
    g.setTransform(px, 0, 0, px, -x0 * px, -y0 * px);
    style.caching = true;
    paint(g);
    style.caching = false;
    stillPics.set(key, s);
  }
  return s.cv;
}
// the world box of a crash-line palm's pictures
const palmBox = p => [
  p.x - p.left - 110,
  p.top - 70,
  p.left + p.right + 220,
  p.ground - p.top + 110,
];
function palmSkirtPicture(p) {
  const [x0, y0, w, h] = palmBox(p);
  return stillPicture(p, x0, y0, w, h, g => palmSkirt(g, p));
}
// paint the palms' hanging fronds while the game loads, not mid-flight
export function warmUp() {
  for (const p of level.palms) palmSkirtPicture(p);
}
function drawGroundDetails(ctx, cam, t) {
  const D = groundDetails();
  const x0 = cam - 60;
  const x1 = cam + VIEW_W + 60;
  const m = ctx.getTransform();
  const each = (list, fn) => {
    for (let i = firstFrom(list, x0); i < list.length && list[i].x < x1; i++)
      fn(list[i], list[i].x - cam);
  };
  each(D.tufts, (o, sx) => {
    const k = (windAt(t, sx) - 0.2) * 0.75 + Math.sin(t * 2.7 + o.ph) * 0.06;
    bent(
      ctx,
      m,
      sprite('tuft' + o.v, 44, 56, g => paintTuft(g, o.v)),
      44,
      56,
      52,
      sx,
      o.y,
      k
    );
  });
  each(D.snowTufts, (o, sx) => {
    bent(
      ctx,
      m,
      sprite('snowTuft' + o.v, 24, 28, g => paintSnowTuft(g, o.v)),
      24,
      28,
      26,
      sx,
      o.y,
      (windAt(t, sx) - 0.25) * 0.4
    );
  });
  each(D.beachTufts, (o, sx) => {
    bent(
      ctx,
      m,
      sprite('beachTuft' + o.v, 44, 44, g => paintBeachTuft(g, o.v)),
      44,
      44,
      40,
      sx,
      o.y,
      (windAt(t, sx) - 0.2) * 0.7
    );
  });
  each(D.flowers, (f, sx) => {
    const k = (windAt(t, sx) - 0.3) * 0.55 + Math.sin(t * 2.3 + f.ph) * 0.07;
    bent(
      ctx,
      m,
      sprite(`flower:${f.kind}:${f.hq}`, 32, 64, g =>
        paintFlower(g, f.kind, f.hq)
      ),
      32,
      64,
      58,
      sx,
      f.y,
      k
    );
  });
  each(D.dandelions, (o, sx) => {
    bent(
      ctx,
      m,
      sprite('dandelion', 32, 64, paintDandelion),
      32,
      64,
      58,
      sx,
      o.y,
      (windAt(t, sx) - 0.3) * 0.4
    );
  });
  ctx.setTransform(m);
  // crabs scuttling to and fro
  for (const cr of level.deco.crabs) {
    const x = cr.x + 50 * Math.sin(t * 0.7 + cr.ph);
    if (x < x0 || x > x1) continue;
    const f = Math.floor(t * 16 + cr.ph * 3) % 8;
    ctx.drawImage(
      sprite('crab' + f, 64, 44, g =>
        crab(g, 0, 12, (f / 8) * TAU, Math.sin((f / 8) * TAU))
      ),
      x - cam - 32,
      groundY(x) - 4 - 34,
      64,
      44
    );
  }
  // butterflies over the meadows
  for (const f of D.butterflies) {
    if (f.x < x0 || f.x > x1) continue;
    const bx = f.x + 42 * Math.sin(t * 0.8 + f.ph) - cam;
    const by = f.y - 63 + 22 * Math.sin(t * 1.6 + f.ph);
    const flap = Math.round(Math.abs(Math.sin(t * 13 + f.ph)) * 4);
    const i = Math.floor(f.ph * 3) % 3;
    ctx.drawImage(
      sprite(`butterfly${i}:${flap}`, 32, 28, g =>
        butterfly(g, 0, 0, flap / 4, i)
      ),
      bx - 16,
      by - 14,
      32,
      28
    );
  }
  // the palm trees that are part of the crash line, and the finish sign
  for (const p of level.palms) {
    const [a, top, w, h] = palmBox(p);
    if (a + w < x0 || a > x1) continue;
    ctx.drawImage(palmSkirtPicture(p), a - cam, top, w, h);
    livePicture(ctx, p, a, top, w, h, cam, t, g =>
      palm(g, p, windAt(t, p.x - cam), t)
    );
  }
  const fin = level.finish;
  if (fin && fin.x1 + 60 > x0 && fin.rampX - 60 < x1) {
    const a = fin.rampX - 40;
    livePicture(
      ctx,
      fin,
      a,
      fin.top - 30,
      fin.x1 + 70 - a,
      1000 - (fin.top - 30),
      cam,
      t,
      g => finishSign(g, fin, t, windAt(t, fin.x0 - cam))
    );
  }
}
function crab(g, x, y, leg, claw) {
  style.stroke(
    g,
    c => {
      for (let s = -1; s <= 1; s += 2)
        for (let k = 0; k < 3; k++) {
          const ph = Math.sin(leg + k * 1.9 + (s > 0 ? 1 : 0)) * 3;
          c.moveTo(x + s * 8, y - 6 + k * 2);
          c.quadraticCurveTo(
            x + s * (18 + k * 2),
            y - 12 + ph,
            x + s * (20 + k * 3),
            y + 2
          );
        }
    },
    'crabLeg',
    2.4
  );
  style.paint(
    g,
    c => {
      for (let s = -1; s <= 1; s += 2) {
        const cy = y - 17 - claw * 2 * s;
        c.moveTo(x + s * 20 + 6, cy);
        c.ellipse(x + s * 20, cy, 6, 4.5, s * 0.5, 0, TAU);
      }
    },
    'crab',
    [0, y - 24, 0, y - 10],
    { small: true }
  );
  style.paint(
    g,
    c => c.ellipse(x, y - 8, 15, 9.5, 0, 0, TAU),
    'crab',
    [x - 15, y - 18, x + 15, y + 2],
    { small: true, gloss: true }
  );
  style.stroke(
    g,
    c => {
      c.moveTo(x - 4, y - 16);
      c.lineTo(x - 5, y - 20);
      c.moveTo(x + 4, y - 16);
      c.lineTo(x + 5, y - 20);
    },
    'ink',
    2
  );
  style.paint(
    g,
    c => {
      c.moveTo(x - 2, y - 21);
      c.arc(x - 5, y - 21, 3, 0, TAU);
      c.moveTo(x + 8, y - 21);
      c.arc(x + 5, y - 21, 3, 0, TAU);
    },
    'eyeWhite',
    [0, 0, 0, 0],
    { small: true }
  );
  g.fillStyle = OUT;
  g.beginPath();
  g.arc(x - 4.6, y - 21, 1.4, 0, TAU);
  g.moveTo(x + 6.8, y - 21);
  g.arc(x + 5.4, y - 21, 1.4, 0, TAU);
  g.fill();
}
function butterfly(g, x, y, flap, i) {
  const f = 0.18 + 0.82 * flap;
  style.paint(
    g,
    c => {
      c.ellipse(x - 6 * f, y - 4, 7 * f, 6, -0.4, 0, TAU);
      c.moveTo(x + 13 * f, y - 4);
      c.ellipse(x + 6 * f, y - 4, 7 * f, 6, 0.4, 0, TAU);
      c.moveTo(x, y + 4);
      c.ellipse(x - 4 * f, y + 4, 4.5 * f, 4, 0.3, 0, TAU);
      c.moveTo(x + 8.5 * f, y + 4);
      c.ellipse(x + 4 * f, y + 4, 4.5 * f, 4, -0.3, 0, TAU);
    },
    'wing' + i,
    [0, 0, 0, 0],
    { small: true }
  );
  style.stroke(
    g,
    c => {
      c.moveTo(x, y - 7);
      c.lineTo(x, y + 7);
    },
    'ink',
    1.8
  );
}
// the old fronds hanging under a palm's crown: they fill the whole loop the
// crash line draws around the tree (so you never crash into empty air), with
// a leafy edge a little outside the line. Worked out once per palm
const skirts = new Map();
function skirt(spec) {
  let s = skirts.get(spec);
  if (s) return s;
  // points every 9 px along the line
  const src = spec.outline;
  const pts = [];
  for (let i = 0; i < src.length - 1; i++) {
    const [x0, y0] = src[i];
    const [x1, y1] = src[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9));
    for (let k = 0; k < n; k++)
      pts.push([lerp(x0, x1, k / n), lerp(y0, y1, k / n)]);
  }
  pts.push(src[src.length - 1]);
  // the loop closes through the crown: its turning direction says which side
  // is outside
  const ring = pts.concat([[spec.x, spec.top + 44]]);
  let area = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    area += p[0] * q[1] - q[0] * p[1];
  });
  const side = area > 0 ? 1 : -1;
  const edge = pts.map((p, i) => {
    const o = pts[Math.max(0, i - 1)];
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1;
    const out = i % 2 ? 13 : 6;
    return [
      p[0] + ((side * (q[1] - o[1])) / d) * out,
      p[1] - ((side * (q[0] - o[0])) / d) * out,
    ];
  });
  // drooping fronds reach the lower part of the loop, one every 40 px or so
  const tips = [];
  let run = 40;
  for (let i = 1; i < pts.length; i++) {
    run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (run < 40 || pts[i][1] < spec.top + 64) continue;
    tips.push([
      lerp(pts[i][0], edge[i][0], 0.3),
      lerp(pts[i][1], edge[i][1], 0.3),
    ]);
    run = 0;
  }
  const ys = edge.map(p => p[1]);
  s = { edge, tips, y0: Math.min(...ys), y1: Math.max(...ys) };
  skirts.set(spec, s);
  return s;
}
// a frond from the crown that arcs out and droops to its tip
function droopingFrond(crown, tip) {
  const dir = Math.sign(tip[0] - crown[0]) || 1;
  const k = [
    crown[0] + dir * Math.max(Math.abs(tip[0] - crown[0]) * 0.8, 36),
    crown[1] - 14,
  ];
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const v = 1 - u;
    pts.push([
      v * v * crown[0] + 2 * v * u * k[0] + u * u * tip[0],
      v * v * crown[1] + 2 * v * u * k[1] + u * u * tip[1],
    ]);
  }
  return pts;
}
// the hanging fronds behind a palm (they hold still, like its crash line)
function palmSkirt(g, spec) {
  if (!spec.outline || spec.outline.length < 3) return;
  const S = skirt(spec);
  const crown = [spec.x + (spec.right - spec.left) / 4, spec.top + 44];
  style.paint(g, c => smoothPath(c, S.edge.concat([crown])), 'leafShade', [
    0,
    S.y0,
    0,
    S.y1,
  ]);
  const hanging = S.tips.map(p => droopingFrond(crown, p));
  style.paint(
    g,
    c => {
      for (const f of hanging) polyPath(c, leafPoly(f, 19, 7));
    },
    'leaf2',
    [0, S.y0, 0, S.y1],
    { small: true }
  );
  style.stroke(
    g,
    c => {
      for (const f of hanging) smoothPath(c, f, false);
    },
    'midrib',
    1.6
  );
}
// a palm drawn over its bump in the crash line (never smaller than the bump)
function palm(g, spec, wind, t) {
  const G = palmGeom(spec, spec.x, wind, t);
  style.paint(
    g,
    c => polyPath(c, ribbon(G.trunk, 14, 8)),
    'trunk',
    [spec.x - 20, G.top[1], spec.x + 20, G.base],
    { horiz: true }
  );
  style.stroke(
    g,
    c => {
      for (let i = 2; i < G.trunk.length - 1; i++) {
        const p = G.trunk[i],
          q = G.trunk[i + 1],
          dx = q[0] - p[0],
          dy = q[1] - p[1],
          dd = Math.hypot(dx, dy) || 1,
          nx = -dy / dd,
          ny = dx / dd,
          w = lerp(13, 8, i / G.trunk.length);
        c.moveTo(p[0] - nx * w, p[1] - ny * w);
        c.quadraticCurveTo(
          p[0] + dx * 0.3,
          p[1] + dy * 0.3 + 3,
          p[0] + nx * w,
          p[1] + ny * w
        );
      }
    },
    'trunkLine',
    1.6
  );
  const back = G.fronds.filter((f, k) => k % 3 === 0);
  const front = G.fronds.filter((f, k) => k % 3 !== 0);
  style.paint(
    g,
    c => {
      for (const f of back) polyPath(c, leafPoly(f, 22, 9));
    },
    'leaf2',
    [0, G.top[1] - 60, 0, G.top[1] + 90]
  );
  style.paint(
    g,
    c => {
      c.arc(G.top[0] - 8, G.top[1] + 8, 8, 0, TAU);
      c.moveTo(G.top[0] + 15, G.top[1] + 10);
      c.arc(G.top[0] + 7, G.top[1] + 10, 8, 0, TAU);
      c.moveTo(G.top[0] + 7.5, G.top[1] + 17);
      c.arc(G.top[0], G.top[1] + 17, 7.5, 0, TAU);
    },
    'coconut',
    [G.top[0] - 16, G.top[1], G.top[0] + 16, G.top[1] + 25],
    { small: true, gloss: true }
  );
  style.paint(
    g,
    c => {
      for (const f of front) polyPath(c, leafPoly(f, 22, 9));
    },
    'leaf',
    [0, G.top[1] - 60, 0, G.top[1] + 90]
  );
  style.stroke(
    g,
    c => {
      for (const f of front) smoothPath(c, f, false);
    },
    'midrib',
    1.6
  );
}
// the finish sign stands where the old "The End" sign was: the top of its
// board is the crash line, and bunting runs down the slope leading up to it
function finishSign(g, f, t, wind) {
  const bx0 = f.x0 - 4;
  const bx1 = f.x1 + 7;
  const by0 = f.top - 1;
  const by1 = f.top + 58;
  // striped posts
  const posts = [f.x0 + 40, f.x1 - 40].map(x => [x, groundY(x) + 10]);
  for (const [px, gy] of posts)
    style.paint(
      g,
      c => rrect(c, px - 10, by1 - 12, 20, gy - by1 + 12, 8),
      'pole',
      [px - 10, by1, px + 10, gy],
      { horiz: true }
    );
  style.paint(
    g,
    c => {
      for (const [px, gy] of posts)
        for (let y = by1 + 10; y < gy - 14; y += 36) c.rect(px - 10, y, 20, 16);
    },
    'poleStripe',
    [0, 0, 0, 0],
    { noLine: true }
  );
  // bunting from a peg at the foot of the slope up to the board's corner
  const peg = [f.rampX, crashY(f.rampX) + 4];
  const corner = [f.x0 + 2, f.top + 3];
  style.paint(
    g,
    c => rrect(c, peg[0] - 5, peg[1] - 16, 10, 24, 4),
    'cabin',
    [0, peg[1] - 16, 0, peg[1] + 8],
    { small: true }
  );
  const n = 7;
  for (let k = 0; k < 4; k++) {
    style.paint(
      g,
      c => {
        for (let i = k; i < n; i += 4) {
          const u0 = (i + 0.2) / n,
            u1 = (i + 0.8) / n,
            xa = lerp(peg[0], corner[0], u0),
            xb = lerp(peg[0], corner[0], u1),
            ya = lerp(peg[1] - 12, corner[1], u0),
            yb = lerp(peg[1] - 12, corner[1], u1),
            sw = Math.sin(t * 3 + i) * 3 + (wind - 0.3) * 6;
          c.moveTo(xa, ya);
          c.lineTo(xb, yb);
          c.lineTo((xa + xb) / 2 + 6 + sw, (ya + yb) / 2 + 22);
          c.closePath();
        }
      },
      ['flag', 'bunY', 'bunG', 'bunB'][k],
      [0, 0, 0, 0],
      { small: true }
    );
  }
  style.stroke(
    g,
    c => {
      c.moveTo(peg[0], peg[1] - 12);
      c.lineTo(corner[0], corner[1]);
    },
    'ink',
    2.6
  );
  // the board: FINISH over a chequered band
  style.paint(
    g,
    c => rrect(c, bx0, by0, bx1 - bx0, by1 - by0, 14),
    'banner',
    [bx0, by0, bx1, by1],
    { gloss: true }
  );
  g.save();
  g.beginPath();
  rrect(g, bx0, by0, bx1 - bx0, by1 - by0, 14);
  g.clip();
  g.fillStyle = '#FFFFFF';
  g.fillRect(bx0, by1 - 14, bx1 - bx0, 14);
  g.fillStyle = OUT;
  for (let x = bx0, i = 0; x < bx1; x += 7, i++)
    g.fillRect(x, by1 - 14 + (i % 2) * 7, 7, 7);
  g.restore();
  style.stroke(g, c => rrect(c, bx0, by0, bx1 - bx0, by1 - by0, 14), 'ink', 5);
  style.text(g, 'FINISH', (bx0 + bx1) / 2, by0 + 36, 38, {
    align: 'center',
    outline: 8,
    fill: '#FFFFFF',
  });
}

/* ================= foreground: tufts at the bottom edge, clear of hazards ================= */
// world x of hazards that stand low on the screen: cannons, Easter Island
// heads and the wind turbine towers
const LOW_HAZARDS = [
  2106, 3555, 5706, 7605, 7905, 17905, 13595, 14795, 15395, 15895, 3675, 4226,
  5076, 5726,
];
const FG_F = 1.4;
const FG_ITEMS = (() => {
  const items = [];
  for (let i = 0; i < 70; i++) {
    const x = i * 380 + h01(i * 11) * 200;
    const wx = (x - VIEW_W / 2) / FG_F + VIEW_W / 2;
    if (LOW_HAZARDS.some(h => Math.abs(h - wx) < 520)) continue;
    items.push([
      x,
      h01(i * 5) < 0.7 ? 'tuft' : 'pebbles',
      0.8 + h01(i * 7) * 0.4,
    ]);
  }
  return items;
})();
// gentle snowfall over Frosty Peaks (fading in and out at its edges)
function drawSnowfall(ctx, cam, t) {
  const snow = level.biomes.find(b => b[2] === 'snow');
  const mid = cam + VIEW_W / 2;
  const k = Math.min(
    sstep(snow[0] - 1100, snow[0] + 100, mid),
    sstep(snow[1] + 1100, snow[1] - 100, mid)
  );
  if (k <= 0.01) return;
  for (let i = 0; i < 70; i++) {
    const depth = 0.4 + h01(i * 3.7) * 0.8;
    const x =
      mod(
        h01(i * 1.3) * 2400 - cam * depth * 0.5 + Math.sin(t * 0.9 + i) * 18,
        2400
      ) - 240;
    const y = mod(h01(i * 5.1) * 1200 + t * (26 + depth * 40), 1200) - 60;
    style.spr(
      ctx,
      'snowflake',
      x,
      y,
      3 + depth * 4,
      k * (0.55 + depth * 0.4),
      t * 0.6 + i
    );
  }
}
export function drawForeground(ctx, cam, t) {
  if (skip.fg) return;
  drawSnowfall(ctx, cam, t);
  const grass = [];
  const stones = [];
  for (const [x0, kind, s] of FG_ITEMS) {
    const x = x0 - cam * FG_F;
    if (x < -140 || x > VIEW_W + 140) continue;
    const wx = x + cam;
    if (lakeAt(wx) || lakeAt(wx - 80) || lakeAt(wx + 80)) continue;
    if (kind === 'tuft' && biomeAt(wx) !== 'sand')
      grass.push([x, s, windAt(t, x), biomeAt(wx)]);
    else stones.push([x, s]);
  }
  if (grass.length) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    for (const snow of [false, true]) {
      ctx.strokeStyle = snow ? '#BCD3EE' : '#2E7433';
      ctx.beginPath();
      for (const [x, s, w, b] of grass) {
        if ((b === 'snow') !== snow) continue;
        for (let k = 0; k < 9; k++) {
          const bx = x + (k - 4) * 7 * s;
          const h = (34 + (k % 3) * 14) * s;
          const bend = (w - 0.2) * h * 0.6 + (k - 4) * 3;
          ctx.moveTo(bx, 1088);
          ctx.quadraticCurveTo(
            bx + bend * 0.4,
            1088 - h * 0.6,
            bx + bend,
            1088 - h
          );
        }
      }
      ctx.stroke();
    }
  }
  if (stones.length)
    style.paint(
      ctx,
      c => {
        for (const [x, s] of stones)
          for (const [dx, r] of [
            [-20, 16],
            [4, 11],
            [22, 13],
          ]) {
            c.moveTo(x + dx * s + r * s, 1088 - r * 0.5 * s);
            c.ellipse(
              x + dx * s,
              1088 - r * 0.5 * s,
              r * s,
              r * 0.72 * s,
              0,
              0,
              TAU
            );
          }
      },
      'fgStone',
      [0, 1050, 0, 1088],
      { small: true }
    );
}

/* ================= public drawing entry points ================= */
// parts of the world the performance tests can switch off (window.__bm.skip)
export const skip = {};
export function drawBackground(ctx, cam, t) {
  const sky = style.sprites.get('sky', VIEW_W, 1080, g => {
    g.translate(-VIEW_W / 2, -540);
    paintSky(g);
  });
  if (!skip.sky) ctx.drawImage(sky, 0, 0, VIEW_W, 1080);
  if (!skip.sun) drawSun(ctx, t);
  if (!skip.farClouds) drawFarClouds(ctx, cam, t);
  if (!skip.farBalloons) drawFarBalloons(ctx, cam, t);
  if (!skip.far) far.draw(ctx, cam, style.px);
  if (!skip.birds) drawBirds(ctx, cam, t);
  if (!skip.mid) mid.draw(ctx, cam, style.px);
  // the sea: the hills run down into it, and it shows where the near hills
  // open up behind the lakes
  if (!skip.sea) {
    const sea = ctx.createLinearGradient(0, 790, 0, 1000);
    sea.addColorStop(0, MATS.midSea.top);
    sea.addColorStop(1, MATS.midSea.bot);
    ctx.fillStyle = sea;
    ctx.fillRect(0, 790, VIEW_W, 290);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(0, 790, VIEW_W, 3);
  }
  if (!skip.midLive) drawMidLive(ctx, cam, t);
}
export function drawNearLayer(ctx, cam, t) {
  if (!skip.near) near.draw(ctx, cam, style.px);
  if (!skip.nearTrees) drawNearTrees(ctx, cam, t);
}
export function drawGround(ctx, cam) {
  if (!skip.ground) ground.draw(ctx, cam, style.px);
}
export function drawGroundLive(ctx, cam, t) {
  if (!skip.groundLive) drawGroundDetails(ctx, cam, t);
}

// build an upcoming tile while there is spare time (at most one per call)
export function prepareAhead() {
  return ground.step() || near.step() || mid.step() || far.step();
}
export function clearCaches() {
  for (const s of [far, mid, near, ground]) s.clear();
}
