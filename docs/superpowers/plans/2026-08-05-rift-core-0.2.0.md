# Rift Companion Core 0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den vorhandenen Prototyp in ein dauerhaft speicherndes, deutsch/englisch lokalisiertes Windows-Programm mit echter Roblox-Erkennung, Sitzungsmessung, Profilen, Bibliothek und Darstellungseinstellungen ausbauen.

**Architecture:** React greift nur ueber typisierte Service-Ports auf Daten und Tauri-Befehle zu. Rust besitzt Betriebssystemgrenzen und die SQLite-Datenbank. Browser-Tests verwenden deterministische In-Memory-Adapter; der Produktions-Build verwendet weder Mockdaten noch `localStorage` als Produktdatenquelle.

**Tech Stack:** Tauri 2, Rust 2021, React 19, TypeScript 5.7, Vitest, Testing Library, SQLite via `tauri-plugin-sql`, `sysinfo`, NSIS.

## Global Constraints

- Keine Cookies, Passwoerter, Client-Patches, FastFlags, DLL-Injection, Hooks, Speicherinspektion, Makros oder Cheats.
- Roblox-Starts verwenden nur validierte Place-IDs und `roblox://placeId=<id>`.
- Nicht messbare Werte werden als `unavailable` modelliert und nie erfunden.
- Alle sichtbaren Texte existieren mit identischen Schluesseln in Deutsch und Englisch.
- Jede Aufgabe folgt Red-Green-Refactor und endet mit den genannten Tests.
- Bestehende Nutzerdateien und unabhaengige Aenderungen bleiben unangetastet.

---

## Task 1: Release-Basis, Installer-Sprachauswahl und i18n

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Create: `src/i18n/types.ts`
- Create: `src/i18n/de.ts`
- Create: `src/i18n/en.ts`
- Create: `src/i18n/index.tsx`
- Create: `src/i18n/i18n.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**

```ts
export type Locale = "de" | "en";
export type TranslationKey = keyof typeof de;
export interface I18nContextValue {
  locale: Locale;
  setLocale(locale: Locale): Promise<void>;
  t(key: TranslationKey, values?: Record<string, string | number>): string;
}
```

- [ ] Write failing tests proving German and English have identical keys, interpolation works, and `setLocale("en")` changes rendered text without reload.

```ts
it("keeps locale dictionaries structurally identical", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
});
```

- [ ] Run `npm test -- --run src/i18n/i18n.test.tsx`; expect FAIL because the i18n module does not exist.
- [ ] Add the typed dictionaries and provider. Use `navigator.language.startsWith("de") ? "de" : "en"` only until persisted settings load.
- [ ] Set all three version fields to `0.2.0`. Add dependencies `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-opener`; add matching Rust plugins plus `sysinfo`, `rusqlite` test support and `thiserror`.
- [ ] Configure NSIS exactly as follows:

```json
"windows": {
  "nsis": {
    "installMode": "currentUser",
    "languages": ["German", "English"],
    "displayLanguageSelector": true
  }
}
```

- [ ] Register only the required plugins and capabilities. Do not grant shell execution.
- [ ] Run `npm test -- --run src/i18n/i18n.test.tsx`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add package.json package-lock.json src src-tauri && git commit -m "feat: establish localized 0.2 release foundation"`.

## Task 2: Gemeinsame Vertraege und Fehlergrenze

**Files:**
- Create: `src/contracts/entities.ts`
- Create: `src/contracts/commands.ts`
- Create: `src/services/backend.ts`
- Create: `src/services/backend.test.ts`
- Create: `src-tauri/src/error.rs`
- Create: `src-tauri/src/contracts.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**

```ts
export type Availability<T> =
  | { status: "available"; value: T }
  | { status: "unavailable"; reason: string }
  | { status: "error"; code: string; message: string };

export interface BackendPort {
  getBootstrap(): Promise<AppBootstrap>;
  saveSettings(input: SettingsInput): Promise<AppSettings>;
  getRobloxStatus(): Promise<RobloxStatus>;
  launchRoblox(input: LaunchRequest): Promise<LaunchReceipt>;
}
```

- [ ] Write failing adapter tests that assert camelCase TypeScript payloads, typed rejection mapping, and no fallback to sample data.
- [ ] Run `npm test -- --run src/services/backend.test.ts`; expect FAIL because `BackendPort` and the adapter do not exist.
- [ ] Implement one `invokeBackend` boundary that maps Rust `{ code, message }` errors to `BackendError`; pages must never import Tauri `invoke` directly.
- [ ] Add serializable Rust DTOs with `#[serde(rename_all = "camelCase")]` and `AppError { code, message }`.
- [ ] Add a Rust contract serialization test for `RobloxStatus` and one error serialization test.
- [ ] Run `npm test -- --run src/services/backend.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml contracts`; expect PASS.
- [ ] Commit: `git add src/contracts src/services src-tauri/src && git commit -m "feat: add typed frontend backend contracts"`.

