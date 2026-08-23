# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A local render pipeline for the UPSCALD Marketing "One Call" demo video: a
20-second, 9:16 (1080×1920) product demo rendered to a real MP4 without any
paid video-generation service. A headless browser plays an HTML/CSS/JS scene
frame-by-frame, screenshots each frame at an exact timestamp, and ffmpeg
encodes the sequence.

The demo pitches UPSCALD's lead-response/booking automation to local service
businesses: a missed-call caption, a lock screen, a "New Lead" notification,
an SMS thread that books an electrician appointment, a confirmation card,
three rapid automated status notifications (reminder → en route → complete),
a 5-star review, and a closing logo lockup.

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
  and CSS is static (built once, either in markup or via the `buildNotif()` /
  template-literal `innerHTML` calls near the top of the `<script>`); a
  single global function, `window.__setTime(ms)`, is the only thing that
  changes anything — given any millisecond timestamp in `[0, DURATION_MS]`,
  it sets every element's opacity/transform directly (no CSS transitions,
  since transitions aren't seekable to an exact frame). This is what makes
  the render frame-accurate: the renderer never has to "catch" a moving
  animation, it just asks for a specific instant.
  - The timeline is organized as consecutive commented "Shot" blocks
    (`// ---------- Shot N [startMs-endMs]: description ----------`)
    inside `setTime()`. To retime or re-order a beat, find its shot comment
    and adjust the ms range. To change copy, edit the template-literal
    strings near the top of the script (bubbles, notification text, booking
    card, review) — no timeline changes needed for that. Shots are not
    strictly sequential/non-overlapping: the "dolly zoom" (see below) and
    the `#veil` crossfade both span multiple nominal shot boundaries.
  - `prog(v, start, end)` gives clamped 0–1 progress through a range;
    `setNotifState()`, `setBubbleState()`, and `setCaption()` are the shared
    arrive/hold/leave helpers most elements use. Adjacent shots that share
    the same screen region (e.g. message thread → booking card) must have
    their leave/arrive windows tuned so one is gone before the next is
    fully in, or they visually overlap.
  - Notifications are built once via `buildNotif(id, app, title, msg)` and
    reused for both the single "New Lead" notif (shot 5) and the three
    rapid-fire status notifs (shot 8) — they all sit at the same
    `.notif` position (`top:350px`) and are shown one at a time via
    `setNotifState`, not stacked.
  - The camera move is a single continuous scale on `#phone-wrap`
    (a "dolly-in") that ramps from t=3000 to t=13000, holds through
    t=15000, then reverses to a pulled-back scale by t=16000 — it is not
    a per-shot push/pull, it spans nearly the whole phone sequence.
  - `#veil` is a full-stage black div used for hard cuts/crossfades
    (e.g. the transition out of the phone sequence around t=16000);
    it's a separate mechanism from any single element's opacity.
  - `#caption` is one reused full-screen text element — `setCaption()`
    overwrites its text content for each caption beat (the opening "A
    missed call is a lost customer." and the later "Nothing goes cold.")
    rather than each caption having its own DOM node.
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

## Brand reference

`scene.html`'s `:root` custom properties are pinned to the UpScald Marketing
identity board — keep them exact rather than approximating:

- Grayscale: `--black:#0B0B0D`, `--gray-dark:#1D1D1F`, `--gray:#686B70`,
  `--gray-light:#F5F5F7`, `--white:#FFFFFF`.
- Accent gradient: `--orange:#FF8A00` → `--purple:#7B3FF2` → `--cyan:#00C2FF`
  (`--orange-red:#FF4500` and `--blue:#2244FF` are extra stops used only
  inside the logo mark's own SVG gradients, not general brand colors).
- Type: `--font-display` (SF Pro Display) for headlines/wordmark,
  `--font-text` (SF Pro Text) for body/support copy (taglines, notification
  text, chat bubbles, sub-labels).
- The phone hardware mockup (bezel gradient, OLED screen/notch black) and
  the lock-screen wallpaper gradient are device/scene chrome, not brand
  surfaces — they're intentionally not tied to the brand grayscale tokens.

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
