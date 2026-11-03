import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, fitStrengths, assignTiers, boardProgress } from './ranking.js';
import { pickPair, pairKey } from './pairing.js';
import { parsePlayerCsv, makePlayer, playerId } from './players.js';
import { DEFAULT_PLAYERS } from '../data/defaultPlayers.js';

const players = ['A', 'B', 'C', 'D', 'E'].map((name, i) => makePlayer({ name, pos: 'WR', rank: i + 1 }));
const id = (name) => playerId(name, 'WR');

// Deterministic RNG so pairing tests are repeatable.
function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('with no comparisons the board matches consensus', () => {
  const board = buildBoard(players, []);
  assert.deepEqual(board.map((e) => e.player.name), ['A', 'B', 'C', 'D', 'E']);
});

test('repeated preference lifts a player above consensus', () => {
  const comparisons = ['A', 'B', 'C', 'D'].flatMap((n) => [
    { a: id('E'), b: id(n), result: 1 },
    { a: id('E'), b: id(n), result: 1 },
  ]);
  const board = buildBoard(players, comparisons);
  assert.equal(board[0].player.name, 'E');
});

test('a single pick nudges but trusted consensus resists', () => {
  const comparisons = [{ a: id('E'), b: id('A'), result: 1 }];
  const board = buildBoard(players, comparisons, { priorSd: 0.6 });
  assert.notEqual(board[0].player.name, 'E');
});

test('comparisons shrink uncertainty and are counted', () => {
  const fit = fitStrengths(players, [{ a: id('A'), b: id('B'), result: 0.5 }]);
  assert.equal(fit.get(id('A')).count, 1);
  assert.ok(fit.get(id('A')).sd < fit.get(id('C')).sd);
});

test('fit converges on the full default pool with many comparisons', () => {
  const rng = seeded(7);
  const comparisons = [];
  for (let k = 0; k < 500; k++) {
    const i = Math.floor(rng() * 60);
    const j = Math.floor(rng() * 60);
    if (i !== j) comparisons.push({ a: DEFAULT_PLAYERS[i].id, b: DEFAULT_PLAYERS[j].id, result: rng() < 0.5 ? 1 : 0 });
  }
  const board = buildBoard(DEFAULT_PLAYERS, comparisons);
  assert.ok(board.every((e) => Number.isFinite(e.strength) && Number.isFinite(e.sd)));
});

test('evenly spaced consensus board is a single tier', () => {
  const tiers = assignTiers(buildBoard(DEFAULT_PLAYERS, []));
  assert.ok(tiers.every((t) => t === 1));
});

test('tiers emerge from preferences, start at 1 and never decrease', () => {
  const rng = seeded(11);
  const comparisons = [];
  for (let k = 0; k < 200; k++) {
    const i = Math.floor(rng() * 80);
    const j = Math.min(79, i + 1 + Math.floor(rng() * 5));
    comparisons.push({ a: DEFAULT_PLAYERS[i].id, b: DEFAULT_PLAYERS[j].id, result: rng() < 0.8 ? 1 : 0 });
  }
  const board = buildBoard(DEFAULT_PLAYERS, comparisons);
  const tiers = assignTiers(board);
  assert.equal(tiers[0], 1);
  assert.ok(tiers.every((t, i) => i === 0 || t >= tiers[i - 1]));
  assert.ok(tiers.at(-1) > 1);
});

test('pickPair returns two distinct players respecting focus', () => {
  const board = buildBoard(DEFAULT_PLAYERS, []);
  const rng = seeded(1);
  for (let k = 0; k < 50; k++) {
    const [a, b] = pickPair(board, { focus: 'TE', rng });
    assert.notEqual(a, b);
    assert.ok(a.startsWith('te-') && b.startsWith('te-'));
  }
});

