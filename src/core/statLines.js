// Which stats to show for each position, in display order.

const LINES = {
  QB: [['Pass yds', 'pass_yd'], ['Pass TD', 'pass_td'], ['INT', 'pass_int'], ['Rush yds', 'rush_yd'], ['Rush TD', 'rush_td']],
  RB: [['Carries', 'rush_att'], ['Rush yds', 'rush_yd'], ['Rush TD', 'rush_td'], ['Rec', 'rec'], ['Rec yds', 'rec_yd'], ['Rec TD', 'rec_td']],
  WR: [['Targets', 'rec_tgt'], ['Rec', 'rec'], ['Rec yds', 'rec_yd'], ['Rec TD', 'rec_td'], ['Rush yds', 'rush_yd']],
  TE: [['Targets', 'rec_tgt'], ['Rec', 'rec'], ['Rec yds', 'rec_yd'], ['Rec TD', 'rec_td']],
  K: [['FG made', 'fgm'], ['FG att', 'fga'], ['XP made', 'xpm']],
  DEF: [['Sacks', 'sack'], ['INT', 'int'], ['Fum rec', 'fum_rec'], ['Def TD', 'def_td'], ['Pts allowed', 'pts_allow']],
};

export function statLines(pos) {
  return (LINES[pos] ?? []).map(([label, key]) => ({ label, key }));
}

export function formatStat(value) {
  if (value == null) return '–';
  if (typeof value !== 'number') return String(value);
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

/** Fantasy points per game, or null when games played is unknown. */
export function pointsPerGame(stats, scoring) {
  const pts = stats?.[`pts_${scoring}`];
  return pts != null && stats.gp ? pts / stats.gp : null;
}
