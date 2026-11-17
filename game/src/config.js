// Gloamgarden's tuning table and palette. Every number the simulation or the renderer
// needs lives here, so the feel of the game can be adjusted in one place.

/** The play field, in logical pixels. The canvas scales this to the window. */
export const FIELD = { width: 960, height: 540 };

/** Fixed simulation step, in seconds. The world never advances by more than this at once. */
export const STEP = 1 / 60;

/** Survive this many seconds and dawn breaks: the run is won. */
export const DAWN_TIME = 240;

/** The Gloam Maw, the night's boss, rises at this many seconds into a run. */
export const BOSS_TIME = 150;

/** The lanternkeeper's starting shape; upgrades grow these numbers from here. */
export const PLAYER = {
  radius: 14,
  baseSpeed: 228,
  baseHp: 100,
  baseWisps: 2,
  baseWispDamage: 1,
  baseOrbitRadius: 48,
  baseOrbitSpeed: 3.3,
  baseMagnet: 74,
  invulnSeconds: 0.8,
};

/** Light motes a level costs: the price of the next level grows as the keeper grows. */
export function xpForLevel(level) {
  return 6 + (level - 1) * 4;
}

/** The night's palette: indigo dark, lantern amber, mote mint, gloom violet. */
export const COLORS = {
  nightTop: '#0b0e24',
  nightBottom: '#171c3d',
  groundGlow: '#1d2650',
  groundLine: '#232c5c',
  starlight: '#aab7ff',
  moon: '#f6efc9',
  moonShade: '#e3d9ae',
  textWarm: '#f6efdd',
  textDim: '#b9bede',
  amber: '#ffb340',
  amberLight: '#ffd97a',
  amberDeep: '#e07f1f',
  keeperCloak: '#1f8a80',
  keeperCloakDark: '#14655e',
  keeperSkin: '#f2c894',
  mote: '#7bf1d3',
  moteCore: '#eafff8',
  gloomBody: '#251b40',
  gloomRim: '#7b5cff',
  skitterBody: '#31194d',
  bruteBody: '#1c1233',
  mawBody: '#150a29',
  eyePink: '#ff5d8f',
  eyeRed: '#ff3860',
  heart: '#ff5d7a',
  xpBar: '#7bf1d3',
  hpBar: '#ffb340',
  cardFace: '#1d2447',
  cardEdge: '#ffb340',
  shadow: 'rgba(4, 6, 18, 0.55)',
};
