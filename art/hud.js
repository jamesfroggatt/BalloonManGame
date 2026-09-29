// The heads-up display: the sum with its answer slot, the journey bar and the
// score, plus the moments around them: praise and "+1" for a right answer,
// the right sum after a wrong one, zone names, and first-flight hints. It only
// reads the game's state. Every part is painted once into a small picture
// (and again only when it changes), which keeps the HUD cheap to draw.
import { TAU, clamp, lerp, easeOutBack, easeInOut } from './util.js';
import { style, OUT, FONT } from './style.js';
import { rrect, starPath } from './shapes.js';
import { level, zoneAt } from './level.js';
import * as fx from './particles.js';

// the answer slot: a hit coin flies to its centre
export const SLOT = { x: 412, y: 40, w: 150, h: 96 };
export const SLOT_CENTRE = [SLOT.x + SLOT.w / 2, SLOT.y + SLOT.h / 2];
const PANEL = { x: 36, y: 26, w: SLOT.x + SLOT.w + 18 - 36, h: 124 };
const JOURNEY = { x: 700, y: 56, w: 540, h: 28 };
const SCORE = { x: 1600, y: 26, w: 284, h: 124 };
const WIN_OFFSET = 16700;
const ZONE_COLOURS = {
  meadow: '#8EDB4E',
  lake: '#4FB8F2',
  snow: '#DDEEFF',
  beach: '#FFD77A',
  finish: '#62C653',
};
const PRAISE = [
  'Brilliant!',
  'Super!',
  'Yes!',
  'Awesome!',
  'Great!',
  'Nice one!',
];

const H = {
  t: 0,
  shown: 0, // how far the panel has slid in (follows the game's own slide)
  score: 0,
  bump: -1,
  plus: -1,
  praise: -1,
  praiseWord: '',
  oops: -1,
  oopsText: '',
  flash: -1,
  flashGood: true,
  streak: 0,
  streakAt: -1,
  zone: null,
  zoneAt: -1,
  hints: { space: 0, steer: false, coin: false },
};

// a new flight: forget the last one's moments (hints are only shown once)
export function reset() {
  Object.assign(H, {
    score: 0,
    bump: -1,
    plus: -1,
    praise: -1,
    oops: -1,
    flash: -1,
    streak: 0,
    streakAt: -1,
    zone: null,
    zoneAt: -1,
  });
}

// the game reports each answered sum
export function answer(correct, sum) {
  H.flash = H.t;
  H.flashGood = correct;
  if (correct) {
    H.streak++;
    H.plus = H.t;
    H.praise = H.t;
    H.praiseWord = PRAISE[(sum.a * 7 + sum.b * 3 + H.streak) % PRAISE.length];
    if (H.streak === 3 || H.streak === 5 || H.streak % 10 === 0)
      H.streakAt = H.t;
    fx.starBurst(SLOT_CENTRE[0], SLOT_CENTRE[1], 10, {
      speed: 260,
      screen: true,
    });
  } else {
    H.streak = 0;
    H.oops = H.t;
    H.oopsText = `${sum.a} ${sum.op} ${sum.b} = ${sum.answer}`;
  }
  H.hints.coin = true;
}

