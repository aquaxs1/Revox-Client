# Rift Companion

Rift is a German-language Roblox companion launcher prototype built with Tauri 2, React, and TypeScript. It organizes games, local account labels, performance recommendations, appearance settings, and session statistics around the official Roblox launch flow.

## Run The Browser Preview

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:1420`.

For the production preview:

```powershell
npm.cmd run build
npm.cmd run preview
```

## Run The Desktop App

Install the Rust toolchain and the Windows prerequisites listed by Tauri, then run:

```powershell
npm.cmd run tauri dev
```

The native shell exposes one narrow command: it validates a numeric Place ID and asks Windows to open `roblox://placeId=<id>` through the installed official Roblox client.

## Included In The Prototype

- Gaming-style dashboard with the Launch Rail, favorites, recent activity, and a system snapshot.
- Searchable games library with category filters and local favorites.
- Add-game flow for a numeric Place ID or an official `roblox.com/games/...` URL.
- Confirmation before handing a Place ID to the official Roblox protocol.
- Local account profile labels, colors, and per-profile product structure.
- Performance, Balanced, and Quality recommendations.
- Dark/light themes, three accents, three launcher font styles, and two density modes.
- Session statistics and performance placeholders showing the intended reporting experience.
- Responsive narrow-window navigation and keyboard focus states.
- Locally bundled original cover artwork for reliable offline rendering.

## Prototype Boundaries

The system and session values are representative prototype data. The current version does not read live CPU, GPU, RAM, FPS, ping, Roblox account, or Roblox game metadata.

Rift intentionally does not:

- store passwords or `.ROBLOSECURITY` cookies;
- automate or bypass Roblox authentication;
- modify Roblox files, fonts, or settings;
- inject into or hook the Roblox client;
- provide cheats, exploits, or hidden process automation;
- close background programs or change Windows settings without a future explicit permission flow.

## Checks

```powershell
npm.cmd run check
```

This runs the 18 unit and interaction tests followed by the TypeScript production build. Native Rust validation additionally requires `cargo check --manifest-path src-tauri/Cargo.toml` once Rust is installed.

## Original Cover Asset

`public/covers/experience-grid.png` was generated specifically for this prototype as one six-scene, text-free thumbnail atlas. The UI crops its cells locally for the different game cards.
