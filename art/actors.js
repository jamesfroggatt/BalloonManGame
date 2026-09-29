// The characters and hazards in the Toybox style. Every game object keeps its
// own movement, timing and hitbox (main.js); these functions only draw what
// its state says, fitted to its hitbox, plus the extras that make it feel
// alive: smoke, sparkles, splashes, blinking eyes.
import {
  TAU,
  clamp,
  lerp,
  h01,
  easeOutBack,
  easeOutCubic,
  makeCanvas,
} from './util.js';
import { style, OUT } from './style.js';
import {
  polyPath,
  smoothPath,
  rrect,
  starPath,
  ribbon,
  sharkHeadPath,
  sharkBellyPath,
  finPath,
  ghostPath,
  moaiPts,
  turbineBlade,
} from './shapes.js';
import { level, lakeAt, biomeAt, groundY, SURFACE_Y } from './level.js';
import { windAt, waveY } from './world.js';
import * as fx from './particles.js';
import { slotScale } from './hud.js';

let T = 0; // the art clock, seconds
let DT = 0; // time since the last drawn frame
let CAM = 0; // how far the world has scrolled
let shake = 0; // screen shake, 0..1
let world = () => ({});
let W = {}; // what world() said this frame

// how to find the game's objects (eyes that follow things, the score)
export function setWorld(get) {
  world = get;
}

// called at the start of every drawn frame
export function beginFrame(t, cam) {
  DT = clamp(t - T, 0, 0.05);
  T = t;
  CAM = cam;
  W = world();
  fx.setCamera(cam);
  fx.update(DT);
  shake = Math.max(0, shake - DT * 2.2);
}

// a near miss: a hazard (centre x, y, radius r) came close to the balloon
// and went away again without a crash, so the pilot says "Phew!"
let phewAt = -9;
function nearMiss(s, x, y, r) {
  const b = W.balloon;
  if (!b || !W.flying) return;
  const d = Math.hypot(
    (x - (b.dX + 85)) / (100 + r),
    (y - (b.dY + 105)) / (125 + r)
  );
  s.minD = Math.min(s.minD === undefined ? 9 : s.minD, d);
  if (!s.phew && s.minD < 1.15 && d > s.minD + 0.35) {
    s.phew = true;
    if (T - phewAt > 2) phewAt = T;
  }
}

// the offset to shake the scene by this frame
export function shakeOffset() {
  if (shake <= 0) return [0, 0];
  const a = shake * shake * 10;
  return [Math.sin(T * 91) * a, Math.cos(T * 77) * a];
}

export function drawParticles(ctx, front) {
  fx.draw(ctx, front);
}

export function clearEffects() {
  fx.clear();
  shake = 0;
}

// what each object needs remembered between frames, kept out of the game code
const memo = new WeakMap();
let serial = 0;
function state(o, make) {
  let s = memo.get(o);
  if (!s) {
    s = make ? make() : {};
    s.id = serial++;
    s.born = T;
    memo.set(o, s);
  }
  return s;
}

// sprites painted once, with the small glossy highlights switched on
function sprite(key, w, h, paint) {
  return style.sprites.get(key, w, h, g => {
    style.caching = true;
    paint(g);
    style.caching = false;
  });
}

function surfaceAt(sx) {
  return waveY(sx + CAM, T);
}

/* ============================== the balloon ==============================
   The envelope follows the balloon's hitbox (box 0..171 x 0..230): an oval
   top 169 px wide, narrowing to the mouth at y 175, then ropes to a small
   basket whose bottom is the hitbox tip at y 228-230. */
const BCX = 85.5; // the hitbox's centre line
const BX = 86.5; // the basket's centre (the tip of the hitbox)
const MOUTH = 175;
const BENV = (() => {
  // half-width at height y: an oval dome down to the widest point at y 47,
  // then a smooth taper through the hitbox's points to the mouth
  const knots = [
    [47, 84.5],
    [86, 79],
    [125, 58.5],
    [164, 26.5],
    [175, 19],
  ];
  const slope = [0];
  for (let i = 1; i < knots.length - 1; i++)
    slope.push(
      (knots[i + 1][1] - knots[i - 1][1]) / (knots[i + 1][0] - knots[i - 1][0])
    );
  slope.push((knots[4][1] - knots[3][1]) / (knots[4][0] - knots[3][0]));
  const W = y => {
    if (y <= 47) return 84.5 * Math.sqrt(Math.max(0, 1 - ((47 - y) / 47) ** 2));
    let i = 0;
    while (i < knots.length - 2 && y > knots[i + 1][0]) i++;
    const [y0, w0] = knots[i];
    const [y1, w1] = knots[i + 1];
    const h = y1 - y0;
    const u = clamp((y - y0) / h, 0, 1);
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * w0 +
      (u3 - 2 * u2 + u) * h * slope[i] +
      (-2 * u3 + 3 * u2) * w1 +
      (u3 - u2) * h * slope[i + 1]
    );
  };
  const ys = [];
  for (let i = 0; i <= 60; i++)
    ys.push(MOUTH * (1 - Math.cos((i / 60) * Math.PI)) * 0.5);
  const pts = ys
    .map(y => [BCX + W(y), y])
    .concat(
      ys
        .slice()
        .reverse()
        .map(y => [BCX - W(y), y])
    );
  const gores = [];
  for (let g = 0; g < 8; g++) {
    const a0 = -Math.PI / 2 + (g / 8) * Math.PI;
    const a1 = -Math.PI / 2 + ((g + 1) / 8) * Math.PI;
    gores.push(
      ys
        .map(y => [BCX + W(y) * Math.sin(a0), y])
        .concat(
          ys
            .slice()
            .reverse()
            .map(y => [BCX + W(y) * Math.sin(a1), y])
        )
    );
  }
  return { W, pts, gores, ys };
})();

function paintEnvelope(g) {
  g.translate(-BCX, -88);
  for (let gi = 0; gi < 8; gi++)
    style.paint(
      g,
      c => polyPath(c, BENV.gores[gi]),
      'g' + gi,
      [0, 0, 171, MOUTH],
      { noLine: true }
    );
  g.save();
  g.beginPath();
  polyPath(g, BENV.pts);
  g.clip();
  // light from the top left, shade to the bottom right
  const sh = g.createRadialGradient(BCX - 36, 36, 8, BCX + 8, 74, 132);
  sh.addColorStop(0, 'rgba(255,255,255,0.42)');
  sh.addColorStop(0.45, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(10,20,60,0.34)');
  g.fillStyle = sh;
  g.fillRect(BCX - 100, -10, 200, MOUTH + 20);
  // the seams between the panels
  g.strokeStyle = 'rgba(27,42,74,0.35)';
  g.lineWidth = 1.8;
  g.beginPath();
  for (let gi = 1; gi < 8; gi++) {
    const a = -Math.PI / 2 + (gi / 8) * Math.PI;
    BENV.ys.forEach((y, i) =>
      (i ? g.lineTo : g.moveTo).call(g, BCX + BENV.W(y) * Math.sin(a), y)
    );
  }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(BCX - 42, 30, 12, 22, -0.75, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.ellipse(BCX - 58, 60, 4, 7, -0.3, 0, TAU);
  g.fill();
  g.restore();
  g.beginPath();
  polyPath(g, BENV.pts);
  g.lineWidth = 5.5;
  g.lineJoin = 'round';
  g.strokeStyle = OUT;
  g.stroke();
  style.paint(
    g,
    c => rrect(c, BCX - 21, MOUTH - 6, 42, 11, 4),
    'skirt',
    [BCX - 21, MOUTH - 6, BCX + 21, MOUTH + 5],
    { small: true, gloss: true }
  );
}

function paintBasket(g) {
  // centred on the basket's middle (BX, 216)
  g.translate(-BX, -216);
  style.paint(
    g,
    c => {
      c.moveTo(BX - 13 + 3.5, 213);
      c.ellipse(BX - 13, 213, 3.5, 4.6, 0, 0, TAU);
      c.moveTo(BX + 13 + 3.5, 213);
      c.ellipse(BX + 13, 213, 3.5, 4.6, 0, 0, TAU);
    },
    'sandbag',
    [0, 208, 0, 218],
    { small: true }
  );
  style.paint(
    g,
    c => rrect(c, BX - 10.5, 205, 21, 23, 4),
    'basket',
    [BX - 10.5, 205, BX + 10.5, 228],
    { gloss: true }
  );
  style.stroke(
    g,
    c => {
      for (let k = 1; k < 4; k++) {
        c.moveTo(BX - 9, 205 + k * 5.6);
        c.lineTo(BX + 9, 205 + k * 5.6);
      }
      for (let k = -1; k <= 1; k++) {
        c.moveTo(BX + k * 6, 207);
        c.lineTo(BX + k * 6, 226);
      }
    },
    'basketLine',
    1.1
  );
  style.paint(
    g,
    c => rrect(c, BX - 12.5, 202, 25, 6, 3),
    'basketRim',
    [BX - 12.5, 202, BX + 12.5, 208],
    { small: true }
  );
}

// the pilot's head and shoulders, centred on the head (eyes drawn per frame)
function paintPilot(g, pose) {
  const px = 0;
  const py = 0;
  if (pose === 'c') {
    style.stroke(
      g,
      c => {
        c.moveTo(px - 6, py + 9);
        c.lineTo(px - 15, py - 10);
        c.moveTo(px + 6, py + 9);
        c.lineTo(px + 15, py - 11);
      },
      'sleeve',
      5
    );
    style.paint(
      g,
      c => {
        c.arc(px - 15, py - 11, 3.2, 0, TAU);
        c.moveTo(px + 18.2, py - 12);
        c.arc(px + 15, py - 12, 3.2, 0, TAU);
      },
      'skin',
      [0, 0, 0, 1],
      { small: true }
    );
  }
  style.paint(
    g,
    c => c.arc(px, py, 10, 0, TAU),
    'skin',
    [px - 10, py - 10, px + 10, py + 10],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.arc(px, py - 1, 10.8, Math.PI * 1.05, Math.PI * 1.95);
      c.quadraticCurveTo(px + 11, py + 4, px + 9, py + 7);
      c.lineTo(px + 7, py);
      c.quadraticCurveTo(px, py - 5, px - 7, py);
      c.lineTo(px - 9, py + 7);
      c.quadraticCurveTo(px - 11, py + 4, px - 10.4, py - 3);
      c.closePath();
    },
    'cap',
    [px - 11, py - 12, px + 11, py + 7],
    { small: true }
  );
  style.paint(
    g,
    c => {
      c.arc(px - 4.2, py - 5.6, 3.6, 0, TAU);
      c.moveTo(px + 7.8, py - 5.6);
      c.arc(px + 4.2, py - 5.6, 3.6, 0, TAU);
    },
    'goggle',
    [px - 8, py - 9, px + 8, py - 2],
    { small: true, gloss: true }
  );
  if (pose === 'b')
    style.stroke(
      g,
      c => {
        c.moveTo(px - 5.5, py + 2);
        c.lineTo(px - 2, py + 2);
        c.moveTo(px + 2, py + 2);
        c.lineTo(px + 5.5, py + 2);
      },
      'ink',
      1.4
    );
  style.stroke(
    g,
    c => {
      if (pose === 'c') {
        c.moveTo(px - 3.5, py + 5);
        c.quadraticCurveTo(px, py + 9.5, px + 3.5, py + 5);
      } else {
        c.moveTo(px - 2.5, py + 5.8);
        c.quadraticCurveTo(px, py + 7.4, px + 2.5, py + 5.8);
      }
    },
    'ink',
    1.3
  );
}

function flame(ctx, x, y, burn, flick) {
  const h = 10 + 30 * flick;
  const w = 5 + 3.5 * burn;
  const sway = Math.sin(T * 19) * 2 * (0.4 + burn);
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 1.2, y - h * 0.5, x + sway, y - h);
  ctx.quadraticCurveTo(x + w * 1.2, y - h * 0.5, x + w, y);
  ctx.closePath();
  ctx.fillStyle = '#FF7A1E';
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#C0391E';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.55, y);
  ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.4, x + sway * 0.6, y - h * 0.7);
  ctx.quadraticCurveTo(x + w * 0.6, y - h * 0.4, x + w * 0.55, y);
  ctx.closePath();
  ctx.fillStyle = '#FFE14A';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.18, w * 0.25, h * 0.16, 0, 0, TAU);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
}

