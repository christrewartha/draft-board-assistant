// Preference model: Bradley-Terry with a Gaussian prior centred on consensus rank.
//
// Every player has a hidden "strength" s. The chance you prefer A over B is
// sigmoid(s_A - s_B). Before you make any picks, strengths come from the
// consensus rankings; each pick pulls them towards your own taste. Refitting
// from the full comparison log (rather than updating incrementally) keeps
// undo trivial and makes the result independent of pick order.

export const TRUST_LEVELS = {
  low: { label: 'Low', priorSd: 1.6 },
  medium: { label: 'Medium', priorSd: 1.0 },
  high: { label: 'High', priorSd: 0.6 },
};

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
// Kickers and defenses only get matchups when you filter to them explicitly.
export const CORE_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export function winProbability(strengthA, strengthB) {
  return sigmoid(strengthA - strengthB);
}

// Linear in rank so one unit of strength means "about 10 board spots" everywhere.
// (A log-shaped prior was tried: it froze the top of the board and let a single
// pick fling late-round players dozens of spots, and learned far worse in simulation.)
export function priorMean(consensusRank) {
  return -consensusRank * 0.1;
}

/**
 * Fit player strengths from the comparison log.
 * comparisons: [{ a, b, result }] where result is 1 (a preferred), 0 (b preferred) or 0.5 (tie).
 * Returns Map id -> { strength, sd, count }.
 */
export function fitStrengths(players, comparisons, { priorSd = 1, iterations = 200, tolerance = 1e-7 } = {}) {
  const n = players.length;
  const index = new Map(players.map((p, i) => [p.id, i]));
  const mu = players.map((p) => priorMean(p.rank));
  const s = Float64Array.from(mu);
  const precision = 1 / (priorSd * priorSd);
  const count = new Int32Array(n);

  const games = [];
  for (const c of comparisons) {
    const i = index.get(c.a);
    const j = index.get(c.b);
    if (i === undefined || j === undefined || i === j) continue;
    games.push([i, j, c.result]);
    count[i]++;
    count[j]++;
  }

  const grad = new Float64Array(n);
  const hess = new Float64Array(n);
  const accumulate = () => {
    for (let i = 0; i < n; i++) {
      grad[i] = -(s[i] - mu[i]) * precision;
      hess[i] = precision;
    }
    for (const [i, j, y] of games) {
      const p = sigmoid(s[i] - s[j]);
      grad[i] += y - p;
      grad[j] -= y - p;
      const w = p * (1 - p);
      hess[i] += w;
      hess[j] += w;
    }
  };

  // Diagonal Newton steps. The prior makes the system strictly diagonally
  // dominant, so this converges without needing a full Hessian solve.
  for (let it = 0; it < iterations && games.length > 0; it++) {
    accumulate();
    let maxStep = 0;
    for (let i = 0; i < n; i++) {
      const step = grad[i] / hess[i];
      s[i] += step;
      maxStep = Math.max(maxStep, Math.abs(step));
    }
    if (maxStep < tolerance) break;
  }
  accumulate();

  const result = new Map();
  players.forEach((p, i) => {
    result.set(p.id, { strength: s[i], sd: 1 / Math.sqrt(hess[i]), count: count[i] });
  });
  return result;
}

/**
 * Build the personalised board: players sorted by fitted strength, annotated
 * with overall/positional ranks for both the board and consensus.
 */
export function buildBoard(players, comparisons, { priorSd = 1 } = {}) {
  const fit = fitStrengths(players, comparisons, { priorSd });

  const consensusPosRank = new Map();
  const posCounters = {};
  [...players]
    .sort((a, b) => a.rank - b.rank)
    .forEach((p) => {
      posCounters[p.pos] = (posCounters[p.pos] ?? 0) + 1;
      consensusPosRank.set(p.id, posCounters[p.pos]);
    });

  const entries = players
    .map((player) => ({ player, ...fit.get(player.id) }))
    .sort((a, b) => b.strength - a.strength || a.player.rank - b.player.rank);

  const boardPosCounters = {};
  entries.forEach((e, i) => {
    e.boardRank = i + 1;
    boardPosCounters[e.player.pos] = (boardPosCounters[e.player.pos] ?? 0) + 1;
    e.posRank = boardPosCounters[e.player.pos];
    e.consensusPosRank = consensusPosRank.get(e.player.id);
  });
  return entries;
}

/**
 * Assign tier numbers to an already-sorted list of board entries. A new tier
 * starts wherever the strength gap to the previous player is unusually large.
 */
export function assignTiers(entries, { percentile = 0.9, minGap = 0.15 } = {}) {
  if (entries.length === 0) return [];
  const gaps = entries.slice(1).map((e, i) => entries[i].strength - e.strength);
  const sorted = [...gaps].sort((a, b) => a - b);
  const threshold = Math.max(minGap, sorted[Math.floor(sorted.length * percentile)] ?? Infinity);
  let tier = 1;
  return entries.map((e, i) => {
    if (i > 0 && gaps[i - 1] >= threshold) tier++;
    return tier;
  });
}

// Share of the "relevant" part of the board that has been compared enough.
export function boardProgress(board, { topN = 120, target = 3 } = {}) {
  const top = board.slice(0, topN);
  if (top.length === 0) return 0;
  const total = top.reduce((sum, e) => sum + Math.min(e.count, target), 0);
  return total / (top.length * target);
}
