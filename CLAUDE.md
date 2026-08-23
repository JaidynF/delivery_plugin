# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A local render pipeline for the UPSCALD "One Call" demo video: a 20-second,
9:16 (1080×1920) product demo rendered to a real MP4 without any paid
video-generation service. A headless browser plays an HTML/CSS/JS scene
frame-by-frame, screenshots each frame at an exact timestamp, and ffmpeg
encodes the sequence.

## Commands

```bash
npm install        # installs Playwright; postinstall runs `playwright install chromium`
npm run render      # equivalent to: node render.js
```

Requires **ffmpeg** on PATH separately (not an npm dependency) — `render.js`
checks for it up front and exits with install instructions if missing.

There is no build step, linter, or test suite in this repo — it's a
single-purpose render script, verified by actually running `npm run render`
and inspecting the output video/frames.

To sanity-check scene changes quickly without a full render, open
`scene.html` directly in any browser — it self-plays on a loop. This uses
the exact same `__setTime()` function the renderer drives, so what you see
in the browser is what ends up in the MP4.

## Architecture

Three files, one direction of dependency: `scene.html` is the source of
truth for every visual; `render.js` only drives it and never contains
visual/timing logic itself.

- **`scene.html`** — the entire video as a deterministic timeline. All DOM
  and CSS is static; a single global function, `window.__setTime(ms)`,
  is the only thing that changes anything — given any millisecond
  timestamp in `[0, DURATION_MS]`, it sets every element's opacity/transform
  directly (no CSS transitions, since transitions aren't seekable to an
  exact frame). This is what makes the render frame-accurate: the renderer
  never has to "catch" a moving animation, it just asks for a specific
  instant.
  - The timeline is organized as consecutive commented "Shot" blocks
    (`// ---------- Shot N [startMs-endMs]: description ----------`)
    inside `__setTime`. To retime or re-order a beat, find its shot
    comment and adjust the ms range. To change copy, edit the static text
    in the HTML body directly (bubbles, notification text, review) — no
    timeline changes needed for that.
  - `fadeWindow(t, inStart, inEnd, outStart, outEnd)` is the shared
    fade-in/hold/fade-out helper nearly every element uses; adjacent shots
    that share the same screen region (e.g. message thread → booking card)
    must have their fade-out/fade-in windows tuned so one is gone before
    the next is fully in, or they visually overlap.
  - `window.__RENDER_MODE`, set via `page.addInitScript` before the page
    loads, tells the scene to skip its own `requestAnimationFrame`
    self-preview loop — render.js drives `__setTime` directly instead and
    the two must never run at once.
  - `DURATION_MS` is declared independently in both `scene.html` and
    `render.js`. Changing the video length means updating **both** — there
    is no shared config file.

- **`render.js`** — pure orchestration, no scene knowledge. Launches
  headless Chromium (Playwright) at exactly 1080×1920, waits for
  `window.__setTime` to exist, then for each of `TOTAL_FRAMES` (`FPS *
  DURATION_MS/1000`) calls `__setTime(ms)` and screenshots to
  `frames/frame_NNNNN.png`. Afterward: ffmpeg encodes the PNG sequence to
  `output/upscald-demo-silent.mp4` (H.264, `-crf 16 -preset slow`), then
  muxes in `assets/music.mp3` if present (`-shortest`, so long tracks are
  trimmed to video length) to produce `output/upscald-demo.mp4`. Frame
  PNGs are deleted after encoding; only the MP4(s) remain in `output/`.

- **`package.json`** — one runtime dependency, Playwright. `postinstall`
  triggers `playwright install chromium`, a ~150MB one-time browser
  download — expect `npm install` to be slow/network-dependent the first
  time.

`assets/music.mp3` and the `frames/`/`output/` directories are optional
and generated, respectively — none are committed (see `.gitignore`).

## Working in this repo

- Never let `scene.html`'s `DURATION_MS` and `render.js`'s `DURATION_MS`
  drift apart — always change both together.
- When adjusting shot timing, check neighboring shots' fade windows too;
  the most likely bug is two shots overlapping visually because one's
  fade-out extends past the next one's fade-in (this happened once
  between the message-thread and booking-card shots — see the shot 6/7
  boundary in `scene.html` for the pattern to follow).
- Verify timing/visual changes by opening `scene.html` in a browser
  first (fast) before running a full `npm run render` (slow — real-time
  is not real-time here, it's ~600 individual screenshots).
