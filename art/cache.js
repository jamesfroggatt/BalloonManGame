// Bitmap caches: the art is drawn with vector paths, but anything that does
// not change every frame is painted once into an offscreen canvas and then
// copied, which is what keeps the game at 60 fps on modest laptops.
import { makeCanvas, rgba } from './util.js';

// the performance tests set window.__artStats = [] to collect how long each
// tile build and layer repaint takes (reading a pixel makes the browser
// finish the drawing, so the time includes it)
export function timed(kind, f, g) {
  const stats = window.__artStats;
  if (!stats) return f();
  const t0 = performance.now();
  const result = f();
  (g || result.getContext('2d')).getImageData(0, 0, 1, 1);
  stats.push([kind, +(performance.now() - t0).toFixed(2)]);
  return result;
}

/* ---------- soft round glows (additive) ---------- */
const glowSprites = new Map();
function glowSprite(color) {
  let c = glowSprites.get(color);
  if (!c) {
    c = makeCanvas(128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(color, 1));
      gr.addColorStop(0.22, rgba(color, 0.6));
      gr.addColorStop(0.55, rgba(color, 0.16));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
    glowSprites.set(color, c);
  }
  return c;
}
export function glow(ctx, x, y, r, color, a = 1) {
  if (a <= 0.003 || r <= 0) return;
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a) * prevA;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevA;
}

/* ---------- sprites: drawn once per output scale, centred on 0,0 ---------- */
export class SpriteStore {
  constructor() {
    this.map = new Map();
    this.scale = 1;
  }
  setScale(scale) {
    if (Math.abs(scale - this.scale) > 1e-4) {
      this.map.clear();
      this.scale = scale;
    }
  }
  get(key, w, h, draw) {
    let cv = this.map.get(key);
    if (!cv) {
      const s = this.scale;
      cv = makeCanvas(w * s, h * s, g => {
        g.setTransform(s, 0, 0, s, (w / 2) * s, (h / 2) * s);
        draw(g);
      });
      cv.logicalW = w;
      cv.logicalH = h;
      this.map.set(key, cv);
    }
    return cv;
  }
  // draw sprite `key` centred at x,y (logical size w x h unless given)
  draw(ctx, key, w, h, draw, x, y, dw = w, dh = h) {
    const cv = this.get(key, w, h, draw);
    ctx.drawImage(cv, x - dw / 2, y - dh / 2, dw, dh);
  }
}

/* ---------- long strips (ground, parallax hills) cut into tiles ----------
   A tile takes 10-50 ms to paint, far too long for one frame, so the tile
   that will scroll in next is painted ahead of time in thin slices. */
