import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pickPair } from '../core/pairing.js';
import { pointsPerGame } from '../core/statLines.js';
import PositionFilter from './PositionFilter.jsx';
import PlayerAvatar from './PlayerAvatar.jsx';
import AdpCompare from './AdpCompare.jsx';

function quickFacts(player, scoring) {
  const facts = [];
  const proj = player.proj?.[`pts_${scoring}`];
  if (proj != null) facts.push(`Proj ${Math.round(proj)} pts`);
  const lastRank = player.last?.[`pos_rank_${scoring}`];
  const ppg = pointsPerGame(player.last, scoring);
  if (lastRank) facts.push(`Last yr ${player.pos}${lastRank}${ppg ? ` (${ppg.toFixed(1)} ppg)` : ''}`);
  return facts.join(' · ');
}

function PlayerCard({ entry, settings, onPick, onInfo, picked, hotkey }) {
  const { scoring, showAdp, leagueSize } = settings;
  const { player } = entry;
  const facts = quickFacts(player, scoring);
  return (
    <div className="player-card-wrap">
      <button className={`player-card pos-${player.pos} ${picked ? 'picked' : ''}`} onClick={onPick}>
        <PlayerAvatar player={player} size={84} />
        <span className="card-body">
          <span className="card-title">
            <span className={`pos-badge pos-${player.pos}`}>{player.pos}</span>
            {player.injury && <span className="injury-tag">{player.injury.status}</span>}
          </span>
          <span className="card-name">{player.name}</span>
          <span className="card-meta">
            {player.team || 'FA'}
            {player.bye ? ` · Bye ${player.bye}` : ''}
          </span>
          {facts && <span className="card-facts">{facts}</span>}
          {showAdp && <AdpCompare entry={entry} scoring={scoring} leagueSize={leagueSize} />}
        </span>
        <span className="card-hotkey">{hotkey}</span>
      </button>
      <button className="info-button" onClick={onInfo} aria-label={`More about ${player.name}`}>
        i
      </button>
    </div>
  );
}

export default function CompareView({ board, comparisons, settings, actions, paused }) {
  const [pair, setPair] = useState(null);
  const [picked, setPicked] = useState(null);
  const lastShown = useRef([]);

  const byId = useMemo(() => new Map(board.map((e) => [e.player.id, e])), [board]);
  const focus = settings.focus;

  // Draw a new pair whenever we don't have a valid one (after a pick, a focus change, or an import).
  useEffect(() => {
    if (pair && byId.has(pair[0]) && byId.has(pair[1])) return;
    setPair(pickPair(board, { focus, comparisons, exclude: lastShown.current }));
  }, [pair, board, byId, focus, comparisons]);

  const choose = useCallback(
    (result) => {
      if (!pair || picked !== null) return;
      const [a, b] = pair;
      if (result !== null) actions.record(a, b, result);
      lastShown.current = pair;
      setPicked(result);
      // Brief highlight so the tap feels acknowledged, then move on.
      setTimeout(() => {
        setPicked(null);
        setPair(null);
      }, result === null ? 0 : 180);
    },
    [pair, picked, actions],
  );

  const undo = useCallback(() => {
    const last = actions.undo();
    if (last) setPair([last.a, last.b]);
  }, [actions]);

  useEffect(() => {
    const onKey = (e) => {
      if (paused || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === '1') choose(1);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === '2') choose(0);
      else if (e.key === '=' || e.key === ' ') { e.preventDefault(); choose(0.5); }
      else if (e.key === 's') choose(null);
      else if (e.key === 'a') actions.updateSettings({ showAdp: !settings.showAdp });
      else if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, undo, paused, actions, settings.showAdp]);

  const a = pair && byId.get(pair[0]);
  const b = pair && byId.get(pair[1]);

  return (
    <div className="compare">
      <PositionFilter value={focus} onChange={(f) => { actions.updateSettings({ focus: f }); setPair(null); }} />
      <div className="prompt-row">
        <p className="prompt">Who would you rather draft?</p>
        <label className="toggle" title="Show where consensus and your board would draft each player">
          <input
            type="checkbox"
            checked={settings.showAdp}
            onChange={(e) => actions.updateSettings({ showAdp: e.target.checked })}
          />
          Show ADP
        </label>
      </div>

      {a && b ? (
        <div className="matchup">
          <PlayerCard
            entry={a}
            settings={settings}
            hotkey="1"
            picked={picked === 1}
            onPick={() => choose(1)}
            onInfo={() => actions.showInfo(a.player.id)}
          />
          <div className="versus">vs</div>
          <PlayerCard
            entry={b}
            settings={settings}
            hotkey="2"
            picked={picked === 0}
            onPick={() => choose(0)}
            onInfo={() => actions.showInfo(b.player.id)}
          />
        </div>
      ) : (
        <p className="empty">Not enough players to compare in this position.</p>
      )}

      <div className="compare-actions">
        <button onClick={undo} disabled={comparisons.length === 0}>↶ Undo</button>
        <button onClick={() => choose(0.5)} disabled={!pair}>Too close</button>
        <button onClick={() => choose(null)} disabled={!pair}>Skip</button>
      </div>
      <p className="hint desktop-only">Keys: 1 / 2 pick · space = too close · S skip · A show ADP · Backspace undo</p>
    </div>
  );
}