// the nearest thing worth looking at, relative to the pilot
function lookTarget(hx, hy) {
  const w = W;
  let best = null;
  let bd = 1e9;
  const consider = (x, y) => {
    const d = Math.hypot(x - hx, y - hy);
    if (d < bd && d < 900) {
      bd = d;
      best = [x, y];
    }
  };
  for (const c of w.coins || [])
    if (!c.fadeOutThisCoin) consider(c.dX + 59, c.dY + 59);
  for (const b of w.balls || []) consider(b.x + 10, b.y + 10);
  for (const g of w.ghosts || []) consider(g.dX + 66, g.dY + 90);
  for (const r of w.rings || []) consider(r.dX + 39, r.dY + 37);
  if (!best) return [0.8, 0.25];
  const dx = best[0] - hx;
  const dy = best[1] - hy;
  const d = Math.hypot(dx, dy) || 1;
  return [dx / d, dy / d];
}

// a soft shadow on the ground or water under the balloon
function balloonShadow(ctx, b) {
  if (!level.ready) return;
  const sx = b.dX + BX;
  const wx = sx + CAM;
  const gy = lakeAt(wx) ? surfaceAt(sx) : groundY(wx);
  const k = clamp(1 - (gy - (b.dY + 230)) / 650, 0, 1);
  if (k <= 0.02) return;
  ctx.fillStyle = `rgba(20,30,60,${0.2 * k})`;
  ctx.beginPath();
  ctx.ellipse(sx, gy + 3, 60 * k + 18, 7 * k + 3, 0, 0, TAU);
  ctx.fill();
}

// everything the balloon needs to be drawn at box position x, y; also used
// for the popping balloon in the explosion
function balloonPose(b, s) {
  s.burn = lerp(s.burn || 0, W.burning ? 1 : 0, Math.min(1, DT * 12));
  s.sway = lerp(
    s.sway || 0,
    clamp(-b.accelarationX * 0.03, -0.16, 0.16) + 0.015 * Math.sin(T * 1.7),
    Math.min(1, DT * 4)
  );
  s.stretch = lerp(
    s.stretch || 1,
    1 + clamp(b.heatInBalloon * 0.006, -0.015, 0.025),
    Math.min(1, DT * 8)
  );
  return s;
}

function paintBalloon(ctx, x, y, s, o = {}) {
  const sy = s.stretch;
  const sx = 1 - (sy - 1) * 0.5;
  const flick =
    s.burn * (0.75 + 0.25 * Math.sin(T * 31) * Math.sin(T * 17 + 1));
  ctx.save();
  ctx.translate(x, y);
  // the ropes, basket and pilot swing below the mouth
  ctx.save();
  ctx.translate(BCX, MOUTH * sy);
  ctx.rotate(s.sway);
  ctx.translate(-BCX, -MOUTH);
  style.stroke(
    ctx,
    c => {
      c.moveTo(BCX - 16, MOUTH + 3);
      c.lineTo(BX - 10, 204);
      c.moveTo(BCX + 16, MOUTH + 3);
      c.lineTo(BX + 10, 204);
      c.moveTo(BCX - 6, MOUTH + 4);
      c.lineTo(BX - 4, 203);
      c.moveTo(BCX + 6, MOUTH + 4);
      c.lineTo(BX + 4, 203);
    },
    'rope',
    1.8
  );
  // pilot, scarf and basket
  const hx = BX - 1;
  const hy = 196;
  const pose = o.pose || 'n';
  const ps = sprite('pilot' + pose, 60, 60, g => paintPilot(g, pose));
  ctx.drawImage(ps, hx - 24, hy - 24, 48, 48);
  if (pose !== 'b') {
    const [lx, ly] = o.look || [0.8, 0.25];
    ctx.fillStyle = OUT;
    ctx.beginPath();
    ctx.arc(
      hx + (-3.6 + lx * 1.3) * 0.8,
      hy + (1.6 + ly * 1.1) * 0.8,
      1.45,
      0,
      TAU
    );
    ctx.moveTo(hx + (3.6 + lx * 1.3) * 0.8 + 1.45, hy + (1.6 + ly * 1.1) * 0.8);
    ctx.arc(
      hx + (3.6 + lx * 1.3) * 0.8,
      hy + (1.6 + ly * 1.1) * 0.8,
      1.45,
      0,
      TAU
    );
    ctx.fill();
  }
  const wv = windAt(T, x + hx);
  const sc = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    sc.push([
      hx + 1 + u * (16 + wv * 7),
      hy + 8 + Math.sin(T * 9 - u * 5) * 2.5 * u + u * 2,
    ]);
  }
  style.paint(
    ctx,
    c => polyPath(c, ribbon(sc, 2.8, 1.1)),
    'scarf',
    [0, hy + 5, 0, hy + 12],
    { small: true }
  );
  ctx.drawImage(
    sprite('basket', 40, 34, paintBasket),
    BX - 20,
    216 - 17,
    40,
    34
  );
  // the burner and its flame
  style.paint(
    ctx,
    c => rrect(c, BCX - 8, MOUTH + 4, 16, 7, 2),
    'burner',
    [BCX - 8, MOUTH + 4, BCX + 8, MOUTH + 11],
    { small: true, gloss: true }
  );
  ctx.restore();
  // the envelope, stretching a little as it rises
  ctx.save();
  ctx.translate(BCX, 0);
  ctx.scale(sx, sy);
  ctx.drawImage(
    sprite('envelope', 200, 200, paintEnvelope),
    -100,
    88 - 100,
    200,
    200
  );
  ctx.restore();
  if (o.flash) {
    ctx.save();
    ctx.beginPath();
    ctx.translate(BCX, 0);
    ctx.scale(sx, sy);
    ctx.translate(-BCX, 0);
    polyPath(ctx, BENV.pts);
    ctx.fillStyle = `rgba(255,255,255,${o.flash})`;
    ctx.fill();
    ctx.restore();
  }
  if (s.burn > 0.03) {
    flame(ctx, BCX, MOUTH + 4, s.burn, flick);
    style.glow(ctx, BCX, MOUTH - 26, 60 + 40 * s.burn, '#FFB347', 0.5 * s.burn);
  }
  ctx.restore();
}

