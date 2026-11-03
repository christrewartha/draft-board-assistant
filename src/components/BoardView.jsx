import { useMemo, useState } from 'react';
import { assignTiers, POSITIONS } from '../core/ranking.js';
import PositionFilter from './PositionFilter.jsx';
import PlayerAvatar from './PlayerAvatar.jsx';

function Movement({ from, to }) {
  const delta = from - to;
  if (delta === 0) return <span className="move none">–</span>;
  return <span className={`move ${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? `▲${delta}` : `▼${-delta}`}</span>;
}

export default function BoardView({ board, drafted, actions }) {
  const [focus, setFocus] = useState('ALL');
  const [draftMode, setDraftMode] = useState(false);
  const [hideDrafted, setHideDrafted] = useState(false);
  const draftedSet = useMemo(() => new Set(drafted), [drafted]);

  // Tiers are computed on the filtered list so positional views get their own breaks.
  const filtered = useMemo(() => (focus === 'ALL' ? board : board.filter((e) => e.player.pos === focus)), [board, focus]);
  const tiers = useMemo(() => assignTiers(filtered), [filtered]);

  const rows = filtered
    .map((entry, i) => ({ entry, tier: tiers[i] }))
    .filter(({ entry }) => !(hideDrafted && draftedSet.has(entry.player.id)));

  const bestAvailable = POSITIONS.map((pos) => board.find((e) => e.player.pos === pos && !draftedSet.has(e.player.id))).filter(Boolean);

  return (
    <div className="board">
      <PositionFilter value={focus} onChange={setFocus} />

      <div className="board-toolbar">
        <label className="toggle">
          <input type="checkbox" checked={draftMode} onChange={(e) => setDraftMode(e.target.checked)} />
          Draft mode
        </label>
        {draftMode && (
          <>
            <label className="toggle">
              <input type="checkbox" checked={hideDrafted} onChange={(e) => setHideDrafted(e.target.checked)} />
              Hide taken
            </label>
            <button
              className="link"
              onClick={() => confirm('Clear all drafted marks?') && actions.resetDraft()}
              disabled={drafted.length === 0}
            >
              Reset
            </button>
          </>
        )}
      </div>

      {draftMode && (
        <div className="best-available">
          {bestAvailable.map((e) => (
            <button key={e.player.id} className="ba-item" onClick={() => actions.showInfo(e.player.id)}>
              <PlayerAvatar player={e.player} size={28} />
              <span className={`pos-badge pos-${e.player.pos}`}>{e.player.pos}</span>
              <span className="ba-name">{e.player.name}</span>
            </button>
          ))}
        </div>
      )}
      <p className="hint">
        {draftMode ? 'Tap a player when they get drafted. Tap i for details.' : 'Tap a player for stats.'}
      </p>

      <ol className="board-list">
        {rows.map(({ entry, tier }, i) => {
          const p = entry.player;
          const isTaken = draftedSet.has(p.id);
          const newTier = i === 0 || tier !== rows[i - 1].tier;
          const rank = focus === 'ALL' ? entry.boardRank : entry.posRank;
          const consensus = focus === 'ALL' ? p.rank : entry.consensusPosRank;
          return (
            <li key={p.id} className={isTaken ? 'taken' : ''}>
              {newTier && <div className="tier-label">Tier {tier}</div>}
              <div
                className="board-row tappable"
                onClick={() => (draftMode ? actions.toggleDrafted(p.id) : actions.showInfo(p.id))}
              >
                <span className="row-rank">{rank}</span>
                <PlayerAvatar player={p} size={38} />
                <span className="row-name">
                  {p.name}
                  <small>
                    <span className={`pos-badge small pos-${p.pos}`}>
                      {p.pos}
                      {entry.posRank}
                    </span>
                    {p.team || 'FA'}
                    {p.bye ? ` · Bye ${p.bye}` : ''}
                    {p.injury && <span className="injury-tag">{p.injury.status}</span>}
                  </small>
                </span>
                <Movement from={consensus} to={rank} />
                {draftMode && (
                  <button
                    className="info-button inline"
                    aria-label={`More about ${p.name}`}
                    onClick={(e) => { e.stopPropagation(); actions.showInfo(p.id); }}
                  >
                    i
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