## Task 3: SQLite-Migrationen und Repositories

**Files:**
- Create: `src-tauri/migrations/0001_core.sql`
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/migrations.rs`
- Create: `src-tauri/src/db/repository.rs`
- Create: `src-tauri/tests/migrations.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**

```rust
pub trait Repository: Send + Sync {
    fn bootstrap(&self) -> Result<AppBootstrap, AppError>;
    fn upsert_account(&self, input: AccountInput) -> Result<AccountProfile, AppError>;
    fn delete_account(&self, id: &str, keep_stats: bool) -> Result<(), AppError>;
    fn upsert_game(&self, input: GameInput) -> Result<Game, AppError>;
    fn finish_session(&self, input: FinishedSession) -> Result<Session, AppError>;
}
```

- [ ] Write migration tests against a temporary SQLite file: first run creates all Stage-1 tables; second run is idempotent; duplicate `(app_profile_id, place_id)` is rejected; foreign keys are enabled.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test migrations`; expect FAIL because migration code is absent.
- [ ] Create `app_profiles`, `account_profiles`, `games`, `collections`, `collection_games`, `account_games`, `performance_profiles`, `sessions`, `activities`, `settings`, and `schema_migrations` in one transaction.
- [ ] Implement repository methods with prepared statements and transactions for multi-table writes. Seed only default performance templates and one app profile; do not seed games, sessions, hardware, or accounts.
- [ ] Initialize the database under Tauri app data and expose it through managed state.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test migrations` twice, then `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS on all three commands.
- [ ] Commit: `git add src-tauri && git commit -m "feat: persist core data in sqlite"`.

## Task 4: Roblox-Eingabe, Installationserkennung und offizieller Start

**Files:**
- Modify: `src/domain/roblox.ts`
- Modify: `src/domain/roblox.test.ts`
- Create: `src-tauri/src/roblox/mod.rs`
- Create: `src-tauri/src/roblox/windows.rs`
- Create: `src-tauri/tests/roblox_detection.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/services/launcher.ts`
- Modify: `src/services/launcher.test.ts`

**Interfaces:**

```rust
pub enum RobloxState { Ready, NotFound, Running, CheckFailed }
pub trait RobloxSystem {
    fn protocol_command(&self) -> Result<Option<String>, AppError>;
    fn known_installations(&self) -> Result<Vec<PathBuf>, AppError>;
    fn running_processes(&self) -> Result<Vec<ProcessIdentity>, AppError>;
    fn open_uri(&self, uri: &str) -> Result<(), AppError>;
}
```

- [ ] Extend failing tests for Place-IDs: accept 1 to 20 ASCII digits; reject zero-length, 21 digits, signs, whitespace and Unicode digits. Accept only HTTPS `roblox.com`/`www.roblox.com` game URLs.
- [ ] Add deterministic Rust fake-system tests for the four Roblox states and for opening exactly `roblox://placeId=123456`.
- [ ] Run `npm test -- --run src/domain/roblox.test.ts src/services/launcher.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml --test roblox_detection`; expect FAIL on the new cases.
- [ ] Implement Windows Registry protocol lookup plus known `%LOCALAPPDATA%/Roblox/Versions` inspection. Treat evidence as status only; the launch still uses the official protocol.
- [ ] Validate again in Rust before opening. Persist every launch attempt to `activities`, including error code and selected local profile ID.
- [ ] Run `npm test -- --run src/domain/roblox.test.ts src/services/launcher.test.ts`, `cargo test --manifest-path src-tauri/Cargo.toml --test roblox_detection`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src/domain src/services src-tauri && git commit -m "feat: detect and launch official roblox client"`.

## Task 5: Sitzungszustandsautomat und reale Spielzeit

**Files:**
- Create: `src-tauri/src/session/state_machine.rs`
- Create: `src-tauri/src/session/monitor.rs`
- Create: `src-tauri/src/session/mod.rs`
- Create: `src-tauri/tests/session_state_machine.rs`
- Create: `src/services/sessions.ts`
- Create: `src/services/sessions.test.ts`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**

```rust
pub enum SessionEvent {
    LaunchRequested(PendingLaunch),
    ProcessSnapshot { at: Instant, processes: Vec<ProcessIdentity> },
    Shutdown,
}
pub enum SessionEffect { Start(SessionDraft), Continue, Finish(FinishedSession), None }
```

- [ ] Write failing state-machine tests for: process appears inside launch window; never appears; multiple Roblox processes count as one session; 19-second restart continues; 21-second gap finishes; manual launch creates unknown game without account assignment.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test session_state_machine`; expect FAIL.
- [ ] Implement the pure state machine using `Instant` for duration and wall-clock timestamps only for persistence/display.
- [ ] Add a bounded monitor worker with clean shutdown. Emit `session://changed` events and persist completion once.
- [ ] Write frontend subscription tests proving duplicate events do not double-count and unsubscribe runs on unmount.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test session_state_machine`, `npm test -- --run src/services/sessions.test.ts`, and `npm test -- --run`; expect PASS.
- [ ] Commit: `git add src/services src-tauri && git commit -m "feat: track real roblox sessions"`.

## Task 6: Profile, Bibliothek, Sammlungen und accountbezogene Daten

**Files:**
- Create: `src/services/accounts.ts`
- Create: `src/services/library.ts`
- Create: `src/services/accounts.test.ts`
- Create: `src/services/library.test.ts`
- Modify: `src/state/types.ts`
- Rewrite: `src/state/AppStore.tsx`
- Rewrite: `src/state/AppStore.test.tsx`
- Modify: `src/pages/Accounts.tsx`
- Modify: `src/pages/Library.tsx`
- Modify: `src/components/LaunchDialog.tsx`
- Remove: `src/data/mockData.ts`

**Interfaces:**

```ts
export interface AccountInput {
  username: string;
  label: string;
  initials: string;
  color: string;
  note: string;
  avatarUrl: string | null;
}
export interface LibraryPort {
  list(query: LibraryQuery): Promise<Game[]>;
  saveGame(input: GameInput): Promise<Game>;
  setFavorite(accountId: string, gameId: string, value: boolean): Promise<void>;
  saveCollection(input: CollectionInput): Promise<Collection>;
}
```

- [ ] Write failing tests for account create/edit/delete confirmation with both statistics policies; normalized unique tags; collection membership; per-account favorite isolation; launch confirmation showing the intended local profile.
- [ ] Run `npm test -- --run src/services/accounts.test.ts src/services/library.test.ts src/state/AppStore.test.tsx src/pages/Accounts.test.tsx src/pages/Library.test.tsx`; expect FAIL.
- [ ] Replace the current state initializer with async `loading | ready | empty | error` bootstrap states backed by `BackendPort`.
- [ ] Implement validated CRUD forms and transaction-backed services. The official account-switch button opens only a fixed Roblox HTTPS URL.
- [ ] Remove `mockData.ts` imports and file. Empty database states must render helpful actions without fabricated cards.
- [ ] Run `rg "mockData|localStorage" src` and require no production data use; i18n locale bootstrap may use settings only through the backend.
- [ ] Run `npm test -- --run` and `npm run build`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: add persistent accounts and game library"`.

