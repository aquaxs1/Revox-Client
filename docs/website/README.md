# Revox Client — website brief

Everything needed to build the Revox Client website without opening the app's
source. Written for a session that has this file and nothing else.

Repository: `aquaxs1/Revox-Client` · Current version: **0.4.0** · Platform:
**Windows** (the app builds elsewhere but the OS features are Windows-only).

---

## 1. What Revox is

Revox Client is a desktop launcher for the **official** Roblox client. It adds a
library, local profiles, playtime statistics, a Roblox stats explorer and a
friends list around Roblox's own launch flow — **without ever touching the
Roblox client itself**.

**One-line positioning:**
> The Roblox launcher that adds everything around the game, and changes nothing
> inside it.

**The competitive angle.** The known alternatives (Bloxstrap, Fishstrap and
similar) work by modifying the Roblox client: FastFlags, patched files, FPS
unlockers. Revox deliberately does none of that. That is not a missing feature —
it is the product. Revox is the launcher you can run without wondering whether
it puts your account at risk.

**Tone of voice:** direct, technical, honest. No hype, no invented numbers, no
"boost your FPS by 300%". The product's whole credibility rests on saying only
what is true, so the website must too.

---

## 2. Hard boundaries — use these as a feature, not a disclaimer

These are enforced in code, not policy. They deserve a prominent section on the
site, probably right after the hero.

- Never stores Roblox passwords or `.ROBLOSECURITY` cookies.
- Never patches Roblox files, fonts or FastFlags.
- Never injects DLLs, hooks a graphics API or reads Roblox process memory.
- Never generates gameplay input, macros, cheats or exploits.
- Roblox is started **only** through a validated `roblox://placeId=<id>` URL,
  optionally with a validated `&gameInstanceId=<uuid>` to rejoin one server.
- Every Roblox lookup is unauthenticated — no login, no token, no cookie.
- All data stays on the device. Nothing is uploaded anywhere.
- Anything that cannot be measured safely shows as **"Not available"** instead
  of a plausible-looking number. There is no sample data in the product.

**Honest limits to state plainly** (they build trust, and hiding them would
backfire when users hit them):

- Data Roblox only shares with a signed-in session is not available. If a
  friend's join privacy hides their server, Revox cannot join them and says so.
- Playtime tracking is **off until the user turns it on**.
- Roblox's keyword search for experiences is the least stable endpoint Revox
  uses; when it fails the app falls back to Place IDs and links.

---

## 3. Feature list

Each entry is written so it can be lifted into website copy. Group them however
the layout wants; the suggested grouping is marked.

### Group A — Playing

**Play screen (dashboard).** A hero tile for the most recently played game with
a large Play button, a row of bookmarked games, and a column of the most recent
sessions.

**Rejoin any past session.** Every recorded session has a "join again" button.
When Revox knows which server it was, it returns to that exact server rather
than any public one.

**Library.** Add a game by name, Place ID or official Roblox link. Typing a name
searches Roblox and you pick from the results. Name, description, icon and live
player count come from the public Roblox catalog.

**Local profiles.** Separate favourites and playtime per profile, each with its
own playtime chart. These are labels you choose — Revox never signs in to
Roblox and never claims to know which account is actually logged in.

### Group B — Knowing

**Explorer — a stats viewer for profiles, experiences and UGC items.** It shows
everything the Roblox website shows, plus figures the site does not put in front
of you:

| Target | Beyond roblox.com |
| --- | --- |
| Profiles | Account age in days, followers per friend |
| Experiences | Like ratio in %, visits per active player, live server fill distribution with median and full-server count |
| UGC / catalog | Resale markup of a limited item over its original price |

**Watchlist with history.** Follow a profile, experience or item and Revox
records a reading every six hours. The detail view then shows a trend per metric
and the change since the last reading — not just a snapshot. A metric Roblox
stopped publishing produces a gap, never a zero.

**Server browser and ranking.** The live server list is ordered joinable-first,
then by lowest ping, then by how busy it is. The best joinable server is marked,
and you can join a specific server directly. A server with no reported ping
sorts behind every server that has one.

**Statistics.** Total playtime, distinct games played and a 14-day chart,
filterable per local profile, plus a most-played ranking.

**Export.** Sessions as CSV or JSON to a file you pick. Nothing is uploaded.

### Group C — Friends

