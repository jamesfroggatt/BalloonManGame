// "Toybox Pop!" - the game's art style.
// Rules: one navy outline on everything in play (thinner, tinted outlines on
// the background), top-lit gradients, a glossy highlight on hard materials,
// candy colours and bouncy lettering in Lilita One.
import { TAU, rgba } from './util.js';
import { glow as addGlow, SpriteStore } from './cache.js';
import { starPath } from './shapes.js';

export const OUT = '#1B2A4A';
export const FONT = '"Lilita One", "Fredoka", "Trebuchet MS", sans-serif';
export const FONT_SMALL = '"Fredoka", "Lilita One", "Trebuchet MS", sans-serif';

// every material: gradient top/bottom, outline width (lw), outline colour
// (line), gloss highlight
export const MATS = {
  _: { top: '#FF00FF', bot: '#AA00AA' },
  // ground
  grass: { top: '#93DE50', bot: '#4AA33A', lw: 5 },
  snow: { top: '#FFFFFF', bot: '#CFE3F7', lw: 5 },
  sand: { top: '#FFDD80', bot: '#F2B25A', lw: 5 },
  rock: { top: '#C6D0DB', bot: '#8492A3', lw: 5, gloss: 1 },
  seabed: { top: '#E7B868', bot: '#C68E46', lw: 0 },
  seaweed: { top: '#46BE6E', bot: '#2A8A52', lw: 0 },
  // background layers (softer, tinted outlines)
  far: { top: '#AFD8F6', bot: '#93C6EE', lw: 0 },
  farSnow: { top: '#FFFFFF', bot: '#E6F0FB', lw: 0 },
  midSea: { top: '#62C6F4', bot: '#45AAE8', lw: 0 },
  mid: { top: '#A6E083', bot: '#7CC76A', lw: 2.2, line: '#5E9F63' },
  midSnow: { top: '#E6F0FB', bot: '#C6D9EF', lw: 2.2, line: '#8FA8C8' },
  midSand: { top: '#FFE7A6', bot: '#F2C77A', lw: 2.2, line: '#C8A060' },
  near: { top: '#74D05C', bot: '#49A747', lw: 3, line: '#3A7F45' },
  nearSnow: { top: '#F5F9FF', bot: '#D0E0F2', lw: 3, line: '#7E9CC2' },
  nearSand: { top: '#FFDF8E', bot: '#EFBF6E', lw: 3, line: '#B98E4E' },
  bush: { top: '#63C353', bot: '#3F9B40', lw: 2.4, line: '#2F6B3A' },
  poplar: { top: '#6FC75C', bot: '#4DA347', lw: 2, line: '#4F8F5A' },
  pine: { top: '#43AA6E', bot: '#2A8656', lw: 2.4, line: '#24583F' },
  pineSnow: { top: '#FFFFFF', bot: '#DDEBFA', lw: 0 },
  pineTrunk: { top: '#8A5A3A', bot: '#6E4429', lw: 0 },
  farPalm: { top: '#5ABB68', bot: '#3F9A52', lw: 0 },
  barn: { top: '#F0624A', bot: '#D8483A', lw: 2, line: '#7A3A3A' },
  house: { top: '#FFF3D6', bot: '#F0DDB5', lw: 2, line: '#7A6A5A' },
  roof: { top: '#D0454C', bot: '#AA343C', lw: 2, line: '#6A2A30' },
  roof2: { top: '#5A6F9E', bot: '#4A5C88', lw: 2, line: '#34405F' },
  windmill: { top: '#FFFFFF', bot: '#E6ECF5', lw: 2, line: '#7A8AA8' },
  millSail: { top: '#FFF6E6', bot: '#F0E0C8', lw: 1.5, line: '#7A8AA8' },
  sheep: { top: '#FFFFFF', bot: '#EEF0F4', lw: 1.5, line: '#8A94A8' },
  sheepFace: { top: '#3A3F4F', bot: '#2A2F3F', lw: 0 },
  lighthouse: { top: '#FFFFFF', bot: '#E8EEF6', lw: 2, line: '#6A7A98' },
  lhStripe: { top: '#FF5A5A', bot: '#E0484A', lw: 0 },
  lamp: { top: '#FFE58A', bot: '#FFC94A', lw: 1.5, line: '#6A7A98' },
  boat: { top: '#E0564A', bot: '#C0443A', lw: 1.5, line: '#6A3A3A' },
  boatSail: { top: '#FFFFFF', bot: '#EAF0F8', lw: 1.5, line: '#7A8AA8' },
  cabin: { top: '#B7784A', bot: '#8E5634', lw: 2, line: '#5A3A28' },
  flagCloth: { top: '#FF4F7A', bot: '#E23A62', lw: 1.5, line: '#7A2A40' },
  // things in play
  turbine: { top: '#FFFFFF', bot: '#D6E2F0', lw: 4 },
  turbineShade: { top: '#EEF3FA', bot: '#C8D4E4', lw: 4 },
  tip: { top: '#FF6B6B', bot: '#F04E5E', lw: 0 },
  hub: { top: '#5AA8FF', bot: '#2F7BE0', lw: 4, gloss: 1 },
  castle: { top: '#FFD98A', bot: '#E9B25A', lw: 4 },
  flag: { top: '#FF4F7A', bot: '#E23A62', lw: 3 },
  bucket: { top: '#48C8F6', bot: '#1E93D6', lw: 4, gloss: 1 },
  spade: { top: '#FF8A3D', bot: '#E86A1E', lw: 3.5 },
  trunk: { top: '#D08E4C', bot: '#A56834', lw: 5 },
  leaf: { top: '#5CD663', bot: '#2FA044', lw: 4 },
  leaf2: { top: '#3FAF52', bot: '#27853A', lw: 4 },
  leafShade: { top: '#309A45', bot: '#1C6A30', lw: 4 },
  coconut: { top: '#8A5A36', bot: '#6A4024', lw: 3.5, gloss: 1 },
  shell: { top: '#FFE5EA', bot: '#FFB5C4', lw: 3 },
  starfish: { top: '#FF8E5E', bot: '#F2643A', lw: 3.5 },
  crab: { top: '#FF6C5C', bot: '#E0443A', lw: 3.5 },
  snowman: { top: '#FFFFFF', bot: '#DCE8F6', lw: 3.5 },
  carrot: { top: '#FF9A3D', bot: '#F07A1E', lw: 2 },
  ball: { top: '#51576F', bot: '#1E2233', lw: 4, gloss: 1 },
  wood: { top: '#E8573F', bot: '#B63A2E', lw: 4.5 },
  raft: { top: '#D9A15E', bot: '#A87438', lw: 4 },
  wheel: { top: '#E8573F', bot: '#B63A2E', lw: 4.5 },
  wheelHub: { top: '#FFD24A', bot: '#F0A91E', lw: 3.5 },
  iron: { top: '#4E5570', bot: '#20243A', lw: 5, gloss: 1 },
  brass: { top: '#FFD24A', bot: '#E8A21E', lw: 3 },
  stone: { top: '#ABA69E', bot: '#7C766D', lw: 5 },
  stoneShade: { top: 'rgba(50,40,30,0.18)', bot: 'rgba(50,40,30,0.3)', lw: 0 },
  stoneDark: { top: '#5E5850', bot: '#4A443C', lw: 0 },
  moss: { top: '#7FCF4B', bot: '#5BAA36', lw: 0 },
  mouth: { top: '#3A2A2A', bot: '#241818', lw: 3 },
  eyeLit: { top: '#FFF6C8', bot: '#FFD54A', lw: 0 },
  shark: { top: '#86A8CE', bot: '#5A7FA8', lw: 5 },
  sharkUnder: { top: 'rgba(16,52,96,0.38)', bot: 'rgba(16,52,96,0.22)', lw: 0 },
  belly: { top: '#F4FAFF', bot: '#DCEAF8', lw: 0 },
  eyeWhite: { top: '#FFFFFF', bot: '#F0F4FA', lw: 2.5 },
  pupil: { top: OUT, bot: OUT, lw: 0 },
  laserEye: { top: '#FFE3EC', bot: '#FF3D7F', lw: 0 },
  fish: { top: '#FFBC4A', bot: '#FF8A2A', lw: 3 },
  ghost: { top: '#FFFFFF', bot: '#E2D8FF', lw: 5 },
  // the balloon: the same red / yellow / green / blue stripes as the original
  g0: { top: '#FF6070', bot: '#E23A4E', lw: 0 },
  g1: { top: '#FFE14A', bot: '#F5B91E', lw: 0 },
  g2: { top: '#4FDC7A', bot: '#23B25A', lw: 0 },
  g3: { top: '#4A92FF', bot: '#2A6AE0', lw: 0 },
  g4: { top: '#FF6070', bot: '#E23A4E', lw: 0 },
  g5: { top: '#FFE14A', bot: '#F5B91E', lw: 0 },
  g6: { top: '#4FDC7A', bot: '#23B25A', lw: 0 },
  g7: { top: '#4A92FF', bot: '#2A6AE0', lw: 0 },
  skirt: { top: '#FFD24A', bot: '#E8A21E', lw: 3.5 },
  burner: { top: '#D2DAE6', bot: '#8A96AA', lw: 3 },
  basket: { top: '#E6A45C', bot: '#B8783A', lw: 4 },
  basketRim: { top: '#C98A48', bot: '#9E6A34', lw: 3.5 },
  skin: { top: '#FFD9BA', bot: '#F2BC94', lw: 2.4 },
  cap: { top: '#8C5C3A', bot: '#6A4228', lw: 2.4 },
  goggle: { top: '#A4EBFF', bot: '#44B6E8', lw: 2.2 },
  scarf: { top: '#FF5060', bot: '#E23A48', lw: 2.4 },
  pennant: { top: '#FFD23F', bot: '#F0A91E', lw: 2.4 },
  sandbag: { top: '#DCCBA2', bot: '#B8A478', lw: 2.4 },
  parachute: { top: '#FF6070', bot: '#E23A4E', lw: 3 },
  // flowers and bugs
  petal_daisy: { top: '#FFFFFF', bot: '#F2F2F2', lw: 1.6 },
  petal_poppy: { top: '#FF5A5A', bot: '#E23A3A', lw: 1.6 },
  petal_blue: { top: '#6AA8FF', bot: '#3A86FF', lw: 1.6 },
  petal_yellow: { top: '#FFE14A', bot: '#FFC21E', lw: 1.6 },
  flowerC: { top: '#FFC21E', bot: '#F09A1E', lw: 0 },
  puff: { top: 'rgba(255,255,255,0.96)', bot: 'rgba(236,242,255,0.92)', lw: 0 },
  wing0: { top: '#FF8AD8', bot: '#E85CB8', lw: 1.6 },
  wing1: { top: '#FFD23F', bot: '#F0A91E', lw: 1.6 },
  wing2: { top: '#7ADFFF', bot: '#3AB6F0', lw: 1.6 },
  fgStone: { top: '#8C98A8', bot: '#5E6A7A', lw: 4, gloss: 1 },
  kite: { top: '#FF6FB5', bot: '#E2489A', lw: 2 },
  pebble: { top: '#C3CCD8', bot: '#8E9AAB', lw: 3 },
  bushSand: { top: '#8CCB5A', bot: '#5EA544', lw: 2.4, line: '#4A7A3A' },
  castleDoor: { top: '#C98A48', bot: '#A56834', lw: 0 },
  // the finish arch
  pole: { top: '#FFFFFF', bot: '#DCE6F2', lw: 4 },
  poleStripe: { top: '#FF4F5E', bot: '#E23A4E', lw: 0 },
  banner: { top: '#FF5A6E', bot: '#E23A55', lw: 5, gloss: 1 },
  bunY: { top: '#FFE14A', bot: '#F5B91E', lw: 3 },
  bunG: { top: '#4FDC7A', bot: '#23B25A', lw: 3 },
  bunB: { top: '#4A92FF', bot: '#2A6AE0', lw: 3 },
  flagWhite: { top: '#FFFFFF', bot: '#E8EEF6', lw: 3 },
  flagBlack: { top: '#2A3350', bot: '#1B2A4A', lw: 0 },
};