/* ---------- pictures, painted once ---------- */
function pic(key, w, h, paint) {
  return style.sprites.get('hud:' + key, w, h, g => {
    style.caching = true;
    paint(g);
    style.caching = false;
  });
}
// draw picture p (logical w x h) centred at x, y, optionally scaled
function put(ctx, p, w, h, x, y, s = 1) {
  ctx.drawImage(p, x - (w * s) / 2, y - (h * s) / 2, w * s, h * s);
}
function paintPanel(g, w, h, r) {
  const x = -w / 2;
  const y = -h / 2 - 4;
  g.fillStyle = 'rgba(27,42,74,0.28)';
  g.beginPath();
  rrect(g, x, y + 8, w, h, r);
  g.fill();
  g.beginPath();
  rrect(g, x, y, w, h, r);
  g.fillStyle = '#FFFFFF';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = OUT;
  g.stroke();
  g.fillStyle = 'rgba(58,134,255,0.07)';
  g.beginPath();
  rrect(g, x + 8, y + h * 0.55, w - 16, h * 0.4, r * 0.6);
  g.fill();
}
// a white pill with a word on it
function paintPill(g, text, size, fill, textFill, outline) {
  g.font = `${size}px ${FONT}`;
  const w = g.measureText(text).width + size * 1.6;
  const h = size * 1.45;
  g.beginPath();
  rrect(g, -w / 2, -h / 2, w, h, h / 2);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = OUT;
  g.stroke();
  style.text(g, text, 0, size * 0.36, size, {
    align: 'center',
    fill: textFill,
    outline,
  });
}
function paintCoinIcon(g, r) {
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.lineWidth = r * 0.17;
  g.strokeStyle = OUT;
  g.stroke();
  const gr = g.createLinearGradient(0, -r, 0, r);
  gr.addColorStop(0, '#FFF08A');
  gr.addColorStop(0.5, '#FFCB2E');
  gr.addColorStop(1, '#F29E10');
  g.fillStyle = gr;
  g.fill();
  g.beginPath();
  g.arc(0, 0, r * 0.72, 0, TAU);
  g.lineWidth = r * 0.08;
  g.strokeStyle = 'rgba(200,110,0,0.75)';
  g.stroke();
  g.beginPath();
  starPath(g, 0, 1, r * 0.42, 0, 5, 0.46);
  g.fillStyle = '#FFF4B8';
  g.fill();
}
// the answer slot waiting for a coin (its dashes march, 8 steps)
function paintSlot(g, pending, phase) {
  g.beginPath();
  rrect(g, -SLOT.w / 2, -SLOT.h / 2, SLOT.w, SLOT.h, 24);
  g.fillStyle = pending ? '#FFF1BF' : '#FFF7DA';
  g.fill();
  g.setLineDash([14, 10]);
  g.lineDashOffset = -phase * 3;
  g.lineWidth = 5;
  g.strokeStyle = '#F2A21E';
  g.stroke();
  g.setLineDash([]);
  if (!pending)
    style.text(g, '?', 0, 30, 76, {
      align: 'center',
      fill: 'rgba(242,162,30,0.55)',
    });
}
function paintJourney(g, fade) {
  const J = JOURNEY;
  const end = WIN_OFFSET + 960;
  const x = -J.w / 2;
  const y = -J.h / 2;
  if (!fade) {
    g.fillStyle = 'rgba(27,42,74,0.28)';
    g.beginPath();
    rrect(g, x, y + 6, J.w, J.h, J.h / 2);
    g.fill();
  }
  g.save();
  g.beginPath();
  rrect(g, x, y, J.w, J.h, J.h / 2);
  g.clip();
  if (fade) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(x, y, J.w, J.h);
  } else {
    for (const z of level.zones) {
      const a = clamp(z.x0 / end, 0, 1);
      const b = clamp(z.x1 / end, 0, 1);
      g.fillStyle = ZONE_COLOURS[z.kind] || '#8EDB4E';
      g.fillRect(x + a * J.w, y, (b - a) * J.w + 1, J.h);
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(x, y + 4, J.w, 6);
  }
  g.restore();
  if (!fade) {
    g.beginPath();
    rrect(g, x, y, J.w, J.h, J.h / 2);
    g.lineWidth = 5;
    g.strokeStyle = OUT;
    g.stroke();
  }
}
function paintFlag(g) {
  g.beginPath();
  g.moveTo(0, 24);
  g.lineTo(0, -24);
  g.lineWidth = 4;
  g.strokeStyle = OUT;
  g.stroke();
  g.beginPath();
  g.moveTo(0, -24);
  g.lineTo(26, -16);
  g.lineTo(0, -8);
  g.closePath();
  g.fillStyle = '#FF4F5E';
  g.fill();
  g.lineWidth = 3;
  g.stroke();
}
function paintMarker(g) {
  g.beginPath();
  g.arc(0, -8, 17, 0, TAU);
  g.lineWidth = 8;
  g.strokeStyle = OUT;
  g.stroke();
  const mg = g.createLinearGradient(-17, 0, 17, 0);
  mg.addColorStop(0, '#FF6070');
  mg.addColorStop(0.33, '#FFE14A');
  mg.addColorStop(0.66, '#4FDC7A');
  mg.addColorStop(1, '#4A92FF');
  g.fillStyle = mg;
  g.fill();
  g.beginPath();
  rrect(g, -7, 13, 14, 11, 3);
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = '#E6A45C';
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  g.ellipse(-6, -15, 4, 6, -0.5, 0, TAU);
  g.fill();
}