**One-click account linking.** Roblox writes the signed-in user ID into its own
local logs, so Revox asks "is this you?" and links with one click. When there is
nothing to detect, a search picker with avatars takes over — you choose a face
instead of spelling a name.

**Friends with live presence.** Your friends list with what each person is
doing right now, sorted so joinable people are at the top.

**Join a friend directly.** One click when Roblox publishes their server. When
it does not, the button is disabled and the reason is stated.

**Friend notifications.** A desktop notification when a friend comes online or
starts a game. Never fires on the first poll, so launching Revox does not
produce a burst of them.

### Group D — Comfort

**Discord Rich Presence.** One switch. Shows what you are playing, with an
elapsed timer. No token is stored and a closed Discord never blocks a launch.

**Tray and autostart.** Revox can keep running in the notification area and
start with Windows, so playtime is recorded even when the window is closed.

**Setup wizard.** Five steps on first run, in the client's own style: welcome,
language and theme, the default switches, the optional Roblox link, done. Every
choice is saved as it is made.

**Appearance.** Dark, light or system theme, six accent colours, three density
modes. German and English, switchable without a restart.

**Signed updates.** The updater accepts only packages signed with the public key
built into the app.

---

## 4. Screens to show

The app is 1440×900 by default with a minimum of 1040×680. Eight screens exist;
these four carry the product best on a website:

1. **Play / Dashboard** — the strongest hero shot. Blue title bar, icon rail on
   the left spread over the full height, a game-cover mosaic behind a green Play
   button, a favourites row, and a "Last Sessions" column on the right.
2. **Explorer** — three tabs (Profiles / Games / UGC & catalog), a search field,
   and a detail view of stat tiles plus a live server list.
3. **Friends** — avatar rows with presence dots and green Join buttons.
4. **Stats** — pill tabs, three big stat tiles, a filled line chart, a
   most-played ranking with meters.

Also useful: **Setup wizard step 3** (the toggle cards) for an "it just works"
section, and **Settings** for the boundaries panel.

**Screenshots do not exist as files in the repo.** They have to be taken from a
running build (`npm run dev` gives a browser preview with an in-memory backend;
seed it via `localStorage` key `revox-preview-v1`). Budget time for this, or
build the site with illustrated mock-ups instead.

---

## 5. Brand

### Logo

The mark is a solid **R** with a diamond and a slab knocked out of it, plus the
word `evox` knocked out along the bottom of the full lockup. Use this path
directly — it is the same geometry the app renders:

```html
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="revox" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5BC8F5" />
      <stop offset="100%" stop-color="#1874FF" />
    </linearGradient>
  </defs>
  <path fill="url(#revox)" fill-rule="evenodd"
        d="M0 0 H57 C80 0 100 12 100 31 C100 48 85 62 68 62 L100 100 H0 Z
           M47 14 L69 32 L47 50 L25 32 Z
           M19 62 H40 L57 79 H17 Z" />
</svg>
```

The cut-outs rely on `fill-rule="evenodd"`, so they show whatever is behind the
logo. Wordmark: **REVOX**, uppercase, bold, slight letter-spacing.

> Note: this path is a hand-traced approximation of the original artwork. If the
> owner supplies the real vector file, prefer it.

### Colour

| Token | Value | Use |
| --- | --- | --- |
| Accent | `#2E9BF0` | Primary actions, links, active nav |
| Accent bright | `#5BC8F5` | Gradient start, highlights |
| Accent deep | `#1874FF` | Gradient end, hover |
| Green | `#35C759` | Play and Join buttons only |
| Amber | `#F5A524` | Bookmarks |
| Red / pink | `#F2557A` | Destructive, "All stats" tab |
| Orange | `#F58A24` | Profile tab, session accents |
| Background | `#0B0E13` | Page ground (dark) |
| Surface | `#14181F` | Cards |
| Surface 2 | `#1C212A` | Menus, raised cards |
| Border | `#2C333F` | Hairlines |
| Text | `#EEF2F7` | Body |
| Text muted | `#98A2B3` | Secondary |
| Text faint | `#6B7484` | Labels, "not available" |

Light theme ground `#EEF1F6`, surface `#FFFFFF`, text `#10151D`.

The signature gradient is `linear-gradient(135deg, #5BC8F5, #1874FF)` — used for
the app's title bar and the logo. It should carry the site's hero too.

### Type and shape

- Font stack: `"Segoe UI", "Inter", system-ui, -apple-system, sans-serif`.
  Monospace for numbers and IDs: `"JetBrains Mono", Consolas, monospace`.
