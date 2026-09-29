// The level's shape, taken from the game's own crash line so the ground you
// see is the ground you hit. levelData.json (made by
// tools/build_level_data.py) adds what the ground is made of: lakes, grass,
// snow, sand, rock outcrops, palm trees and the named zones.
import { clamp, lerp, mulberry, sstep } from './util.js';

export const WATER_Y = 909; // crash line height across the lakes
export const SURFACE_Y = 905; // where the water is drawn (waves ride +-3 px)

export const level = {
  ready: false,
  data: null,
  line: [], // the crash line's ground: [x, canvasY], sorted by x
  xs: [],
  lakes: [],
  rocks: [],
  palms: [],
  biomes: [],
  zones: [],
  clusters: [],
  finish: null,
  deco: null,
};

// crashPoints: the landscape collision JSON (the same data the game tests)
export function initLevel(crashPoints, data) {
  // the crash line in its own order (the first and last points close the
  // shape along the bottom of the screen)
  const path = crashPoints.filter(p => p.y < 815).map(p => [p.x, p.y + 270]);
  // the ground is the lowest part of the line at each x: over a palm the line
  // loops up around the fronds and back down the trunk
  level.xs = [...new Set(path.map(p => p[0]))].sort((a, b) => a - b);
  level.line = level.xs.map(x => {
    let y = -Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const [x0, y0] = path[i];
      const [x1, y1] = path[i + 1];
      if (x < Math.min(x0, x1) || x > Math.max(x0, x1)) continue;
      y = Math.max(
        y,
        x0 === x1 ? Math.max(y0, y1) : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
      );
    }
    return [x, y];
  });
  level.data = data;
  level.lakes = data.lakes;
  // each palm keeps the loop of crash line around its fronds, so the tree can
  // be drawn to cover all of it (neighbouring palms share the loop halfway)
  level.palms = data.palms.map((p, i, all) => {
    const prev = all[i - 1];
    const next = all[i + 1];
    const lo =
      prev && p.x - prev.x < 400 ? (prev.x + p.x) / 2 : p.x - p.left - 60;
    const hi =
      next && next.x - p.x < 400 ? (p.x + next.x) / 2 : p.x + p.right + 60;
    return { ...p, outline: loopWithin(path, lo, hi, p.ground - 20) };
  });
  level.zones = data.zones;
  // the ground changes type at the lake shores, where it looks natural
  const [l1, l2, l3] = data.lakes;
  const sandEnd = Math.max(
    ...data.biomes.filter(b => b[2] === 'sand').map(b => b[1])
  );
  level.biomes = [
    [-1e6, l2[1], 'grass'],
    [l2[1], l3[0], 'snow'],
    [l3[0], l3[1], 'grass'],
    [l3[1], sandEnd, 'sand'],
    [sandEnd, 1e6, 'grass'],
  ];
  void l1;
  // rock outcrops: merge close neighbours, drop any that are really palms
  const palmSpans = data.palms.map(p => [
    p.x - p.left - 30,
    p.x + p.right + 30,
  ]);
  const rocks = [];
  for (const [a, b] of data.rocks) {
    if (palmSpans.some(([p0, p1]) => a < p1 && b > p0)) continue;
    if (rocks.length && a - rocks[rocks.length - 1][1] < 60)
      rocks[rocks.length - 1][1] = b;
    else rocks.push([a, b]);
  }
  level.rocks = rocks.map(([a, b]) => ({ x0: a - 10, x1: b + 10 }));
  level.palmSpans = palmSpans;
  level.finish = data.finish;
  // rocks, palms and the finish sign that touch are one cluster: the crash
  // line there is the top of the rocks, trees or sign, not the ground. Under
  // a cluster the ground runs between the open ground on either side,
  // through each palm's own foot and the hill under the sign
  const spans = [
    ...level.rocks.map(r => ({ a: r.x0, b: r.x1, pts: [] })),
    ...data.palms.map((p, i) => ({
      a: palmSpans[i][0],
      b: palmSpans[i][1],
      pts: [[p.x, p.ground]],
    })),
  ];
  if (data.finish)
    spans.push({
      a: data.finish.rampX - 10,
      b: data.finish.x1 + 14,
      pts: data.finish.hill,
    });
  spans.sort((p, q) => p.a - q.a);
  const clusters = [];
  for (const s of spans) {
    const last = clusters[clusters.length - 1];
    if (last && s.a - last.b < 60) {
      last.b = Math.max(last.b, s.b);
      last.pts.push(...s.pts);
    } else clusters.push({ a: s.a, b: s.b, pts: [...s.pts] });
  }
  level.clusters = clusters.map(({ a, b, pts }) => ({
    a,
    b,
    pts: [
      [a - 20, crashY(a - 20)],
      ...pts.sort((p, q) => p[0] - q[0]),
      [b + 20, crashY(b + 20)],
    ],
  }));
  level.deco = makeDecorations();
  level.ready = true;
}

