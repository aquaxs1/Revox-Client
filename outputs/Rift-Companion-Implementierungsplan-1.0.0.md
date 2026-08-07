# Rift Companion Comfort 1.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestandenen 0.3.0-Build um cookie-freien Serverkomfort, Discord Rich Presence, Screenshot-Bibliothek, echte Wochen-/Monatsstatistiken und einen signierten Updatefluss erweitern und als 1.0.0 ausliefern.

**Architecture:** Netzwerkmodule verwenden feste HTTPS-Hosts, strikte DTOs, Timeouts und Pagination. Discord, Screenshot-Watcher und Updater sind optionale Rust-Subsysteme, deren Fehler den Core nie blockieren. SQLite bleibt die Quelle fuer Statistiken und Metadaten; Originalbilder bleiben am Nutzerort.

**Tech Stack:** Bestehender 0.3.0-Stack, Tauri Updater/Process/HTTP APIs, Discord IPC/RPC library, filesystem watcher, image metadata/thumbnail library, SQLite, Vitest, Rust Tests, Playwright.

## Global Constraints

- Dieser Plan beginnt erst, wenn das 0.3.0 Completion Gate vollstaendig gruen ist.
- Roblox-Netzwerkzugriffe senden niemals Cookies, Passwoerter oder Browser-Sitzungsdaten.
- Nur feste Roblox-HTTPS-Hosts, validierte IDs und offizielle Join-/Browser-Ziele sind erlaubt.
- Discord speichert nur eine numerische Application ID, niemals Token.
- Der private Update-Signaturschluessel darf weder im Repository noch in `outputs` erscheinen.
- Externe Subsystemfehler duerfen Start, Bibliothek und lokale Sitzungsmessung nicht blockieren.

---

## Task 1: 1.0.0-Schema und sichere Roblox-Linktypen

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/migrations/0003_comfort.sql`
- Create: `src/domain/serverLinks.ts`
- Create: `src/domain/serverLinks.test.ts`
- Modify: `src/contracts/entities.ts`

**Interfaces:**

```ts
export interface ValidatedJoinTarget {
  placeId: string;
  serverId: string | null;
  privateLinkCode: string | null;
}
```

- [ ] Write failing tests for strict place/server IDs, Roblox host allowlist, HTTPS requirement, allowed private link code and removal of unknown query parameters.
- [ ] Run `npm test -- --run src/domain/serverLinks.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml --test migrations`; expect FAIL.
- [ ] Add `private_servers`, `screenshots`, screenshot folders and comfort settings migrations; set all version fields to `1.0.0`.
- [ ] Implement parsers returning structured data, never user-provided final URLs. Reconstruct an official target from validated fields.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test migrations` twice, `npm test -- --run src/domain/serverLinks.test.ts`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add . && git commit -m "feat: establish secure comfort data model"`.

## Task 2: Oeffentlicher Server-Browser, Rejoin und private Links

**Files:**
- Create: `src-tauri/src/servers/client.rs`
- Create: `src-tauri/src/servers/mod.rs`
- Create: `src-tauri/tests/server_client.rs`
- Create: `src/services/servers.ts`
- Create: `src/services/servers.test.ts`
- Create: `src/pages/Servers.tsx`
- Create: `src/pages/Servers.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**

```rust
pub trait ServerApi {
    async fn public_servers(&self, place_id: PlaceId, cursor: Option<Cursor>) -> Result<ServerPage, AppError>;
}
pub struct ServerPage { pub servers: Vec<PublicServer>, pub next_cursor: Option<String> }
```

- [ ] Write failing HTTP-contract tests for no Cookie header, fixed host, encoded cursor, timeout, 429, malformed response and pagination. Write UI tests for sort, retry and empty state.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test server_client` and `npm test -- --run src/services/servers.test.ts src/pages/Servers.test.tsx`; expect FAIL.
- [ ] Implement the public server client with a fresh cookie-free client and bounded timeout. Preserve server IDs only as validated opaque IDs.
- [ ] Implement local player-count sorting and pagination. Rejoin uses last validated server ID when present, otherwise only the place ID.
- [ ] Persist sanitized private link records and open reconstructed official targets through the existing safe launcher.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test server_client`, `npm test -- --run src/services/servers.test.ts src/pages/Servers.test.tsx`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: add safe roblox server tools"`.

## Task 3: Discord Rich Presence

**Files:**
- Create: `src-tauri/src/discord.rs`
- Create: `src-tauri/tests/discord_presence.rs`
- Create: `src/services/discord.ts`
- Create: `src/services/discord.test.ts`
- Create: `src/components/DiscordSettings.tsx`
- Create: `src/components/DiscordSettings.test.tsx`
- Modify: `src-tauri/src/session/monitor.rs`
- Modify: `src/pages/Settings.tsx`

