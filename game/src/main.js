// Gloamgarden's boot and heartbeat. Wires the world, the renderer, the input and the
// sound together: a fixed-step simulation fed by requestAnimationFrame, screens that
// follow the run (title, play, blessing choice, the light fading, dawn), and the
// ?shot= staging the screenshots are taken with.

import { FIELD, STEP } from './config.js';
import { SoundFX } from './audio.js';
import { Input } from './input.js';
import {
  EVENT_BOSS,
  EVENT_DAWN,
  EVENT_HURT,
  EVENT_LEVELUP,
  EVENT_MOTE,
  EVENT_NOVA,
  EVENT_OVER,
  EVENT_POP,
  EVENT_ZAP,
  World,
} from './world.js';
import {
  SCREEN_DAWN,
  SCREEN_LEVELUP,
  SCREEN_OVER,
  SCREEN_PLAY,
  SCREEN_TITLE,
  againButtonRect,
  beginButtonRect,
  drawGame,
  pointInRect,
  upgradeCardRects,
} from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const baseSeed = Number.isFinite(seedParam) ? seedParam : 20261117;

let viewScale = 1;
let viewOX = 0;
let viewOY = 0;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  viewScale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
  viewOX = (canvas.width - FIELD.width * viewScale) / 2;
  viewOY = (canvas.height - FIELD.height * viewScale) / 2;
}

function toField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (canvas.width / rect.width);
  const py = (clientY - rect.top) * (canvas.height / rect.height);
  return { x: (px - viewOX) / viewScale, y: (py - viewOY) / viewScale };
}

function loadBest() {
  try {
    return Number.parseInt(window.localStorage.getItem('gloamgarden-best') ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('gloamgarden-best', String(value));
  } catch {
    // A private window keeps no best; the night is no worse for it.
  }
}

const world = new World();
const sound = new SoundFX();
const input = new Input(canvas, toField);
let screen = SCREEN_TITLE;
let best = loadBest();
let paused = false;
let hoverCard = -1;
let animClock = 0;
let screenAge = 0;
let shotMode = false;

function say(text) {
  statusLine.textContent = text;
}

function startRun() {
  sound.unlock();
  sound.ui();
  const seed = (Date.now() % 2147483646) + 1;
  world.reset(seed);
  paused = false;
  screen = SCREEN_PLAY;
  screenAge = 0;
  say('The watch begins. Move with WASD, the arrow keys, or a held pointer. Survive until dawn.');
}

function backToTitle() {
  world.reset(baseSeed, { ambient: true });
  screen = SCREEN_TITLE;
  screenAge = 0;
  paused = false;
  say('Gloamgarden. Press Enter or choose Begin the watch.');
}

function finishRun(won) {
  best = Math.max(best, world.state.score);
  saveBest(best);
  screen = won ? SCREEN_DAWN : SCREEN_OVER;
  screenAge = 0;
  if (won) {
    sound.dawn();
    say(`Dawn breaks. Score ${world.state.score}. Press Enter to watch another night.`);
  } else {
    sound.gameOver();
    say(`The light fades. Score ${world.state.score}. Press Enter to light it again.`);
  }
}

function playEvents(events) {
  if (events & EVENT_ZAP) sound.zap();
  if (events & EVENT_POP) sound.pop();
  if (events & EVENT_MOTE) sound.pickup();
  if (events & EVENT_HURT) sound.hurt();
  if (events & EVENT_NOVA) sound.nova();
  if (events & EVENT_BOSS) {
    sound.boss();
    say('The Gloam Maw has risen.');
  }
  if (events & EVENT_LEVELUP) {
    sound.levelup();
    screen = SCREEN_LEVELUP;
    screenAge = 0;
    const names = world.state.pending.map((upgrade) => upgrade.name).join(', ');
    say(`Level ${world.state.level}. Choose a blessing: ${names}.`);
  }
  if (events & EVENT_OVER) finishRun(false);
  else if (events & EVENT_DAWN) finishRun(true);
}

function chooseBlessing(index) {
  const pending = world.state.pending;
  if (index < 0 || index >= pending.length) return;
  sound.unlock();
  world.choose(pending[index].id);
  sound.choose();
  if (world.state.pending.length === 0) {
    screen = SCREEN_PLAY;
    screenAge = 0;
    say('The watch goes on.');
  }
}

function steering() {
  const axis = input.axis();
  if (axis.x !== 0 || axis.y !== 0) return axis;
  if (input.pointer.down && input.pointer.seen) {
    const player = world.state.player;
    const dx = input.pointer.x - player.x;
    const dy = input.pointer.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 12) {
      const strength = Math.min(1, dist / 60);
      return { x: (dx / dist) * strength, y: (dy / dist) * strength };
    }
  }
  return { x: 0, y: 0 };
}

