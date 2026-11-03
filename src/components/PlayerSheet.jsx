import { useEffect, useState } from 'react';
import { fetchWeeklyStats, sumWeekly, teamLogoUrl, SCORING } from '../core/sleeper.js';
import { formatStat, pointsPerGame, statLines } from '../core/statLines.js';
import PlayerAvatar from './PlayerAvatar.jsx';
import WeeklyChart from './WeeklyChart.jsx';
import AdpCompare from './AdpCompare.jsx';

// Weekly logs are fetched on demand; keep them for the session so reopening is instant.
const weeklyCache = new Map();

function useWeekly(sleeperId, season) {
  const key = sleeperId && season ? `${sleeperId}:${season}` : null;
  const [state, setState] = useState(() => (key && weeklyCache.has(key) ? { weeks: weeklyCache.get(key) } : { loading: !!key }));

  useEffect(() => {
    if (!key || weeklyCache.has(key)) return;
    let cancelled = false;
    setState({ loading: true });
    fetchWeeklyStats(sleeperId, season)
      .then((weeks) => {
        weeklyCache.set(key, weeks);
        if (!cancelled) setState({ weeks });
      })
      .catch(() => !cancelled && setState({ error: true }));
    return () => { cancelled = true; };
  }, [key, sleeperId, season]);

  return state;
}

function injuryLabel(injury) {
  return [injury.status, injury.part].filter(Boolean).join(' · ');
}

export default function PlayerSheet({ entry, settings, source, onClose }) {
  const { scoring, showAdp, leagueSize } = settings;
  const { player } = entry;
  const currentSeason = source?.currentSeason;
  const weekly = useWeekly(player.sleeperId, currentSeason);
  const ytd = weekly.weeks ? sumWeekly(weekly.weeks) : null;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasStats = Boolean(player.proj || player.last);
  const columns = [
    player.proj && { title: `${source.season} proj`, stats: player.proj },
    player.last && { title: `${source.lastSeason}`, stats: player.last },
    currentSeason && { title: `${currentSeason} so far`, stats: ytd, pending: weekly.loading },
  ].filter(Boolean);

  const pts = `pts_${scoring}`;
  const rows = [
    { label: 'Fantasy pts', get: (s) => s?.[pts] },
    { label: 'Pts / game', get: (s) => pointsPerGame(s, scoring) },
    { label: 'Pos finish', get: (s) => (s?.[`pos_rank_${scoring}`] ? `${player.pos}${s[`pos_rank_${scoring}`]}` : null) },
    { label: 'Games', get: (s) => s?.gp },
    ...statLines(player.pos).map(({ label, key }) => ({ label, get: (s) => s?.[key] })),
  ];

  const logo = teamLogoUrl(player.team);
  const lastWeek = Math.max(0, (source?.currentWeek ?? 1) - 1, ...(weekly.weeks ?? []).map((w) => w.week));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={player.name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button className="sheet-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="sheet-header">
          <PlayerAvatar player={player} size={88} full />
          <div>
            <h2>{player.name}</h2>
            <div className="sheet-sub">
              <span className={`pos-badge pos-${player.pos}`}>{player.pos}</span>
              {logo && <img className="team-logo" src={logo} alt="" />}
              <span>{player.team || 'FA'}</span>
            </div>
            <div className="sheet-facts">
              {player.yearsExp != null && <span>{player.yearsExp === 0 ? 'Rookie' : `${player.yearsExp} yrs exp`}</span>}
              {player.bye && <span>Bye {player.bye}</span>}
            </div>
            {player.injury && <span className="injury-chip">{injuryLabel(player.injury)}</span>}
          </div>
        </div>

        {/* Consensus is hidden unless "Show ADP" is on, so it doesn't sway your picks. */}
        {showAdp ? (
          <AdpCompare entry={entry} scoring={scoring} leagueSize={leagueSize} />
        ) : (
          <div className="rank-chips">
            <div><strong>#{entry.boardRank}</strong><span>Your board</span></div>
            <div><strong>{player.pos}{entry.posRank}</strong><span>Your {player.pos} rank</span></div>
          </div>
        )}

        {hasStats ? (
          <>
            <h3>Stats <small>{SCORING[scoring].label}</small></h3>
            <table className="stat-table">
              <thead>
                <tr>
                  <th />
                  {columns.map((c) => <th key={c.title}>{c.title}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th>{r.label}</th>
                    {columns.map((c) => <td key={c.title}>{c.pending ? '…' : formatStat(r.get(c.stats))}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>

            {currentSeason && (
              <>
                <h3>{currentSeason} points by week</h3>
                {weekly.loading && <p className="hint">Loading game log…</p>}
                {weekly.error && <p className="hint">Couldn't load the game log.</p>}
                {weekly.weeks && (weekly.weeks.length ? (
                  <WeeklyChart weeks={weekly.weeks} lastWeek={lastWeek} bye={player.bye} scoring={scoring} />
                ) : <p className="hint">No games played yet this season.</p>)}
              </>
            )}
          </>
        ) : (
          <p className="hint">No stats for this player. Sync from Sleeper in Settings to get projections, last season and game logs.</p>
        )}
      </div>
    </div>
  );
}
