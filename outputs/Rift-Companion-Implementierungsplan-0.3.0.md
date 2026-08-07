# Rift Companion Performance 0.3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auf dem bestandenen 0.2.0-Core sichere Performance-Empfehlungen, bestaetigte Windows-Aktionen, Prozessverwaltung, Diagnosen, Sitzungsberichte und ein eigenstaendiges Overlay liefern.

**Architecture:** Alle Windows-Aktionen liegen hinter kleinen Rust-Traits mit festen Argumenten und erneuter Identitaetspruefung. React zeigt Vorschau und Bestaetigung, Rust erzwingt die Sicherheitsregeln. Das Overlay ist ein separates Tauri-Fenster und erhaelt ausschliesslich Rift-eigene Telemetrieereignisse.

**Tech Stack:** Bestehender 0.2.0-Stack, Tauri Window/Event APIs, `sysinfo`, feste Windows-Systemaufrufe, Vitest, Rust Tests, Playwright.

## Global Constraints

- Dieser Plan beginnt erst, wenn das 0.2.0 Completion Gate vollstaendig gruen ist.
- Keine Roblox-Konfigurationsdateien, Registry-Tricks fuer Game Mode, Client-Hooks oder freie Shellargumente.
- Jede veraendernde Aktion zeigt Ziel, Wirkung und Wiederherstellung und braucht eine ausdrueckliche Bestaetigung.
- FPS und Roblox-Ingame-Ping bleiben `null`, solange keine sichere, externe Quelle implementiert ist.
- Jeder Fehler bleibt auf sein Modul begrenzt und wird im Aktivitaets- oder Sitzungsbericht protokolliert.

---

## Task 1: 0.3.0-Schema und Performanceprofile

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/migrations/0002_performance.sql`
- Modify: `src/contracts/entities.ts`
- Create: `src/domain/performanceProfile.ts`
- Create: `src/domain/performanceProfile.test.ts`
- Modify: `src/pages/Performance.tsx`

**Interfaces:**

```ts
export interface PerformanceProfile {
  id: string;
  name: string;
  targetFps: number | null;
  robloxGraphicsLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  overlayEnabled: boolean;
  sampleIntervalMs: 1000 | 2000 | 5000;
  managedProgramPolicy: "none" | "ask";
}
```

- [ ] Write failing validation tests for templates, graphics bounds, allowed intervals and per-account selection.
- [ ] Run `npm test -- --run src/domain/performanceProfile.test.ts`; expect FAIL.
- [ ] Add migration fields/tables for managed programs, session samples, network checks and crash reports. Update all version fields to `0.3.0`.
- [ ] Implement Performance/Ausgeglichen/Qualitaet as editable recommendation templates and explanatory checklist only.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test migrations` twice, `npm test -- --run src/domain/performanceProfile.test.ts`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add . && git commit -m "feat: add persistent performance profiles"`.

## Task 2: Energieplan und Game Mode

**Files:**
- Create: `src-tauri/src/windows/power.rs`
- Create: `src-tauri/src/windows/game_mode.rs`
- Create: `src-tauri/src/windows/mod.rs`
- Create: `src-tauri/tests/power_plan.rs`
- Create: `src/services/windowsSettings.ts`
- Create: `src/services/windowsSettings.test.ts`
- Modify: `src/pages/Performance.tsx`

**Interfaces:**

```rust
pub trait PowerPlanSystem {
    fn list(&self) -> Result<Vec<PowerPlan>, AppError>;
    fn active(&self) -> Result<PowerPlan, AppError>;
    fn activate_known(&self, guid: Uuid) -> Result<(), AppError>;
}
```

- [ ] Write failing tests that reject unknown GUIDs, require a confirmation token, preserve the previous plan and restore it after a session. Test German and English confirmation copy.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test power_plan` and `npm test -- --run src/services/windowsSettings.test.ts`; expect FAIL.
- [ ] Parse `powercfg /list` and `/getactivescheme` through a fixed invocation wrapper. Activation may receive only a GUID returned by the same provider and fixed `/setactive` arguments.
- [ ] Read Game Mode status with a typed availability result and open the fixed `ms-settings:gaming-gamemode` URI; do not write the setting.
- [ ] Persist each attempt and restoration result. Show read-only operation without elevation and actionable errors.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test power_plan`, `npm test -- --run src/services/windowsSettings.test.ts`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: manage confirmed windows performance settings"`.

## Task 3: Sichere Hintergrundprogramm-Allowlist