function handleClicks() {
  const clicks = input.takeClicks();
  if (clicks.length === 0) return;
  sound.unlock();
  if (screen === SCREEN_TITLE) {
    if (clicks.some((point) => pointInRect(point, beginButtonRect()))) startRun();
  } else if (screen === SCREEN_LEVELUP) {
    const rects = upgradeCardRects();
    for (const point of clicks) {
      const index = rects.findIndex((rect) => pointInRect(point, rect));
      if (index !== -1) {
        chooseBlessing(index);
        break;
      }
    }
  } else if ((screen === SCREEN_OVER || screen === SCREEN_DAWN) && screenAge > 0.5) {
    if (clicks.some((point) => pointInRect(point, againButtonRect()))) startRun();
  }
}

function handleKeys() {
  if (input.takePressed('KeyM')) {
    sound.setMuted(!sound.muted);
    say(sound.muted ? 'Sound off.' : 'Sound on.');
  }
  if (screen === SCREEN_PLAY && (input.takePressed('KeyP') || input.takePressed('Escape'))) {
    paused = !paused;
    say(paused ? 'Paused.' : 'The watch goes on.');
    return;
  }
  if (screen === SCREEN_TITLE && input.takeConfirm()) {
    startRun();
    return;
  }
  if (screen === SCREEN_LEVELUP) {
    if (input.takePressed('Digit1')) chooseBlessing(0);
    else if (input.takePressed('Digit2')) chooseBlessing(1);
    else if (input.takePressed('Digit3')) chooseBlessing(2);
    return;
  }
  if ((screen === SCREEN_OVER || screen === SCREEN_DAWN) && screenAge > 0.5) {
    if (input.takePressed('Escape')) backToTitle();
    else if (input.takeConfirm()) startRun();
  }
}

function updateHover() {
  hoverCard = -1;
  if (screen !== SCREEN_LEVELUP || !input.pointer.seen) return;
  const rects = upgradeCardRects();
  hoverCard = rects.findIndex((rect) => pointInRect(input.pointer, rect));
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07081a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewOX, viewOY);
  drawGame(ctx, {
    world,
    screen,
    t: shotMode ? world.state.time : animClock,
    best,
    muted: sound.muted,
    paused,
    hoverCard,
  });
}

let lastStamp = 0;
let accumulator = 0;

function frame(stamp) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, lastStamp === 0 ? 0 : (stamp - lastStamp) / 1000);
  lastStamp = stamp;
  animClock += dt;
  screenAge += dt;

  handleKeys();
  handleClicks();
  updateHover();

  if (!paused) {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      accumulator -= STEP;
      guard += 1;
      if (screen === SCREEN_TITLE) {
        world.step(STEP, 0, 0);
      } else if (screen === SCREEN_PLAY) {
        const move = steering();
        playEvents(world.step(STEP, move.x, move.y));
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      } else {
        break;
      }
    }
    if (guard >= 8) accumulator = 0;
  }
  draw();
}

resize();
window.addEventListener('resize', resize);

const shot = params.get('shot');
if (shot !== null) {
  shotMode = true;
  const staged = stageShot(shot, world, baseSeed);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  draw();
  say(`Gloamgarden, screenshot scene ${shot}.`);
  window.__shotReady = true;
} else {
  world.reset(baseSeed, { ambient: true });
  input.attach();
  say('Gloamgarden. Press Enter or choose Begin the watch.');
  requestAnimationFrame(frame);
}

window.__gloam = { world, stageShot };