**Interfaces:**

```rust
pub trait PresenceClient {
    fn connect(&mut self, application_id: u64) -> Result<(), AppError>;
    fn set(&mut self, activity: PresenceActivity) -> Result<(), AppError>;
    fn clear(&mut self) -> Result<(), AppError>;
}
```

- [ ] Write failing tests for numeric nonzero Application ID, opt-in per local account, set on session start, clear on finish/disable, and graceful missing Discord client.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test discord_presence` and `npm test -- --run src/services/discord.test.ts src/components/DiscordSettings.test.tsx`; expect FAIL.
- [ ] Implement local Discord IPC with application ID only. Presence contains game name, elapsed start timestamp and local profile label; no secrets or Roblox login claims.
- [ ] Keep failures as a module status and activity record; session tracking must continue.
- [ ] Add translated settings with default off and a clear privacy description.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test discord_presence`, `npm test -- --run src/services/discord.test.ts src/components/DiscordSettings.test.tsx`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: add optional discord rich presence"`.

## Task 4: Screenshot-Index, Watcher und Vorschaucache

**Files:**
- Create: `src-tauri/src/screenshots/index.rs`
- Create: `src-tauri/src/screenshots/watcher.rs`
- Create: `src-tauri/src/screenshots/thumbnail.rs`
- Create: `src-tauri/src/screenshots/mod.rs`
- Create: `src-tauri/tests/screenshots.rs`
- Create: `src/services/screenshots.ts`
- Create: `src/services/screenshots.test.ts`

**Interfaces:**

```rust
pub struct ScreenshotRecord {
    pub id: String,
    pub original_path: PathBuf,
    pub thumbnail_path: Option<PathBuf>,
    pub captured_at: DateTime<Utc>,
    pub width: u32,
    pub height: u32,
    pub missing: bool,
}
```

- [ ] Write failing temp-directory tests for PNG/JPEG/WebP import, duplicate canonical path, unsupported file, new watcher event, moved original and deterministic cache key.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test screenshots` and `npm test -- --run src/services/screenshots.test.ts`; expect FAIL.
- [ ] Canonicalize only user-approved folders/files. Store metadata without copying originals; create bounded thumbnails under app cache with orientation respected.
- [ ] Debounce watcher events, stop watchers cleanly and mark missing originals instead of deleting metadata.
- [ ] Expose list/filter/favorite/tag/remove-metadata commands without filesystem deletion of originals.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test screenshots`, `npm test -- --run src/services/screenshots.test.ts`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: index local screenshot folders"`.

## Task 5: Screenshot-Galerie

**Files:**
- Create: `src/pages/Screenshots.tsx`
- Create: `src/pages/Screenshots.test.tsx`
- Create: `src/components/ScreenshotGrid.tsx`
- Create: `src/components/ScreenshotGrid.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`
- Modify: `src/i18n/de.ts`
- Modify: `src/i18n/en.ts`

- [ ] Write failing tests for folder/file import, search, game/date filter, favorite, tags, open folder, remove metadata and missing-file state.
- [ ] Run `npm test -- --run src/pages/Screenshots.test.tsx src/components/ScreenshotGrid.test.tsx`; expect FAIL.
- [ ] Build a virtualizable, stable-aspect thumbnail grid with keyboard access and no nested cards. Use OS opener only for validated existing paths.
- [ ] Add empty/loading/error states and make missing originals visually clear without hiding metadata.
- [ ] Verify at 1440x900, 1024x720 and minimum app size with long German labels and 125% text scale.
- [ ] Run `npm test -- --run src/pages/Screenshots.test.tsx src/components/ScreenshotGrid.test.tsx`, `npm test -- --run`, and `npx playwright test tests/e2e/screenshots.spec.ts`; expect PASS.
- [ ] Commit: `git add src && git commit -m "feat: add screenshot library interface"`.

## Task 6: Wochen-/Monatsstatistik und gefilterter Export

**Files:**
- Create: `src-tauri/src/statistics.rs`
- Create: `src-tauri/tests/statistics.rs`
- Create: `src/domain/statistics.ts`
- Create: `src/domain/statistics.test.ts`
- Modify: `src/pages/Stats.tsx`
- Modify: `src/services/reports.ts`

**Interfaces:**

```ts
export interface StatisticsQuery {
  range: "week" | "month" | "custom";
  from: string;
  to: string;
  accountId: string | null;
  appProfileId: string;
  gameId: string | null;
}
```