- Radii: 6px small, 10px default, 16px large. Pills for tabs and chips.
- The app is **dark-first**. A dark site matches the product; if you build a
  light mode, mirror the token table above rather than inventing a second
  palette.

---

## 6. Suggested site structure

1. **Hero** — logo, the one-liner, a download button, and the Play screen
   screenshot. Gradient accent behind it.
2. **The boundaries panel** — the "changes nothing inside Roblox" list as
   checkmarks. This is the differentiator; put it high.
3. **Feature sections** — one per group from §3, each with a screenshot or
   illustration. Suggested order: Playing → Knowing → Friends → Comfort.
4. **Explorer deep-dive** — the table of "beyond roblox.com" figures reads well
   as its own section and is the most distinctive capability.
5. **Comparison** — Revox vs. client-modifying launchers. Be factual: state what
   Revox does not do and why that is the point. Do not disparage named products.
6. **Download** — Windows installer and portable exe. Mention the German/English
   installer selector, that it installs per user without administrator rights,
   and that releases are signed.
7. **FAQ** — cover: Is it safe? Does it change Roblox? Does it need my password?
   (No.) Why is playtime tracking off by default? Why can it sometimes not join
   my friend? Does it work on Mac/Linux? (No — Windows.)
8. **Footer** — GitHub link, licence, version.

### Download facts

- Two artefacts: an **NSIS installer** (`currentUser` mode, no admin rights,
  German/English language selector on the first page) and a **portable exe**.
- Built with Tauri 2, so the download is small compared to an Electron app.
- The installer is branded with the Revox mark on a dark sidebar.

---

## 7. Copy snippets

Bilingual, matching the app's own wording. German is the app's source language.

| Purpose | German | English |
| --- | --- | --- |
| Tagline | Dein Launcher für den offiziellen Roblox-Client | Your launcher for the official Roblox client |
| Boundary 1 | Startet nur über den offiziellen Roblox-Startfluss | Starts only through the official Roblox launch flow |
| Boundary 2 | Speichert keine Passwörter und keine Cookies | Stores no passwords and no cookies |
| Boundary 3 | Keine Injection, keine Cheats, keine FastFlags | No injection, no cheats, no FastFlags |
| Boundary 4 | Verändert keine Roblox-Dateien oder -Schriften | Never changes Roblox files or fonts |
| Boundary 5 | Alle Daten bleiben lokal auf deinem Gerät | All data stays local on your device |
| Honesty line | Nicht verfügbar | Not available |
| Privacy note | Revox liest nur öffentliche Roblox-Daten. | Revox reads public Roblox data only. |

---

## 8. Things the website must not claim

Getting any of these wrong would make the product look dishonest, which is the
one thing it cannot afford:

- Do **not** claim FPS improvements, performance boosts or optimisation. Revox
  does not touch the game.
- Do **not** claim it detects which Roblox account is logged in as a fact. It
  reads a hint from Roblox's local logs and asks the user to confirm.
- Do **not** claim it shows other players' names or pings inside a game. Roblox's
  public API does not expose them, and Revox will not inject to get them.
- Do **not** claim account switching or automatic login. Local profiles are
  labels.
- Do **not** claim cloud sync, accounts or a companion service. There is no
  backend; everything is local.
- Do **not** invent user counts, review quotes or ratings.

---

## 9. Technical facts for an "under the hood" section

- **Stack:** Tauri 2 (Rust) + React 19 + TypeScript, no UI framework, hand-built
  design system.
- **Storage:** SQLite locally, with versioned migrations.
- **Roblox access:** unauthenticated calls to `users`, `friends`, `presence`,
  `games`, `catalog`, `economy`, `thumbnails` and `apis` `.roblox.com`, made
  from Rust rather than the web view so nothing reaches the page unvalidated.
  Thumbnail hosts are allow-listed and enforced by the window's CSP.
- **Tests:** 104 frontend + 89 backend, run on every change.
- **Languages:** German and English, complete, with a test enforcing key parity.

---

## 10. Open items the site should account for

- The Discord application ID is not yet registered, so Rich Presence is inert in
  a build made straight from the repo. Either register it before launch or leave
  the feature off the site until it works.
- No signed-update endpoint is configured yet, so "automatic updates" should not
  be promised until a release endpoint and key exist.
- No screenshots are committed; they must be captured from a build.
- No public release binaries exist yet — the download section needs real links
  before the site goes live.