export function drawBalloon(ctx, b) {
  const s = state(b, () => ({
    nextBlink: T + 2.5,
    cheerUntil: 0,
    score: null,
  }));
  // cheer when a sum is answered right
  const score = W.score ? W.score.score : 0;
  if (s.score !== null && score > s.score) {
    s.cheerUntil = T + 1.5;
    fx.starBurst(b.dX + BX, b.dY + 190, 8, { speed: 220 });
  }
  s.score = score;
  if (T > s.nextBlink + 0.13)
    s.nextBlink = T + 2.6 + h01(s.id + Math.floor(T)) * 2.2;
  balloonPose(b, s);
  const pose =
    T < s.cheerUntil || W.winning ? 'c' : T > s.nextBlink ? 'b' : 'n';
  // a few embers from the burner
  if (s.burn > 0.4) {
    s.ember = (s.ember || 0) + DT * 14;
    while (s.ember > 1) {
      s.ember -= 1;
      fx.emit('ember', b.dX + BCX + fx.rand(-6, 6), b.dY + MOUTH + 6, {
        vx: fx.rand(-40, 40),
        vy: fx.rand(-30, 30),
        g: 180,
        drag: 0.5,
        life: fx.rand(0.3, 0.6),
        size: fx.rand(2.5, 4),
      });
    }
  }
  balloonShadow(ctx, b);
  paintBalloon(ctx, b.dX, b.dY, s, {
    pose: T - phewAt < 1.2 ? 'c' : pose,
    look: lookTarget(b.dX + BX, b.dY + 196),
  });
  if (T - phewAt < 1.2) {
    const k = (T - phewAt) / 1.2;
    const sc = k < 0.2 ? easeOutBack(k / 0.2) : 1;
    ctx.save();
    ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.translate(b.dX + 170, b.dY + 10 - k * 30);
    ctx.rotate(0.12);
    ctx.scale(sc, sc);
    style.text(ctx, 'Phew!', 0, 0, 56, {
      align: 'center',
      fill: '#FFFFFF',
      outline: 11,
      shadow: true,
    });
    ctx.restore();
  }
  s.last = { x: b.dX, y: b.dY, sway: s.sway, stretch: s.stretch, burn: s.burn };
}

// the balloon bobbing on the title screen, burner flickering now and then
export function drawTitleBalloon(ctx, x, y, t) {
  const burn = Math.max(0, Math.sin(t * 0.9)) ** 3;
  const pose = t % 4.3 < 0.13 ? 'b' : 'n';
  paintBalloon(
    ctx,
    x,
    y,
    {
      stretch: 1 + 0.01 * Math.sin(t * 1.4),
      sway: 0.05 * Math.sin(t * 1.1),
      burn,
    },
    { pose, look: [-0.7, 0.3] }
  );
}

/* ============================== the explosion ==============================
   The game shows the explosion for 62 frames of 0.04 s (the balloon is
   removed at frame 16). Here: a squash and white flash, POP!, scraps of
   fabric, and the pilot drifting down under a parachute. */
