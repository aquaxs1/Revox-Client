# Revox Client — website

The marketing site for [Revox Client](https://github.com/aquaxs1/Revox-Client),
a desktop launcher for the official Roblox client. Plain HTML and CSS, no build
step, deployed on Vercel to <https://revoxclient.vercel.app>.

The app itself lives in a separate repository. This one only holds the site.

## Layout

```
index.html         the landing page: positioning, comparison table, FAQ
features.html      what the app does, in detail
setup.html         installing and first run
download.html      links to the latest GitHub release
terms.html         terms of use
404.html           not-found page
assets/style.css   the whole stylesheet
assets/og-image.png  the social preview
Logo.PNG           the app icon, also used as the apple-touch-icon
favicon.svg        the favicon
sitemap.xml        every page listed above
robots.txt
vercel.json        security headers, clean-URL and caching rules
Revoxclient-info.txt  what the app is and does — the source for the copy
Website-info.txt      the brief this site was written from
```

## Working on it

There is nothing to install. Open a page in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

`vercel.json` has `cleanUrls: false`, so links keep their `.html` ending. When
you add a page, add it to `sitemap.xml` and give it a `<link rel="canonical">`
pointing at its own URL.

## Deploying

Vercel builds from `main` on every push — there is no build command, the folder
is served as it is.

## Tone

Direct, technical, honest. No hype, no invented numbers. Revox's whole
positioning is that it does not modify the Roblox client, so the site only ever
claims what the app actually does. `Website-info.txt` spells this out.

## Licence

MIT — see [LICENSE](LICENSE).
