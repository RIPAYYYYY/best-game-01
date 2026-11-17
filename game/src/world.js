// The garden at night, as a simulation. The World owns every rule: the keeper walks, the
// ember wisps orbit and burn, the glooms creep in from the dark in growing numbers, the
// fallen drop light motes, motes feed levels, and levels offer blessings. It renders
// nothing and reads no clock but its own stepped time, and every random draw comes from
// its seeded stream, so a staged run replays exactly.

import { BOSS_TIME, DAWN_TIME, FIELD, PLAYER, xpForLevel } from './config.js';
import { createRng } from './rng.js';
import { applyUpgrade, rollChoices } from './upgrades.js';

export const EVENT_NONE = 0;
export const EVENT_ZAP = 1;
export const EVENT_MOTE = 2;
export const EVENT_HURT = 4;
export const EVENT_POP = 8;
export const EVENT_LEVELUP = 16;
export const EVENT_NOVA = 32;
export const EVENT_OVER = 64;
export const EVENT_DAWN = 128;
export const EVENT_BOSS = 256;

export const KIND_SHADE = 'shade';
export const KIND_SKITTER = 'skitter';
export const KIND_BRUTE = 'brute';
export const KIND_MAW = 'maw';

/** What each gloom is made of. Hit points scale with the night's age when it spawns. */
const GLOOM_STATS = {
  [KIND_SHADE]: { radius: 15, hp: 3, speed: 63, touch: 10, xp: 1, score: 10, knockResist: 1 },
  [KIND_SKITTER]: { radius: 10, hp: 1, speed: 122, touch: 6, xp: 1, score: 15, knockResist: 1 },
  [KIND_BRUTE]: { radius: 26, hp: 16, speed: 35, touch: 18, xp: 3, score: 30, knockResist: 0.3 },
  [KIND_MAW]: { radius: 46, hp: 250, speed: 27, touch: 24, xp: 20, score: 500, knockResist: 0.06 },
};

const MAX_ENEMIES = 64;
const MAX_MOTES = 240;
const WISP_RADIUS = 7;
const WISP_HIT_COOLDOWN = 0.16;

export class World {
  constructor() {
    this.rng = createRng(1);
    this.state = null;
    this.reset(1, { ambient: true });
  }

  /**
   * Begin again from a seed. With `ambient`, the garden is at peace for the title
   * screen: a few glooms drift in the dark, nothing hunts and nothing can be hurt.
   */
  reset(seed, { ambient = false } = {}) {
    this.rng = createRng(seed);
    const rng = this.rng;
    const decor = [];
    for (let index = 0; index < 30; index += 1) {
      decor.push({
        x: rng.range(24, FIELD.width - 24),
        y: rng.range(24, FIELD.height - 24),
        kind: rng.pick(['flower', 'flower', 'bush', 'grass', 'stone', 'patch']),
        scale: rng.range(0.7, 1.5),
        phase: rng.range(0, Math.PI * 2),
        tint: rng.int(0, 2),
      });
    }
    this.state = {
      time: 0,
      ambient,
      over: false,
      dawn: false,
      player: {
        x: FIELD.width / 2,
        y: FIELD.height / 2 + 30,
        hp: PLAYER.baseHp,
        maxHp: PLAYER.baseHp,
        speed: PLAYER.baseSpeed,
        radius: PLAYER.radius,
        face: 1,
      },
      wisps: {
        count: PLAYER.baseWisps,
        damage: PLAYER.baseWispDamage,
        orbitRadius: PLAYER.baseOrbitRadius,
        orbitSpeed: PLAYER.baseOrbitSpeed,
        angle: 0,
      },
      magnet: PLAYER.baseMagnet,
      regen: 0,
      nova: { cooldown: 0, timer: 0, damage: 0, radius: 0 },
      xp: 0,
      level: 1,
      xpNext: xpForLevel(1),
      kills: 0,
      score: 0,
      scoreCarry: 0,
      motesGot: 0,
      enemies: [],
      motes: [],
      particles: [],
      floaters: [],
      upgradeLevels: {},
      pending: [],
      queuedLevels: 0,
      boss: null,
      bossSpawned: false,
      spawnTimer: 1.1,
      invuln: 0,
      shake: 0,
      flash: 0,
      decor,
    };
    if (ambient) {
      for (let index = 0; index < 5; index += 1) {
        const enemy = this.makeEnemy(rng.pick([KIND_SHADE, KIND_SHADE, KIND_SKITTER]), rng.range(90, FIELD.width - 90), rng.range(70, FIELD.height - 70));
        enemy.decor = true;
        enemy.homeX = enemy.x;
        enemy.homeY = enemy.y;
        this.state.enemies.push(enemy);
      }
    }
  }

