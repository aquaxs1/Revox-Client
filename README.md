# Revox Client

Revox is a desktop launcher for the **official** Roblox client, built with Tauri 2,
React and TypeScript. It organizes your games, local profiles, playtime and
statistics around the official Roblox launch flow — without ever touching the
Roblox client itself.

The interface ships in German and English.

## What Revox does

- **Play screen** — a hero tile for the last played game, your bookmarked games,
  and the most recent sessions.
- **Library** — add games by Place ID or official Roblox link. Name, description,
  icon and player count come from the public Roblox catalog.
- **Local profiles** — separate favourites and playtime per profile, with per-profile
  playtime charts. No passwords, no cookies, no Roblox login.
- **Automatic playtime** — Revox watches for the Roblox player process after a
  launch and writes a real session when it ends.
- **Statistics** — playtime, distinct games played and a 14-day chart, filterable
  by profile.
- **Appearance** — dark, light or system theme, six accent colors, three density modes.

## Hard boundaries

These are built into the product, not options:

- Revox never stores Roblox passwords or `.ROBLOSECURITY` cookies.
- Revox never patches Roblox files, fonts or FastFlags.
- Revox never injects DLLs, hooks a graphics API or reads Roblox process memory.
- Revox never generates gameplay input, macros, cheats or exploits.
- Roblox is started **only** through a validated `roblox://placeId=<id>` URL.
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
npm run check                                   # 46 frontend tests + production build
cargo test --manifest-path src-tauri/Cargo.toml # 35 backend tests
```

## Architecture

| Layer | Location | Responsibility |
| --- | --- | --- |
| UI | `src/pages`, `src/components` | Screens, dialogs, shell |
| State | `src/state/AppStore.tsx` | Single store over the backend port |
| Port | `src/contracts/commands.ts` | The only surface the UI may use |
| Adapters | `src/services/` | Tauri adapter and in-memory adapter |
| Pure logic | `src/domain/` | Place ID parsing, statistics |
| Commands | `src-tauri/src/lib.rs` | Validated Tauri commands |
| Persistence | `src-tauri/src/db/` | SQLite with versioned migrations |
| OS access | `src-tauri/src/roblox/` | Detection, processes, hardware |
| Sessions | `src-tauri/src/session.rs` | Pure session state machine |
| Roblox API | `src-tauri/src/metadata.rs` | Public catalog lookups |

Both backend adapters implement the same `BackendPort`, so the browser preview
and the desktop app behave identically apart from the platform features noted
above.

## Logo

`src/components/Logo.tsx` draws the Revox mark as inline SVG. It is a hand-traced
approximation of the original artwork — drop the real vector file in and swap the
path when you have it.
