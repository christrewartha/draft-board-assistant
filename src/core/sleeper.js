// Sleeper data source. Public, no auth, CORS-enabled.
// Note: only /v1/state is documented; the projections/stats/schedule endpoints
// are the ones sleeper.com itself uses and could change without notice.

import { applyScoring, makePlayer } from './players.js';

const API = 'https://api.sleeper.app';
const CDN = 'https://sleepercdn.com';

export const SCORING = {
  ppr: { label: 'PPR' },
  half_ppr: { label: 'Half PPR' },
  std: { label: 'Standard' },
};

const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const POOL_LIMITS = { skill: 230, K: 16, DEF: 16 };
const NO_ADP = 999;

// The subset of Sleeper's ~100 stat keys worth keeping on device.
const STAT_KEYS = [
  'gp', 'pts_ppr', 'pts_half_ppr', 'pts_std', 'pos_rank_ppr', 'pos_rank_half_ppr', 'pos_rank_std',
  'pass_yd', 'pass_td', 'pass_int', 'rush_att', 'rush_yd', 'rush_td', 'rec_tgt', 'rec', 'rec_yd', 'rec_td',
  'fgm', 'fga', 'xpm', 'sack', 'int', 'fum_rec', 'def_td', 'pts_allow',
];

export function headshotUrl(player, { full = false } = {}) {
  if (!player.sleeperId) return null;
  if (player.pos === 'DEF') return teamLogoUrl(player.team);
  return `${CDN}/content/nfl/players/${full ? '' : 'thumb/'}${player.sleeperId}.jpg`;
}

export function teamLogoUrl(team) {
  return team ? `${CDN}/images/team_logos/nfl/${team.toLowerCase()}.png` : null;
}

export function trimStats(stats) {
  if (!stats) return null;
  const out = {};
  for (const k of STAT_KEYS) if (stats[k] != null) out[k] = stats[k];
  return Object.keys(out).length ? out : null;
}

/** Bye week per team: the regular-season week a team doesn't appear in the schedule. */
export function byeWeeks(schedule) {
  const weeks = new Set();
  const played = new Map();
  for (const g of schedule) {
    weeks.add(g.week);
    for (const t of [g.home, g.away]) {
      if (!played.has(t)) played.set(t, new Set());
      played.get(t).add(g.week);
    }
  }
  const byes = {};
  for (const [team, ws] of played) {
    const missing = [...weeks].sort((a, b) => a - b).filter((w) => !ws.has(w));
    if (missing.length === 1) byes[team] = missing[0];
  }
  return byes;
}

const adpOf = (stats) => ({
  ppr: stats?.adp_ppr ?? NO_ADP,
  half_ppr: stats?.adp_half_ppr ?? NO_ADP,
  std: stats?.adp_std ?? NO_ADP,
});
const bestAdp = (adp) => Math.min(adp.ppr, adp.half_ppr, adp.std);

/**
 * Turn raw Sleeper responses into the app's player pool.
 * projections / lastStats: arrays from /projections|stats/nfl/{season}?position[]=...
 */
export function buildSleeperPool({ projections, lastStats = [], schedule = [] }) {
  const lastById = new Map(lastStats.map((r) => [r.player_id, r.stats]));
  const byes = byeWeeks(schedule);

  const rows = projections
    .filter((r) => r.player && FANTASY_POSITIONS.includes(r.player.position) && r.team)
    .map((r) => ({ r, adp: adpOf(r.stats) }))
    .filter(({ adp }) => bestAdp(adp) < NO_ADP)
    .sort((a, b) => bestAdp(a.adp) - bestAdp(b.adp));

  const taken = { skill: 0, K: 0, DEF: 0 };
  const pool = [];
  for (const { r, adp } of rows) {
    const bucket = r.player.position === 'K' || r.player.position === 'DEF' ? r.player.position : 'skill';
    if (taken[bucket] >= POOL_LIMITS[bucket]) continue;
    taken[bucket]++;
    const p = r.player;
    pool.push({
      ...makePlayer({
        name: `${p.first_name} ${p.last_name}`.trim(),
        pos: p.position,
        team: r.team,
        rank: pool.length + 1,
        bye: byes[r.team] ?? null,
      }),
      sleeperId: r.player_id,
      adp,
      yearsExp: p.years_exp ?? null,
      injury: p.injury_status ? { status: p.injury_status, part: p.injury_body_part ?? null } : null,
      // Sleeper's projection gp is unreliable (18, or 1 for defenses); a season is 17 games.
      proj: { ...trimStats(r.stats), gp: 17 },
      last: trimStats(lastById.get(r.player_id)),
    });
  }
  return applyScoring(pool, 'half_ppr');
}

async function getJson(fetchFn, path) {
  const res = await fetchFn(`${API}${path}`);
  if (!res.ok) throw new Error(`Sleeper ${path} failed (${res.status})`);
  return res.json();
}

const positionQuery = FANTASY_POSITIONS.map((p) => `position[]=${p}`).join('&');

/**
 * Fetch a fresh pool. Uses the upcoming/current league season for ADP and
 * projections, falling back a year if ADP for that season isn't out yet.
 */
export async function fetchSleeperPool({ fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  const state = await getJson(fetchFn, '/v1/state/nfl');
  let season = Number(state.league_season || state.season);

  let projections = await getJson(fetchFn, `/projections/nfl/${season}?season_type=regular&${positionQuery}&order_by=adp_half_ppr`);
  if (projections.filter((r) => (r.stats?.adp_half_ppr ?? NO_ADP) < NO_ADP).length < 100) {
    season -= 1;
    projections = await getJson(fetchFn, `/projections/nfl/${season}?season_type=regular&${positionQuery}&order_by=adp_half_ppr`);
  }
  const lastSeason = season - 1;
  const [lastStats, schedule] = await Promise.all([
    getJson(fetchFn, `/stats/nfl/${lastSeason}?season_type=regular&${positionQuery}&order_by=pts_half_ppr`),
    getJson(fetchFn, `/schedule/nfl/regular/${season}`).catch(() => []),
  ]);

  const players = buildSleeperPool({ projections, lastStats, schedule });
  if (players.length < 20) throw new Error('Sleeper returned too few players.');
  return {
    players,
    source: {
      type: 'sleeper',
      season,
      lastSeason,
      currentSeason: state.season_has_scores ? Number(state.season) : null,
      currentWeek: state.season_has_scores ? Number(state.week) : null,
      syncedAt: Date.now(),
    },
  };
}

/**
 * Week-by-week stats for one player in one season, fetched on demand for the info sheet.
 * Returns [{ week, stats }] sorted by week; bye/absent weeks are omitted by Sleeper.
 */
export async function fetchWeeklyStats(sleeperId, season, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  const data = await getJson(fetchFn, `/stats/nfl/player/${sleeperId}?season_type=regular&season=${season}&grouping=week`);
  return Object.entries(data ?? {})
    .filter(([, row]) => row?.stats)
    .map(([week, row]) => ({ week: Number(week), stats: row.stats }))
    .sort((a, b) => a.week - b.week);
}

/** Sum weekly rows into season-to-date totals (rank fields are dropped as they don't sum). */
export function sumWeekly(weeks) {
  const total = {};
  for (const { stats } of weeks) {
    for (const k of STAT_KEYS) {
      if (k.startsWith('pos_rank')) continue;
      if (stats[k] != null) total[k] = (total[k] ?? 0) + stats[k];
    }
  }
  return weeks.length ? total : null;
}
