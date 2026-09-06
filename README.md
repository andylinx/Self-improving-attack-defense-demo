# Self-Evolving Red Team Demo

A nine-page, presenter-controlled visual story for non-technical audiences. It shows a self-evolving red team agent discovering and combining new skills, learning from failed attempts, and ultimately causing a trusted AI personal assistant to send a confidential file externally.

## Run locally

Open `index.html` directly, or serve the directory with any static file server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

Use the on-screen controls, arrow keys, or space bar to move through the story. Each page runs a short internal animation and then waits for the presenter.

## Deployment

The included GitHub Actions workflow publishes the site to GitHub Pages whenever `main` is updated.

## Asset attribution

The OpenClaw pixel lobster is sourced from the public [OpenClaw repository](https://github.com/openclaw/openclaw/blob/main/docs/assets/pixel-lobster.svg), which is distributed under the repository's MIT license.