test('pickPair avoids excluded players and repeats', () => {
  const board = buildBoard(players, []);
  const rng = seeded(3);
  const comparisons = [{ a: id('A'), b: id('B'), result: 1 }];
  for (let k = 0; k < 30; k++) {
    const pair = pickPair(board, { exclude: [id('C')], comparisons, rng });
    assert.ok(!pair.includes(id('C')));
  }
  const counts = new Map();
  for (let k = 0; k < 200; k++) {
    const key = pairKey(...pickPair(board, { comparisons, rng }));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.ok((counts.get(pairKey(id('A'), id('B'))) ?? 0) < 20);
});

test('progress grows with comparisons', () => {
  const before = boardProgress(buildBoard(players, []));
  const after = boardProgress(buildBoard(players, [{ a: id('A'), b: id('B'), result: 1 }]));
  assert.equal(before, 0);
  assert.ok(after > 0);
});

test('CSV import handles headers, quotes, positional ranks and bad rows', () => {
  const csv = `Rank,Player,Team,Pos,Bye
2,"Smith, Jr.",DAL,WR3,10
1,Jane Doe,KC,RB1,
3,Nobody,XX,LB,`;
  const { players: parsed, errors } = parsePlayerCsv(csv);
  assert.deepEqual(parsed.map((p) => [p.name, p.pos, p.rank, p.bye]), [
    ['Jane Doe', 'RB', 1, null],
    ['Smith, Jr.', 'WR', 2, 10],
  ]);
  assert.equal(errors.length, 1);
});

test('CSV import without header uses name,pos,team order', () => {
  const { players: parsed } = parsePlayerCsv('Josh Allen,QB,BUF\nBijan Robinson,RB,ATL');
  assert.equal(parsed[0].id, 'qb-josh-allen');
  assert.equal(parsed[1].rank, 2);
});

test('player ids strip accents and punctuation', () => {
  assert.equal(playerId("Ja'Marr Chase", 'WR'), 'wr-ja-marr-chase');
  assert.equal(playerId('José Núñez', 'RB'), 'rb-jose-nunez');
});

import { buildSleeperPool, byeWeeks, sumWeekly, fetchSleeperPool, headshotUrl } from './sleeper.js';
import { applyScoring } from './players.js';

const proj = (id, first, last, pos, team, adpHalf, adpPpr, extra = {}) => ({
  player_id: id,
  team,
  player: { first_name: first, last_name: last, position: pos, years_exp: 3, injury_status: null },
  stats: { adp_half_ppr: adpHalf, adp_ppr: adpPpr, adp_std: adpHalf, pts_half_ppr: 200, gp: 17, adp_dynasty: 999, ...extra },
});

const projections = [
  proj('2', 'Wide', 'Out', 'WR', 'CIN', 3, 1),
  proj('1', 'Run', 'Ning', 'RB', 'ATL', 1, 2),
  proj('9', 'No', 'Adp', 'WR', 'NYJ', 999, 999),
  proj('8', 'Free', 'Agent', 'RB', null, 5, 5),
  proj('HOU', 'Houston', 'Texans', 'DEF', 'HOU', 120, 120),
  proj('7', 'Line', 'Backer', 'LB', 'DAL', 50, 50),
];
const schedule = [
  { week: 1, home: 'CIN', away: 'ATL' },
  { week: 1, home: 'HOU', away: 'NYJ' },
  { week: 2, home: 'CIN', away: 'HOU' },
  { week: 3, home: 'ATL', away: 'HOU' },
  { week: 3, home: 'NYJ', away: 'CIN' },
];

test('byeWeeks finds the one missing week per team', () => {
  assert.deepEqual(byeWeeks(schedule), { ATL: 2, NYJ: 2 });
});

test('buildSleeperPool keeps ranked fantasy players with a team and attaches stats/byes', () => {
  const lastStats = [{ player_id: '1', stats: { pts_half_ppr: 300.5, gp: 17, pos_rank_half_ppr: 2, rush_yd: 1400, noise: 1 } }];
  const pool = buildSleeperPool({ projections, lastStats, schedule });
  assert.deepEqual(pool.map((p) => p.name), ['Run Ning', 'Wide Out', 'Houston Texans']);
  const rb = pool[0];
  assert.equal(rb.id, 'rb-run-ning');
  assert.equal(rb.sleeperId, '1');
  assert.equal(rb.bye, 2);
  assert.equal(rb.last.rush_yd, 1400);
  assert.equal(rb.last.noise, undefined);
  assert.equal(rb.proj.adp_dynasty, undefined);
  assert.deepEqual(rb.adp, { ppr: 2, half_ppr: 1, std: 1 });
  assert.equal(headshotUrl(pool[2]), 'https://sleepercdn.com/images/team_logos/nfl/hou.png');
});

test('applyScoring re-ranks by the chosen ADP', () => {
  const pool = buildSleeperPool({ projections });
  assert.deepEqual(applyScoring(pool, 'ppr').map((p) => p.name), ['Wide Out', 'Run Ning', 'Houston Texans']);
  assert.deepEqual(applyScoring(pool, 'ppr').map((p) => p.rank), [1, 2, 3]);
});

test('sumWeekly totals counting stats and skips ranks', () => {
  const total = sumWeekly([
    { week: 1, stats: { gp: 1, pts_ppr: 10.5, rec: 5, pos_rank_ppr: 3 } },
    { week: 2, stats: { gp: 1, pts_ppr: 20, rec: 7, pos_rank_ppr: 1 } },
  ]);
  assert.deepEqual(total, { gp: 2, pts_ppr: 30.5, rec: 12 });
  assert.equal(sumWeekly([]), null);
});

test('fetchSleeperPool falls back a season when ADP is not out yet', async () => {
  const calls = [];
  const many = Array.from({ length: 120 }, (_, i) => proj(String(100 + i), 'P', String(i), 'WR', 'KC', i + 1, i + 1));
  const fetchFn = async (url) => {
    calls.push(url.replace('https://api.sleeper.app', ''));
    const body = url.includes('/v1/state') ? { league_season: '2027', season: '2026', season_has_scores: false }
      : url.includes('/projections/nfl/2027') ? [proj('1', 'Run', 'Ning', 'RB', 'ATL', 999, 999)]
      : url.includes('/projections/nfl/2026') ? many
      : [];
    return { ok: true, json: async () => body };
  };
  const { players, source } = await fetchSleeperPool({ fetchFn });
  assert.equal(source.season, 2026);
  assert.equal(source.lastSeason, 2025);
  assert.equal(players.length, 120);
  assert.ok(calls.some((c) => c.startsWith('/stats/nfl/2025')));
});

import { formatStat } from './statLines.js';

test('formatStat handles numbers, decimals, labels and missing values', () => {
  assert.equal(formatStat(1400), '1,400');
  assert.equal(formatStat(13.444), '13.4');
  assert.equal(formatStat('DEF3'), 'DEF3');
  assert.equal(formatStat(null), '–');
});

import { consensusAdp, draftSlot } from './players.js';

test('draftSlot converts pick numbers to round.pick', () => {
  assert.equal(draftSlot(1, 12), '1.01');
  assert.equal(draftSlot(12, 12), '1.12');
  assert.equal(draftSlot(13, 12), '2.01');
  assert.equal(draftSlot(27.6, 12), '3.04');
  assert.equal(draftSlot(27.6, 10), '3.08');
});

test('consensusAdp uses ADP when known, otherwise consensus rank', () => {
  assert.equal(consensusAdp({ rank: 5, adp: { ppr: 3.2, half_ppr: 999 } }, 'ppr'), 3.2);
  assert.equal(consensusAdp({ rank: 5, adp: { ppr: 3.2, half_ppr: 999 } }, 'half_ppr'), 5);
  assert.equal(consensusAdp({ rank: 7 }, 'ppr'), 7);
});
