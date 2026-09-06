# Self-Evolving Red Team Demo

A continuous, cinematic visual story for non-technical audiences. The camera follows one red team agent as failed attempts become research, research becomes reusable skills, and the evolving skill chain ultimately causes a trusted AI personal assistant to send a confidential file externally.

## Run locally

Open `index.html` directly, or serve the directory with any static file server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

The story auto-plays along one uninterrupted timeline and pauses at five natural speaking moments. Use the on-screen control, right arrow, or space bar to continue; use the left arrow to revisit the previous moment. Add `?t=42` to the URL to inspect a specific second.

## Deployment

The included GitHub Actions workflow publishes the site to GitHub Pages whenever `main` is updated.

## Asset attribution

The OpenClaw pixel lobster is sourced from the public [OpenClaw repository](https://github.com/openclaw/openclaw/blob/main/docs/assets/pixel-lobster.svg), which is distributed under the repository's MIT license.