## Task 7: Hardwarewerte und typisierte Verfuegbarkeit

**Files:**
- Create: `src-tauri/src/system/mod.rs`
- Create: `src-tauri/src/system/windows.rs`
- Create: `src-tauri/tests/system_provider.rs`
- Create: `src/services/system.ts`
- Create: `src/services/system.test.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Performance.tsx`

**Interfaces:**

```ts
export interface SystemSnapshot {
  capturedAt: string;
  cpu: { model: string; logicalCores: number; usagePercent: Availability<number> };
  memory: { totalBytes: number; usedBytes: number; usagePercent: Availability<number> };
  gpu: { name: Availability<string>; usagePercent: Availability<number> };
  operatingSystem: string;
}
```

- [ ] Write failing provider tests for valid CPU/RAM values, GPU unavailable, provider failure, and refresh cleanup.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test system_provider` and `npm test -- --run src/services/system.test.ts`; expect FAIL.
- [ ] Implement `sysinfo` CPU/RAM/OS reads. Query GPU name through a fixed Windows API/provider; return unavailable if it cannot be resolved. Never substitute a GPU percentage.
- [ ] Refresh on a bounded interval while the relevant page is mounted and show `Nicht verfuegbar`/`Unavailable` for missing values.
- [ ] Remove every fixed hardware percentage and model from production UI.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test system_provider`, `npm test -- --run src/services/system.test.ts`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: display real system telemetry"`.

