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
- **Library** — add games by name, Place ID or official Roblox link. Typing a
  name searches Roblox and you pick from the results; a Place ID or link always
  resolves directly. Name, description, icon and player count come from the
  public Roblox catalog.
- **Explorer** — a stats viewer for Roblox profiles, experiences and UGC/catalog
  items. It shows what the Roblox website shows, plus figures the site does not
  put in front of you: like ratio, visits per active player, account age,
  followers per friend, live server fill distribution, and the resale markup of
  a limited item over its original price. Anything worth revisiting goes on a
  local watchlist.
- **Friends** — Revox reads the signed-in account from Roblox's own local logs
  and asks "is this you?", so linking is one click; otherwise pick your profile
  from a search with avatars. It then lists your friends with live presence,
  what they are playing, and a direct join into their server.
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
- **Discord Rich Presence** — a single switch. Revox ships its own Discord
  application, so there is no ID to register; power users can still override it.
  No Discord token is stored, and a closed Discord never blocks a launch.
- **Watchlist history** — watched profiles, experiences and items are sampled
  every six hours, so the Explorer shows a trend and the change since the last
  reading rather than only a snapshot.
- **Server ranking** — the server list is ordered joinable-first, then by ping,
  then by how busy it is, and the best joinable server is marked.
- **Export** — sessions as CSV or JSON to a file you pick. Nothing is uploaded.
- **Signed updates** — the updater accepts only packages signed with the public
  key built into the app. See *Configuring updates* below.
- **Setup wizard** — a five-step first run in the client's own style covering
  language, theme, the default switches and the optional Roblox link. Every
  choice is written the moment it is made, so quitting halfway still leaves a
  configured app.
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

## Getting the app

### 1. Download a release (no tools needed)

Releases are built and signed by GitHub Actions and published under
[Releases](https://github.com/aquaxs1/Revox-Client/releases):

- `Revox-Client_<version>_x64-setup.exe` — installer, German/English selector,
  installs per user without administrator rights.
- `Revox-Client-Portable.exe` — one file, no installation.

Both need the Microsoft Edge WebView2 runtime, which Windows 10 and 11 already
ship; the installer fetches it if it is missing.

### 2. Build it yourself with one double-click

Double-click **`Build-Revox.bat`** in the repository root. It checks for Node.js
and Rust, installs whatever is missing via `winget`, builds, and opens the
folder with the finished files.

> If `npm run tauri dev` printed **`failed to run 'cargo metadata' … program not
> found`**, that is exactly this: Tauri compiles a Rust program, and the Rust
> toolchain was not installed. Install it from [rustup.rs](https://rustup.rs),
> **open a new terminal window** so Windows picks it up, and try again — or just
> use the batch file, which handles it for you.

### 3. Build it from the command line

Needs Node.js 22+ and the Rust toolchain.

```bash
npm install
npm run tauri build     # installer + portable exe
npm run tauri dev       # run it with hot reload
```

Native launching, Roblox detection, hardware readings, the tray, notifications
and session tracking are Windows features. On other platforms the app runs but
reports them as unavailable.

### Browser preview (UI work only, no Rust needed)

```bash
npm install
npm run dev
```

Opens on `http://127.0.0.1:1420` against an in-memory backend that enforces the
same validation rules as the Rust one. Roblox lookups, hardware readings and
anything touching the operating system are unavailable there and say so.

## Checks

```bash
npm run check                                   # 104 frontend tests + production build
cargo test --manifest-path src-tauri/Cargo.toml # 89 backend tests
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
| Account hint | `src-tauri/src/roblox/account.rs` | Reads the signed-in user ID from Roblox's logs |

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

## Configuring Discord Rich Presence

Rich Presence needs one Discord application, registered once for the whole
project rather than per user. Create it at
<https://discord.com/developers/applications>, then paste its client ID into
`BUILT_IN_APPLICATION_ID` in `src-tauri/src/discord.rs`. A Discord application
ID is public by design — it travels in the clear during the RPC handshake — so
shipping it in the binary is exactly how other launchers do this.

While the constant is empty, the Discord section says so and the switch stays
harmless: it never silently fails.

## Releasing

`.github/workflows/release.yml` builds the Windows artefacts, signs them with
the updater key and publishes a GitHub Release. Start it either by pushing a tag
(`git tag v0.4.1 && git push origin v0.4.1`) or from **Actions → Release → Run
workflow**, where you just type the version.

It needs two repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | the contents of your minisign private key file |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | its password, or an empty string |

The matching public key is already committed in `src-tauri/tauri.conf.json`, and
the update endpoint points at this repository's latest release. The app verifies
the signature before installing anything, so a release signed with a different
key is rejected.

Never commit the private key. If it ever leaks, generate a new pair with
`npm run tauri signer generate`, replace the public key in the config, and ship
that as a normal download — old installs cannot auto-update across a key change.

## Building the website

`docs/website/README.md` is a standalone brief: every feature, the brand tokens,
the logo path, the suggested page structure and — importantly — the list of
things the site must not claim. A session with only that file can build the
site without reading this repository.

## Logo

`src/components/Logo.tsx` draws the Revox mark as inline SVG. It is a hand-traced
approximation of the original artwork — drop the real vector file in and swap the
path when you have it.