export class TileStrip {
  // draw(g, x0, x1) paints layer coordinates x0..x1 (y is canvas y)
  constructor({ tileW = 1024, slices = 16, y0, h, f = 1, draw }) {
    Object.assign(this, { tileW, slices, y0, h, f, paint: draw });
    this.tiles = new Map();
    this.pending = null;
    this.scale = 0;
  }
  newCanvas() {
    return makeCanvas(this.tileW * this.scale + 1, this.h * this.scale);
  }
  // paint slice k of tile i (all of it when k is undefined); slices meet on
  // whole pixels so no seams show
  paintSlice(cv, i, k) {
    const s = this.scale;
    const x0 = i * this.tileW;
    const edge = j =>
      j >= this.slices
        ? cv.width
        : Math.round((j * this.tileW * s) / this.slices);
    const d0 = k === undefined ? 0 : edge(k);
    const d1 = k === undefined ? cv.width : edge(k + 1);
    const g = cv.getContext('2d');
    g.save();
    g.beginPath();
    g.rect(d0, 0, d1 - d0, cv.height);
    g.clip();
    g.setTransform(s, 0, 0, s, -x0 * s, -this.y0 * s);
    this.paint(g, x0 + d0 / s, x0 + d1 / s);
    g.restore();
  }
  build(i) {
    const cv = timed('tile' + this.f, () => {
      const c = this.newCanvas();
      this.paintSlice(c, i);
      return c;
    });
    this.tiles.set(i, cv);
    return cv;
  }
  // a tile needed right now: finish the one being painted, or paint it whole
  need(i) {
    if (this.pending && this.pending.i === i) {
      while (this.pending) this.step();
      return this.tiles.get(i);
    }
    return this.build(i);
  }
  // paint one slice of the next tile ahead; false when there is nothing to do
  step() {
    if (!this.pending) {
      const i = this.next;
      if (!this.scale || i === undefined || this.tiles.has(i)) return false;
      this.pending = { i, k: 0, cv: this.newCanvas() };
    }
    const p = this.pending;
    timed(
      'slice' + this.f,
      () => this.paintSlice(p.cv, p.i, p.k),
      p.cv.getContext('2d')
    );
    if (++p.k === this.slices) {
      this.tiles.set(p.i, p.cv);
      this.pending = null;
    }
    return true;
  }
  // cameraX is the world scroll; this layer moves at factor f of it
  draw(ctx, cameraX, scale, viewW = 1920) {
    if (Math.abs(scale - this.scale) > 1e-4) {
      this.clear();
      this.scale = scale;
    }
    const lx = cameraX * this.f;
    const first = Math.floor(lx / this.tileW);
    const last = Math.floor((lx + viewW) / this.tileW);
    for (let i = first; i <= last; i++) {
      const cv = this.tiles.get(i) || this.need(i);
      ctx.drawImage(
        cv,
        i * this.tileW - lx,
        this.y0,
        this.tileW + 1 / scale,
        this.h
      );
    }
    // forget tiles far behind
    for (const k of this.tiles.keys()) if (k < first - 1) this.tiles.delete(k);
    this.next = last + 1;
    if (this.pending && this.pending.i !== this.next) this.pending = null;
  }
  clear() {
    this.tiles.clear();
    this.pending = null;
  }
}

/* ---------- gently animated scenery redrawn ~20 times a second ----------
   The layer is painted with the camera where it was at the time and slid by
   how far the camera has moved since, so scrolling stays perfectly smooth. */
export class LiveLayer {
  constructor({ y0, h, f = 1, pad = 220, fps = 20, phase = 0, draw }) {
    Object.assign(this, { y0, h, f, pad, fps, phase, paint: draw });
    this.cv = null;
    this.slot = null;
    this.camAt = 0;
    this.scale = 0;
  }
  draw(ctx, cameraX, t, scale, viewW = 1920) {
    const w = viewW + this.pad * 2;
    const slot = Math.floor(t * this.fps + this.phase);
    const cam = cameraX * this.f;
    if (
      !this.cv ||
      Math.abs(scale - this.scale) > 1e-4 ||
      slot !== this.slot ||
      Math.abs(cam - this.camAt) > this.pad * 0.8
    ) {
      if (!this.cv || Math.abs(scale - this.scale) > 1e-4) {
        this.cv = makeCanvas(w * scale, this.h * scale);
        this.scale = scale;
      }
      const g = this.cv.getContext('2d');
      timed(
        'live' + this.f,
        () => {
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.clearRect(0, 0, this.cv.width, this.cv.height);
          g.setTransform(
            scale,
            0,
            0,
            scale,
            (this.pad - cam) * scale,
            -this.y0 * scale
          );
          this.paint(g, cam - this.pad, cam + viewW + this.pad, t);
        },
        g
      );
      this.slot = slot;
      this.camAt = cam;
    }
    ctx.drawImage(this.cv, this.camAt - cam - this.pad, this.y0, w, this.h);
  }
}

/* ---------- repeating patterns, one per canvas context ---------- */
const patterns = new WeakMap();
export function patternFor(ctx, key, make) {
  let m = patterns.get(ctx);
  if (!m) {
    m = new Map();
    patterns.set(ctx, m);
  }
  let p = m.get(key);
  if (!p) {
    p = ctx.createPattern(make(), 'repeat');
    m.set(key, p);
  }
  return p;
}