// s: { sum: {a, b, op, scroll} | null, pending (a coin is on its way), score,
// cam, burning, steering, first (hints wanted) }
export function draw(ctx, s, t) {
  const dt = clamp(t - H.t, 0, 0.05);
  H.t = t;
  // the sum panel slides in with each new sum (following the game's slide)
  const slide = s.sum ? clamp((s.sum.scroll + 500) / 550, 0, 1) : 0;
  H.shown = s.sum ? slide : Math.max(0, H.shown - dt * 4);
  const ox = (1 - easeInOut(H.shown)) * -620;
  const pcx = PANEL.x + PANEL.w / 2 + ox;
  const pcy = PANEL.y + PANEL.h / 2;
  put(
    ctx,
    pic('panel:' + PANEL.w, PANEL.w + 24, PANEL.h + 30, g =>
      paintPanel(g, PANEL.w, PANEL.h, 30)
    ),
    PANEL.w + 24,
    PANEL.h + 30,
    pcx,
    pcy + 4
  );
  if (s.sum) {
    const text = `${s.sum.a} ${s.sum.op} ${s.sum.b} =`;
    const tw = SLOT.x - 18 - (PANEL.x + 26);
    const p = pic('sum:' + text, tw, 110, g => {
      let size = 86;
      g.font = `${size}px ${FONT}`;
      const w = g.measureText(text).width;
      if (w > tw - 6) size = Math.floor((size * (tw - 6)) / w);
      style.text(g, text, tw / 2 - 3, size * 0.36, size, {
        align: 'right',
        fill: OUT,
      });
    });
    put(ctx, p, tw, 110, PANEL.x + 26 + tw / 2 + ox, pcy);
  }
  // the answer slot: waiting, or flashing green or red with the result
  const fl = H.flash >= 0 ? clamp(1 - (t - H.flash) / 0.9, 0, 1) : 0;
  const scx = SLOT_CENTRE[0] + ox;
  const scy = SLOT_CENTRE[1];
  if (fl > 0) {
    const wob = H.flashGood ? 0 : Math.sin((t - H.flash) * 30) * 8 * fl;
    const good = H.flashGood;
    put(
      ctx,
      pic('slot:' + (good ? 'good' : 'bad'), SLOT.w + 20, SLOT.h + 20, g => {
        g.beginPath();
        rrect(g, -SLOT.w / 2, -SLOT.h / 2, SLOT.w, SLOT.h, 24);
        g.fillStyle = good ? '#C8FFD0' : '#FFE0D6';
        g.fill();
        g.lineWidth = 6;
        g.strokeStyle = good ? '#2FB45A' : '#FF6B4A';
        g.stroke();
      }),
      SLOT.w + 20,
      SLOT.h + 20,
      scx + wob,
      scy
    );
    style.glow(ctx, scx, scy, 150, good ? '#8CFF9A' : '#FF9A7A', fl * 0.8);
    put(
      ctx,
      pic('badge:' + (good ? 'good' : 'bad'), 44, 44, g => {
        g.beginPath();
        g.arc(0, 0, 17, 0, TAU);
        g.fillStyle = good ? '#2FB45A' : '#FF6B4A';
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = OUT;
        g.stroke();
        g.beginPath();
        if (good) {
          g.moveTo(-8, 0);
          g.lineTo(-2, 7);
          g.lineTo(9, -6);
        } else {
          g.moveTo(-6, -6);
          g.lineTo(6, 6);
          g.moveTo(6, -6);
          g.lineTo(-6, 6);
        }
        g.lineWidth = 4.5;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = '#FFFFFF';
        g.stroke();
      }),
      44,
      44,
      SLOT.x + SLOT.w - 8 + ox + wob,
      SLOT.y + 10,
      0.8 + 0.2 * fl
    );
  } else {
    const phase = Math.floor(t * 7) % 8;
    const pending = !!s.pending;
    put(
      ctx,
      pic(`slot:${pending}:${phase}`, SLOT.w + 20, SLOT.h + 20, g =>
        paintSlot(g, pending, phase)
      ),
      SLOT.w + 20,
      SLOT.h + 20,
      scx,
      scy
    );
  }

  // the journey: coloured zones, the part still to fly faded, the balloon
  const J = JOURNEY;
  const at = clamp((s.cam + 960) / (WIN_OFFSET + 960), 0, 1);
  const jcx = J.x + J.w / 2;
  const jcy = J.y + J.h / 2;
  const jw = J.w + 20;
  const jh = J.h + 26;
  put(
    ctx,
    pic('journey', jw, jh, g => paintJourney(g, false)),
    jw,
    jh,
    jcx,
    jcy + 3
  );
  const fade = pic('journeyFade', jw, jh, g => paintJourney(g, true));
  const px = style.px;
  const from = 10 + at * J.w;
  if (from < jw - 10)
    ctx.drawImage(
      fade,
      from * px,
      0,
      (jw - from) * px,
      jh * px,
      J.x - 10 + from,
      jcy - jh / 2 + 3,
      jw - from,
      jh
    );
  put(ctx, pic('flag', 40, 60, paintFlag), 40, 60, J.x + J.w + 16, J.y + 6);
  put(
    ctx,
    pic('marker', 46, 60, paintMarker),
    46,
    60,
    J.x + at * J.w,
    jcy - 16 + Math.sin(t * 2.4) * 3
  );

  // the score, with a bump when it goes up
  if (s.score !== H.score) {
    if (s.score > H.score) H.bump = t;
    H.score = s.score;
  }
  put(
    ctx,
    pic('scorePanel', SCORE.w + 24, SCORE.h + 30, g => {
      paintPanel(g, SCORE.w, SCORE.h, 30);
      g.save();
      g.translate(-SCORE.w / 2 + 68, -4);
      paintCoinIcon(g, 38);
      g.restore();
    }),
    SCORE.w + 24,
    SCORE.h + 30,
    SCORE.x + SCORE.w / 2,
    SCORE.y + SCORE.h / 2 + 4
  );
  const bu = H.bump >= 0 ? clamp((t - H.bump) / 0.45, 0, 1) : 1;
  const num = String(H.score);
  put(
    ctx,
    pic('score:' + num, 200, 110, g =>
      style.text(g, num, 0, 31, 86, { align: 'center', fill: OUT })
    ),
    200,
    110,
    SCORE.x + 190,
    SCORE.y + 62,
    1 + 0.3 * Math.sin(bu * Math.PI)
  );

  // "+1" flying from the slot to the score
  if (H.plus >= 0 && t - H.plus < 0.9) {
    const k = (t - H.plus) / 0.9;
    const u = easeInOut(k);
    const x = lerp(SLOT_CENTRE[0] + 40, SCORE.x + 190, u);
    const y = lerp(SLOT_CENTRE[1] - 20, 70, u) - Math.sin(u * Math.PI) * 90;
    ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
    put(
      ctx,
      pic('plus', 120, 90, g =>
        style.text(g, '+1', 0, 23, 64, {
          align: 'center',
          fill: '#FFE14A',
          outline: 12,
        })
      ),
      120,
      90,
      x,
      y,
      k < 0.2 ? easeOutBack(k / 0.2) : 1
    );
    ctx.globalAlpha = 1;
  }
  // praise under the panel, and a cheer for a run of right answers
  if (H.praise >= 0 && t - H.praise < 1.4) {
    const k = (t - H.praise) / 1.4;
    ctx.save();
    ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.translate(300, 207 - k * 24);
    ctx.rotate(-0.07);
    put(
      ctx,
      pic('praise:' + H.praiseWord, 420, 110, g =>
        style.text(g, H.praiseWord, 0, 25, 70, {
          align: 'center',
          fill: '#FFFFFF',
          outline: 13,
          shadow: true,
        })
      ),
      420,
      110,
      0,
      0,
      k < 0.18 ? easeOutBack(k / 0.18) : 1
    );
    ctx.restore();
  }
  if (H.streakAt >= 0 && t - H.streakAt < 1.8) {
    const k = (t - H.streakAt) / 1.8;
    ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    const text = `${H.streak} in a row!`;
    put(
      ctx,
      pic('streak:' + text, 420, 90, g =>
        paintPill(g, text, 44, '#FF4F5E', '#FFFFFF')
      ),
      420,
      90,
      300,
      300,
      k < 0.15 ? easeOutBack(k / 0.15) : 1
    );
    ctx.globalAlpha = 1;
  }
  // after a wrong answer, show the right one kindly
  if (H.oops >= 0 && t - H.oops < 2.6) {
    const k = (t - H.oops) / 2.6;
    ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
    const text = H.oopsText;
    put(
      ctx,
      pic('oops:' + text, 560, 90, g => {
        g.font = `44px ${FONT}`;
        const w = g.measureText('Oops! ' + text).width + 70;
        g.beginPath();
        rrect(g, -w / 2, -31, w, 62, 31);
        g.fillStyle = '#FFFFFF';
        g.fill();
        g.lineWidth = 6;
        g.strokeStyle = OUT;
        g.stroke();
        const ow = g.measureText('Oops! ').width;
        style.text(g, 'Oops!', -w / 2 + 35, 15, 44, { fill: '#FF6B4A' });
        style.text(g, text, -w / 2 + 35 + ow, 15, 44, { fill: '#2FB45A' });
      }),
      560,
      90,
      307,
      205,
      k < 0.1 ? easeOutBack(k / 0.1) : 1
    );
    ctx.globalAlpha = 1;
  }

  // the zone we are flying into
  const zone = level.ready ? zoneAt(s.cam + 960) : null;
  if (zone && zone !== H.zone) {
    H.zone = zone;
    H.zoneAt = t;
  }
  if (H.zone && t - H.zoneAt < 2.8) {
    const k = (t - H.zoneAt) / 2.8;
    const drop =
      k < 0.15
        ? easeOutBack(k / 0.15)
        : k > 0.85
        ? 1 - easeInOut((k - 0.85) / 0.15)
        : 1;
    const z = H.zone;
    ctx.globalAlpha = clamp(drop * 1.5, 0, 1);
    put(
      ctx,
      pic('zone:' + z.name, 640, 100, g =>
        paintPill(
          g,
          z.name,
          50,
          ZONE_COLOURS[z.kind] || '#8EDB4E',
          '#FFFFFF',
          10
        )
      ),
      640,
      100,
      970,
      110 + drop * 70
    );
    ctx.globalAlpha = 1;
  }

  // first-flight hints, one at a time until each has been done
  if (s.first) {
    if (s.burning) H.hints.space += dt;
    if (s.steering) H.hints.steer = true;
    let hint = null;
    if (H.hints.space < 0.6)
      hint = s.touch ? 'Hold UP to go up' : 'Hold SPACE to go up';
    else if (!H.hints.steer)
      hint = s.touch ? 'Use the arrows to steer' : 'Use ← → to steer';
    else if (!H.hints.coin && s.sum) hint = 'Fly into the right answer!';
    if (hint)
      put(
        ctx,
        pic('hint:' + hint, 760, 110, g =>
          paintPill(g, hint, 48, 'rgba(255,255,255,0.95)', OUT)
        ),
        760,
        110,
        960,
        990 + Math.sin(t * 3) * 5
      );
  }
}

// how the game should scale a coin flying into the slot (1 far away, smaller
// as it arrives so it fits)
export function slotScale(cx, cy) {
  const d = Math.hypot(cx - SLOT_CENTRE[0], cy - SLOT_CENTRE[1]);
  return lerp(0.68, 1, clamp(d / 300, 0, 1));
}
