# Aura

An instrument for tending your inner flame. Aura is a vibe score that you
kindle with good acts and smother with bad ones.

**Live**: https://number1victoryroyale.github.io/Aura/

## Features

- **The dial**: a glowing flame-orb with an SVG progress ring showing how far
  you are through your current tier (Fractured → Clouded → Dormant → Kindled
  → Luminous → Transcendent).
- **Kindling / Smothering**: tap a preset action (or add your own) to
  instantly gain or lose aura.
- **Set the Flame**: type in any number to set your aura directly.
- **Impact frames**: kindling triggers a rising ember burst, a screen flash,
  and a slamming "+N" banner. Smothering triggers falling ash/cinder, a
  glitchy shake, and a "-N" banner. Effects scale with the size of the
  change.
- **Ember Trail**: a history log of everything you've done.
- Everything is saved locally in your browser (`localStorage`) — no backend
  required.

## Running it locally

It's a static site — just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deployment

Pushes to `main` (or the active development branch) are built and deployed
to GitHub Pages automatically by `.github/workflows/deploy-pages.yml`.

## Removing a custom action

Right-click (or long-press on mobile) a custom action you added to remove it.
Default actions can't be removed.
