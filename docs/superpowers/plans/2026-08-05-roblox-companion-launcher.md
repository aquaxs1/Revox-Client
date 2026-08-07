# Roblox Companion Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished German-language Tauri 2 desktop prototype that safely launches the official Roblox client and demonstrates local library, profile, performance, appearance, and statistics workflows.

**Architecture:** React owns the application shell and local prototype state through a reducer-backed context. Pure domain helpers parse Roblox references and construct official protocol URLs; a small launcher adapter calls a Tauri command when native and simulates it in browser preview. Tauri exposes only one narrow `launch_roblox` command with numeric Place ID validation.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript 5, Vite 7, Vitest, Testing Library, Lucide React, CSS.

## Global Constraints

- The interface language is German.
- The app never stores passwords or `.ROBLOSECURITY` cookies.
- The app never modifies or injects into the Roblox client and provides no cheats or automation.
- Native launching uses only an official `roblox://placeId=<id>` protocol URL.
- Browser development mode simulates launch success without navigating away.
- All interactive controls are keyboard reachable and respect `prefers-reduced-motion`.

---

### Task 1: Project Scaffold And Roblox Domain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/vite-env.d.ts`
- Create: `src/domain/roblox.ts`
- Test: `src/domain/roblox.test.ts`

**Interfaces:**
- Produces: `parsePlaceId(input: string): string | null`
- Produces: `buildLaunchUrl(placeId: string): string`

- [ ] **Step 1: Add the package and TypeScript/Vite configuration**

Use scripts `dev`, `build`, `test`, `tauri`, and `check`, with React, Lucide React, Tauri API, Vite, Vitest, jsdom, TypeScript, ESLint, and Testing Library dependencies.

- [ ] **Step 2: Write failing parser tests**

```ts
expect(parsePlaceId("920587237")).toBe("920587237");
expect(parsePlaceId("https://www.roblox.com/games/920587237/Adopt-Me")).toBe("920587237");
expect(parsePlaceId("javascript:alert(1)")).toBeNull();
expect(buildLaunchUrl("920587237")).toBe("roblox://placeId=920587237");
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `npm test -- src/domain/roblox.test.ts --run`
Expected: FAIL because `src/domain/roblox.ts` does not exist.

- [ ] **Step 4: Implement strict Place ID parsing**

Accept only 1-20 digits directly or the `/games/<digits>` path on `roblox.com` and `www.roblox.com`; reject all other hosts, protocols, and paths. Build the launch URL only after re-validating the numeric ID.

- [ ] **Step 5: Run the focused test and commit**

Run: `npm test -- src/domain/roblox.test.ts --run`
Expected: PASS.

### Task 2: Local Product Model And Store

**Files:**
- Create: `src/data/mockData.ts`
- Create: `src/state/types.ts`
- Create: `src/state/AppStore.tsx`
- Test: `src/state/AppStore.test.tsx`

**Interfaces:**
- Consumes: `parsePlaceId(input: string): string | null`
- Produces: `Game`, `AccountProfile`, `PerformanceProfile`, `Session`, `AppearanceSettings`, and `AppState` types.
- Produces: `useAppStore()` with `selectGame`, `toggleFavorite`, `addGame`, `selectAccount`, `setPerformanceProfile`, `updateAppearance`, and `recordLaunch`.

- [ ] **Step 1: Write store interaction tests**

```tsx
render(<AppStoreProvider><StoreProbe /></AppStoreProvider>);
await user.click(screen.getByRole("button", { name: "Favorit umschalten" }));
expect(screen.getByTestId("favorite-state")).toHaveTextContent("true");
```

Add equivalent assertions for valid game addition, selected account changes, appearance updates, and activity recording.

- [ ] **Step 2: Run the store test and confirm failure**

Run: `npm test -- src/state/AppStore.test.tsx --run`
Expected: FAIL because the provider and state model do not exist.

- [ ] **Step 3: Implement typed mock data and reducer-backed context**

Create five games, three local account labels, three performance modes, seven sessions, default appearance settings, and localStorage hydration guarded against malformed data. Keep action functions stable and reject duplicate Place IDs.

- [ ] **Step 4: Run all domain and store tests**

Run: `npm test -- --run`
Expected: PASS.

### Task 3: Native Tauri Shell And Safe Launch Adapter

**Files:**
- Create: `src/services/launcher.ts`
- Test: `src/services/launcher.test.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/icons/icon.png`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/main.rs`