export function drawExplosion(ctx, e, balloon) {
  const s = state(e, () => ({}));
  if (!s.pose) {
    // remember the balloon as it was when it popped
    const bs = balloon && memo.get(balloon);
    // the game places the explosion 300 px left of and 200 px above the balloon
    s.pose = {
      sway: 0,
      stretch: 1,
      ...(bs && bs.last),
      x: e.dX + 300,
      y: e.dY + 200,
      burn: 0,
    };
    s.t0 = T;
    shake = 1;
  }
  const p = s.pose;
  const age = T - s.t0;
  const cx = p.x + BCX;
  const cy = p.y + 88;
  if (age < 0.22) {
    // hit-stop: the balloon swells and flashes
    const k = age / 0.22;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + 0.12 * k, 1 + 0.08 * k);
    ctx.translate(-cx, -cy);
    paintBalloon(
      ctx,
      p.x,
      p.y,
      { ...p, burn: 0 },
      { pose: 'b', flash: 0.35 + 0.45 * Math.abs(Math.sin(age * 40)) }
    );
    ctx.restore();
    return;
  }
  if (!s.popped) {
    s.popped = true;
    shake = 1;
    for (let i = 0; i < 26; i++) {
      const a = fx.rand(0, TAU);
      const v = fx.rand(260, 620);
      fx.emit('scrap', cx + Math.cos(a) * 40, cy + Math.sin(a) * 40, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 120,
        g: 620,
        drag: 0.7,
        life: fx.rand(1.2, 2.2),
        size: fx.rand(9, 16),
        rot: fx.rand(0, 6),
        spin: fx.rand(-9, 9),
        hue: i % 4,
      });
    }
    fx.puffs(cx, cy, 14, { speed: 180, size: 22, grow: 30, life: 1.4 });
    fx.sparks(cx, cy, 18, { speed: 420 });
  }
  const u = age - 0.22;
  // the POP! starburst
  if (u < 0.6) {
    const k = u / 0.6;
    const r = 70 + 150 * easeOutCubic(Math.min(1, k * 2.2));
    ctx.save();
    ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
    ctx.translate(cx, cy);
    ctx.rotate(0.2);
    ctx.beginPath();
    starPath(ctx, 0, 0, r, 0, 11, 0.55);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.fillStyle = '#FFE14A';
    ctx.fill();
    ctx.beginPath();
    starPath(ctx, 0, 0, r * 0.62, 0.3, 9, 0.6);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
    style.glow(ctx, cx, cy, r * 1.4, '#FFB347', 0.8 * (1 - k));
  }
  if (u < 1.3) {
    const k = u / 1.3;
    const sc = k < 0.15 ? easeOutBack(k / 0.15) : 1;
    ctx.save();
    ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.translate(cx, cy - 10 - k * 30);
    ctx.rotate(-0.1);
    ctx.scale(sc, sc);
    style.text(ctx, 'POP!', 0, 30, 96, {
      align: 'center',
      fill: '#FF4F5E',
      outline: 16,
      shadow: true,
    });
    ctx.restore();
  }
  // the pilot floats down under a parachute
  const fall = Math.min(u, 0.35);
  const drift = Math.max(0, u - 0.35);
  const px = cx + 2 + Math.sin(drift * 1.6) * 12 + drift * 10;
  // ...and lands softly on the ground, where the canopy folds away
  const floor = level.ready
    ? (lakeAt(px + CAM) ? surfaceAt(px) : groundY(px + CAM)) - 14
    : 1066;
  const fallY = p.y + 196 + fall * fall * 400 + drift * 70;
  if (fallY >= floor && s.landed === undefined) s.landed = T;
  const py = Math.min(fallY, floor);
  const folded = s.landed === undefined ? 0 : clamp((T - s.landed) / 0.6, 0, 1);
  const open = clamp((u - 0.3) / 0.35, 0, 1) * (1 - folded);
  const tilt = s.landed === undefined ? Math.sin(drift * 1.6 + 0.5) * 0.12 : 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(tilt);
  if (open > 0) {
    const cw = 56 * easeOutBack(open);
    const ch = 40 * open;
    style.stroke(
      ctx,
      c => {
        c.moveTo(-6, 6);
        c.lineTo(-cw * 0.9, -52 * open);
        c.moveTo(6, 6);
        c.lineTo(cw * 0.9, -52 * open);
        c.moveTo(0, 4);
        c.lineTo(0, -56 * open);
      },
      'rope',
      1.6
    );
    style.paint(
      ctx,
      c => {
        c.moveTo(-cw, -50 * open);
        c.quadraticCurveTo(
          -cw,
          -50 * open - ch * 1.6,
          0,
          -50 * open - ch * 1.5
        );
        c.quadraticCurveTo(cw, -50 * open - ch * 1.6, cw, -50 * open);
        for (let k = 3; k >= -3; k--)
          c.quadraticCurveTo(
            (k * cw) / 3 + cw / 6,
            -50 * open - 8 * open,
            (k * cw) / 3,
            -50 * open
          );
        c.closePath();
      },
      'parachute',
      [-cw, -50 * open - ch * 1.5, cw, -50 * open],
      { gloss: true }
    );
    style.stroke(
      ctx,
      c => {
        c.moveTo(0, -50 * open - ch * 1.5);
        c.lineTo(0, -50 * open);
      },
      'ink',
      1.4
    );
  }
  ctx.drawImage(
    sprite('pilotc', 60, 60, g => paintPilot(g, 'c')),
    -24,
    -24,
    48,
    48
  );
  ctx.fillStyle = OUT;
  ctx.beginPath();
  ctx.arc(-2.9, 1.3, 1.45, 0, TAU);
  ctx.moveTo(4.35, 1.3);
  ctx.arc(2.9, 1.3, 1.45, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ============================== coins ==============================
   A fat glossy coin (radius 56, the hitbox circle), rocking gently so its
   number always stays readable. */
function paintCoinFace(g, n) {
  const R = 56;
  g.lineJoin = 'round';
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.lineWidth = 10;
  g.strokeStyle = OUT;
  g.stroke();
  const gr = g.createLinearGradient(0, -R, 0, R);
  gr.addColorStop(0, '#FFF08A');
  gr.addColorStop(0.5, '#FFCB2E');
  gr.addColorStop(1, '#F29E10');
  g.fillStyle = gr;
  g.fill();
  g.beginPath();
  g.arc(0, 0, R * 0.8, 0, TAU);
  g.lineWidth = 4.5;
  g.strokeStyle = 'rgba(200,110,0,0.75)';
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.beginPath();
  g.ellipse(-R * 0.38, -R * 0.5, R * 0.3, R * 0.14, -0.6, 0, TAU);
  g.fill();
  const str = String(n);
  const size = R * (str.length === 1 ? 1.06 : str.length === 2 ? 0.88 : 0.66);
  g.globalAlpha = 0.9;
  style.text(g, str, -1.5, size * 0.34 - 2.5, size, {
    align: 'center',
    fill: '#FFF4B8',
  });
  g.globalAlpha = 1;
  style.text(g, str, 0, size * 0.34, size, {
    align: 'center',
    fill: '#B86400',
  });
}
function paintCoinEdge(g) {
  g.beginPath();
  g.arc(0, 0, 56, 0, TAU);
  g.lineWidth = 10;
  g.strokeStyle = OUT;
  g.stroke();
  g.fillStyle = '#D98A00';
  g.fill();
}

export function drawCoin(ctx, c) {
  const s = state(c, () => ({ tw: 0 }));
  const k = c.dWidth / 118;
  const cx = c.dX + 59 * k;
  const cy = c.dY + 59 * (c.dHeight / 120);
  // a coin flying into the answer slot shrinks to fit it
  const R = 56 * k * (c.thisCoinHasBeenHit ? slotScale(cx, cy) : 1);
  if (R < 1) return;
  // a gentle rocking turn, never edge-on
  const wob = 0.84 + 0.16 * Math.cos(T * 4 + s.id * 1.7);
  const W = 140 * k;
  if (c.thisCoinHasBeenHit && !s.hit) {
    s.hit = true;
    fx.starBurst(cx, cy, 10, { speed: 320 });
    fx.confetti(cx, cy, 22, { power: 0.9 });
  }
  if (c.fadeOutThisCoin && !s.gone) {
    s.gone = true;
    fx.puffs(cx, cy, 6, { size: 14, speed: 70 });
  }
  if (c.thisCoinHasBeenHit) {
    s.tw += DT * 30;
    while (s.tw > 1) {
      s.tw -= 1;
      fx.emit('twinkle', cx + fx.rand(-R, R), cy + fx.rand(-R, R), {
        life: 0.5,
        size: fx.rand(8, 13),
        rot: fx.rand(0, 1),
      });
    }
  } else if (!c.fadeOutThisCoin) {
    style.glow(ctx, cx, cy, R * 2.1, '#FFE27A', 0.35);
    s.tw += DT * 2.2;
    if (s.tw > 1) {
      s.tw -= 1;
      const a = fx.rand(0, TAU);
      fx.emit(
        'twinkle',
        cx + Math.cos(a) * R * 1.05,
        cy + Math.sin(a) * R * 1.05,
        { life: 0.6, size: fx.rand(8, 12), rot: fx.rand(0, 1) }
      );
    }
  }
  const e = (1 - wob) * R * 0.24;
  const Wr = (W * R) / (56 * k);
  ctx.drawImage(
    sprite('coinEdge', 140, 140, paintCoinEdge),
    cx + e - (Wr * wob) / 2,
    cy - Wr / 2,
    Wr * wob,
    Wr
  );
  ctx.drawImage(
    sprite('coin' + c.randomNumber, 140, 140, g =>
      paintCoinFace(g, c.randomNumber)
    ),
    cx - (Wr * wob) / 2,
    cy - Wr / 2,
    Wr * wob,
    Wr
  );
}

/* ============================== cannons ==============================
   170 x 170 box; the ball leaves the muzzle at (35, 30) facing left, or
   (140, 30) facing right (the same cannon mirrored about x 87.5). */
const DIR = [0.64, 0.77]; // from the muzzle back along the barrel (facing left)
const NRM = [0.77, -0.64]; // the barrel's upper side
const MUZ = [35, 30];
const at = (d, s = 0) => [
  MUZ[0] + DIR[0] * d + NRM[0] * s,
  MUZ[1] + DIR[1] * d + NRM[1] * s,
];
const FUSE = [
  at(84, 17),
  [at(84, 17)[0] + 7, at(84, 17)[1] - 11],
  [at(84, 17)[0] + 15, at(84, 17)[1] - 12],
];

function paintCannon(g) {
  g.translate(-85, -85);
  // spare cannonballs
  style.paint(
    g,
    c => {
      for (const [x, y] of [
        [134, 157],
        [151, 157],
        [142.5, 143],
      ]) {
        c.moveTo(x + 8.5, y);
        c.arc(x, y, 8.5, 0, TAU);
      }
    },
    'ball',
    [126, 134, 160, 166],
    { small: true, gloss: true }
  );
  // the carriage
  style.paint(
    g,
    c =>
      polyPath(c, [
        [54, 132],
        [58, 98],
        [86, 76],
        [112, 84],
        [150, 136],
        [158, 152],
        [150, 160],
        [100, 152],
        [60, 144],
      ]),
    'wood',
    [54, 76, 158, 160],
    {}
  );
  style.stroke(
    g,
    c => {
      c.moveTo(76, 108);
      c.lineTo(136, 142);
    },
    'crack',
    2.2
  );
  // the barrel: wider at the back, with a lip at the muzzle
  const bar = [
    at(-2, 14),
    at(96, 19),
    at(104, 13),
    at(104, -13),
    at(96, -19),
    at(-2, -14),
  ];
  style.paint(
    g,
    c => {
      polyPath(c, bar);
      const k = at(112, 0);
      c.moveTo(k[0] + 7, k[1]);
      c.arc(k[0], k[1], 7, 0, TAU);
    },
    'iron',
    [10, 5, 140, 130],
    { gloss: true }
  );
  style.paint(
    g,
    c => {
      polyPath(c, [at(-4, 17.5), at(6, 17.5), at(6, -17.5), at(-4, -17.5)]);
      polyPath(c, [at(38, 17), at(45, 17), at(45, -17), at(38, -17)]);
      polyPath(c, [at(78, 19), at(85, 19), at(85, -19), at(78, -19)]);
    },
    'brass',
    [0, 0, 150, 130],
    { small: true }
  );
  // the dark mouth of the barrel
  g.fillStyle = '#10131F';
  g.beginPath();
  const m = at(-3, 0);
  g.ellipse(m[0], m[1], 5, 11, Math.atan2(DIR[1], DIR[0]), 0, TAU);
  g.fill();
  // the wheel
  const wx = 80;
  const wy = 136;
  style.paint(
    g,
    c => {
      c.arc(wx, wy, 29, 0, TAU);
      c.arc(wx, wy, 21, 0, TAU, true);
    },
    'wheel',
    [wx - 29, wy - 29, wx + 29, wy + 29],
    { gloss: true }
  );
  style.paint(
    g,
    c => {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + 0.2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        c.moveTo(wx + ca * 6 - sa * 2.6, wy + sa * 6 + ca * 2.6);
        c.lineTo(wx + ca * 22 - sa * 2.6, wy + sa * 22 + ca * 2.6);
        c.lineTo(wx + ca * 22 + sa * 2.6, wy + sa * 22 - ca * 2.6);
        c.lineTo(wx + ca * 6 + sa * 2.6, wy + sa * 6 - ca * 2.6);
        c.closePath();
      }
    },
    'wood',
    [wx - 22, wy - 22, wx + 22, wy + 22],
    { small: true }
  );
  style.paint(
    g,
    c => c.arc(wx, wy, 7.5, 0, TAU),
    'wheelHub',
    [wx - 7.5, wy - 7.5, wx + 7.5, wy + 7.5],
    { small: true, gloss: true }
  );
  // the trunnion (the barrel's pivot) and the wick
  const tr = at(56, 0);
  style.paint(
    g,
    c => c.arc(tr[0], tr[1], 6.5, 0, TAU),
    'brass',
    [tr[0] - 6.5, tr[1] - 6.5, tr[0] + 6.5, tr[1] + 6.5],
    { small: true, gloss: true }
  );
  style.stroke(
    g,
    c => {
      c.moveTo(FUSE[0][0], FUSE[0][1]);
      c.quadraticCurveTo(FUSE[1][0], FUSE[1][1], FUSE[2][0], FUSE[2][1]);
    },
    'wick',
    3
  );
}

