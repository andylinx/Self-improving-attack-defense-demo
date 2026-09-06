# Self-Evolving Attack & Defense Demos

Two cinematic, non-technical visual stories about AI-agent security.

- `attack.html` — a red-team agent travels along a timeline, absorbing skills from the
  internet and from its own failures, visibly growing stronger, then breaches OpenClaw in
  two simple steps.
- `defense.html` — a static split screen: a self-evolving attacker on the left, and a
  defense harness on the right that learns a new safeguard from every successful attack
  until nothing gets through.
- `index.html` — the entry page.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Both demos auto-play. Use the on-screen controls or the space bar to play and pause, and
click the progress track to jump to any moment. Left and right arrows scrub. A `?t=42`
query opens either demo at a specific second.

## Assets

The pixel lobster (`assets/openclaw-lobster.svg`) is the OpenClaw assistant. The pixel
skull (`assets/attacker-skull.svg`) is the red-team attacker.

## Deployment

The included GitHub Actions workflow publishes the site to GitHub Pages on every push to
`main`.