// the loop of crash line over a palm's fronds: the stretch of line between x
// lo and hi and above y maxY that reaches highest (cut where it crosses the
// sides of that range)
function loopWithin(path, lo, hi, maxY) {
  const runs = [[]];
  const add = p => runs[runs.length - 1].push(p);
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const q = path[i + 1];
    if (p[0] >= lo && p[0] <= hi && p[1] < maxY) add(p);
    else if (runs[runs.length - 1].length) runs.push([]);
    if (!q) break;
    for (const side of [lo, hi]) {
      if ((p[0] - side) * (q[0] - side) >= 0) continue;
      const y = p[1] + ((q[1] - p[1]) * (side - p[0])) / (q[0] - p[0]);
      if (y < maxY) add([side, y]);
    }
  }
  const top = r => Math.min(...r.map(p => p[1]));
  return runs.reduce(
    (best, r) => (r.length && top(r) < top(best) ? r : best),
    [[0, Infinity]]
  );
}

// the crash line's ground at world x
export function crashY(x) {
  const xs = level.xs;
  const line = level.line;
  let lo = 0;
  let hi = xs.length - 1;
  if (x <= xs[0]) return line[0][1];
  if (x >= xs[hi]) return line[hi][1];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = line[lo];
  const [x1, y1] = line[hi];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
}

// the crash line, smoothed through its points (Catmull-Rom): follows it to
// within a few pixels, hidden by the grass on top
export function smoothCrashY(x) {
  const xs = level.xs;
  const line = level.line;
  let lo = 0;
  let hi = xs.length - 1;
  if (x <= xs[0] || x >= xs[hi]) return crashY(x);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const p0 = line[Math.max(0, lo - 1)];
  const p1 = line[lo];
  const p2 = line[hi];
  const p3 = line[Math.min(line.length - 1, hi + 1)];
  const dx = p2[0] - p1[0];
  const u = (x - p1[0]) / dx;
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * dx;
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * dx;
  const u2 = u * u;
  const u3 = u2 * u;
  const y =
    (2 * u3 - 3 * u2 + 1) * p1[1] +
    (u3 - 2 * u2 + u) * m1 +
    (-2 * u3 + 3 * u2) * p2[1] +
    (u3 - u2) * m2;
  // never draw the ground more than 4 px below the real crash line
  return Math.min(y, crashY(x) + 4);
}

export function lakeAt(x) {
  for (const l of level.lakes) if (x > l[0] && x < l[1]) return l;
  return null;
}

// the bed of a lake, below the water
export function seabedY(x, lake) {
  const u = clamp((x - lake[0]) / (lake[1] - lake[0]), 0, 1);
  const depth = Math.min(150, (lake[1] - lake[0]) * 0.12);
  return (
    WATER_Y +
    depth * Math.pow(Math.sin(Math.PI * u), 0.55) +
    3 * Math.sin(x * 0.02)
  );
}