**Files:**
- Create: `src-tauri/src/processes/catalog.rs`
- Create: `src-tauri/src/processes/policy.rs`
- Create: `src-tauri/src/processes/mod.rs`
- Create: `src-tauri/tests/process_policy.rs`
- Create: `src/services/programs.ts`
- Create: `src/services/programs.test.ts`
- Create: `src/components/ManagedPrograms.tsx`
- Create: `src/components/ManagedPrograms.test.tsx`

**Interfaces:**

```rust
pub struct ProcessActionTarget { pub pid: u32, pub name: String, pub owner_sid: String, pub executable: PathBuf }
pub trait ProcessSystem {
    fn current_user_catalog(&self) -> Result<Vec<ProcessActionTarget>, AppError>;
    fn terminate_verified(&self, target: &ProcessActionTarget) -> Result<(), AppError>;
    fn restart_path(&self, executable: &Path) -> Result<ChildIdentity, AppError>;
}
```

- [ ] Write failing policy tests excluding system, security, driver, Roblox and Rift processes; reject relative/missing paths, changed PID identity and argument-bearing restart strings.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test process_policy` and `npm test -- --run src/services/programs.test.ts src/components/ManagedPrograms.test.tsx`; expect FAIL.
- [ ] Implement current-user catalog and stable exclusion policy. Re-read PID, name, owner and canonical executable immediately before termination.
- [ ] Save only explicitly checked programs. The UI shows name, memory, canonical path and one confirmation dialog per batch.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test process_policy` and `npm test -- --run src/services/programs.test.ts src/components/ManagedPrograms.test.tsx`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: add safe managed program allowlist"`.

## Task 4: Schliessen/Wiederstarten im Sitzungslebenszyklus

**Files:**
- Modify: `src-tauri/src/session/state_machine.rs`
- Modify: `src-tauri/src/session/monitor.rs`
- Create: `src-tauri/src/processes/lifecycle.rs`
- Create: `src-tauri/tests/program_lifecycle.rs`
- Modify: `src/components/LaunchDialog.tsx`
- Modify: `src/services/sessions.ts`

- [ ] Write failing tests for confirmed close before launch, partial failure, session never starts, normal finish, crash-like finish and restart only for successfully closed programs.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test program_lifecycle`; expect FAIL.
- [ ] Model lifecycle effects explicitly: `CloseApproved`, `Launch`, `RestartClosed`, `RecordFailure`. Store the canonical restart path and PID result per launch receipt.
- [ ] Add launch-dialog preview and unchecked-by-default confirmation. Cancellation changes nothing.
- [ ] Ensure shutdown attempts restoration once and records every result.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test program_lifecycle`, `npm test -- --run src/services/sessions.test.ts`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: restore managed programs after sessions"`.

## Task 5: Netzwerk-, Log- und Crashdiagnose

**Files:**
- Create: `src-tauri/src/diagnostics/network.rs`
- Create: `src-tauri/src/diagnostics/logs.rs`
- Create: `src-tauri/src/diagnostics/mod.rs`
- Create: `src-tauri/tests/diagnostics.rs`
- Create: `src/services/diagnostics.ts`
- Create: `src/services/diagnostics.test.ts`
- Modify: `src/pages/Performance.tsx`

**Interfaces:**

```ts
export interface NetworkDiagnostic {
  target: string;
  capturedAt: string;
  dnsMs: Availability<number>;
  connectMs: Availability<number>;
  httpsMs: Availability<number>;
}
```

- [ ] Write failing tests separating DNS/connect/HTTPS errors, enforcing timeouts, permitting only configured HTTPS targets and reading metadata only from allowed Roblox log directories.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test diagnostics` and `npm test -- --run src/services/diagnostics.test.ts`; expect FAIL.
- [ ] Implement bounded diagnostics with no endless retry. Label values `Network diagnosis`, never `Roblox ping`.
- [ ] Watch allowed log directories read-only; persist path, timestamp, size and a short locally generated category without uploading content.
- [ ] Connect possible unexpected termination to a `possibleCrash` flag, never a definitive claim.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test diagnostics`, `npm test -- --run src/services/diagnostics.test.ts`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: add bounded session diagnostics"`.

## Task 6: Reale Sitzungssamples, Bericht und Export

**Files:**
- Create: `src-tauri/src/reports.rs`
- Create: `src-tauri/tests/reports.rs`
- Create: `src/domain/reports.ts`
- Create: `src/domain/reports.test.ts`
- Create: `src/services/reports.ts`
- Modify: `src/pages/Stats.tsx`

