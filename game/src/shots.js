// The staged scenes behind ?shot=start|play|upgrade|end&seed=N, used to take the entry's
// screenshots. Each one resets the world from the seed and plays the real rules forward
// with a simple autopilot — kite at wisp range, gather motes, take blessings in a fixed
// order of preference — so a frame is what a short game really looks like, and the same
// seed always gives the same frame. The end scene plays well for a while, then walks
// into the dark on purpose, so the game-over screen shows a real run's numbers.

import { FIELD, STEP } from './config.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const CHOOSE_ORDER = ['wisp', 'damage', 'nova', 'orbitRadius', 'orbitSpeed', 'heart', 'magnet', 'boots', 'regen', 'oil'];
const START_SECONDS = 4;
const PLAY_SECONDS = 78;
const END_GOOD_SECONDS = 45;
const LIMIT_SECONDS = 420;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Steer like a careful keeper: hold the nearest gloom at orbit range, strafe, fetch motes. */
function autopilot(state) {
  const player = state.player;
  let nearestEnemy = null;
  let enemyDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < enemyDist) {
      enemyDist = dist;
      nearestEnemy = enemy;
    }
  }
  let nearestMote = null;
  let moteDist = Infinity;
  for (const mote of state.motes) {
    const dist = Math.hypot(mote.x - player.x, mote.y - player.y);
    if (dist < moteDist) {
      moteDist = dist;
      nearestMote = mote;
    }
  }
  let targetX = player.x;
  let targetY = player.y;
  if (nearestEnemy !== null) {
    const ring = state.wisps.orbitRadius + 10;
    const away = Math.atan2(player.y - nearestEnemy.y, player.x - nearestEnemy.x);
    targetX = nearestEnemy.x + Math.cos(away) * ring + Math.cos(away + Math.PI / 2) * 30;
    targetY = nearestEnemy.y + Math.sin(away) * ring + Math.sin(away + Math.PI / 2) * 30;
  }
  if (nearestMote !== null && moteDist < 180 && enemyDist > 100) {
    targetX = nearestMote.x;
    targetY = nearestMote.y;
  }
  // Shove away from anything else that has crept too close — but not from the gloom
  // being kited: that one is close on purpose, inside the wisps' reach.
  let fleeX = 0;
  let fleeY = 0;
  for (const enemy of state.enemies) {
    if (enemy === nearestEnemy) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 120) {
      const weight = ((120 - dist) / 120) * 110;
      fleeX += (dx / dist) * weight;
      fleeY += (dy / dist) * weight;
    }
  }
  // Near a wall the garden closes in: lean back toward the middle before it is too late.
  if (player.x < 90 || player.x > FIELD.width - 90 || player.y < 90 || player.y > FIELD.height - 90) {
    targetX += (FIELD.width / 2 - player.x) * 0.4;
    targetY += (FIELD.height / 2 - player.y) * 0.4;
  }
  targetX = clamp(targetX + fleeX, 42, FIELD.width - 42);
  targetY = clamp(targetY + fleeY, 42, FIELD.height - 42);
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 5) return { x: 0, y: 0 };
  return { x: dx / dist, y: dy / dist };
}

/** Steer straight at the nearest gloom: how the end scene meets its end. */
function doomPilot(state) {
  const player = state.player;
  let nearest = null;
  let dist = Infinity;
  for (const enemy of state.enemies) {
    const enemyDist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (enemyDist < dist) {
      dist = enemyDist;
      nearest = enemy;
    }
  }
  if (nearest === null) return { x: 0, y: 0 };
  return { x: (nearest.x - player.x) / (dist || 1), y: (nearest.y - player.y) / (dist || 1) };
}

/** Take the most preferred blessing on offer, as a player with a plan would. */
function chooseForShot(world) {
  const pending = world.state.pending;
  for (const id of CHOOSE_ORDER) {
    if (pending.some((upgrade) => upgrade.id === id)) {
      world.choose(id);
      return;
    }
  }
  if (pending.length > 0) world.choose(pending[0].id);
}

/** Play the world forward under the autopilot, taking blessings as they come. */
function playFor(world, seconds, pilot) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    if (world.state.pending.length > 0) chooseForShot(world);
    const move = pilot(world.state);
    world.step(STEP, move.x, move.y);
    if (world.state.over || world.state.dawn) break;
  }
}

/**
 * Set the world to the named scene and return the screen to draw over it and the best
 * score to show. Any name but play, upgrade or end is the title scene.
 */
export function stageShot(name, world, seed) {
  if (name === 'play') {
    for (const attemptSeed of [seed, seed + 7, seed + 21]) {
      world.reset(attemptSeed);
      playFor(world, PLAY_SECONDS, autopilot);
      if (!world.state.over) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'upgrade') {
    for (const attemptSeed of [seed, seed + 3, seed + 11]) {
      world.reset(attemptSeed);
      const limit = Math.floor(LIMIT_SECONDS / STEP);
      for (let index = 0; index < limit; index += 1) {
        if (world.state.pending.length > 0) break;
        const move = autopilot(world.state);
        world.step(STEP, move.x, move.y);
        if (world.state.over) break;
      }
      if (world.state.pending.length > 0) break;
    }
    return { screen: world.state.pending.length > 0 ? SCREEN_LEVELUP : SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    world.reset(seed);
    playFor(world, END_GOOD_SECONDS, autopilot);
    const limit = Math.floor(LIMIT_SECONDS / STEP);
    for (let index = 0; index < limit && !world.state.over; index += 1) {
      if (world.state.pending.length > 0) chooseForShot(world);
      const move = doomPilot(world.state);
      world.step(STEP, move.x, move.y);
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  world.reset(seed, { ambient: true });
  const steps = Math.floor(START_SECONDS / STEP);
  for (let index = 0; index < steps; index += 1) world.step(STEP, 0, 0);
  return { screen: SCREEN_TITLE, best: 0 };
}
