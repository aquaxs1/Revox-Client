# Roblox Companion Launcher Prototype Design

## Goal

Build a polished German-language desktop prototype using Tauri 2, React, and TypeScript. It acts as a companion launcher around the official Roblox client. The prototype demonstrates the complete product shape with realistic local data and working local interactions while keeping account and client safety boundaries explicit.

## Scope

The first prototype contains:

- Dashboard with current profile, favorite games, recent activity, quick launch, and session summary.
- Games library with search, category filters, favorites, and adding a game by Roblox URL or numeric Place ID.
- Official Roblox launch flow through `roblox://placeId=...`, with validation and clear errors.
- Local account profiles with avatar, label, color, and selection state. No password, session cookie, or authentication storage.
- Performance profiles for Performance, Balanced, and Quality, plus recommendation and Windows-status placeholders.
- Appearance settings for dark/light themes, accent color, interface font, and density.
- Stats views with useful placeholder charts and per-game session history.
- Safety information explaining that the app does not modify, inject into, or automate the Roblox client.

Not included in this prototype: live Roblox API integration, automatic account switching, cookie handling, process termination, client file modification, injection, cheats, an in-game overlay, real FPS or ping capture, cloud sync, or launcher auto-update.

## Product Structure

The app has a compact left rail for Dashboard, Library, Accounts, Performance, Statistics, and Settings. A persistent top status area shows Roblox readiness and the selected local profile. The main workspace changes without full-page navigation.

Data is isolated behind a small local store so mock data can later be replaced with Tauri persistence and allowed APIs. Roblox launching lives behind a dedicated service and Tauri command instead of being mixed into UI components.

## Visual Direction

The visual language is a quiet gaming control room rather than a neon-heavy game landing page. Deep graphite surfaces, cool cyan signal light, small warm status accents, precise dividers, and condensed display typography create a focused desktop-tool feel.

The signature element is the Launch Rail: a horizontal, track-like strip on the dashboard that combines the selected game, account, Roblox status, and one primary launch action. It gives the product a recognizable center without turning every section into a card.

Color tokens:

- Void: `#080B10`
- Graphite: `#10151D`
- Steel: `#1B2430`
- Signal cyan: `#45D6E8`
- Warm status: `#FFB45E`
- Frost: `#E9F1F5`

Typography uses a condensed display/system face for section headings, a clean UI face for controls, and tabular numerals for stats. User-selected font families are applied only inside the launcher.

## Interaction And Data Flow

User preferences, profiles, favorites, library additions, and activity are kept locally. The React store owns UI state and persists it through a storage adapter. In browser development the adapter uses `localStorage`; the Tauri shell can later swap in a file or plugin-backed adapter without changing screens.

Launching validates a Place ID, shows a confirmation sheet with the chosen game and local account label, then asks Tauri to open the official Roblox protocol URL. Browser preview mode shows a successful simulated launch rather than navigating away.

## Error Handling

- Invalid Roblox URLs or Place IDs produce inline field guidance.
- Launch failures remain visible in a status toast and are recorded in the local activity list.
- Missing Roblox installation is represented as a recoverable status with an official install/open action.
- Unsupported native actions in browser preview mode are clearly marked as simulated.

## Accessibility And Responsiveness

All interactive controls are keyboard reachable and have visible focus states. Motion respects `prefers-reduced-motion`. The layout supports desktop widths down to 1024 px and collapses to a mobile-style bottom navigation for narrow preview windows. Text never relies on color alone for meaning.

## Verification

Focused unit tests cover Place ID parsing, local state mutations, and launch URL creation. A production build validates TypeScript and bundling. The running app is checked at desktop and narrow viewport sizes for layout, interaction, and empty/error states.
