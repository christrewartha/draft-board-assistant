import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildBoard, boardProgress, TRUST_LEVELS } from './core/ranking.js';
import { applyScoring } from './core/players.js';
import { fetchSleeperPool } from './core/sleeper.js';
import { loadState, saveState } from './core/storage.js';
import { DEFAULT_PLAYERS } from './data/defaultPlayers.js';
import CompareView from './components/CompareView.jsx';
import BoardView from './components/BoardView.jsx';
import SettingsView from './components/SettingsView.jsx';
import PlayerSheet from './components/PlayerSheet.jsx';

const DAY = 24 * 60 * 60 * 1000;

// Merged into saved settings on every render, so settings added in a later version
// get their default even for state saved (or held in memory) before they existed.
const DEFAULT_SETTINGS = { trust: 'medium', focus: 'ALL', scoring: 'half_ppr', leagueSize: 12, showAdp: false };

const defaultState = () => ({
  players: DEFAULT_PLAYERS,
  source: { type: 'default' },
  comparisons: [],
  drafted: [],
  settings: DEFAULT_SETTINGS,
});

function initialState() {
  const saved = loadState();
  return saved ? { ...defaultState(), ...saved } : defaultState();
}

const TABS = [
  { id: 'compare', label: 'Pick', icon: '⇄' },
  { id: 'board', label: 'Board', icon: '☰' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState('compare');
  const [sync, setSync] = useState({ status: 'idle' });
  const [infoId, setInfoId] = useState(null);

  useEffect(() => saveState(state), [state]);

  const syncFromSleeper = useCallback(async () => {
    setSync({ status: 'loading' });
    try {
      const { players, source } = await fetchSleeperPool();
      setState((s) => ({ ...s, players, source }));
      setSync({ status: 'idle' });
    } catch (err) {
      setSync({ status: 'error', message: err.message });
    }
  }, []);

  // Pull from Sleeper on first launch, then refresh daily (injuries, team changes).
  // A CSV import is a deliberate choice, so never overwrite it automatically.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (autoSynced.current) return;
    autoSynced.current = true;
    const { source } = state;
    if (source.type === 'default' || (source.type === 'sleeper' && Date.now() - source.syncedAt > DAY)) {
      syncFromSleeper();
    }
  }, [state, syncFromSleeper]);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...state.settings }), [state.settings]);
  const { scoring } = settings;
  const players = useMemo(() => applyScoring(state.players, scoring), [state.players, scoring]);
  const priorSd = TRUST_LEVELS[settings.trust]?.priorSd ?? 1;
  const board = useMemo(
    () => buildBoard(players, state.comparisons, { priorSd }),
    [players, state.comparisons, priorSd],
  );
  const progress = useMemo(() => boardProgress(board), [board]);
  const infoEntry = infoId && board.find((e) => e.player.id === infoId);

  const update = (patch) => setState((s) => ({ ...s, ...patch }));
  const updateSettings = (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const actions = {
    record: (a, b, result) =>
      setState((s) => ({ ...s, comparisons: [...s.comparisons, { a, b, result, at: Date.now() }] })),
    undo: () => {
      const last = state.comparisons.at(-1);
      if (last) update({ comparisons: state.comparisons.slice(0, -1) });
      return last;
    },
    toggleDrafted: (id) =>
      setState((s) => ({
        ...s,
        drafted: s.drafted.includes(id) ? s.drafted.filter((d) => d !== id) : [...s.drafted, id],
      })),
    resetDraft: () => update({ drafted: [] }),
    resetPicks: () => update({ comparisons: [] }),
    importPlayers: (players) => update({ players, source: { type: 'csv', importedAt: Date.now() }, drafted: [] }),
    syncFromSleeper,
    resetAll: () => {
      setState(defaultState());
      syncFromSleeper();
    },
    showInfo: setInfoId,
    updateSettings,
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Draft Board Assistant</h1>
        <div className="progress" title="Share of the top 120 players compared at least 3 times">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span>
            {state.comparisons.length} picks · {Math.round(progress * 100)}%
          </span>
        </div>
        {sync.status === 'loading' && <div className="banner">Updating players from Sleeper…</div>}
        {sync.status === 'error' && (
          <div className="banner error">
            Couldn't reach Sleeper ({sync.message}).{' '}
            <button className="link" onClick={syncFromSleeper}>Retry</button>
          </div>
        )}
      </header>

      <main className="app-main">
        {tab === 'compare' && (
          <CompareView
            board={board}
            comparisons={state.comparisons}
            settings={settings}
            actions={actions}
            paused={infoEntry != null}
          />
        )}
        {tab === 'board' && <BoardView board={board} drafted={state.drafted} actions={actions} />}
        {tab === 'settings' && <SettingsView state={state} settings={settings} board={board} sync={sync} actions={actions} />}
      </main>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {infoEntry && (
        <PlayerSheet entry={infoEntry} settings={settings} source={state.source} onClose={() => setInfoId(null)} />
      )}
    </div>
  );
}
