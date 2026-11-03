import { useState } from 'react';
import { assignTiers, TRUST_LEVELS } from '../core/ranking.js';
import { boardToCsv, parsePlayerCsv } from '../core/players.js';
import { SCORING } from '../core/sleeper.js';

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function sourceDescription(source) {
  if (source.type === 'sleeper') {
    return `Sleeper: ${source.season} ADP & projections, ${source.lastSeason} stats. Updated ${new Date(source.syncedAt).toLocaleString()}.`;
  }
  if (source.type === 'csv') return `Imported from CSV on ${new Date(source.importedAt).toLocaleDateString()}. No stats or photos.`;
  return 'Built-in starter list (offline fallback). No stats or photos.';
}

export default function SettingsView({ state, settings, board, sync, actions }) {
  const [csv, setCsv] = useState('');
  const [importMsg, setImportMsg] = useState(null);

  const importPlayers = () => {
    const { players, errors } = parsePlayerCsv(csv);
    if (players.length < 2) {
      setImportMsg({ ok: false, text: errors[0] ?? 'Need at least two players.' });
      return;
    }
    if (!confirm(`Replace the player pool with ${players.length} players? Picks for players that are still in the pool are kept.`)) return;
    actions.importPlayers(players);
    setCsv('');
    setImportMsg({
      ok: true,
      text: `Imported ${players.length} players.${errors.length ? ` ${errors.length} row(s) skipped: ${errors.slice(0, 3).join(' ')}` : ''}`,
    });
  };

  const readFile = async (file) => {
    if (file) setCsv(await file.text());
  };

  return (
    <div className="settings">
      <section>
        <h2>Player data</h2>
        <p className="hint">{sourceDescription(state.source)}</p>
        <button onClick={actions.syncFromSleeper} disabled={sync.status === 'loading'}>
          {sync.status === 'loading' ? 'Syncing…' : state.source.type === 'sleeper' ? 'Refresh from Sleeper' : 'Load from Sleeper'}
        </button>
        {sync.status === 'error' && <p className="error">{sync.message}</p>}
      </section>

      <section>
        <h2>Scoring</h2>
        <p className="hint">Sets which ADP is used as consensus and which points are shown.</p>
        <div className="segmented">
          {Object.entries(SCORING).map(([key, { label }]) => (
            <button
              key={key}
              className={settings.scoring === key ? 'active' : ''}
              onClick={() => actions.updateSettings({ scoring: key })}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>League size</h2>
        <p className="hint">Used to show ADP as round.pick (e.g. 3.04) when "Show ADP" is on.</p>
        <div className="segmented">
          {[8, 10, 12, 14].map((n) => (
            <button
              key={n}
              className={settings.leagueSize === n ? 'active' : ''}
              onClick={() => actions.updateSettings({ leagueSize: n })}
            >
              {n} teams
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Trust in consensus</h2>
        <p className="hint">
          How strongly the board sticks to consensus rankings. Low lets a few picks move players a long way; high needs
          lots of evidence before a player moves.
        </p>
        <div className="segmented">
          {Object.entries(TRUST_LEVELS).map(([key, { label }]) => (
            <button
              key={key}
              className={settings.trust === key ? 'active' : ''}
              onClick={() => actions.updateSettings({ trust: key })}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Export board</h2>
        <button
          onClick={() => download('draft-board.csv', boardToCsv(board, assignTiers(board)))}
        >
          Download CSV
        </button>
      </section>

      <section>
        <h2>Import rankings</h2>
        <p className="hint">
          Prefer another site's rankings over Sleeper ADP? Paste or upload a CSV to use as consensus instead. This
          replaces the Sleeper pool, so photos and stats won't be shown. Columns: <code>name, pos, team, rank, bye</code> (header row optional, rank and
          bye optional — row order is used as rank).
        </p>
        <textarea
          rows={6}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={'name,pos,team,rank\nJa\'Marr Chase,WR,CIN,1\nBijan Robinson,RB,ATL,2'}
        />
        <div className="row-buttons">
          <label className="file-button">
            Choose file
            <input type="file" accept=".csv,.txt,text/csv" onChange={(e) => readFile(e.target.files[0])} />
          </label>
          <button onClick={importPlayers} disabled={!csv.trim()}>
            Import
          </button>
        </div>
        {importMsg && <p className={importMsg.ok ? 'ok' : 'error'}>{importMsg.text}</p>}
      </section>

      <section>
        <h2>Reset</h2>
        <div className="row-buttons">
          <button
            className="danger"
            disabled={state.comparisons.length === 0}
            onClick={() => confirm(`Delete all ${state.comparisons.length} picks?`) && actions.resetPicks()}
          >
            Clear picks
          </button>
          <button
            className="danger"
            onClick={() => confirm('Reset everything, including imported players?') && actions.resetAll()}
          >
            Reset everything
          </button>
        </div>
      </section>
    </div>
  );
}
