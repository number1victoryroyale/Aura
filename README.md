# Aura

A little app that tracks your "aura" — a vibe score that goes up when you do
good things and down when you don't.

## Features

- **Aura orb**: a big glowing number showing your current aura, colored and
  labeled by tier (Doomed → Cursed → Neutral → Radiant → Ethereal → Legendary).
- **Positive / negative actions**: tap a preset action (or add your own custom
  one) to instantly gain or lose aura.
- **Manual set**: type in any number to set your aura directly.
- **Impact frames**: gaining aura triggers a huge golden particle burst, a
  screen flash, and a slamming "+N AURA" banner. Losing aura triggers a dark
  red glitchy shake, a red flash, and a "-N AURA" banner. Effects scale with
  the size of the change.
- **History log**: every action you take is recorded.
- Everything is saved locally in your browser (`localStorage`) — no backend
  required.

## Running it

It's a static site — just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Removing a custom action

Right-click (or long-press on mobile) a custom action you added to remove it.
Default actions can't be removed.
