# Self-Evolving Red Team Demo

A 72-second, auto-playing visual story for non-technical audiences. It shows a self-evolving red team agent discovering and combining new skills, probing an AI personal assistant, and ultimately causing a confidential file to be sent externally.

## Run locally

Open `index.html` directly, or serve the directory with any static file server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

The experience starts automatically. Press `Space` to pause/resume, or use the replay button on the final screen.

## Deployment

The included GitHub Actions workflow publishes the site to GitHub Pages whenever `main` is updated.

## Asset attribution

The OpenClaw pixel lobster is sourced from the public [OpenClaw repository](https://github.com/openclaw/openclaw/blob/main/docs/assets/pixel-lobster.svg), which is distributed under the repository's MIT license.
