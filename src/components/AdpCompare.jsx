import { consensusAdp, draftSlot } from '../core/players.js';

// Consensus ADP next to "your ADP" (where the player sits on your board), both
// as round.pick so players at different positions can be compared directly.
export default function AdpCompare({ entry, scoring, leagueSize }) {
  const { player } = entry;
  const consensus = consensusAdp(player, scoring);
  const hasAdp = (player.adp?.[scoring] ?? 999) < 999;
  return (
    <span className="adp-compare">
      <span className="adp-cell">
        <span className="adp-label">Consensus</span>
        <span className="adp-slot">{draftSlot(consensus, leagueSize)}</span>
        <span className="adp-detail">
          {hasAdp ? `ADP ${consensus.toFixed(1)}` : `#${player.rank}`} · {player.pos}
          {entry.consensusPosRank}
        </span>
      </span>
      <span className="adp-cell mine">
        <span className="adp-label">You</span>
        <span className="adp-slot">{draftSlot(entry.boardRank, leagueSize)}</span>
        <span className="adp-detail">
          #{entry.boardRank} · {player.pos}
          {entry.posRank}
        </span>
      </span>
    </span>
  );
}
