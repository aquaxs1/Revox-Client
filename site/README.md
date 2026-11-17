# Revox — website

The site at <https://revox-client.vercel.app>. Plain HTML, CSS and JavaScript: no build
step, no framework, nothing loaded from another host.

| File | What it is |
| --- | --- |
| `index.html` | Landing page |
| `features.html` | Features |
| `setup.html` | Setup |
| `download.html` | Download |
| `terms.html` | Terms of Use |
| `404.html` | Shown for any address that does not exist |
| `assets/site.css` | This project's accent colour and anything only this site needs |
| `assets/scene.js` | The 3D scene in the page header |
| `assets/aqx/` | The look and behaviour shared by all AquAxs project sites |

## The shared part

`assets/aqx/` is the same in every project site: the stylesheet (`aqx.css`),
the interactions (`aqx.js`), the 3D stage (`stage.js`), three.js and the three
typefaces. It follows the portfolio at aqua.is-a.dev: a black sky with slow
dots, glass cards that lean towards the pointer, Bodoni Moda headlines.
Change the accent in `assets/site.css` (`--ac`, `--ac-hi`), not in `aqx.css`.

## The 3D scene

`assets/scene.js` exports one function that builds its objects into
`stage.frame`. The stage (`assets/aqx/stage.js`) does the rest: camera, lights,
resizing, pointer and touch, pausing off screen. With reduced motion the scene
is one still frame; without WebGL a glow in the accent colour stays instead.

## Preview

Links have no `.html` (Vercel serves `/download` from `download.html`), so open
the folder through a server that does the same:

```bash
npx serve site
```

## Deploy

Vercel, root directory `site`, no build command. `vercel.json` sets clean URLs
and the security headers. The site sets no cookies and stores nothing.

## Tone

Direct, technical, honest. No hype, no invented numbers. Revox's whole
positioning is that it does not modify the Roblox client, so the site only ever
claims what the app actually does. The brief the copy was written from —
features, brand tokens and the list of things the site must not claim — is
[`docs/website/README.md`](../docs/website/README.md) in this repository.

The game and friend names in the 3D scene and in the picture of the Play
screen are made up.

## Licence

MIT — see [LICENSE](../LICENSE).