// colours for thin strokes (ropes, stems, cracks...)
export const INKS = {
  rope: OUT,
  stem: '#3E8E3A',
  puffLine: 'rgba(190,205,230,0.9)',
  dune: '#B39A3E',
  shellLine: '#E07B95',
  crabLeg: '#B8322A',
  trunkLine: '#7A4A22',
  midrib: '#2A7A3A',
  gill: '#3E5F88',
  crack: '#5A544C',
  wick: '#3A2A1A',
  basketLine: '#8A5424',
  sleeve: '#3A86FF',
  fgGrass: '#2E7433',
  kiteString: 'rgba(40,50,80,0.6)',
  ink: OUT,
};

export const BLADES = ['#5BBE36', '#8EDB4E', '#43A22F'];
export const SNOW_BLADES = ['#E8F2FF', '#FFFFFF', '#C9DCF2'];

// the style object: holds the output scale and the sprite store
export const style = {
  px: 1,
  sprites: new SpriteStore(),
  caching: false,

  setScale(px) {
    this.px = px;
    this.sprites.setScale(px);
  },

  // fill a path with a material: navy outline, top-lit gradient, gloss
  paint(ctx, fn, key, bb, o = {}) {
    const m = MATS[key] || MATS._;
    const lw = o.noLine ? 0 : (m.lw != null ? m.lw : 4) * (o.small ? 0.72 : 1);
    ctx.beginPath();
    fn(ctx);
    if (lw > 0) {
      ctx.lineWidth = lw * 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = m.line || OUT;
      ctx.stroke();
    }
    let fill = m.top;
    if (m.bot && m.bot !== m.top && bb[3] > bb[1]) {
      const g =
        o.horiz && bb[2] > bb[0]
          ? ctx.createLinearGradient(bb[0], 0, bb[2], 0)
          : ctx.createLinearGradient(0, bb[1], 0, bb[3]);
      g.addColorStop(0, m.top);
      g.addColorStop(1, m.bot);
      fill = g;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    const w = bb[2] - bb[0];
    const h = bb[3] - bb[1];
    if (
      (o.gloss || m.gloss) &&
      !o.noGloss &&
      w > 12 &&
      h > 12 &&
      (this.caching || w * h > 900)
    ) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(
        bb[0] + w * 0.33,
        bb[1] + h * 0.27,
        Math.max(2, w * 0.2),
        Math.max(1.5, h * 0.12),
        -0.55,
        0,
        TAU
      );
      ctx.fill();
      ctx.restore();
    }
  },

  stroke(ctx, fn, role, w) {
    ctx.beginPath();
    fn(ctx);
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INKS[role] || OUT;
    ctx.stroke();
  },

  glow(ctx, x, y, r, color, a = 1) {
    addGlow(ctx, x, y, r, color, a);
  },

  // chunky lettering: optional navy outline and a soft drop shadow
  text(ctx, s, x, y, size, o = {}) {
    ctx.font = `${Math.round(size)}px ${o.small ? FONT_SMALL : FONT}`;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.lineJoin = 'round';
    if (o.shadow) {
      ctx.fillStyle = 'rgba(27,42,74,0.3)';
      ctx.fillText(s, x, y + size * 0.07);
    }
    if (o.outline) {
      ctx.lineWidth = o.outline;
      ctx.strokeStyle = o.line || OUT;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = o.fill || OUT;
    ctx.fillText(s, x, y);
  },

  // draw a pre-rendered particle look (fast: the GPU batches these)
  spr(ctx, key, x, y, r, a = 1, rot = 0, sy = 1) {
    if (a <= 0.004 || r <= 0.2) return;
    const cv = this.sprites.get('p:' + key, 64, 64, g =>
      drawParticleSprite(g, key, 30)
    );
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, a) * prev;
    if (rot || sy !== 1) {
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (sy !== 1) ctx.scale(1, sy);
      ctx.drawImage(cv, -r, -r, 2 * r, 2 * r);
      ctx.restore();
    } else ctx.drawImage(cv, x - r, y - r, 2 * r, 2 * r);
    ctx.globalAlpha = prev;
  },
};