// a mound of ground under things that stand low on the screen (cannons, Easter
// Island heads): grass, snow or sand, or a rock in front of the water
function plinth(ctx, x0, x1, top) {
  const wx = (x0 + x1) / 2 + CAM;
  const water = !!lakeAt(wx);
  const mat = water ? 'rock' : biomeAt(wx);
  const h = Math.round((1100 - top) / 2) * 2;
  const w = x1 - x0 + 40;
  const spr = sprite(`plinth:${mat}:${w}:${h}`, w, h, g =>
    paintPlinth(g, -w / 2 + 20, w / 2 - 20, -h / 2, h / 2, mat, water)
  );
  ctx.drawImage(spr, x0 - 20, 1100 - h, w, h);
}
function paintPlinth(ctx, x0, x1, top, bottom, mat, water) {
  const path = c => {
    c.moveTo(x0 - 18, bottom);
    c.bezierCurveTo(x0 - 8, top + 50, x0 + 4, top + 3, x0 + 36, top);
    c.lineTo(x1 - 36, top);
    c.bezierCurveTo(x1 - 4, top + 3, x1 + 8, top + 50, x1 + 18, bottom);
    c.closePath();
  };
  style.paint(ctx, path, mat, [x0, top, x1, bottom], { gloss: water });
  if (!water) {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x0 - 4, top + 26);
    ctx.bezierCurveTo(x0 + 6, top + 9, x0 + 16, top + 8, x0 + 38, top + 8);
    ctx.lineTo(x1 - 38, top + 8);
    ctx.bezierCurveTo(x1 - 16, top + 8, x1 - 6, top + 9, x1 + 4, top + 26);
    ctx.lineWidth = 10;
    ctx.strokeStyle =
      mat === 'grass'
        ? 'rgba(196,245,120,0.8)'
        : mat === 'snow'
        ? 'rgba(255,255,255,0.95)'
        : 'rgba(255,244,200,0.9)';
    ctx.stroke();
    ctx.restore();
  }
}

export function drawCannon(ctx, c) {
  const s = state(c, () => ({ frame: c.frame, firedAt: -9 }));
  const left = c.facing === 'left';
  const flip = left ? 1 : -1;
  const X = xb => (left ? c.dX + xb : c.dX + 175 - xb);
  // what happened since the last frame
  if (c.frame !== s.frame) {
    if (c.frame === 34) {
      s.firedAt = T;
      const m = [X(MUZ[0] - DIR[0] * 6), c.dY + MUZ[1] - DIR[1] * 6];
      const ang = Math.atan2(-DIR[1], -DIR[0] * flip);
      fx.puffs(m[0], m[1], 10, {
        speed: 140,
        size: 16,
        grow: 24,
        life: 1.3,
        vx: Math.cos(ang) * 120,
        vy: Math.sin(ang) * 120,
      });
      fx.sparks(m[0], m[1], 10, { angle: ang, cone: 0.5, speed: 380 });
      shake = Math.max(shake, 0.35);
    }
    s.frame = c.frame;
  }
  plinth(ctx, c.dX - 10, c.dX + 180, c.dY + 164);
  const since = T - s.firedAt;
  const rk =
    since < 0.45
      ? Math.sin(Math.min(1, since / 0.08) * Math.PI * 0.5) *
        (1 - clamp((since - 0.08) / 0.37, 0, 1))
      : 0;
  const ox = DIR[0] * 9 * rk * flip;
  const oy = DIR[1] * 5 * rk;
  const spr = sprite('cannon', 170, 170, paintCannon);
  ctx.save();
  ctx.translate(c.dX + ox + (left ? 0 : 175), c.dY + oy);
  ctx.scale(flip, 1);
  ctx.drawImage(spr, 0, 0, 170, 170);
  // the fuse burning down to the barrel
  if (c.frame > 0 && c.frame < 34) {
    const u = 1 - c.frame / 34;
    const v = 1 - u;
    const p = [
      v * v * FUSE[0][0] + 2 * v * u * FUSE[1][0] + u * u * FUSE[2][0],
      v * v * FUSE[0][1] + 2 * v * u * FUSE[1][1] + u * u * FUSE[2][1],
    ];
    style.glow(ctx, p[0], p[1], 22, '#FFB347', 0.8);
    style.spr(
      ctx,
      'spark' + (Math.floor(T * 30) % 2),
      p[0],
      p[1],
      9 + 3 * Math.sin(T * 50),
      1,
      T * 9
    );
    s.fz = (s.fz || 0) + DT * 22;
    while (s.fz > 1) {
      s.fz -= 1;
      fx.emit(
        'spark',
        c.dX + ox + (left ? p[0] : 175 - p[0]),
        c.dY + oy + p[1],
        {
          vx: fx.rand(-70, 70),
          vy: fx.rand(-160, -40),
          g: 420,
          life: fx.rand(0.2, 0.45),
          size: fx.rand(3, 5),
          rot: fx.rand(0, 6),
        }
      );
    }
  }
  ctx.restore();
  // muzzle flash and BOOM!
  if (since < 0.16) {
    const k = 1 - since / 0.16;
    const m = [X(MUZ[0]) - DIR[0] * 8 * flip, c.dY + MUZ[1] - DIR[1] * 8];
    ctx.save();
    ctx.translate(m[0], m[1]);
    ctx.rotate(Math.atan2(-DIR[1], -DIR[0] * flip));
    const sc = 0.6 + 0.6 * k;
    ctx.beginPath();
    starPath(ctx, 18 * sc, 0, 44 * sc, 0.3, 9, 0.5);
    ctx.fillStyle = '#FFE14A';
    ctx.lineWidth = 4;
    ctx.strokeStyle = OUT;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    starPath(ctx, 18 * sc, 0, 24 * sc, 0.1, 7, 0.55);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
    style.glow(ctx, m[0], m[1], 110 * sc, '#FFB347', k);
  }
  if (since < 0.85) {
    const u = since / 0.85;
    const sc = u < 0.25 ? easeOutBack(u / 0.25) : 1;
    ctx.save();
    ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
    ctx.translate(X(MUZ[0]) + 10 * -flip, c.dY + MUZ[1] - 60 - u * 30);
    ctx.rotate(-0.12 * flip);
    ctx.scale(sc, sc);
    style.text(ctx, 'BOOM!', 0, 0, 54, {
      align: 'center',
      fill: '#FFE14A',
      outline: 11,
    });
    ctx.restore();
  }
}

/* ============================== cannonballs ==============================
   The hitbox is the 20 x 20 square at (x, y), so the ball is centred on
   (x + 10, y + 10). */
export function drawCannonBall(ctx, b) {
  const s = state(b, () => ({ px: b.x, py: b.y, puff: 0 }));
  const x = b.x + 10;
  const y = b.y + 10;
  const dx = b.x - s.px;
  const dy = b.y - s.py;
  s.px = b.x;
  s.py = b.y;
  const wx = x + CAM;
  const lake = lakeAt(wx);
  const surf = lake ? surfaceAt(x) : 1e9;
  if (lake && !s.splashed && y > surf) {
    s.splashed = true;
    fx.splash(x, surf, 12, { scale: 1.1 });
  }
  nearMiss(s, x, y, 12);
  if (s.splashed) {
    s.bub = (s.bub || 0) + DT * 12;
    while (s.bub > 1) {
      s.bub -= 1;
      fx.emit('bubble', x + fx.rand(-8, 8), y + fx.rand(-8, 8), {
        vy: -60,
        life: 0.5,
        size: fx.rand(3, 5),
      });
    }
    return;
  }
  // a soft smoke streak where the ball has been (kept in world positions, so
  // it stays in the air as the scenery scrolls), with the odd puff
  if (!s.trail) s.trail = [];
  s.trail.push([x + CAM, y, T]);
  while (s.trail.length && T - s.trail[0][2] > 0.28) s.trail.shift();
  if (s.trail.length > 2) {
    const n = s.trail.length;
    const pts = s.trail.map(([wx, wy]) => [wx - CAM, wy]);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    polyPath(ctx, ribbon(pts, 1, 9));
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    polyPath(ctx, ribbon(pts.slice(Math.floor(n / 2)), 1, 4));
    ctx.fill();
  }
  s.puff += DT * 7;
  while (s.puff > 1) {
    s.puff -= 1;
    fx.emit('smoke', x + fx.rand(-4, 4), y + fx.rand(-4, 4), {
      life: fx.rand(0.4, 0.7),
      size: fx.rand(6, 9),
      grow: 12,
    });
  }
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    const ux = dx / d;
    const uy = dy / d;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const o of [-9, 0, 9]) {
      const L = 54 - Math.abs(o) * 1.6;
      ctx.moveTo(x - ux * 18 - uy * o, y - uy * 18 + ux * o);
      ctx.lineTo(x - ux * L - uy * o, y - uy * L + ux * o);
    }
    ctx.stroke();
  }
  ctx.drawImage(
    sprite('cannonball', 34, 34, g =>
      style.paint(
        g,
        c => c.arc(0, 0, 12.5, 0, TAU),
        'ball',
        [-12.5, -12.5, 12.5, 12.5],
        { gloss: true }
      )
    ),
    x - 17,
    y - 17,
    34,
    34
  );
}

/* ============================== wind turbines ==============================
   The hitbox is the whole disc the blades sweep (hub at 205, 210 from the
   turbine's corner, reach about 206) plus the tower down to y 680. */
