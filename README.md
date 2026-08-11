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
npm run check                                   # 80 frontend tests + production build
cargo test --manifest-path src-tauri/Cargo.toml # 45 backend tests
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

## Logo

`src/components/Logo.tsx` draws the Revox mark as inline SVG. It is a hand-traced
approximation of the original artwork — drop the real vector file in and swap the
path when you have it.
