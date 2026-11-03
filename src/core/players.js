// Player pool helpers: id generation and CSV import/export.

export function playerId(name, pos) {
  return `${pos}-${name}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function makePlayer({ name, pos, team = '', rank, bye = null }) {
  return { id: playerId(name, pos), name, pos, team, rank, bye };
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === '\t') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const VALID_POS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const POS_ALIASES = { DST: 'DEF', 'D/ST': 'DEF', D: 'DEF', PK: 'K' };

/**
 * Parse a CSV of players. Accepts an optional header row; recognised columns are
 * name, pos/position, team, rank, bye. Without a header, columns are assumed to
 * be name,pos,team[,rank][,bye]. Missing ranks fall back to row order.
 * Returns { players, errors }.
 */
export function parsePlayerCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors = [];
  if (lines.length === 0) return { players: [], errors: ['No rows found.'] };

  let cols = { name: 0, pos: 1, team: 2, rank: 3, bye: 4 };
  const first = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  if (first.includes('name') || first.includes('player')) {
    const find = (...names) => first.findIndex((h) => names.includes(h));
    cols = {
      name: find('name', 'player'),
      pos: find('pos', 'position'),
      team: find('team', 'tm'),
      rank: find('rank', 'rk', 'ecr', 'adp'),
      bye: find('bye', 'bye week'),
    };
    lines.shift();
    if (cols.name < 0 || cols.pos < 0) return { players: [], errors: ['Header needs at least "name" and "pos" columns.'] };
  }

  const players = [];
  const seen = new Set();
  lines.forEach((line, i) => {
    const f = splitCsvLine(line);
    const name = f[cols.name];
    const rawPos = (f[cols.pos] ?? '').toUpperCase().replace(/\d+$/, ''); // "WR12" -> "WR"
    const pos = POS_ALIASES[rawPos] ?? rawPos;
    if (!name || !VALID_POS.has(pos)) {
      errors.push(`Row ${i + 1}: skipped (need a name and a position of ${[...VALID_POS].join('/')}).`);
      return;
    }
    const rank = Number(f[cols.rank]);
    const bye = Number(f[cols.bye]);
    const player = makePlayer({
      name,
      pos,
      team: cols.team >= 0 ? (f[cols.team] ?? '').toUpperCase() : '',
      rank: Number.isFinite(rank) && rank > 0 ? rank : players.length + 1,
      bye: Number.isFinite(bye) && bye > 0 ? bye : null,
    });
    if (seen.has(player.id)) {
      errors.push(`Row ${i + 1}: duplicate ${name} (${pos}) ignored.`);
      return;
    }
    seen.add(player.id);
    players.push(player);
  });

  // Normalise to 1..N so the prior is well defined even if ranks had gaps or ties.
  players.sort((a, b) => a.rank - b.rank).forEach((p, i) => { p.rank = i + 1; });
  return { players, errors };
}

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function boardToCsv(board, tiers) {
  const rows = [['rank', 'tier', 'name', 'pos', 'pos_rank', 'team', 'bye', 'consensus_rank']];
  board.forEach((e, i) => {
    const p = e.player;
    rows.push([e.boardRank, tiers[i], p.name, p.pos, `${p.pos}${e.posRank}`, p.team, p.bye ?? '', p.rank]);
  });
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

/**
 * Re-rank the pool by ADP for the chosen scoring format. Players without
 * ADP for that format (e.g. CSV imports) keep their relative order at the end.
 */
export function applyScoring(players, scoring) {
  const adp = (p) => p.adp?.[scoring] ?? 999;
  return [...players]
    .sort((a, b) => adp(a) - adp(b) || a.rank - b.rank)
    .map((p, i) => (p.rank === i + 1 ? p : { ...p, rank: i + 1 }));
}

/** Consensus ADP for the scoring format, falling back to consensus rank for sources without ADP. */
export function consensusAdp(player, scoring) {
  const adp = player.adp?.[scoring];
  return adp != null && adp < 999 ? adp : player.rank;
}

/** Overall pick number -> "round.pick" for a given league size, e.g. 28 in a 12-team league -> "3.04". */
export function draftSlot(pick, leagueSize) {
  const n = Math.max(1, Math.round(pick));
  const round = Math.floor((n - 1) / leagueSize) + 1;
  const inRound = ((n - 1) % leagueSize) + 1;
  return `${round}.${String(inRound).padStart(2, '0')}`;
}