const HUB = [205, 210];
function paintTower(g) {
  // box coordinates, sprite centred on (205, 560)
  g.translate(-205, -560);
  style.paint(
    g,
    c => {
      c.moveTo(191, 230);
      c.lineTo(219, 230);
      c.lineTo(212, 905);
      c.lineTo(176, 905);
      c.closePath();
    },
    'turbine',
    [176, 230, 219, 905],
    { horiz: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(208, 240);
      c.lineTo(216, 240);
      c.lineTo(209, 905);
      c.lineTo(201, 905);
      c.closePath();
    },
    'turbineShade',
    [0, 0, 0, 0],
    { noLine: true }
  );
  // the nacelle behind the hub
  style.paint(
    g,
    c => rrect(c, 190, 194, 62, 32, 13),
    'turbine',
    [190, 194, 252, 226],
    { gloss: true }
  );
  style.paint(g, c => rrect(c, 224, 200, 18, 8, 4), 'hub', [0, 0, 0, 0], {
    small: true,
    noLine: true,
  });
}
function paintRotor(g) {
  const blades = k => turbineBlade(0, 0, (k * TAU) / 3 - Math.PI / 2, 194);
  style.paint(
    g,
    c => {
      for (let k = 0; k < 3; k++) polyPath(c, blades(k));
    },
    'turbine',
    [-200, -200, 200, 200]
  );
  style.paint(
    g,
    c => {
      for (let k = 0; k < 3; k++) {
        const p = blades(k);
        polyPath(c, [p[8], p[9], p[10], p[11], p[12], p[13]]);
      }
    },
    'tip',
    [0, 0, 0, 0],
    { noLine: true }
  );
}
function paintDisc(g) {
  g.beginPath();
  g.arc(0, 0, 204, 0, TAU);
  g.fillStyle = 'rgba(255,255,255,0.1)';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255,255,255,0.3)';
  g.stroke();
}
export function drawTurbine(ctx, w) {
  const s = state(w);
  const hx = w.dX + HUB[0];
  const hy = w.dY + HUB[1];
  ctx.drawImage(
    sprite('tower', 110, 700, paintTower),
    w.dX + 205 - 55,
    w.dY + 560 - 350,
    110,
    700
  );
  // the swept disc (this is what you can hit), softly
  ctx.drawImage(
    sprite('turbineDisc', 420, 420, paintDisc),
    hx - 210,
    hy - 210,
    420,
    420
  );
  // the blades turn, with a faint copy trailing behind as motion blur
  const rotor = sprite('rotor', 420, 420, paintRotor);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(T * 3.1 + s.id * 1.9 - 0.22);
  ctx.globalAlpha = 0.22;
  ctx.drawImage(rotor, -210, -210, 420, 420);
  ctx.rotate(0.22);
  ctx.globalAlpha = 1;
  ctx.drawImage(rotor, -210, -210, 420, 420);
  ctx.restore();
  ctx.drawImage(
    sprite('hub', 44, 44, g =>
      style.paint(g, c => c.arc(0, 0, 17, 0, TAU), 'hub', [-17, -17, 17, 17], {
        gloss: true,
      })
    ),
    hx - 22,
    hy - 22,
    44,
    44
  );
  // a blinking warning light on top
  const blink = Math.max(0, Math.sin(T * 3 + s.id)) ** 6;
  style.glow(
    ctx,
    hx + 26,
    hy - 18,
    12 + 26 * blink,
    '#FF4F5E',
    0.3 + 0.7 * blink
  );
  ctx.fillStyle = blink > 0.3 ? '#FF6B7A' : '#B8323E';
  ctx.beginPath();
  ctx.arc(hx + 26, hy - 18, 4, 0, TAU);
  ctx.fill();
}

/* ============================== sharks ============================== */
function lakeClip(ctx, x) {
  const lake = lakeAt(x + CAM);
  if (!lake) return false;
  ctx.beginPath();
  ctx.rect(lake[0] - CAM, -10, lake[1] - lake[0], 1100);
  ctx.clip();
  return true;
}

function paintFin(g) {
  style.paint(g, c => finPath(c, 0, 40, 66, 1), 'shark', [-36, -26, 34, 40], {
    gloss: true,
  });
  style.stroke(
    g,
    c => {
      c.moveTo(-18, 12);
      c.quadraticCurveTo(-6, -10, -8, -18);
    },
    'gill',
    2
  );
}

// the fin rides the surface; the shark's body shows through the water
export function drawSharkFin(ctx, f) {
  const x = f.dX + 170;
  ctx.save();
  if (!lakeClip(ctx, x)) {
    ctx.restore();
    return;
  }
  const s = state(f, () => ({ frame: f.frame, foam: 0 }));
  const dir = f.facing === 'left' ? -1 : 1;
  const yb = surfaceAt(x) + 2;
  const h = (f.frame / 27) * 64;
  const depth = (f.dY - 846) / 78;
  // the body under the water
  if (f.frame > 2) {
    const k = Math.min(1, f.frame / 10);
    const by = yb + 18 + depth * 26;
    ctx.globalAlpha = 0.9 * k * (1 - depth * 0.35);
    style.paint(
      ctx,
      c => {
        c.moveTo(x + 70 * dir, by + 16);
        c.quadraticCurveTo(x + 10 * dir, by - 4, x - 90 * dir, by + 12);
        c.quadraticCurveTo(
          x - 150 * dir,
          by + 16,
          x - 190 * dir,
          by + 2 + Math.sin(T * 5) * 6
        );
        c.lineTo(x - 186 * dir, by + 28 + Math.sin(T * 5) * 4);
        c.quadraticCurveTo(x - 120 * dir, by + 32, x - 70 * dir, by + 38);
        c.quadraticCurveTo(x + 40 * dir, by + 42, x + 70 * dir, by + 16);
        c.closePath();
      },
      'sharkUnder',
      [0, by, 0, by + 40],
      { noLine: true }
    );
    ctx.globalAlpha = 1;
  }
  if (f.frame > 0) {
    const spr = sprite('fin', 140, 90, paintFin);
    const rows = h + 21;
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(dir, 1);
    ctx.drawImage(
      spr,
      0,
      0,
      spr.width,
      spr.height * (rows / 90),
      -70,
      yb - h - 19,
      140,
      rows
    );
    ctx.restore();
    // a curl of foam where the fin cuts the water
    s.foam += DT * (6 + h * 0.15);
    while (s.foam > 1) {
      s.foam -= 1;
      fx.emit('foam', x - fx.rand(-20, 30) * dir, yb + fx.rand(-2, 2), {
        vx: -fx.rand(20, 50) * dir,
        life: fx.rand(0.4, 0.8),
        size: fx.rand(3, 6),
        grow: 3,
      });
    }
  }
  if (f.frame === 1 && s.frame === 0) fx.splash(x, yb, 6, { scale: 0.7 });
  s.frame = f.frame;
  ctx.restore();
}

function paintSharkHead(g) {
  const x = -103;
  const y = -70;
  style.paint(
    g,
    c => sharkHeadPath(c, x, y),
    'shark',
    [x, y, x + 206, y + 120],
    { gloss: true }
  );
  g.save();
  g.beginPath();
  sharkHeadPath(g, x, y);
  g.clip();
  style.paint(
    g,
    c => sharkBellyPath(c, x, y),
    'belly',
    [x, y, x + 90, y + 120],
    { noLine: true }
  );
  g.restore();
  style.stroke(
    g,
    c => {
      for (let k = 0; k < 3; k++) {
        c.moveTo(x + 122 + k * 12, y + 58 + k * 4);
        c.quadraticCurveTo(
          x + 128 + k * 12,
          y + 78 + k * 4,
          x + 122 + k * 12,
          y + 98 + k * 4
        );
      }
    },
    'gill',
    2.4
  );
  // a grin full of teeth
  g.beginPath();
  g.moveTo(x + 28, y + 54);
  g.quadraticCurveTo(x + 50, y + 92, x + 100, y + 92);
  g.quadraticCurveTo(x + 56, y + 80, x + 28, y + 54);
  g.closePath();
  g.fillStyle = '#7A2438';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = OUT;
  g.lineJoin = 'round';
  g.stroke();
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const u = (k + 0.6) / 6.4;
    const v = 1 - u;
    const tx = v * v * (x + 28) + 2 * v * u * (x + 50) + u * u * (x + 100);
    const ty = v * v * (y + 54) + 2 * v * u * (y + 92) + u * u * (y + 92) - 3;
    g.moveTo(tx - 4.5, ty - 1);
    g.lineTo(tx + 4.5, ty + 1);
    g.lineTo(tx - 1, ty + 7);
    g.closePath();
  }
  g.fill();
  g.lineWidth = 1.4;
  g.stroke();
  const ex = x + 82;
  const ey = y + 42;
  style.paint(
    g,
    c => c.ellipse(ex, ey, 9, 8, 0, 0, TAU),
    'eyeWhite',
    [ex - 9, ey - 8, ex + 9, ey + 8],
    { small: true }
  );
  g.beginPath();
  g.moveTo(ex - 13, ey - 16);
  g.lineTo(ex + 9, ey - 9);
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.strokeStyle = OUT;
  g.stroke();
}

