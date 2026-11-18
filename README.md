# Draft Board Assistant

Build a personalised fantasy football draft board by answering "who would you rather draft?" two players at a time.

## Running

```sh
npm install
npm run dev      # http://localhost:5173 (also exposed on your LAN, so you can open it on your phone)
npm test         # core logic tests
npm run build    # static build in dist/
```

## How it works

- **Model:** Bradley-Terry with a Gaussian prior. Every player has a hidden strength; the chance you prefer A over B is `sigmoid(sA - sB)`. Before you make any picks, strengths come from consensus rank. Each pick pulls them towards your taste. The board is refit from the full pick log each time, so undo is exact and pick order doesn't matter.
- **Trust in consensus** (Settings) is the prior's standard deviation. Low lets a few picks move players a long way; high needs more evidence.
- **Choosing matchups** (`src/core/pairing.js`) favours players who are close together on your current board, have been compared least, rank high enough to matter, and haven't been asked about as a pair before.
- **Progress** is the share of the top 120 players who have been compared at least 3 times. About 180 picks gets you to 100%, but the board is usable much sooner.
- **Show ADP** (toggle on the Pick screen, or press A) shows consensus ADP next to "your ADP" (your board rank), both as round.pick for your league size, on the cards and in the info sheet. It is off by default so consensus doesn't sway your picks.
- **Tiers** start wherever the strength gap between neighbouring players is unusually large. A board with no picks yet is one tier, because consensus alone gives evenly spaced players.

## Project layout

```
src/core/      Pure JS, no React or DOM. Reusable as-is in a mobile app.
  ranking.js   fitting, board building, tiers, progress
  pairing.js   next-matchup selection
  players.js   ids, CSV import/export
  sleeper.js   Sleeper API fetch + transform, image URLs
  statLines.js which stats to show per position
  storage.js   persistence (localStorage, behind a 2-function interface)
src/data/      starter player pool
src/components React UI
```

## Player data

Players come from [Sleeper](https://sleeper.com)'s public API (no account or key needed):

- **On first launch** the app pulls the pool from Sleeper. After that it refreshes once a day, or whenever you tap *Refresh from Sleeper* in Settings.
- **Pool:** the top ~230 QB/RB/WR/TE plus 16 K and 16 DEF, taken by Sleeper ADP. Consensus rank is ADP for your chosen scoring format (PPR / Half / Standard).
- **Each player carries:** headshot, team, bye week (worked out from the schedule), injury status, years of experience, season projection and last season's stats.
- **The info sheet** (tap **i** on a card, or tap a row on the board) also fetches the current season's game log on demand. It shows season-to-date totals and a points-by-week chart.
- **Unofficial endpoints:** apart from `/v1/state`, the endpoints used (projections, stats, schedule) aren't officially documented. Sleeper's own site uses them, but they could change. All the Sleeper code is in `src/core/sleeper.js`.

**Fallbacks:**

- **Offline:** if Sleeper can't be reached on first launch, the app uses a built-in starter list (`src/data/defaultPlayers.js`).
- **Your own rankings:** you can still import a CSV (`name, pos, team, rank, bye`) in Settings. That replaces the Sleeper pool, so it has no photos or stats.
- **Picks carry over:** picks are keyed by name and position, so they survive a refresh or switching data source.

## Path to mobile

1. **Quickest:** the app is already a mobile-first PWA. "Add to Home Screen" works today.
2. **App stores, minimal changes:** wrap the build with [Capacitor](https://capacitorjs.com/). Swap `storage.js` to `@capacitor/preferences`.
3. **Fully native UI:** React Native / Expo. Reuse `src/core/` unchanged and rewrite only the three screens in `src/components/`.

## Deploying

It runs on the home server (`scaramanga.local`, in `~/draft-board`) as an nginx container bound to `127.0.0.1:8769`. The host's `cloudflared` service routes `draft.christrewartha.com` to that port (see `/etc/cloudflared/config.yml`).

To redeploy from this machine:

```sh
tar --exclude=node_modules --exclude=dist --exclude=.git -czf - . \
  | ssh scaramanga.local 'mkdir -p ~/draft-board && tar -xzf - -C ~/draft-board && cd ~/draft-board && docker compose up -d --build'
```

Picks are stored in the browser's localStorage, which is per-origin. Picks made on `localhost` or a LAN address won't show up at `draft.christrewartha.com`.
