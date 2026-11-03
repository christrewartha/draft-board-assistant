// Persistence. Kept behind this tiny interface so a mobile build can swap
// localStorage for AsyncStorage / Capacitor Preferences without touching the UI.

const KEY = 'draft-board-assistant:v1';

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (e.g. private browsing) - the app still works in memory.
  }
}
