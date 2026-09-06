# Self-Evolving Attack & Defense Demos

Two continuous, cinematic visual stories for non-technical audiences:

- `attack.html` shows a red-team agent discovering, absorbing, combining, and adapting attack skills.
- `defense.html` shows a defense harness learning from a live stream of attacks and assembling reusable protection gates.
- `index.html` is the entry page for choosing either demo.

## Run locally

Open `index.html` directly, or serve the directory with any static file server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`, `http://localhost:8080/attack.html`, or `http://localhost:8080/defense.html`.

Both demos auto-play as continuous visual systems. Use the on-screen controls or space bar to play and pause, and click the progress track to inspect a particular moment. A `?t=42` query can also open either demo at a specific second.

## Deployment

The included GitHub Actions workflow publishes the site to GitHub Pages whenever `main` is updated.

## Asset attribution

The OpenClaw pixel lobster is sourced from the public [OpenClaw repository](https://github.com/openclaw/openclaw/blob/main/docs/assets/pixel-lobster.svg), which is distributed under the repository's MIT license.
