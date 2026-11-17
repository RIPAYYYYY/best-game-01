// Everything Gloamgarden looks like. One canvas, drawn fresh each frame from the world
// state: the night garden, its keeper and her orbiting embers, the glooms, the motes,
// the sparks — and the screens that frame a run (title, blessing choice, the light
// fading, dawn). No images anywhere; every shape is a path, a gradient or a glyph.

import { BOSS_TIME, COLORS, DAWN_TIME, FIELD } from './config.js';
import { KIND_BRUTE, KIND_MAW, KIND_SKITTER } from './world.js';
import { levelOf } from './upgrades.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';
export const SCREEN_DAWN = 'dawn';

const TITLE_FONT = 'Georgia, "Times New Roman", serif';
const BODY_FONT = 'system-ui, "Segoe UI", sans-serif';

/** The Begin button on the title screen, in field coordinates. */
export function beginButtonRect() {
  return { x: FIELD.width / 2 - 118, y: 398, w: 236, h: 54 };
}

/** The play-again button on the end screens, in field coordinates. */
export function againButtonRect() {
  return { x: FIELD.width / 2 - 118, y: 436, w: 236, h: 54 };
}

/** The three blessing cards on the level-up screen, in field coordinates. */
export function upgradeCardRects() {
  const rects = [];
  const width = 264;
  const gap = 24;
  const x0 = (FIELD.width - (width * 3 + gap * 2)) / 2;
  for (let index = 0; index < 3; index += 1) {
    rects.push({ x: x0 + index * (width + gap), y: 178, w: width, h: 224 });
  }
  return rects;
}