// the head rises out of the water (frames 0..30) and fires its lasers from
// the eye at (82, 42)
export function drawSharkHead(ctx, h, lasers) {
  const s = state(h, () => ({ rose: false, bub: 0 }));
  const surf = SURFACE_Y + 2;
  ctx.save();
  if (!lakeClip(ctx, h.dX + 103)) {
    ctx.restore();
    return;
  }
  // bubbles give it away just before it comes up
  if (
    !h.haveWePausedLongEnough &&
    h.timeSinceLastHeadInterval > h.pauseBeforeSharkAppears - 0.9
  ) {
    const k = clamp(
      (h.timeSinceLastHeadInterval - (h.pauseBeforeSharkAppears - 0.9)) / 0.9,
      0,
      1
    );
    s.bub += DT * (10 + 30 * k);
    while (s.bub > 1) {
      s.bub -= 1;
      fx.emit('bubble', h.dX + fx.rand(30, 180), surf + fx.rand(6, 50), {
        vy: fx.rand(-90, -50),
        life: fx.rand(0.3, 0.6),
        size: fx.rand(3, 7),
      });
    }
    ctx.globalAlpha = 0.5 * k;
    style.paint(
      ctx,
      c => c.ellipse(h.dX + 103, surf + 44, 90, 26, 0, 0, TAU),
      'sharkUnder',
      [0, surf + 18, 0, surf + 70],
      { noLine: true }
    );
    ctx.globalAlpha = 1;
  }
  if (h.frame > 0 && !s.rose) {
    s.rose = true;
    fx.splash(h.dX + 103, surf, 16, { scale: 1.3 });
  }
  if (h.frame > 0) {
    const k = h.frame / 30;
    style.paint(
      ctx,
      c => {
        c.moveTo(h.dX + 12, surf);
        c.bezierCurveTo(
          h.dX + 4,
          surf + 40,
          h.dX + 60,
          surf + 60,
          h.dX + 110,
          surf + 62
        );
        c.bezierCurveTo(
          h.dX + 170,
          surf + 58,
          h.dX + 206,
          surf + 36,
          h.dX + 196,
          surf
        );
        c.closePath();
      },
      'sharkUnder',
      [0, surf, 0, surf + 60],
      { noLine: true }
    );
    const top = surf - k * (surf - (h.dY - 15));
    const vis = clamp(surf - top, 0, 170);
    const spr = sprite('sharkHead', 260, 170, paintSharkHead);
    if (vis > 1)
      ctx.drawImage(
        spr,
        0,
        0,
        spr.width,
        spr.height * (vis / 170),
        h.dX + 103 - 130,
        top,
        260,
        vis
      );
    // the eye: an angry pupil, glowing pink while the lasers fire
    const ex = h.dX + 80;
    const ey = top + 15 + 42 + 1;
    const firing = lasers.some(l => Math.abs(l.laser1BeginX - (h.dX + 82)) < 3);
    if (ey + 6 < surf) {
      style.paint(
        ctx,
        c => c.arc(ex, ey, 4.6, 0, TAU),
        firing ? 'laserEye' : 'pupil',
        [ex - 5, ey - 5, ex + 5, ey + 5],
        { noLine: true }
      );
      if (firing)
        style.glow(ctx, ex, ey, 40 + 10 * Math.sin(T * 30), '#FF3D7F', 0.9);
    }
  }
  ctx.restore();
}