**Interfaces:**
- Consumes: `buildLaunchUrl(placeId: string): string`
- Produces: `launchRoblox(placeId: string): Promise<{ mode: "native" | "preview"; url: string }>`
- Produces native command: `launch_roblox(place_id: String) -> Result<String, String>`

- [ ] **Step 1: Write adapter tests for browser preview and invalid IDs**

```ts
await expect(launchRoblox("920587237")).resolves.toEqual({
  mode: "preview",
  url: "roblox://placeId=920587237",
});
await expect(launchRoblox("bad-id")).rejects.toThrow("Ungültige Place-ID");
```

- [ ] **Step 2: Run the adapter test and confirm failure**

Run: `npm test -- src/services/launcher.test.ts --run`
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the browser/native adapter and Tauri command**

Use `window.__TAURI_INTERNALS__` detection before importing `@tauri-apps/api/core`. In Rust, accept digits only, construct the protocol URL internally, and open it with `std::process::Command::new("cmd").args(["/C", "start", "", &url])` on Windows. Expose no arbitrary URL or command execution API.

- [ ] **Step 4: Run adapter tests and validate Rust**

Run: `npm test -- src/services/launcher.test.ts --run`
Expected: PASS.

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

### Task 4: Complete React Experience

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/TopBar.tsx`
- Create: `src/components/Toast.tsx`
- Create: `src/components/LaunchDialog.tsx`
- Create: `src/pages/Dashboard.tsx`
- Create: `src/pages/Library.tsx`
- Create: `src/pages/Accounts.tsx`
- Create: `src/pages/Performance.tsx`
- Create: `src/pages/Stats.tsx`
- Create: `src/pages/Settings.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/app.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `useAppStore()` and `launchRoblox(placeId)`.
- Produces: desktop and narrow responsive UI for all six product areas.

- [ ] **Step 1: Write the application smoke and navigation test**

```tsx
render(<App />);
expect(screen.getByRole("heading", { name: "Bereit zum Spielen" })).toBeVisible();
await user.click(screen.getByRole("button", { name: "Bibliothek" }));
expect(screen.getByRole("heading", { name: "Deine Spiele" })).toBeVisible();
```

Also verify the launch confirmation, favorite toggle, account selection, performance selection, and appearance control labels.

- [ ] **Step 2: Run the smoke test and confirm failure**

Run: `npm test -- src/App.test.tsx --run`
Expected: FAIL because the application screens do not exist.

- [ ] **Step 3: Build the shell and dashboard**

Implement the compact icon rail, persistent status bar, dashboard greeting, Launch Rail, favorites, recent sessions, and system snapshot. Use German copy and Lucide icons with tooltips.

- [ ] **Step 4: Build library, accounts, performance, stats, and settings screens**

Implement functional search and filters, add-game dialog, favorites, local profile selection, safe login handoff copy, three performance profiles, session chart, stats table, theme/accent/font/density controls, and a dedicated safety section.

- [ ] **Step 5: Implement the tokenized responsive design**

Use the approved graphite/cyan/warm palette, condensed headings, tabular stats, 0-8 px radii, stable control dimensions, visible focus, reduced-motion overrides, and bottom navigation below 760 px. Keep sections unframed and reserve panels for repeated game/profile items.

- [ ] **Step 6: Run UI tests and production build**

Run: `npm test -- --run`
Expected: PASS.

Run: `npm run build`
Expected: PASS with no TypeScript errors.

### Task 5: Visual QA And Handoff

**Files:**
- Create: `README.md`
- Modify: application files only for defects found during QA.

**Interfaces:**
- Consumes: built prototype and all documented scripts.
- Produces: verified local browser preview and Tauri run instructions.

- [ ] **Step 1: Start the Vite preview server**

Run: `npm run dev -- --host 127.0.0.1`
Expected: a local URL with the dashboard loaded.

- [ ] **Step 2: Verify desktop and narrow layouts**

Check 1440x900 and 390x844 screenshots for nonblank rendering, readable text, no overlaps, working navigation, and visible selected states. Exercise add game, favorite, account, performance, appearance, and launch-confirmation flows.

- [ ] **Step 3: Fix visual or interaction defects and rerun checks**

Run: `npm test -- --run && npm run build`
Expected: PASS.

- [ ] **Step 4: Document the prototype**

Document prerequisites, `npm install`, `npm run dev`, `npm run tauri dev`, implemented features, preview-mode behavior, and explicit safety boundaries.

- [ ] **Step 5: Final verification**

Run: `npm run check`
Expected: all tests and production build pass.