- [ ] Write failing aggregate tests for average/max CPU and RAM, partially unavailable GPU, empty samples, JSON/CSV escaping and nullable FPS/in-game ping.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test reports` and `npm test -- --run src/domain/reports.test.ts`; expect FAIL.
- [ ] Sample at the selected bounded interval and persist in batches. Aggregate with SQLite queries and retain availability counts.
- [ ] Export the current report to a user-selected path via dialog; fields `fps` and `inGamePingMs` must serialize as `null` without a provider.
- [ ] Render report values, diagnostic errors and empty states in both languages.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test reports`, `npm test -- --run src/domain/reports.test.ts`, `npm test -- --run`, and `cargo test --manifest-path src-tauri/Cargo.toml`; expect PASS.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: generate real session reports"`.

## Task 7: Eigenstaendiges Overlay

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Create: `src-tauri/capabilities/overlay.json`
- Create: `src-tauri/src/overlay.rs`
- Create: `src/overlay/main.tsx`
- Create: `src/overlay/Overlay.tsx`
- Create: `src/overlay/Overlay.test.tsx`
- Create: `src/overlay/overlay.css`
- Modify: `src/pages/Settings.tsx`

**Interfaces:**

```ts
export interface OverlaySnapshot {
  clock: string;
  sessionSeconds: number | null;
  cpuPercent: Availability<number>;
  ramPercent: Availability<number>;
  gpuPercent: Availability<number>;
  microphoneActive: boolean;
  recordingActive: boolean;
}
```

- [ ] Write failing component tests for available/unavailable metrics, status indicators, click-through toggle and keyboard shortcut reconfiguration.
- [ ] Add Rust tests proving the overlay command can target only the `overlay` window and clamps position/scale to visible bounds.
- [ ] Run `npm test -- --run src/overlay/Overlay.test.tsx` and `cargo test --manifest-path src-tauri/Cargo.toml overlay`; expect FAIL.
- [ ] Create the always-on-top, transparent, decorations-free overlay hidden at startup. It receives only `overlay://snapshot` events and has minimum capabilities.
- [ ] Implement move, scale, visible click-through control, show/hide shortcut and clean app shutdown. Do not attach to or inspect Roblox windows.
- [ ] Run `npm test -- --run src/overlay/Overlay.test.tsx`, `cargo test --manifest-path src-tauri/Cargo.toml overlay`, and `npx playwright test tests/e2e/overlay.spec.ts`; expect PASS, including nonblank screenshots at 100% and 125% scaling.
- [ ] Commit: `git add src src-tauri && git commit -m "feat: add external performance overlay"`.

## Task 8: 0.3.0-Integration und Release

**Files:**
- Modify: `src/App.test.tsx`
- Create: `tests/e2e/performance.spec.ts`
- Modify: `scripts/package-release.ps1`
- Modify: `README.md`
- Modify: `src/i18n/de.ts`
- Modify: `src/i18n/en.ts`

- [ ] Add failing end-to-end cases covering refusal of an excluded process, cancelled power-plan change, restored plan/program, diagnostics, report export and overlay lifecycle.
- [ ] Run `npm test -- --run src/App.test.tsx` and `npx playwright test tests/e2e/performance.spec.ts`; expect FAIL before final integration wiring.
- [ ] Complete translations and wire all loading/error/confirmation states.
- [ ] Run `npm run check`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `npx playwright test`; expect PASS.
- [ ] Build NSIS, visibly verify both installer languages, start the portable EXE, and exercise the full flow with a harmless user-owned test program.
- [ ] Produce `outputs/Rift-Companion-0.3.0-Setup.exe`, `outputs/Rift-Companion-0.3.0-Portable.exe` and `outputs/Rift-Companion-0.3.0-SHA256.txt`.
- [ ] Confirm FPS and in-game ping show unavailable in the release build and no Roblox/client settings were written.
- [ ] Commit: `git add . && git commit -m "release: build Rift Companion 0.3.0"`.

## 0.3.0 Completion Gate

- [ ] The entire 0.2.0 gate remains green.
- [ ] Every Windows mutation requires confirmation and is auditable.
- [ ] Excluded processes cannot be selected or terminated, including by crafted command input.
- [ ] Overlay is a standalone window and shuts down cleanly.
- [ ] Reports contain only measured values; FPS and in-game ping remain unavailable.
- [ ] Both 0.3.0 executables and hash file exist and start successfully.