## Task 8: Themes, Fonts, Hintergruende und App-Sprache

**Files:**
- Create: `src/domain/appearance.ts`
- Create: `src/domain/appearance.test.ts`
- Create: `src/services/appearance.ts`
- Create: `src/services/appearance.test.ts`
- Create: `src/assets/fonts/README.md`
- Create: `src-tauri/src/imports.rs`
- Create: `src-tauri/tests/import_validation.rs`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/app.css`
- Modify: `src/i18n/de.ts`
- Modify: `src/i18n/en.ts`

**Interfaces:**

```ts
export type BuiltInFont = "Inter" | "Geist" | "Poppins" | "Manrope" | "Rubik" | "JetBrains Mono";
export interface AppearanceSettings {
  theme: "dark" | "light" | "system";
  accent: string;
  headingFont: string;
  bodyFont: string;
  scalePercent: number;
  weight: 400 | 500 | 600 | 700;
  spacing: "compact" | "comfortable" | "spacious";
  backgroundImage: string | null;
}
```

- [ ] Write failing tests for scale bounds 85-125, strict hex colors, supported font/image extensions, 10 MiB font limit, persisted locale, and immediate CSS variable application.
- [ ] Run `npm test -- --run src/domain/appearance.test.ts src/services/appearance.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml --test import_validation`; expect FAIL.
- [ ] Bundle all six font families with declared weights and licenses. Implement imports by copying selected files into app data after canonical path, extension and size validation; imported fonts are loaded only into Rift's WebView.
- [ ] Implement separate heading/body selectors, weight, scale, spacing, theme, accent presets/custom hex, background import/remove and DE/EN selector.
- [ ] Apply settings via stable CSS custom properties and cover 980x680 minimum layout without overlap.
- [ ] Run `npm test -- --run src/domain/appearance.test.ts src/services/appearance.test.ts`, `cargo test --manifest-path src-tauri/Cargo.toml --test import_validation`, `npm test -- --run`, and `npm run build`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: add localized appearance controls"`.

## Task 9: Core-Integration, visuelle QA und 0.2.0-Artefakte

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/pages/Stats.tsx`
- Create: `tests/e2e/core.spec.ts`
- Create: `scripts/package-release.ps1`
- Modify: `README.md`

- [ ] Write failing app tests for bootstrap loading/error/empty, navigation, German/English switch, profile persistence, favorite persistence, launch receipt and unavailable metrics.
- [ ] Add Playwright checks at 1440x900 and 1024x720 for all six pages, keyboard focus, dialogs and no text overlap.
- [ ] Run `npm test -- --run`; expect FAIL before integration wiring.
- [ ] Wire pages to the new ports, complete translations and remove every fixed sample statistic. Stats empty state must be based on zero stored sessions.
- [ ] Implement `scripts/package-release.ps1` to run tests/builds, copy the NSIS artifact and portable binary to `outputs/Rift-Companion-0.2.0-Setup.exe` and `outputs/Rift-Companion-0.2.0-Portable.exe`, and fail if either hash is empty.
- [ ] Run `npm run check`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npx playwright test`, and `npm run tauri build -- --bundles nsis`; expect PASS.
- [ ] Launch the portable EXE, create a profile and game, restart, verify persistence, and perform one visible installer run confirming the German/English selector. Verify install/uninstall in both languages using clean current-user test directories.
- [ ] Run the packaging script and record SHA-256 values in `outputs/Rift-Companion-0.2.0-SHA256.txt`.
- [ ] Commit: `git add . && git commit -m "release: build Rift Companion 0.2.0"`.

## 0.2.0 Completion Gate

- [ ] No production import references `mockData` or stores product data in `localStorage`.
- [ ] All TypeScript, Rust, integration and viewport tests pass.
- [ ] Real profile, favorite, font, theme, launch activity and completed session persist across restart.
- [ ] Installer selector and all installer/uninstaller pages work in German and English.
- [ ] Both named 0.2.0 executables and their SHA-256 file exist in `outputs` and start successfully.