// the look of each particle kind, painted once into a small sprite
export function drawParticleSprite(g, key, R) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (key === 'smoke' || key === 'dust' || key === 'snowPuff') {
    g.beginPath();
    g.arc(0, 0, R - 3, 0, TAU);
    g.lineWidth = 5;
    g.strokeStyle = key === 'dust' ? '#B89A6A' : '#9FB3CF';
    g.stroke();
    g.fillStyle = key === 'dust' ? '#F2DDB0' : '#FFFFFF';
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(-R * 0.3, -R * 0.35, R * 0.22, R * 0.13, -0.5, 0, TAU);
    g.fill();
  } else if (key.startsWith('spark')) {
    g.fillStyle = ['#FFFFFF', '#FFE14A', '#FF8A2A'][+key[5]];
    g.beginPath();
    starPath(g, 0, 0, R, 0, 4, 0.35);
    g.fill();
  } else if (key === 'twinkle') {
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    starPath(g, 0, 0, R, 0, 4, 0.28);
    g.fill();
    g.fillStyle = 'rgba(255,214,64,0.95)';
    g.beginPath();
    starPath(g, 0, 0, R * 0.46, 0, 4, 0.3);
    g.fill();
  } else if (key === 'star') {
    g.beginPath();
    starPath(g, 0, 0, R - 3, 0, 5, 0.45);
    g.lineWidth = 5;
    g.strokeStyle = OUT;
    g.stroke();
    g.fillStyle = '#FFD23F';
    g.fill();
  } else if (key.startsWith('conf')) {
    g.fillStyle = [
      '#FF4F5E',
      '#FFD23F',
      '#3BCE6B',
      '#3A86FF',
      '#FF7AD0',
      '#FF9F1C',
    ][+key[4]];
    g.fillRect(-R, -R * 0.66, 2 * R, R * 1.32);
  } else if (key === 'mist') {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, 'rgba(201,178,255,0.55)');
    gr.addColorStop(1, 'rgba(201,178,255,0)');
    g.fillStyle = gr;
    g.fillRect(-R, -R, 2 * R, 2 * R);
  } else if (key === 'frost' || key === 'snowflake') {
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    starPath(g, 0, 0, R, 0, 6, 0.4);
    g.fill();
  } else if (key === 'drop') {
    g.beginPath();
    g.arc(0, 0, R - 3, 0, TAU);
    g.lineWidth = 5;
    g.strokeStyle = OUT;
    g.stroke();
    g.fillStyle = '#8FE6FF';
    g.fill();
  } else if (key === 'foam') {
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fillStyle = '#FFFFFF';
    g.fill();
  } else if (key === 'ring') {
    g.beginPath();
    g.arc(0, 0, R - 2, 0, TAU);
    g.lineWidth = 3;
    g.strokeStyle = '#FFFFFF';
    g.stroke();
  } else if (key === 'bubble') {
    g.beginPath();
    g.arc(0, 0, R - 3, 0, TAU);
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.stroke();
  } else if (key === 'seed') {
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.35;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    g.moveTo(0, 0);
    g.lineTo(0, R * 0.8);
    g.stroke();
  } else if (key === 'leaf') {
    g.beginPath();
    g.ellipse(0, 0, R - 3, (R - 3) * 0.5, 0, 0, TAU);
    g.fillStyle = '#6ACB44';
    g.lineWidth = 5;
    g.strokeStyle = OUT;
    g.stroke();
    g.fill();
  } else if (key.startsWith('scrap')) {
    // a torn scrap of balloon fabric in one of the balloon's colours
    g.beginPath();
    g.moveTo(-R + 3, -R * 0.45);
    g.lineTo(R * 0.55, -R + 3);
    g.lineTo(R - 3, R * 0.3);
    g.lineTo(-R * 0.2, R - 3);
    g.closePath();
    g.lineWidth = 5;
    g.strokeStyle = OUT;
    g.stroke();
    g.fillStyle = ['#FF6070', '#FFE14A', '#4FDC7A', '#4A92FF'][+key[5] || 0];
    g.fill();
  }
}

export { rgba };