  /** Build one gloom of a kind at a place, its strength set by the night's age. */
  makeEnemy(kind, x, y) {
    const stats = GLOOM_STATS[kind];
    const hpScale = 1 + (this.state.time / 60) * 0.22;
    const hp = Math.max(1, Math.round(stats.hp * (kind === KIND_MAW ? 1 : hpScale)));
    return {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      radius: stats.radius,
      speed: stats.speed,
      touch: stats.touch,
      xpValue: stats.xp,
      scoreValue: stats.score,
      knockResist: stats.knockResist,
      phase: this.rng.range(0, Math.PI * 2),
      lastHit: -10,
      stun: 0,
      spawnClock: 0,
      decor: false,
      homeX: x,
      homeY: y,
    };
  }

  /** Where the wisps are right now: evenly spaced points on the orbit ring. */
  wispPositions() {
    const { player, wisps } = this.state;
    const points = [];
    for (let index = 0; index < wisps.count; index += 1) {
      const angle = wisps.angle + (index * Math.PI * 2) / wisps.count;
      points.push({ x: player.x + Math.cos(angle) * wisps.orbitRadius, y: player.y + Math.sin(angle) * wisps.orbitRadius });
    }
    return points;
  }

  /** A burst of sparks. `ring` particles are the nova's expanding circle instead. */
  burst(x, y, color, count, speed = 130, kind = 'spark') {
    const { particles } = this.state;
    if (kind === 'ring') {
      particles.push({ kind, x, y, vx: 0, vy: 0, life: 0.38, max: 0.38, size: 6, color, radius: 20 });
      return;
    }
    for (let index = 0; index < count; index += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const pace = this.rng.range(speed * 0.25, speed);
      particles.push({
        kind,
        x,
        y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life: this.rng.range(0.25, 0.6),
        max: 0.6,
        size: this.rng.range(1.6, 3.6),
        color,
        radius: 0,
      });
    }
  }

  /** A small floating label: damage done, a mote's worth, a warning. */
  floater(x, y, text, color) {
    this.state.floaters.push({ x, y, text, color, life: 0.85 });
    if (this.state.floaters.length > 40) this.state.floaters.shift();
  }

