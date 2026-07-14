# Sip & Saga — The Indian Cocktail & Mocktail Encyclopedia

A single-purpose static site: **102 complete recipes** (cocktails, mocktails, bomb shots, layered shots, chai, coffee, lassi, smoothies, shakes, sherbets) with a cinematic canvas pour on loop, a Bomb Lab drop animation, instant filters + search, FLIP card→recipe expansion, and the **Bartender's Slang** measurement translator.

No frameworks. No build step. Three files + data.

```
index.html   – markup, fonts, ad-slot placeholders
style.css    – full design system (Fraunces + Karla, plum/amber palette)
script.js    – canvas animation engine, filters, search, FLIP detail view
data.js      – 102 recipes, auto-generated (one unique Unsplash photo each)
```

## Deploy to GitHub Pages (2 minutes)

1. Create a repo (e.g. `sip-and-saga`), push these four files to the root of `main`.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save.
3. Your site is live at `https://<username>.github.io/sip-and-saga/` in ~1 minute.

Any static host works the same way (Netlify/Vercel/Cloudflare Pages: just drag the folder).

## Monetization — flip these switches when live

- **Amazon affiliate**: every recipe's "Stock the bar" links and the Bar Shelf use the tag `sipandsaga-21`. Search-replace it with your own Associates tag (in `script.js`, one place: the `affLink()` function).
- **Ads**: two styled placeholder slots exist (`.ad-slot` in `index.html`, library + shelf sections). Paste your AdSense unit inside `.ad-inner`.
- **Sponsored pours**: the second slot is written as a native "partner recipe" pitch.

## Notes

- Images hotlink Unsplash CDN (free licence, no attribution required) — each recipe has a unique photo; a graceful gradient fallback shows if any URL ever 404s.
- All animation honours `prefers-reduced-motion` (canvases hold their final frame, transitions are disabled).
- Canvases pause when off-screen or when the tab is hidden; device pixel ratio is capped at 2 for 60 fps on mobile.
- Nutrition, ABV and ₹ costs are per-serving estimates.
