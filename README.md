# Revox Client

Revox is a desktop launcher for the **official** Roblox client, built with Tauri 2,
React and TypeScript. It organizes your games, local profiles, playtime and
statistics around the official Roblox launch flow — without ever touching the
Roblox client itself.

The interface ships in German and English.

## What Revox does

- **Play screen** — a hero tile for the last played game, your bookmarked games,
  and the most recent sessions. Every past session can be rejoined, returning to
  the same server when Revox recorded which one it was.
- **Library** — add games by Place ID or official Roblox link. Name, description,
  icon and player count come from the public Roblox catalog.
- **Explorer** — a stats viewer for Roblox profiles, experiences and UGC/catalog
  items. It shows what the Roblox website shows, plus figures the site does not
  put in front of you: like ratio, visits per active player, account age,
  followers per friend, live server fill distribution, and the resale markup of
  a limited item over its original price. Anything worth revisiting goes on a
  local watchlist.
- **Friends** — link a public Roblox profile and Revox lists its friends with
  live presence, what they are playing, and a direct join into their server.
- **Local profiles** — separate favourites and playtime per profile, with per-profile
  playtime charts. No passwords, no cookies, no Roblox login.
- **Opt-in playtime tracking** — off until you turn it on. Once enabled, Revox
  watches for the Roblox player process after a launch and writes a real session
  when it ends.
- **Statistics** — playtime, distinct games played and a 14-day chart, filterable
  by profile.
- **Tray and autostart** — Revox can keep running in the notification area and
  start with Windows, so playtime is recorded even when the window is closed.
- **Friend notifications** — a desktop notification when a friend comes online
  or starts a game. Never fires on the first poll, so starting Revox does not
  produce a burst of them.
- **Discord Rich Presence** — opt-in, with your own Discord application ID.
  Revox stores no Discord token and fails soft when Discord is not running.
- **Watchlist history** — watched profiles, experiences and items are sampled
  every six hours, so the Explorer shows a trend and the change since the last
  reading rather than only a snapshot.
- **Server ranking** — the server list is ordered joinable-first, then by ping,
  then by how busy it is, and the best joinable server is marked.
- **Export** — sessions as CSV or JSON to a file you pick. Nothing is uploaded.
- **Signed updates** — the updater accepts only packages signed with the public
  key built into the app. See *Configuring updates* below.
- **Appearance** — dark, light or system theme, six accent colors, three density modes.

## Hard boundaries

These are built into the product, not options:

- Revox never stores Roblox passwords or `.ROBLOSECURITY` cookies.
- Revox never patches Roblox files, fonts or FastFlags.
- Revox never injects DLLs, hooks a graphics API or reads Roblox process memory.
- Revox never generates gameplay input, macros, cheats or exploits.
- Roblox is started **only** through a validated `roblox://placeId=<id>` URL,
  optionally with a validated `&gameInstanceId=<uuid>` to rejoin one server.
- Every Roblox lookup is unauthenticated. Data Roblox only shares with a
  signed-in session — a friend's server while their privacy hides it, a private
  inventory — comes back empty and is labelled as such.
- A local profile is a label you choose. Revox never claims to know which Roblox
  account is actually signed in.
- Anything that cannot be measured safely is shown as **Not available** rather
  than as an invented number. There is no sample data in the product.

## Running it

### Desktop app

Needs the Rust toolchain and the Tauri prerequisites for your platform.

```bash
npm install
npm run tauri dev
```

Native launching, Roblox detection, hardware readings and session tracking are
Windows features. On other platforms the app runs but reports those as
unavailable.

### Browser preview

```bash
npm install
npm run dev
```

Opens on `http://127.0.0.1:1420` against an in-memory backend that enforces the
same validation rules as the Rust one. Roblox metadata and hardware readings are
not available in a browser, and launching only reports the URL it *would* open.

## Checks

```bash
npm run check                                   # 99 frontend tests + production build
cargo test --manifest-path src-tauri/Cargo.toml # 80 backend tests
```

## Architecture

| Layer | Location | Responsibility |
| --- | --- | --- |
| UI | `src/pages`, `src/components` | Screens, dialogs, shell |
| State | `src/state/AppStore.tsx` | Single store over the backend port |
| Port | `src/contracts/commands.ts` | The only surface the UI may use |
| Adapters | `src/services/` | Tauri adapter and in-memory adapter |
| Pure logic | `src/domain/` | Place ID parsing, statistics, derived metrics |
| Commands | `src-tauri/src/lib.rs` | Validated Tauri commands |
| Persistence | `src-tauri/src/db/` | SQLite with versioned migrations |
| OS access | `src-tauri/src/roblox/` | Detection, processes, hardware |
| Sessions | `src-tauri/src/session.rs` | Pure session state machine |
| Notifications | `src-tauri/src/notifications.rs` | Pure friend-presence diff |
| History | `src-tauri/src/history.rs` | Which metrics to sample, and when |
| Export | `src-tauri/src/export.rs` | CSV and JSON serializers |
| Discord | `src-tauri/src/discord.rs` | Rich Presence, fails soft |
| Roblox API | `src-tauri/src/api/` | Public users, games and catalog lookups |

Both backend adapters implement the same `BackendPort`, so the browser preview
and the desktop app behave identically apart from the platform features noted
above.

### Roblox endpoints

All lookups go through Rust, never the WebView: Roblox blocks browser-origin
requests, and keeping them in Rust means no Roblox response can reach the page
without passing validation first. `users.roblox.com`, `friends.roblox.com`,
`presence.roblox.com`, `games.roblox.com`, `catalog.roblox.com`,
`economy.roblox.com`, `thumbnails.roblox.com` and `apis.roblox.com` are the only
hosts contacted. Thumbnail URLs are checked against an allowlist of Roblox CDN
hosts before being stored or rendered, and the window CSP permits exactly that
set.

Roblox's keyword search for experiences is the least stable endpoint Revox
touches. When it fails the UI says so and points at the Place-ID path, which
does not depend on it.

## Configuring updates

No release endpoint is committed, so a build made from this repository reports
**update source not configured** and stays fully usable. To enable updates:

1. `npm run tauri signer generate -- -w ~/.revox/updater.key` — keep the private
   key out of the repository and out of the installer.
2. Add the public key and your `latest.json` endpoint under `plugins.updater` in
   `src-tauri/tauri.conf.json`.
3. Sign releases with the private key; the app verifies the signature before it
   installs anything.

## Logo

`src/components/Logo.tsx` draws the Revox mark as inline SVG. It is a hand-traced
approximation of the original artwork — drop the real vector file in and swap the
path when you have it.