export function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatScore(value) {
  return String(Math.floor(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Wrap text to a width, returning the lines. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(trial).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/**
 * Draw the whole frame. `view` carries the world, which screen is up, the animation
 * clock `t` (seconds; staged screenshots pass a fixed one), the best score, whether
 * sound is muted, whether play is paused, and which blessing card the pointer hovers.
 */
export function drawGame(ctx, view) {
  const { world, screen, t } = view;
  const state = world.state;
  ctx.save();
  drawGarden(ctx, state, t);
  const shakeX = state.shake > 0 ? Math.sin(t * 51) * state.shake * 0.55 : 0;
  const shakeY = state.shake > 0 ? Math.cos(t * 43) * state.shake * 0.55 : 0;
  ctx.translate(shakeX, shakeY);
  drawMotes(ctx, state, t);
  drawEnemies(ctx, world, t);
  drawKeeper(ctx, world, t);
  drawParticles(ctx, state);
  drawFloaters(ctx, state);
  ctx.restore();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 45, 80, ${state.flash * 0.22})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  if (screen === SCREEN_PLAY || screen === SCREEN_LEVELUP) drawHud(ctx, view);
  if (screen === SCREEN_TITLE) drawTitle(ctx, view);
  if (screen === SCREEN_LEVELUP) drawLevelUp(ctx, view);
  if (screen === SCREEN_OVER) drawGameOver(ctx, view);
  if (screen === SCREEN_DAWN) drawDawn(ctx, view);
  if (view.paused && screen === SCREEN_PLAY) drawPaused(ctx);
}

/** The ground of the garden: night gradient, soft patches, flowers, bushes and stones. */
function drawGarden(ctx, state, t) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, COLORS.nightTop);
  gradient.addColorStop(1, COLORS.nightBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  const glow = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 60, FIELD.width / 2, FIELD.height / 2, 430);
  glow.addColorStop(0, 'rgba(64, 78, 160, 0.30)');
  glow.addColorStop(1, 'rgba(64, 78, 160, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  for (const item of state.decor) {
    if (item.kind === 'patch') {
      ctx.fillStyle = item.tint === 0 ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 10, 0.10)';
      ctx.beginPath();
      ctx.ellipse(item.x, item.y, 74 * item.scale, 40 * item.scale, item.phase, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const item of state.decor) {
    if (item.kind === 'patch') continue;
    drawDecorItem(ctx, item, t);
  }
  // Fireflies: a dozen slow sparks that belong to no one.
  ctx.fillStyle = COLORS.amberLight;
  for (let index = 0; index < 12; index += 1) {
    const x = (index * 167 + 60 + Math.sin(t * 0.31 + index * 1.7) * 34 + FIELD.width) % FIELD.width;
    const y = (index * 89 + 50 + Math.cos(t * 0.23 + index * 2.3) * 26 + FIELD.height) % FIELD.height;
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 1.4 + index);
    ctx.beginPath();
    ctx.arc(x, y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDecorItem(ctx, item, t) {
  const sway = Math.sin(t * 0.9 + item.phase) * 0.03;
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(sway);
  ctx.scale(item.scale, item.scale);
  if (item.kind === 'bush') {
    ctx.fillStyle = '#123332';
    for (const [dx, dy, r] of [[-11, 2, 12], [0, -5, 15], [12, 2, 11]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1b4a44';
    ctx.beginPath();
    ctx.arc(-3, -7, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.kind === 'flower') {
    const petal = ['#c084fc', '#f0a6c0', '#93c5fd'][item.tint];
    ctx.fillStyle = petal;
    for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
      const angle = (petalIndex * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 4.4, Math.sin(angle) * 4.4, 3.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.amberLight;
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.kind === 'grass') {
    ctx.strokeStyle = '#1d5c50';
    ctx.lineWidth = 2;
    for (const lean of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(lean * 0.5, 5);
      ctx.quadraticCurveTo(lean, -3, lean * 1.5, -9);
      ctx.stroke();
    }
  } else if (item.kind === 'stone') {
    ctx.fillStyle = '#39406e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 6.5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a528a';
    ctx.beginPath();
    ctx.ellipse(-2, -2, 5.5, 3.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Fallen light, waiting to be gathered. Bigger motes are worth two. */
function drawMotes(ctx, state, t) {
  for (const mote of state.motes) {
    const pulse = 1 + 0.22 * Math.sin(t * 5 + mote.phase);
    const core = (mote.value > 1 ? 4 : 3) * pulse;
    const glow = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, core * 3.4);
    glow.addColorStop(0, 'rgba(123, 241, 211, 0.55)');
    glow.addColorStop(1, 'rgba(123, 241, 211, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, core * 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.moteCore;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, core * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
}

const GLOOM_PAINT = {
  shade: { body: COLORS.gloomBody, rim: COLORS.gloomRim, eye: COLORS.eyePink },
  skitter: { body: COLORS.skitterBody, rim: '#c084fc', eye: COLORS.eyePink },
  brute: { body: COLORS.bruteBody, rim: '#a78bfa', eye: COLORS.eyeRed },
  maw: { body: COLORS.mawBody, rim: COLORS.eyeRed, eye: COLORS.amberLight },
};

/** The glooms: wobbling shadow bodies with eyes fixed on the keeper. */
function drawEnemies(ctx, world, t) {
  const state = world.state;
  const player = state.player;
  for (const enemy of state.enemies) {
    const paint = GLOOM_PAINT[enemy.kind];
    ctx.fillStyle = 'rgba(2, 3, 10, 0.4)';
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y + enemy.radius * 0.82, enemy.radius * 0.9, enemy.radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    const wobble = 1 + 0.055 * Math.sin(t * 4 + enemy.phase);
    const radius = enemy.radius * wobble;
    if (enemy.kind === KIND_MAW) {
      const halo = ctx.createRadialGradient(enemy.x, enemy.y, radius * 0.4, enemy.x, enemy.y, radius * 1.9);
      halo.addColorStop(0, 'rgba(255, 56, 96, 0.16)');
      halo.addColorStop(1, 'rgba(255, 56, 96, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, radius * 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = paint.body;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = paint.rim;
    ctx.lineWidth = enemy.kind === KIND_BRUTE || enemy.kind === KIND_MAW ? 3 : 2;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (enemy.kind === KIND_BRUTE || enemy.kind === KIND_MAW) {
      ctx.fillStyle = paint.body;
      const spikes = enemy.kind === KIND_MAW ? 9 : 6;
      for (let index = 0; index < spikes; index += 1) {
        const angle = (index * Math.PI * 2) / spikes - Math.PI / 2;
        const base = radius * 0.92;
        const tip = radius * 1.22;
        ctx.beginPath();
        ctx.moveTo(enemy.x + Math.cos(angle - 0.16) * base, enemy.y + Math.sin(angle - 0.16) * base);
        ctx.lineTo(enemy.x + Math.cos(angle) * tip, enemy.y + Math.sin(angle) * tip);
        ctx.lineTo(enemy.x + Math.cos(angle + 0.16) * base, enemy.y + Math.sin(angle + 0.16) * base);
        ctx.closePath();
        ctx.fill();
      }
    }

    const look = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const eyeSpread = radius * 0.36;
    const eyeForward = radius * 0.3;
    const eyeX = enemy.x + Math.cos(look) * eyeForward;
    const eyeY = enemy.y + Math.sin(look) * eyeForward;
    const perpX = Math.cos(look + Math.PI / 2);
    const perpY = Math.sin(look + Math.PI / 2);
    ctx.fillStyle = paint.eye;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(eyeX + perpX * eyeSpread * side, eyeY + perpY * eyeSpread * side, Math.max(2, radius * 0.11), 0, Math.PI * 2);
      ctx.fill();
    }
    if (enemy.kind === KIND_MAW) {
      ctx.strokeStyle = COLORS.eyeRed;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, radius * 0.52, look - 0.7, look + 0.7);
      ctx.stroke();
    }
    if (enemy.hp < enemy.maxHp && enemy.kind !== KIND_MAW) {
      const width = enemy.radius * 1.7;
      ctx.fillStyle = 'rgba(6, 8, 22, 0.7)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 11, width, 4);
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 11, width * Math.max(0, enemy.hp / enemy.maxHp), 4);
    }
  }
}

/** The keeper: teal cloak, warm face, and the lantern that is the garden's whole hope. */
function drawKeeper(ctx, world, t) {
  const state = world.state;
  const player = state.player;

  const pool = ctx.createRadialGradient(player.x, player.y, 8, player.x, player.y, 118);
  pool.addColorStop(0, 'rgba(255, 179, 64, 0.20)');
  pool.addColorStop(1, 'rgba(255, 179, 64, 0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 118, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(2, 3, 10, 0.45)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 13, 13, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();

  const blinking = state.invuln > 0 && Math.floor(t * 18) % 2 === 0;
  ctx.save();
  if (blinking) ctx.globalAlpha = 0.4;
  const bob = Math.sin(t * 2.2) * 1.2;
  ctx.translate(player.x, player.y + bob);
  ctx.fillStyle = COLORS.keeperCloak;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.quadraticCurveTo(12, -4, 10, 12);
  ctx.quadraticCurveTo(0, 16, -10, 12);
  ctx.quadraticCurveTo(-12, -4, 0, -12);
  ctx.fill();
  ctx.fillStyle = COLORS.keeperCloakDark;
  ctx.beginPath();
  ctx.moveTo(-10, 9);
  ctx.quadraticCurveTo(0, 13, 10, 9);
  ctx.quadraticCurveTo(8, 14, 0, 15);
  ctx.quadraticCurveTo(-8, 14, -10, 9);
  ctx.fill();
  ctx.fillStyle = COLORS.keeperSkin;
  ctx.beginPath();
  ctx.arc(0, -9, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.keeperCloakDark;
  ctx.beginPath();
  ctx.arc(0, -10.5, 6.8, Math.PI * 1.02, Math.PI * 1.98);
  ctx.quadraticCurveTo(0, -15.5, -6.8, -10.5);
  ctx.fill();
  // The lantern, held out on the facing side.
  const handX = player.face * 13;
  ctx.strokeStyle = COLORS.keeperSkin;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(player.face * 6, 0);
  ctx.lineTo(handX, 3);
  ctx.stroke();
  ctx.fillStyle = '#5b4326';
  ctx.fillRect(handX - 3.4, 1, 6.8, 8.6);
  ctx.fillStyle = COLORS.amberLight;
  ctx.fillRect(handX - 1.9, 2.8, 3.8, 5);
  ctx.restore();

  // The ember wisps, each with a short comet trail behind it along the orbit.
  const points = world.wispPositions();
  points.forEach((point, index) => {
    const angle = state.wisps.angle + (index * Math.PI * 2) / state.wisps.count;
    for (let trail = 3; trail >= 1; trail -= 1) {
      const back = angle - trail * 0.16;
      const tx = player.x + Math.cos(back) * state.wisps.orbitRadius;
      const ty = player.y + Math.sin(back) * state.wisps.orbitRadius;
      ctx.fillStyle = `rgba(255, 150, 50, ${0.10 * (4 - trail)})`;
      ctx.beginPath();
      ctx.arc(tx, ty, 5.4 - trail, 0, Math.PI * 2);
      ctx.fill();
    }
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 17);
    glow.addColorStop(0, 'rgba(255, 190, 80, 0.75)');
    glow.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.amber;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.1, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawParticles(ctx, state) {
  for (const particle of state.particles) {
    const fade = Math.max(0, particle.life / particle.max);
    if (particle.kind === 'ring') {
      ctx.strokeStyle = particle.color;
      ctx.globalAlpha = fade * 0.85;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * fade + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, state) {
  ctx.textAlign = 'center';
  ctx.font = `bold 12px ${BODY_FONT}`;
  for (const floater of state.floaters) {
    ctx.globalAlpha = Math.min(1, floater.life * 1.6);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.globalAlpha = 1;
}

/** The frame of a run: heart, the road to dawn, the score, and the lantern's growth. */
function drawHud(ctx, view) {
  const state = view.world.state;
  const player = state.player;

  ctx.fillStyle = 'rgba(5, 7, 20, 0.52)';
  ctx.fillRect(0, 0, FIELD.width, 44);

  // Heart and its bar.
  ctx.font = `16px ${BODY_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.heart;
  ctx.fillText('♥', 14, 23);
  roundRect(ctx, 36, 16, 188, 13, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.fill();
  roundRect(ctx, 36, 16, 188 * Math.max(0, player.hp / player.maxHp), 13, 6);
  ctx.fillStyle = player.hp / player.maxHp < 0.3 ? COLORS.eyeRed : COLORS.hpBar;
  ctx.fill();
  ctx.font = `bold 11px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textWarm;
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 42, 23.5);

  if (state.nova.cooldown > 0) {
    ctx.font = `11px ${BODY_FONT}`;
    ctx.fillStyle = COLORS.textDim;
    const ready = state.nova.timer <= 0.05;
    ctx.fillText(ready ? '☀ nova ready' : `☀ nova ${state.nova.timer.toFixed(1)}s`, 36, 40);
  }

  // The road to dawn.
  ctx.textAlign = 'center';
  ctx.font = `bold 16px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textWarm;
  ctx.fillText(`☾ ${formatClock(state.time)}`, FIELD.width / 2, 17);
  roundRect(ctx, FIELD.width / 2 - 95, 30, 190, 5, 2.5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.fill();
  roundRect(ctx, FIELD.width / 2 - 95, 30, 190 * Math.min(1, state.time / DAWN_TIME), 5, 2.5);
  ctx.fillStyle = COLORS.amber;
  ctx.fill();
  ctx.font = `11px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('dawn', FIELD.width / 2 + 112, 33);

  // Score and tallies.
  ctx.textAlign = 'right';
  ctx.font = `bold 16px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textWarm;
  ctx.fillText(`SCORE ${formatScore(state.score)}`, FIELD.width - 16, 17);
  ctx.font = `11px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`✦ ${state.kills} burned   ✚ ${state.motesGot} motes`, FIELD.width - 16, 34);

  if (state.boss !== null) {
    const boss = state.boss;
    ctx.textAlign = 'center';
    ctx.font = `bold 11px ${BODY_FONT}`;
    ctx.fillStyle = '#ff8fab';
    ctx.fillText('T H E   G L O A M   M A W', FIELD.width / 2, 54);
    roundRect(ctx, FIELD.width / 2 - 210, 62, 420, 9, 4.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.fill();
    roundRect(ctx, FIELD.width / 2 - 210, 62, 420 * Math.max(0, boss.hp / boss.maxHp), 9, 4.5);
    ctx.fillStyle = COLORS.eyeRed;
    ctx.fill();
  }

  // The lantern's growth: experience along the bottom edge, level as a badge.
  roundRect(ctx, 0, FIELD.height - 10, FIELD.width, 10, 0);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.fillStyle = COLORS.xpBar;
  ctx.fillRect(0, FIELD.height - 10, FIELD.width * Math.min(1, state.xp / state.xpNext), 10);
  roundRect(ctx, 12, FIELD.height - 40, 74, 24, 12);
  ctx.fillStyle = 'rgba(5, 7, 20, 0.66)';
  ctx.fill();
  ctx.strokeStyle = COLORS.xpBar;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold 12px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.moteCore;
  ctx.fillText(`LV ${state.level}`, 49, FIELD.height - 27.5);

  ctx.textAlign = 'right';
  ctx.font = `11px ${BODY_FONT}`;
  ctx.fillStyle = 'rgba(185, 190, 222, 0.75)';
  ctx.fillText(view.muted ? 'M unmute · P pause' : 'M mute · P pause', FIELD.width - 14, FIELD.height - 24);
  ctx.textBaseline = 'alphabetic';
}

function drawTitle(ctx, view) {
  const state = view.world.state;
  ctx.fillStyle = 'rgba(4, 5, 16, 0.34)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';

  ctx.font = `15px ${TITLE_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('~  the last garden of the valley  ~', FIELD.width / 2, 92);

  ctx.save();
  ctx.shadowColor = 'rgba(255, 160, 40, 0.85)';
  ctx.shadowBlur = 30;
  const titleGradient = ctx.createLinearGradient(0, 108, 0, 168);
  titleGradient.addColorStop(0, COLORS.amberLight);
  titleGradient.addColorStop(0.55, COLORS.amber);
  titleGradient.addColorStop(1, COLORS.amberDeep);
  ctx.fillStyle = titleGradient;
  ctx.font = `bold 63px ${TITLE_FONT}`;
  ctx.fillText('GLOAMGARDEN', FIELD.width / 2, 164);
  ctx.restore();

  ctx.font = `italic 17px ${TITLE_FONT}`;
  ctx.fillStyle = COLORS.textWarm;
  ctx.fillText("A lanternkeeper's night watch", FIELD.width / 2, 196);

  ctx.font = `14.5px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('The glooms creep in to snuff the garden\u2019s last light. Walk the night,', FIELD.width / 2, 232);
  ctx.fillText('burn them back with your ember wisps, and last until dawn.', FIELD.width / 2, 254);

  roundRect(ctx, FIELD.width / 2 - 268, 276, 536, 96, 12);
  ctx.fillStyle = 'rgba(8, 10, 28, 0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 179, 64, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `13.5px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textWarm;
  ctx.fillText('Move — WASD · Arrow keys · or hold the Mouse / a touch', FIELD.width / 2, 302);
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('Your wisps strike on their own. Gather the motes the glooms drop,', FIELD.width / 2, 326);
  ctx.fillText('level up, and choose a blessing each time. Survive 4:00 to dawn.', FIELD.width / 2, 348);

  const button = beginButtonRect();
  const pulse = 0.75 + 0.25 * Math.sin(view.t * 2.6);
  ctx.save();
  ctx.shadowColor = `rgba(255, 160, 40, ${0.55 * pulse})`;
  ctx.shadowBlur = 20;
  roundRect(ctx, button.x, button.y, button.w, button.h, 27);
  ctx.fillStyle = '#2a1f08';
  ctx.fill();
  ctx.restore();
  roundRect(ctx, button.x, button.y, button.w, button.h, 27);
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `bold 18px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.amberLight;
  ctx.fillText('✦  Begin the watch', FIELD.width / 2, button.y + 34);

  if (view.best > 0) {
    ctx.font = `13px ${BODY_FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`Best score so far: ${formatScore(view.best)}`, FIELD.width / 2, 478);
  }
  ctx.font = `11px ${BODY_FONT}`;
  ctx.fillStyle = 'rgba(185, 190, 222, 0.6)';
  ctx.fillText(`Night falls at ${formatClock(BOSS_TIME)} the Maw rises · an original game in pure JavaScript — no assets, no network`, FIELD.width / 2, 518);
  void state;
}

function drawLevelUp(ctx, view) {
  const state = view.world.state;
  ctx.fillStyle = 'rgba(4, 5, 16, 0.66)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.font = `bold 30px ${TITLE_FONT}`;
  ctx.fillStyle = COLORS.amberLight;
  ctx.fillText('The lantern grows brighter', FIELD.width / 2, 108);
  ctx.font = `15px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`Level ${state.level} — choose a blessing (click, or press 1 · 2 · 3)`, FIELD.width / 2, 138);

  const rects = upgradeCardRects();
  state.pending.forEach((upgrade, index) => {
    const rect = rects[index];
    const hovered = view.hoverCard === index;
    ctx.save();
    if (hovered) {
      ctx.shadowColor = 'rgba(255, 170, 60, 0.65)';
      ctx.shadowBlur = 22;
    }
    roundRect(ctx, rect.x, rect.y - (hovered ? 6 : 0), rect.w, rect.h, 14);
    ctx.fillStyle = COLORS.cardFace;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, rect.x, rect.y - (hovered ? 6 : 0), rect.w, rect.h, 14);
    ctx.strokeStyle = hovered ? COLORS.amberLight : COLORS.cardEdge;
    ctx.lineWidth = hovered ? 2.4 : 1.4;
    ctx.stroke();

    const top = rect.y - (hovered ? 6 : 0);
    ctx.fillStyle = 'rgba(5, 7, 20, 0.8)';
    ctx.beginPath();
    ctx.arc(rect.x + 26, top + 26, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold 13px ${BODY_FONT}`;
    ctx.fillStyle = COLORS.textWarm;
    ctx.fillText(String(index + 1), rect.x + 26, top + 30.5);

    ctx.font = `42px ${BODY_FONT}`;
    ctx.fillStyle = COLORS.amber;
    ctx.fillText(upgrade.glyph, rect.x + rect.w / 2, top + 66);
    ctx.font = `bold 18.5px ${BODY_FONT}`;
    ctx.fillStyle = COLORS.textWarm;
    ctx.fillText(upgrade.name, rect.x + rect.w / 2, top + 102);

    ctx.font = `13px ${BODY_FONT}`;
    ctx.fillStyle = COLORS.textDim;
    const lines = wrapText(ctx, upgrade.blurb(levelOf(state, upgrade.id)), rect.w - 36);
    lines.slice(0, 4).forEach((line, lineIndex) => {
      ctx.fillText(line, rect.x + rect.w / 2, top + 128 + lineIndex * 17);
    });

    const held = levelOf(state, upgrade.id);
    ctx.font = `12px ${BODY_FONT}`;
    if (held === 0) {
      ctx.fillStyle = COLORS.mote;
      ctx.fillText('✦ new blessing', rect.x + rect.w / 2, top + rect.h - 16);
    } else {
      ctx.fillStyle = COLORS.textDim;
      const pips = '●'.repeat(Math.min(held, 8)) + (upgrade.max !== Number.POSITIVE_INFINITY ? ` of ${upgrade.max}` : '');
      ctx.fillText(`held ${pips}`, rect.x + rect.w / 2, top + rect.h - 16);
    }
  });
}

function drawStats(ctx, view, topY) {
  const state = view.world.state;
  const rows = [
    ['Time in the garden', state.dawn ? formatClock(DAWN_TIME) : formatClock(state.time)],
    ['Lantern level', String(state.level)],
    ['Glooms burned', formatScore(state.kills)],
    ['Motes gathered', formatScore(state.motesGot)],
  ];
  ctx.font = `15px ${BODY_FONT}`;
  rows.forEach(([label, value], index) => {
    const y = topY + index * 27;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(label, FIELD.width / 2 - 14, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textWarm;
    ctx.fillText(value, FIELD.width / 2 + 14, y);
  });
  const scoreY = topY + rows.length * 27 + 12;
  ctx.textAlign = 'center';
  ctx.font = `bold 25px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.amberLight;
  ctx.fillText(`SCORE  ${formatScore(state.score)}`, FIELD.width / 2, scoreY);
  ctx.font = `13px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(view.best > 0 ? `Best: ${formatScore(Math.max(view.best, state.score))}` : '', FIELD.width / 2, scoreY + 24);
  return scoreY;
}

function drawAgainButton(ctx, label) {
  const button = againButtonRect();
  roundRect(ctx, button.x, button.y, button.w, button.h, 27);
  ctx.fillStyle = '#2a1f08';
  ctx.fill();
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `bold 17px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.amberLight;
  ctx.fillText(label, FIELD.width / 2, button.y + 34);
  ctx.font = `12px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('or press Enter', FIELD.width / 2, button.y + button.h + 22);
}

function drawGameOver(ctx, view) {
  ctx.fillStyle = 'rgba(10, 3, 10, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = 'rgba(255, 56, 96, 0.6)';
  ctx.shadowBlur = 22;
  ctx.font = `bold 46px ${TITLE_FONT}`;
  ctx.fillStyle = '#ff8fab';
  ctx.fillText('THE LIGHT FADES', FIELD.width / 2, 128);
  ctx.restore();
  ctx.font = `italic 15.5px ${TITLE_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('The garden darkens… but a lantern is made to be lit again.', FIELD.width / 2, 160);
  drawStats(ctx, view, 208);
  drawAgainButton(ctx, '↻  Light it again');
}

function drawDawn(ctx, view) {
  ctx.fillStyle = 'rgba(24, 16, 4, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const glow = ctx.createRadialGradient(FIELD.width / 2, 120, 20, FIELD.width / 2, 120, 420);
  glow.addColorStop(0, 'rgba(255, 200, 90, 0.30)');
  glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = 'rgba(255, 190, 80, 0.8)';
  ctx.shadowBlur = 26;
  ctx.font = `bold 46px ${TITLE_FONT}`;
  ctx.fillStyle = COLORS.amberLight;
  ctx.fillText('DAWN BREAKS', FIELD.width / 2, 128);
  ctx.restore();
  ctx.font = `italic 15.5px ${TITLE_FONT}`;
  ctx.fillStyle = COLORS.textWarm;
  ctx.fillText('First light spills over the hedges. The garden is safe — tonight.', FIELD.width / 2, 160);
  drawStats(ctx, view, 208);
  drawAgainButton(ctx, '↻  Watch another night');
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4, 5, 16, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.font = `bold 34px ${TITLE_FONT}`;
  ctx.fillStyle = COLORS.textWarm;
  ctx.fillText('The night holds its breath', FIELD.width / 2, 250);
  ctx.font = `15px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('Paused — press P to go on', FIELD.width / 2, 284);
}
