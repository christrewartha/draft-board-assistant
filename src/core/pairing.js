import { winProbability, CORE_POSITIONS } from './ranking.js';

// Choose the next matchup. Good questions are ones where:
//  - the players are near each other on the board (the answer could flip their order),
//  - we know little about them yet (high uncertainty),
//  - they sit high enough on the board to matter on draft day,
//  - we haven't asked about this exact pair already.

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function weightedPick(items, weightOf, rng) {
  const weights = items.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * board: sorted entries from buildBoard.
 * Returns [idA, idB] or null if there aren't enough players.
 */
export function pickPair(
  board,
  { focus = 'ALL', comparisons = [], exclude = [], poolSize = 150, window = 8, rng = Math.random } = {},
) {
  const inFocus = (e) => (focus === 'ALL' ? CORE_POSITIONS.includes(e.player.pos) : e.player.pos === focus);
  const pool = board.filter(inFocus).slice(0, poolSize);
  if (pool.length < 2) return null;

  const excluded = new Set(exclude);
  const asked = new Map();
  for (const c of comparisons) {
    const k = pairKey(c.a, c.b);
    asked.set(k, (asked.get(k) ?? 0) + 1);
  }

  let anchorCandidates = pool.map((e, idx) => ({ e, idx })).filter(({ e }) => !excluded.has(e.player.id));
  if (anchorCandidates.length < 2) anchorCandidates = pool.map((e, idx) => ({ e, idx }));

  const anchor = weightedPick(
    anchorCandidates,
    ({ e, idx }) => (e.sd * e.sd) / (1 + e.count) / (1 + idx / 30),
    rng,
  );

  const lo = Math.max(0, anchor.idx - window);
  const hi = Math.min(pool.length, anchor.idx + window + 1);
  let opponents = pool.slice(lo, hi).filter((e) => e.player.id !== anchor.e.player.id);
  const fresh = opponents.filter((e) => !excluded.has(e.player.id));
  if (fresh.length > 0) opponents = fresh;

  const opponent = weightedPick(
    opponents,
    (e) => {
      const p = winProbability(anchor.e.strength, e.strength);
      const repeats = asked.get(pairKey(anchor.e.player.id, e.player.id)) ?? 0;
      return p * (1 - p) * (anchor.e.sd ** 2 + e.sd ** 2) * 0.1 ** repeats;
    },
    rng,
  );

  const pair = [anchor.e.player.id, opponent.player.id];
  return rng() < 0.5 ? pair : pair.reverse();
}