// top of the grass / snow / sand body at x (rocks and palms sit on top of it)
export function groundY(x) {
  const lake = lakeAt(x);
  if (lake) return seabedY(x, lake);
  let y = smoothCrashY(x);
  for (const c of level.clusters) {
    if (x < c.a - 30 || x > c.b + 30) continue;
    let i = 0;
    while (i < c.pts.length - 2 && x > c.pts[i + 1][0]) i++;
    const [xa, ya] = c.pts[i];
    const [xb, yb] = c.pts[i + 1];
    const base = lerp(ya, yb, clamp((x - xa) / (xb - xa), 0, 1));
    // blend the edges so the ground slides under the rocks and trees
    const k = Math.min(
      sstep(c.a - 30, c.a + 10, x),
      sstep(c.b + 30, c.b - 10, x)
    );
    y = lerp(y, Math.max(y, base), k);
  }
  return y;
}

export function biomeAt(x) {
  for (const b of level.biomes) if (x >= b[0] && x < b[1]) return b[2];
  return 'grass';
}

export function zoneAt(x) {
  for (const z of level.zones) if (x >= z.x0 && x < z.x1) return z;
  return level.zones[level.zones.length - 1];
}

// can a low decoration sit at x? (on dry ground, not on a rock or under a palm)
function dryGround(x) {
  if (lakeAt(x - 40) || lakeAt(x + 40)) return false;
  if (level.rocks.some(r => x > r.x0 - 20 && x < r.x1 + 20)) return false;
  if (level.palmSpans.some(([a, b]) => x > a && x < b)) return false;
  return true;
}

// seeded decoration lists along the whole level (never Math.random)
function makeDecorations() {
  const r = mulberry(2024);
  const end = level.xs[level.xs.length - 1];
  const blades = [];
  const flowers = [];
  const dandelions = [];
  const shells = [];
  const snowTufts = [];
  const beachTufts = [];
  const castles = [];
  const snowmen = [];
  const crabs = [];
  const starfish = [];
  const kinds = ['daisy', 'poppy', 'blue', 'daisy', 'yellow'];
  for (let x = 0; x < end; x += 4.4 + r() * 3.6) {
    const b = biomeAt(x);
    if (lakeAt(x - 6) || lakeAt(x + 6)) continue;
    if (b === 'grass')
      blades.push({
        x,
        h: 15 + r() * 21,
        ph: r() * 6.28,
        k: (r() * 3) | 0,
        lean: (r() - 0.5) * 7,
      });
    if (b === 'snow' && r() < 0.07)
      snowTufts.push({ x, h: 8 + r() * 8, ph: r() * 6.28 });
  }
  for (let x = 40; x < end; x += 46 + r() * 60) {
    if (!dryGround(x)) continue;
    const b = biomeAt(x);
    if (b === 'grass') {
      if (r() < 0.08) dandelions.push({ x });
      else
        flowers.push({
          x,
          h: 20 + r() * 16,
          ph: r() * 6.28,
          kind: kinds[(r() * kinds.length) | 0],
        });
    } else if (b === 'sand') {
      const k = r();
      if (k < 0.3) shells.push({ x, i: (r() * 3) | 0 });
      else if (k < 0.45) beachTufts.push({ x });
      else if (k < 0.52) starfish.push({ x, rot: r() * 6.28 });
    }
  }
  // a few special pieces, placed where there is room
  const place = (list, x0, x1, n, make) => {
    let tries = 0;
    while (list.length < n && tries++ < 200) {
      const x = x0 + r() * (x1 - x0);
      if (dryGround(x) && !list.some(o => Math.abs(o.x - x) < 300))
        list.push(make(x));
    }
  };
  const beach = level.biomes.find(b => b[2] === 'sand');
  const snow = level.biomes.find(b => b[2] === 'snow');
  place(castles, beach[0] + 300, beach[1] - 300, 3, x => ({ x }));
  place(crabs, beach[0] + 200, beach[1] - 200, 4, x => ({ x, ph: r() * 6.28 }));
  place(snowmen, snow[0] + 200, snow[1] - 200, 2, x => ({ x }));
  return {
    blades,
    flowers,
    dandelions,
    shells,
    snowTufts,
    beachTufts,
    castles,
    snowmen,
    crabs,
    starfish,
  };
}