  /** Feed the lantern. Crossing a level queues a blessing choice. */
  addXp(value, events) {
    const state = this.state;
    state.xp += value;
    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.queuedLevels += 1;
      state.xpNext = xpForLevel(state.level);
    }
    if (state.queuedLevels > 0 && state.pending.length === 0) {
      state.pending = rollChoices(state, this.rng);
      return events | EVENT_LEVELUP;
    }
    return events;
  }

  /** Take the blessing with this id; if levels are still queued, offer the next three. */
  choose(id) {
    const state = this.state;
    if (state.pending.length === 0) return;
    applyUpgrade(state, id);
    state.queuedLevels = Math.max(0, state.queuedLevels - 1);
    state.pending = state.queuedLevels > 0 ? rollChoices(state, this.rng) : [];
  }

  /** Scatter a dead gloom's worth of light motes. */
  dropMotes(enemy) {
    const state = this.state;
    let total = enemy.xpValue;
    const count = Math.min(total, 12);
    for (let index = 0; index < count; index += 1) {
      const value = index < total - count ? 2 : 1;
      total -= value;
      const angle = this.rng.range(0, Math.PI * 2);
      const pace = this.rng.range(20, 95);
      state.motes.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        value,
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
    if (state.motes.length > MAX_MOTES) state.motes.splice(0, state.motes.length - MAX_MOTES);
  }

  /** Hurt a gloom; kill it if the hurt is enough. Returns the events it caused. */
  damageEnemy(enemy, amount, fromX, fromY, events) {
    const state = this.state;
    enemy.hp -= amount;
    const away = Math.atan2(enemy.y - fromY, enemy.x - fromX);
    const push = 150 * enemy.knockResist;
    enemy.vx += Math.cos(away) * push;
    enemy.vy += Math.sin(away) * push;
    this.floater(enemy.x, enemy.y - enemy.radius - 4, String(amount), '#ffd97a');
    this.burst(enemy.x, enemy.y, '#b79cff', 3, 90);
    if (enemy.hp > 0) return events;
    state.kills += 1;
    state.score += enemy.scoreValue;
    this.burst(enemy.x, enemy.y, enemy.kind === KIND_SKITTER ? '#c084fc' : '#8f7bff', enemy.kind === KIND_BRUTE || enemy.kind === KIND_MAW ? 22 : 10, 170);
    this.dropMotes(enemy);
    if (state.boss === enemy) state.boss = null;
    enemy.dead = true;
    return events | EVENT_POP;
  }

  /** Where the next gloom slips in: just past a random edge of the garden. */
  spawnPoint() {
    const rng = this.rng;
    const side = rng.int(0, 3);
    if (side === 0) return { x: rng.range(0, FIELD.width), y: -34 };
    if (side === 1) return { x: rng.range(0, FIELD.width), y: FIELD.height + 34 };
    if (side === 2) return { x: -34, y: rng.range(0, FIELD.height) };
    return { x: FIELD.width + 34, y: rng.range(0, FIELD.height) };
  }

  /** Which glooms the hour calls: skitters after dusk deepens, brutes later still. */
  spawnKind() {
    const time = this.state.time;
    const roll = this.rng.next();
    if (time > 85 && roll < 0.16) return KIND_BRUTE;
    if (time > 40 && roll < 0.42) return KIND_SKITTER;
    return KIND_SHADE;
  }

  /**
   * Advance the garden by one fixed step. `moveX`/`moveY` are the keeper's steering,
   * each in -1..1. Returns the events the step caused, as EVENT_* bits.
   */
  step(dt, moveX, moveY) {
    const state = this.state;
    if (state.pending.length > 0) return EVENT_NONE;
    let events = EVENT_NONE;

    state.wisps.angle += state.wisps.orbitSpeed * dt;
    this.updateParticles(dt);
    if (state.over || state.dawn) return events;

    if (state.ambient) {
      for (const enemy of state.enemies) {
        enemy.x = enemy.homeX + Math.sin(state.time * 0.24 + enemy.phase) * 26;
        enemy.y = enemy.homeY + Math.cos(state.time * 0.19 + enemy.phase) * 18;
      }
      state.time += dt;
      return events;
    }

    state.time += dt;
    state.scoreCarry += dt * 2;
    const whole = Math.floor(state.scoreCarry);
    state.score += whole;
    state.scoreCarry -= whole;

    if (state.time >= DAWN_TIME) {
      state.dawn = true;
      state.score += 500;
      for (const enemy of state.enemies) this.burst(enemy.x, enemy.y, '#ffd97a', 8, 150);
      state.enemies = [];
      state.boss = null;
      return events | EVENT_DAWN;
    }

    // Spawning: the dark thickens, so the interval between arrivals keeps shrinking.
    state.spawnTimer -= dt;
    const interval = Math.max(0.42, 1.5 - (state.time / DAWN_TIME) * 1.05);
    if (state.spawnTimer <= 0 && state.enemies.length < MAX_ENEMIES) {
      state.spawnTimer = interval * this.rng.range(0.7, 1.3);
      const point = this.spawnPoint();
      state.enemies.push(this.makeEnemy(this.spawnKind(), point.x, point.y));
    }
    if (!state.bossSpawned && state.time >= BOSS_TIME) {
      state.bossSpawned = true;
      const maw = this.makeEnemy(KIND_MAW, FIELD.width / 2, -50);
      state.enemies.push(maw);
      state.boss = maw;
      events |= EVENT_BOSS;
    }

    // The keeper walks, and the garden walls hold her in.
    const player = state.player;
    const length = Math.hypot(moveX, moveY);
    if (length > 0.01) {
      const scale = Math.min(1, length) / (length || 1);
      player.x += moveX * scale * player.speed * dt;
      player.y += moveY * scale * player.speed * dt;
      if (Math.abs(moveX) > 0.1) player.face = moveX > 0 ? 1 : -1;
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y));
    if (state.regen > 0) player.hp = Math.min(player.maxHp, player.hp + state.regen * dt);
    state.invuln = Math.max(0, state.invuln - dt);
    state.shake = Math.max(0, state.shake - dt * 26);
    state.flash = Math.max(0, state.flash - dt * 3.2);

    events = this.moveEnemies(dt, events);
    events = this.wispHits(events);
    events = this.enemyTouches(events);
    events = this.moveMotes(dt, events);
    events = this.novaTick(dt, events);

    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
    return events;
  }

  /** Glooms hunt the keeper, keep a little distance from each other, and drift home when stunned. */
  moveEnemies(dt, events) {
    const state = this.state;
    const player = state.player;
    for (const enemy of state.enemies) {
      const toward = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      let wantX = Math.cos(toward) * enemy.speed;
      let wantY = Math.sin(toward) * enemy.speed;
      if (enemy.kind === KIND_SKITTER) {
        const sway = Math.sin(state.time * 6 + enemy.phase) * 44;
        wantX += Math.cos(toward + Math.PI / 2) * sway;
        wantY += Math.sin(toward + Math.PI / 2) * sway;
      }
      enemy.stun = Math.max(0, enemy.stun - dt);
      const blend = enemy.stun > 0 ? 2.5 : 6;
      enemy.vx += (wantX - enemy.vx) * Math.min(1, blend * dt);
      enemy.vy += (wantY - enemy.vy) * Math.min(1, blend * dt);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.kind === KIND_MAW) {
        enemy.spawnClock += dt;
        if (enemy.spawnClock > 4 && state.enemies.length < MAX_ENEMIES) {
          enemy.spawnClock = 0;
          state.enemies.push(this.makeEnemy(KIND_SHADE, enemy.x + this.rng.range(-40, 40), enemy.y + this.rng.range(-40, 40)));
        }
      }
    }
    // A gentle separation pass so the horde reads as bodies, not one stacked blob.
    const list = state.enemies;
    for (let a = 0; a < list.length; a += 1) {
      for (let b = a + 1; b < list.length; b += 1) {
        const dx = list[b].x - list[a].x;
        const dy = list[b].y - list[a].y;
        const min = (list[a].radius + list[b].radius) * 0.82;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0.01 && distSq < min * min) {
          const dist = Math.sqrt(distSq);
          const push = ((min - dist) / dist) * 0.5;
          list[a].x -= dx * push * 0.5;
          list[a].y -= dy * push * 0.5;
          list[b].x += dx * push * 0.5;
          list[b].y += dy * push * 0.5;
        }
      }
    }
    return events;
  }

  /** The orbit burns what it touches, each gloom briefly proof against a second touch. */
  wispHits(events) {
    const state = this.state;
    const points = this.wispPositions();
    for (const enemy of state.enemies) {
      if (enemy.dead || state.time - enemy.lastHit < WISP_HIT_COOLDOWN) continue;
      for (const point of points) {
        const dx = enemy.x - point.x;
        const dy = enemy.y - point.y;
        const reach = WISP_RADIUS + enemy.radius;
        if (dx * dx + dy * dy < reach * reach) {
          enemy.lastHit = state.time;
          events |= EVENT_ZAP;
          events = this.damageEnemy(enemy, state.wisps.damage, state.player.x, state.player.y, events);
          break;
        }
      }
    }
    return events;
  }

  /** A gloom that reaches the keeper bites: she is briefly untouchable afterwards. */
  enemyTouches(events) {
    const state = this.state;
    const player = state.player;
    if (state.invuln > 0) return events;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const reach = enemy.radius + player.radius - 2;
      if (dx * dx + dy * dy < reach * reach) {
        player.hp -= enemy.touch;
        state.invuln = PLAYER.invulnSeconds;
        state.shake = 9;
        state.flash = 1;
        enemy.stun = 0.35;
        const away = Math.atan2(dy, dx);
        enemy.vx += Math.cos(away) * 300;
        enemy.vy += Math.sin(away) * 300;
        this.burst(player.x, player.y, '#ff5d7a', 10, 160);
        events |= EVENT_HURT;
        if (player.hp <= 0) {
          player.hp = 0;
          state.over = true;
          this.burst(player.x, player.y, '#ffb340', 42, 240);
          this.burst(player.x, player.y, '#ffd97a', 24, 150);
          events |= EVENT_OVER;
        }
        break;
      }
    }
    return events;
  }

  /** Motes drift, then hurry to the lantern when they come within the charm's reach. */
  moveMotes(dt, events) {
    const state = this.state;
    const player = state.player;
    const kept = [];
    for (const mote of state.motes) {
      const dx = player.x - mote.x;
      const dy = player.y - mote.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < state.magnet) {
        const pull = 170 + (1 - dist / state.magnet) * 430;
        mote.vx = (dx / dist) * pull;
        mote.vy = (dy / dist) * pull;
      } else {
        mote.vx *= 1 - 2.4 * dt;
        mote.vy *= 1 - 2.4 * dt;
      }
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      if (dist < player.radius + 9) {
        state.motesGot += 1;
        state.score += 5 * mote.value;
        events |= EVENT_MOTE;
        events = this.addXp(mote.value, events);
      } else {
        kept.push(mote);
      }
    }
    state.motes = kept;
    return events;
  }

  /** The nova, once learned, keeps its own time and spends it all at once. */
  novaTick(dt, events) {
    const state = this.state;
    if (state.nova.cooldown <= 0) return events;
    state.nova.timer -= dt;
    if (state.nova.timer > 0) return events;
    state.nova.timer = state.nova.cooldown;
    const player = state.player;
    this.burst(player.x, player.y, '#ffb340', 0, 0, 'ring');
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < state.nova.radius + enemy.radius) {
        events = this.damageEnemy(enemy, state.nova.damage, player.x, player.y, events);
      }
    }
    return events | EVENT_NOVA;
  }

  /** Sparks fall and fade; rings swell; labels rise. */
  updateParticles(dt) {
    const state = this.state;
    const kept = [];
    for (const particle of state.particles) {
      particle.life -= dt;
      if (particle.life <= 0) continue;
      if (particle.kind === 'ring') {
        particle.radius += 460 * dt;
      } else {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 1 - 2.2 * dt;
        particle.vy *= 1 - 2.2 * dt;
      }
      kept.push(particle);
    }
    state.particles = kept;
    const labels = [];
    for (const floater of state.floaters) {
      floater.life -= dt;
      floater.y -= 32 * dt;
      if (floater.life > 0) labels.push(floater);
    }
    state.floaters = labels;
  }
}
