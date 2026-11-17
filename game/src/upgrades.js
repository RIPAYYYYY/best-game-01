// The level-up pool. Every mote the keeper gathers feeds the lantern; each level offers
// three of these blessings, and the keeper picks one. Each blessing can be taken only so
// many times, so a build takes shape over a night: more wisps, hotter embers, a wider
// orbit, swifter feet, a deeper heart. When nothing is left to learn, the lantern offers
// oil instead: a plain heal, so a level is never wasted.

export const UPGRADES = [
  {
    id: 'wisp',
    name: 'Ember Wisp',
    glyph: '✦',
    max: 4,
    blurb: () => 'One more ember joins the orbit and burns what it touches.',
    apply(state) {
      state.wisps.count += 1;
    },
  },
  {
    id: 'damage',
    name: 'Hotter Embers',
    glyph: '✸',
    max: 5,
    blurb: () => 'Every wisp burns +1 deeper.',
    apply(state) {
      state.wisps.damage += 1;
    },
  },
  {
    id: 'orbitSpeed',
    name: 'Dervish Orbit',
    glyph: '↻',
    max: 4,
    blurb: () => 'The wisps circle 18% faster.',
    apply(state) {
      state.wisps.orbitSpeed *= 1.18;
    },
  },
  {
    id: 'orbitRadius',
    name: 'Wider Orbit',
    glyph: '◎',
    max: 3,
    blurb: () => 'The orbit widens by 11 paces, sweeping a bigger ring.',
    apply(state) {
      state.wisps.orbitRadius += 11;
    },
  },
  {
    id: 'boots',
    name: 'Swift Boots',
    glyph: '➤',
    max: 4,
    blurb: () => 'The keeper walks 11% swifter.',
    apply(state) {
      state.player.speed *= 1.11;
    },
  },
  {
    id: 'heart',
    name: 'Heart Vessel',
    glyph: '♥',
    max: 4,
    blurb: () => '+25 heart, and mend 25 now.',
    apply(state) {
      state.player.maxHp += 25;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
    },
  },
  {
    id: 'magnet',
    name: 'Mote Charm',
    glyph: '⊕',
    max: 4,
    blurb: () => 'Motes are drawn in from 45% farther away.',
    apply(state) {
      state.magnet *= 1.45;
    },
  },
  {
    id: 'regen',
    name: 'Dew Blessing',
    glyph: '❖',
    max: 3,
    blurb: () => 'Morning dew mends +0.7 heart a second.',
    apply(state) {
      state.regen += 0.7;
    },
  },
  {
    id: 'nova',
    name: 'Ember Nova',
    glyph: '☀',
    max: 3,
    blurb: (level) =>
      level === 0
        ? 'Every 13 seconds the lantern bursts, blasting every gloom nearby.'
        : 'The nova comes sooner, reaches farther and hits harder.',
    apply(state, level) {
      const table = [
        { cooldown: 13, damage: 6, radius: 150 },
        { cooldown: 10.5, damage: 10, radius: 168 },
        { cooldown: 8, damage: 15, radius: 190 },
      ];
      const nova = table[Math.min(level, table.length - 1)];
      state.nova.cooldown = nova.cooldown;
      state.nova.damage = nova.damage;
      state.nova.radius = nova.radius;
      state.nova.timer = Math.min(state.nova.timer, nova.cooldown);
    },
  },
];

/** The fallback offer when every blessing is mastered: a flask of lantern oil. */
export const OIL = {
  id: 'oil',
  name: 'Lantern Oil',
  glyph: '✚',
  max: Number.POSITIVE_INFINITY,
  blurb: () => 'A deep drink of oil: mend 40 heart now.',
  apply(state) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 40);
  },
};

/** How many times the keeper already holds the blessing with this id. */
export function levelOf(state, id) {
  return state.upgradeLevels[id] || 0;
}

/**
 * Draw up to three distinct blessings the keeper can still learn, using the world's own
 * random stream so a staged run always offers the same choices.
 */
export function rollChoices(state, rng) {
  const open = UPGRADES.filter((upgrade) => levelOf(state, upgrade.id) < upgrade.max);
  const choices = [];
  while (choices.length < 3 && open.length > 0) {
    const index = Math.floor(rng.next() * open.length);
    choices.push(open.splice(index, 1)[0]);
  }
  while (choices.length < 3) choices.push(OIL);
  return choices;
}

/** Give the keeper the blessing with this id. Returns the blessing, or null if unknown. */
export function applyUpgrade(state, id) {
  const upgrade = id === OIL.id ? OIL : UPGRADES.find((entry) => entry.id === id);
  if (!upgrade) return null;
  const level = levelOf(state, id);
  state.upgradeLevels[id] = level + 1;
  upgrade.apply(state, level);
  return upgrade;
}