- [ ] Write failing SQLite fixture tests for timezone boundaries, overlapping sessions, account/game filters, empty periods, totals and daily grouping. Add CSV/JSON filtered-export tests.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test statistics` and `npm test -- --run src/domain/statistics.test.ts`; expect FAIL.
- [ ] Implement parameterized aggregate queries using stored session timestamps and explicit local date boundaries supplied by the UI.
- [ ] Display week/month/account/game views using only database results. Empty periods return zero totals and empty series without division.
- [ ] Export exactly the active filter and include its range/profile metadata.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test statistics`, `npm test -- --run src/domain/statistics.test.ts`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: add real period statistics"`.

## Task 7: Signierter Updater und lokale Signaturpruefung

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/updater.rs`
- Create: `src-tauri/tests/updater_policy.rs`
- Create: `src/services/updater.ts`
- Create: `src/services/updater.test.ts`
- Create: `src/components/UpdateSettings.tsx`
- Create: `src/components/UpdateSettings.test.tsx`
- Create: `scripts/test-signed-update.ps1`

**Interfaces:**

```ts
export type UpdateState =
  | { kind: "unconfigured" }
  | { kind: "checking" }
  | { kind: "current"; checkedAt: string }
  | { kind: "available"; version: string; notes: string }
  | { kind: "downloading"; received: number; total: number | null }
  | { kind: "error"; code: string; message: string };
```

- [ ] Write failing policy tests for HTTPS-only endpoint, at-most-once-per-24-hours automatic check, explicit install confirmation, valid signature accepted and modified package rejected.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test updater_policy` and `npm test -- --run src/services/updater.test.ts src/components/UpdateSettings.test.tsx`; expect FAIL.
- [ ] Add Tauri updater/process plugins and minimum capabilities. Read a build-time endpoint plus embedded public key; an absent endpoint returns `unconfigured`.
- [ ] Implement check progress/error UI and never auto-install. Keep private signing keys outside repository and outputs; the script accepts the key path only through a process environment variable and validates that it is external.
- [ ] Run a local HTTPS fixture producing a signed `latest.json`; prove valid acceptance and invalid-signature rejection.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test updater_policy`, `npm test -- --run src/services/updater.test.ts src/components/UpdateSettings.test.tsx`, `powershell -ExecutionPolicy Bypass -File scripts/test-signed-update.ps1`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add package.json package-lock.json src src-tauri scripts && git commit -m "feat: add signed update workflow"`.

## Task 8: Vollstaendige Integration, Sicherheitspruefung und 1.0.0-Release

**Files:**
- Modify: `src/App.test.tsx`
- Create: `tests/e2e/comfort.spec.ts`
- Create: `tests/e2e/security-boundaries.spec.ts`
- Modify: `scripts/package-release.ps1`
- Modify: `README.md`
- Modify: `src/i18n/de.ts`
- Modify: `src/i18n/en.ts`

- [ ] Add failing full-flow tests for server retry, rejoin fallback, private link sanitization, Discord unavailable, new screenshot, period statistics and updater states.
- [ ] Add negative boundary tests attempting cookie input, non-Roblox host, `javascript:` URL, shell metacharacters, client-file path and unknown server ID; every attempt must be rejected before OS/network action.
- [ ] Run `npm test -- --run src/App.test.tsx` and `npx playwright test tests/e2e/comfort.spec.ts tests/e2e/security-boundaries.spec.ts`; expect FAIL before final integration wiring.
- [ ] Complete all translations and run the dictionary equality test.
- [ ] Run `npm run check`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `npx playwright test`; expect PASS at all configured viewports.
- [ ] Run the local valid/invalid signed update test, then scan repository and outputs for private-key markers and `.ROBLOSECURITY`; expect no secret material.
- [ ] Build NSIS and portable app, visibly test German/English installer and launch all main workflows on a clean current-user install.
- [ ] Produce `outputs/Rift-Companion-1.0.0-Setup.exe`, `outputs/Rift-Companion-1.0.0-Portable.exe`, `outputs/Rift-Companion-1.0.0-SHA256.txt` and a concise `outputs/Rift-Companion-1.0.0-Testbericht.md`.
- [ ] Commit: `git add . && git commit -m "release: build Rift Companion 1.0.0"`.

## 1.0.0 Completion Gate

- [ ] The 0.2.0 and 0.3.0 gates remain fully green.
- [ ] Server tools use only validated official targets and never send cookies.
- [ ] Discord presence sets/clears when available and fails without affecting sessions.
- [ ] New screenshots appear without restart; moved files remain represented as missing.
- [ ] Week/month totals match SQLite fixtures and filtered exports.
- [ ] Valid signed update is accepted and modified package rejected; private key is absent from all deliverables.
- [ ] German and English app plus installer are complete.
- [ ] Both final 1.0.0 executables, hashes and test report exist in `outputs` and the executables start successfully.