// the two beams, exactly along the lines the game tests for collisions
export function drawLasers(ctx, L) {
  const fl = 0.85 + 0.15 * Math.sin(T * 57);
  const beams = [
    [L.laser1BeginX, L.laser1BeginY, L.laser1EndX, L.laser1EndY],
    [L.laser2BeginX, L.laser2BeginY, L.laser2EndX, L.laser2EndY],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  const layers = [
    ['rgba(255,50,120,0.22)', 40 * fl],
    [OUT, 16],
    ['#FF3D7F', 11],
    ['#FFFFFF', 4.5 * fl],
  ];
  for (const [col, wid] of layers) {
    ctx.beginPath();
    for (const [ax, ay, bx, by] of beams) {
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = wid;
    ctx.stroke();
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  beams.forEach(([ax, ay, bx, by], i) => {
    for (let k = 0; k < 5; k++) {
      const u = (T * 1.6 + k / 5 + i * 0.1) % 1;
      starPath(
        ctx,
        lerp(ax, bx, u) + Math.sin(k * 9 + T * 20) * 9,
        lerp(ay, by, u),
        6,
        T * 3 + k,
        4,
        0.3
      );
    }
  });
  ctx.fill();
  ctx.restore();
  const s = state(L, () => ({ sp: 0 }));
  s.sp += DT * 24;
  while (s.sp > 1) {
    s.sp -= 1;
    const [, , bx, by] = beams[Math.floor(fx.rand(0, 2))];
    fx.emit('spark', bx, by + 2, {
      vx: fx.rand(-160, 160),
      vy: fx.rand(20, 200),
      g: 500,
      life: fx.rand(0.25, 0.5),
      size: fx.rand(3, 6),
      rot: fx.rand(0, 6),
    });
  }
  style.glow(ctx, beams[0][0], beams[0][1], 70, '#FF3D7F', 0.9);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  starPath(ctx, beams[0][0], beams[0][1], 13 * fl, T * 2, 4, 0.22);
  ctx.fill();
}

/* ============================== ice ghosts ==============================
   133 x 195, like the hitbox. Eyes follow the balloon; purple mist and
   frost trail behind. */
export function drawGhost(ctx, gh) {
  const s = state(gh, () => ({ mist: 0, frost: 0 }));
  const x = gh.dX;
  const y = gh.dY;
  const t = T + s.id * 1.3;
  nearMiss(s, x + 66, y + 100, 60);
  // a frosty glow on the right-hand edge as a ghost drifts in
  if (x > 1400) {
    const k = clamp((x - 1400) / 450, 0, 1);
    const fr = ctx.createLinearGradient(1920, 0, 1740, 0);
    fr.addColorStop(0, `rgba(215,235,255,${0.55 * k})`);
    fr.addColorStop(1, 'rgba(215,235,255,0)');
    ctx.fillStyle = fr;
    ctx.fillRect(1740, 0, 180, 1080);
    if (fx.rand() < DT * 12 * k)
      fx.emit('frost', 1920 - fx.rand(0, 90), fx.rand(40, 1040), {
        vx: -fx.rand(20, 60),
        life: fx.rand(0.6, 1),
        size: fx.rand(4, 7),
        rot: fx.rand(0, 6),
        spin: fx.rand(-2, 2),
      });
  }
  style.glow(ctx, x + 66, y + 104, 150, '#B08CFF', 0.3);
  s.mist += DT * 9;
  while (s.mist > 1) {
    s.mist -= 1;
    fx.emit('mist', x + fx.rand(20, 130), y + fx.rand(120, 190), {
      vx: fx.rand(10, 50),
      vy: fx.rand(-10, 10),
      life: fx.rand(0.8, 1.4),
      size: fx.rand(18, 30),
      grow: 16,
    });
  }
  s.frost += DT * 7;
  while (s.frost > 1) {
    s.frost -= 1;
    fx.emit('frost', x + fx.rand(60, 140), y + fx.rand(20, 180), {
      vx: fx.rand(20, 70),
      vy: fx.rand(-10, 30),
      life: fx.rand(0.5, 0.9),
      size: fx.rand(3, 6),
      rot: fx.rand(0, 6),
      spin: fx.rand(-3, 3),
    });
  }
  // the body and face are repainted 20 times a second into the ghost's own
  // small picture, which is then drawn every frame
  const slot = Math.floor(T * 20);
  if (!s.cv || s.slot !== slot || s.px !== style.px) {
    const px = style.px;
    if (!s.cv || s.px !== px) s.cv = makeCanvas(180 * px, 240 * px);
    s.px = px;
    s.slot = slot;
    const g = s.cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, s.cv.width, s.cv.height);
    g.setTransform(px, 0, 0, px, 20 * px, 20 * px);
    style.caching = true;
    ghostFace(g, t, W.balloon, x, y);
    style.caching = false;
  }
  ctx.drawImage(s.cv, x - 20, y - 20, 180, 240);
}
// the ghost at (0, 0); its eyes look at the balloon b (the ghost is at x, y)
function ghostFace(ctx, t, b, gx, gy) {
  const x = 0;
  const y = 0;
  style.paint(
    ctx,
    c => ghostPath(c, x, y, t),
    'ghost',
    [x, y, x + 133, y + 195],
    { gloss: true }
  );
  let lx = -5;
  let ly = 1;
  if (b) {
    const dx = b.dX + 85 - (gx + 65);
    const dy = b.dY + 110 - (gy + 68);
    const d = Math.hypot(dx, dy) || 1;
    lx = (dx / d) * 5;
    ly = (dy / d) * 4;
  }
  ctx.fillStyle = OUT;
  ctx.beginPath();
  ctx.ellipse(x + 46, y + 70, 11, 15, 0.05, 0, TAU);
  ctx.moveTo(x + 95, y + 66);
  ctx.ellipse(x + 84, y + 66, 11, 15, -0.05, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + 46 + lx, y + 64 + ly, 4.2, 0, TAU);
  ctx.moveTo(x + 88.2 + lx, y + 60 + ly);
  ctx.arc(x + 84 + lx, y + 60 + ly, 4.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 32, y + 46);
  ctx.lineTo(x + 56, y + 52);
  ctx.moveTo(x + 98, y + 42);
  ctx.lineTo(x + 74, y + 50);
  ctx.stroke();
  const mo = 1 + 0.25 * Math.sin(t * 5);
  ctx.fillStyle = '#4A2A5A';
  ctx.beginPath();
  ctx.ellipse(x + 66, y + 106, 10, 12 * mo, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FF7AA8';
  ctx.beginPath();
  ctx.ellipse(x + 66, y + 113 + 2 * mo, 6, 4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,120,170,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 30, y + 92, 9, 5, 0, 0, TAU);
  ctx.moveTo(x + 111, y + 88);
  ctx.ellipse(x + 102, y + 88, 9, 5, 0, 0, TAU);
  ctx.fill();
}

/* ============================== Easter Island heads ==============================
   148 x 328 box. The mouth opens (frame 0) three seconds after it appears
   and spits rings from (10, 150) for four seconds. */
function paintMoai(g, q) {
  const x = -75;
  const y = -165;
  const pts = moaiPts(q).map(([a, b]) => [x + a, y + b]);
  style.paint(g, c => smoothPath(c, pts), 'stone', [x, y, x + 150, y + 330], {
    horiz: true,
  });
  g.save();
  g.beginPath();
  smoothPath(g, pts);
  g.clip();
  style.paint(
    g,
    c => {
      c.moveTo(x + 104, y - 10);
      c.bezierCurveTo(x + 96, y + 110, x + 100, y + 230, x + 118, y + 340);
      c.lineTo(x + 170, y + 340);
      c.lineTo(x + 170, y - 10);
      c.closePath();
    },
    'stoneShade',
    [x + 100, y, x + 160, y + 330],
    { noLine: true }
  );
  style.paint(
    g,
    c => c.ellipse(x + 30, y + 99, 22, 11, 0.1, 0, TAU),
    'stoneDark',
    [x, y + 88, x + 50, y + 110],
    { noLine: true }
  );
  style.paint(
    g,
    c => {
      c.moveTo(x + 102, y + 70);
      c.bezierCurveTo(x + 124, y + 76, x + 124, y + 170, x + 110, y + 196);
      c.bezierCurveTo(x + 102, y + 170, x + 98, y + 110, x + 102, y + 70);
      c.closePath();
    },
    'stoneDark',
    [x + 98, y + 70, x + 124, y + 196],
    { noLine: true }
  );
  style.paint(
    g,
    c => {
      for (const [mx, my, r] of [
        [46, 6, 13],
        [70, 2, 16],
        [96, 4, 14],
        [120, 10, 12],
        [58, 12, 9],
      ]) {
        c.moveTo(x + mx + r, y + my);
        c.ellipse(x + mx, y + my, r, r * 0.6, 0, 0, TAU);
      }
    },
    'moss',
    [x + 30, y - 10, x + 130, y + 20],
    { noLine: true }
  );
  g.restore();
  style.stroke(
    g,
    c => {
      c.moveTo(x + 58, y + 150);
      c.lineTo(x + 64, y + 166);
      c.lineTo(x + 60, y + 180);
      c.moveTo(x + 126, y + 240);
      c.lineTo(x + 118, y + 256);
      c.lineTo(x + 124, y + 272);
      c.moveTo(x + 40, y + 290);
      c.lineTo(x + 52, y + 300);
    },
    'crack',
    2
  );
  style.stroke(
    g,
    c => {
      c.moveTo(x + 10, y + 82);
      c.quadraticCurveTo(x + 30, y + 88, x + 50, y + 84);
    },
    'crack',
    2.4
  );
  if (q > 0.02)
    style.paint(
      g,
      c =>
        polyPath(c, [
          [x + 13, y + 191],
          [x + 26, y + 198],
          [x + 25, y + 199 + 17 * q],
          [x + 14, y + 205 + 17 * q],
        ]),
      'mouth',
      [0, y + 190, 0, y + 222],
      { small: true }
    );
}
export function drawMoai(ctx, m) {
  const s = state(m, () => ({ mouth: 0, dust: 0 }));
  const want = m.frame === 0 ? 1 : 0;
  const before = s.mouth;
  s.mouth = clamp(s.mouth + Math.sign(want - s.mouth) * DT * 3.2, 0, 1);
  if (before < 0.05 && s.mouth >= 0.05) {
    // stone dust falls as the jaw drops
    for (let i = 0; i < 10; i++)
      fx.emit('dust', m.dX + fx.rand(4, 40), m.dY + fx.rand(196, 230), {
        vx: fx.rand(-40, 10),
        vy: fx.rand(20, 90),
        g: 300,
        life: fx.rand(0.6, 1.1),
        size: fx.rand(4, 8),
        grow: 6,
      });
  }
  plinth(ctx, m.dX - 16, m.dX + 164, m.dY + 318);
  const q = Math.round(s.mouth * 4) / 4;
  ctx.drawImage(
    sprite('moai' + q, 220, 370, g => paintMoai(g, q)),
    m.dX + 75 - 110,
    m.dY + 165 - 185,
    220,
    370
  );
  if (s.mouth > 0.02) {
    const glow = s.mouth * (0.75 + 0.25 * Math.sin(T * 6));
    style.glow(ctx, m.dX + 28, m.dY + 100, 34, '#FFB000', glow);
    style.paint(
      ctx,
      c => c.ellipse(m.dX + 28, m.dY + 100, 6, 4, 0, 0, TAU),
      'eyeLit',
      [0, 0, 0, 1],
      { noLine: true }
    );
  }
}

/* ============================== rings ==============================
   The ring hitbox is a circle about 72 px across, centred on (39, 37); the
   ring fades in over 1.5 s as it leaves the mouth, as before. */
function paintRing(g) {
  const r = 27;
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.lineWidth = 17;
  g.strokeStyle = OUT;
  g.stroke();
  const gr = g.createLinearGradient(0, -r - 8, 0, r + 8);
  gr.addColorStop(0, '#FFC05A');
  gr.addColorStop(1, '#FF5A3A');
  g.lineWidth = 10;
  g.strokeStyle = gr;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r + 1, -2.7, -1.5);
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.stroke();
}
export function drawRing(ctx, r, fixedDt) {
  const a = clamp((r.startingBallAlpha * fixedDt) / 1.5, 0, 1);
  if (a <= 0.004) return;
  const x = r.dX + 39;
  const y = r.dY + 37;
  nearMiss(state(r), x, y, 36);
  style.glow(ctx, x, y, 80, '#FF9A4A', 0.25 * a);
  const s = 1 + Math.sin(T * 14 + x * 0.05) * 0.03;
  ctx.globalAlpha = a;
  ctx.drawImage(
    sprite('ring', 90, 90, paintRing),
    x - 45 * s,
    y - 45 * s,
    90 * s,
    90 * s
  );
  ctx.globalAlpha = 1;
}

/* ============================== warming up ==============================
   Paint every sprite once while the game loads, so nothing is painted for
   the first time in the middle of play. */
export function warmUp(coinNumbers) {
  const g = makeCanvas(64, 64).getContext('2d');
  for (const pose of ['n', 'b', 'c'])
    sprite('pilot' + pose, 60, 60, c => paintPilot(c, pose));
  sprite('envelope', 200, 200, paintEnvelope);
  sprite('basket', 40, 34, paintBasket);
  sprite('coinEdge', 140, 140, paintCoinEdge);
  for (const n of coinNumbers)
    sprite('coin' + n, 140, 140, c => paintCoinFace(c, n));
  sprite('cannon', 170, 170, paintCannon);
  sprite('cannonball', 34, 34, c =>
    style.paint(
      c,
      p => p.arc(0, 0, 12.5, 0, TAU),
      'ball',
      [-12.5, -12.5, 12.5, 12.5],
      { gloss: true }
    )
  );
  sprite('tower', 110, 700, paintTower);
  sprite('fin', 140, 90, paintFin);
  sprite('sharkHead', 260, 170, paintSharkHead);
  for (const q of [0, 0.25, 0.5, 0.75, 1])
    sprite('moai' + q, 220, 370, c => paintMoai(c, q));
  sprite('ring', 90, 90, paintRing);
  const kinds = [
    'smoke',
    'dust',
    'snowPuff',
    'spark0',
    'spark1',
    'spark2',
    'twinkle',
    'star',
    'mist',
    'frost',
    'snowflake',
    'drop',
    'foam',
    'ring',
    'bubble',
    'seed',
    'leaf',
  ];
  for (let i = 0; i < 6; i++) kinds.push('conf' + i);
  for (let i = 0; i < 4; i++) kinds.push('scrap' + i);
  for (const k of kinds) style.spr(g, k, 0, 0, 10, 1);
  // the lettering, so its glyphs are ready
  for (const word of ['POP!', 'BOOM!'])
    style.text(g, word, 0, 0, 60, { outline: 10 });
}

// coins to paint when there is time to spare (the numbers for the chosen sums)
const warmQueue = [];
export function warmLater(numbers) {
  for (const n of numbers) warmQueue.push(n);
}
export function warmStep() {
  const n = warmQueue.shift();
  if (n === undefined) return false;
  sprite('coin' + n, 140, 140, g => paintCoinFace(g, n));
  return true;
}
