# Blind Date with a Book 📚

An anti-algorithm "serendipity engine" for book discovery. Pick a mood, an
era, and a genre nudge — get back up to five wrapped parcels, each with only a cryptic hint
and three keywords. Swipe through them, tap one to tear it open, and meet your match.

No accounts, no tracking, no recommendation engine. Just live data from the
free [Open Library API](https://openlibrary.org/developers/api).

## Project structure

```
.
├── public/                  # everything served to the browser
│   ├── index.html
│   ├── manifest.webmanifest # PWA manifest ("Add to Home Screen")
│   ├── sw.js                # service worker (app-shell caching)
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js           # UI controller: tabs, picker, reveal, pile
│   │   ├── api.js           # Open Library search + fallback logic
│   │   ├── data.js          # moods / decades / genres config
│   │   └── storage.js       # localStorage "TBR pile"
│   └── assets/              # icons + og-image.png (placeholders — swap
│                             # these for your own artwork any time)
├── src/
│   └── worker.js            # Cloudflare Worker: serves public/ via ASSETS
└── wrangler.toml            # Worker + static assets configuration
```

## Local development

```bash
npm install -g wrangler   # if you don't already have it
wrangler dev
```

This serves the app at `http://localhost:8787` using the same Worker code
that runs in production.

## Deploying to Cloudflare (via GitHub sync)

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Connect
   to Git** and select the repo.
3. Cloudflare will detect `wrangler.toml` automatically:
   - `main = "src/worker.js"` — the Worker entry point.
   - `[assets] directory = "public"` — the static files it serves.
4. Deploy. Your app will be live at
   `https://blind-date-book.<your-subdomain>.workers.dev/`.

If your subdomain differs from `suvadipchakraborty`, update the absolute
URLs in `public/index.html` (`og:url`, `og:image`, `twitter:image`,
`canonical`) and `public/js/app.js` (`APP_URL`) to match.

## Swapping the placeholder artwork

`public/assets/icon-192.png`, `icon-512.png`, their `-maskable` variants,
and `og-image.png` are generated placeholders in the app's color palette
(ink plum / kraft paper / brass / wine). Drop in your own square icons and
a 1200×630 `og-image.png` at any time — no other code changes needed.

## Notes on the API strategy

`public/js/api.js` builds an Open Library `search.json` query from the
selected mood/genre/decade, fetches up to 100 matching docs, and (when the
catalogue has more than that) jumps to a random offset first for variety.
It only keeps results that have a cover, title, and author, then falls
back through progressively broader queries (dropping the decade, then the
genre, then the mood) so a match is almost always found.

Built by Suva.
