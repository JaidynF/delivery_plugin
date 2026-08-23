# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A local render pipeline for the UPSCALD Marketing "One Call" demo video: a
30-second, 9:16 (1080×1920) product demo rendered to a real MP4 without any
paid video-generation service. A headless browser plays an HTML/CSS/JS scene
frame-by-frame, screenshots each frame at an exact timestamp, and ffmpeg
encodes the sequence.

The demo is a two-phone dramatization, never both on screen at once: Phone A
("Customer," always enters from the left) makes an unanswered outgoing call,
gets ghosted, then — off-screen, on Phone B ("Mike's Electric," always enters
from the right) — UPSCALD auto-responds to the missed call. Cut back to
Phone A for the auto-reply text, a booking confirmation, a flurry of
automation notifications, a 5-star review, and a closing logo lockup.

## Commands

```bash
npm install    # installs Playwright; postinstall runs `playwright install chromium`
npm run render # equivalent to: node render.js
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
  is static markup; a single global function, `window.__setTime(ms)`, is
  the only thing that changes anything — given any millisecond timestamp in
  `[0, DURATION_MS]`, it sets every element's opacity/transform directly (no
  CSS transitions, since those aren't seekable to an exact frame). This is
  what makes the render frame-accurate: the renderer never has to "catch" a
  moving animation, it just asks for a specific instant.

  - **Camera rigs, not per-element scale.** `#rigB` wraps Phone B (+ its
    glow); `#rigA` wraps Phone A (+ its glow), the pill flurry, and the
    standalone review-card lockup. Each rig's own `transform: scale(...)`
    is the dolly push/pull for that section of the video — `cameraBScale(t)`
    ramps 1→1.25 across shots 6–7 ([10000,15000)); `cameraAScale(t)` ramps
    1→1.28 across shots 9–10 ([16000,21000)), holds through shots 11–12,
    then pulls back to 0.55 during shot 13's release ([27000,28000)).
    Everything nested inside a rig shares its scale automatically — which
    is exactly what caused a real bug (see the pill-flurry note below).

  - **Hard cuts are just step functions.** There's no `#veil` element —
    a "hard cut" (e.g. Shot 2 → Shot 3, Shot 5 → Shot 6, Shot 7 → Shot 8)
    is simply an element's opacity jumping from 1 to 0 in one frame with no
    fade window, since every frame is computed independently anyway.

  - **Two phones, four appearance windows.** Phone A is visible during
    `[4000,9000)` (the outgoing call, shots 3–4) and again during
    `[15000,24000)` (shots 8–11: idle lock screen → iMessage banner →
    booking sheet → pill flurry). Phone B is visible only during
    `[10000,15000)` (shots 6–7). A phone's *first* appearance each "episode"
    slides in from off-screen (`translateX` with `easeOutBack` overshoot,
    ~500ms); a phone reappearing after a hard cut (Phone A at t=15000) pops
    in already settled, no re-entrance animation, per the brief's "no
    re-entrance animation needed" instruction for that beat.

  - **Pill flurry ([21000,24000), shot 11) — coordinate-space gotcha.**
    `#pillFlurry` is a sibling of `#phoneA-wrap` inside `#rigA`, so both
    share the same *local* (pre-scale) coordinate space; `#rigA`'s dolly
    scale (held at 1.28 for this whole shot) is applied on top afterward.
    Getting a pill to dock flush against the phone's on-screen edge without
    overlapping it (or the booking card behind it) requires reasoning in
    on-screen pixels and converting back: `toLocal(screenX, screenY)`
    inverts the rig's scale-around-center transform. The width gotcha:
    the rig also scales a pill's *rendered width*, not just its position —
    so docking a pill's right edge flush against the phone's left edge
    needs `screenLeftEdge = DOCK_X - offsetWidth * SCALE_HOLD`, not
    `DOCK_X - offsetWidth`. Getting either of these wrong (both happened
    once) silently lands pills off in blank space or drifting straight
    across the booking card — there's no visual error, just a wrong frame,
    so re-verify with `getBoundingClientRect()` against the phone's known
    on-screen box after touching any pill math, not just by eyeballing one
    frame.

  - **Shared per-frame helpers**: `clamp01`, `lerp`, `prog(v,start,end)`
    (clamped 0–1 progress through a range), `easeOutCubic`,
    `easeInOutCubic`, `easeOutBack` (the spring/overshoot used for every
    phone and notification entrance). `setPill(node, def, t)` drives the
    flurry; there's no generic fade-window helper reused across every
    element type the way earlier revisions had one — each screen state
    (call screen, notifications, booking sheet, stars, review text) has its
    own small inline `if/else` block in `setTime()`, organized by shot
    number in comments (`// ---------- Shot N [startMs-endMs]: ... ----------`).

  - `window.__RENDER_MODE`, set via `page.addInitScript` before the page
    loads, tells the scene to skip its own `requestAnimationFrame`
    self-preview loop — `render.js` drives `__setTime` directly instead and
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

## Visual style — this video's colors are locked, not approximate

Unlike a general brand-identity pass, this scene's palette comes from an
explicit "no exceptions" production brief and must be followed exactly:

- **Stage background is pure `#000000`** in every frame — no gradients, no
  vignettes, no ambient color outside the phones themselves. (Gradients and
  textures *inside* a phone's own screen — the call screen, the lock-screen
  wallpaper — are fine; the "no exceptions" rule is about the stage, not
  screen content.)
- Text: `--white:#FFFFFF` for primary lines, `--gray:#8A8A8F` for secondary
  lines/labels — these exact values, not a warmer/darker near-black or a
  different mid-gray from other UPSCALD collateral (business cards, the
  website) which use a different, unrelated grayscale ramp. This video's
  palette does not need to match that other collateral.
- Accent gradient: `--orange-red:#FF4500` → `--orange:#FF8A00` →
  `--purple:#7B3FF2` → `--cyan:#00C2FF` → `--blue:#2244FF`, used exactly as
  laid out in the logo mark's two overlapping SVG polygons (left panel:
  orange-red→orange; right panel: blue→purple→cyan) and reused in the
  brand-gradient notification icon.
- Spec-specific one-off colors, each used for exactly one purpose — don't
  reuse them elsewhere: `--red-miss:#FF3B30` (missed-call banner only,
  distinct from the brand gradient), `--link-blue:#0A84FF` (the tappable
  link segment inside the iMessage banner, matching real iOS link
  auto-detection styling), `--imessage-green:#34C759` (the Messages app
  icon, distinct from UPSCALD's own brand-gradient notification icon).
- Type: `--font-display` (SF Pro Display) for headlines/names/titles,
  `--font-text` (SF Pro Text) for body/support copy (taglines, notification
  body text, chat/message text, phone labels, review byline).
- "UPSCALD" always renders full uppercase, no exceptions.

## Working in this repo

- Never let `scene.html`'s `DURATION_MS` and `render.js`'s `DURATION_MS`
  drift apart — always change both together.
- When adjusting shot timing, check neighboring shots' arrive/leave windows
  too; the most likely bug is two shots overlapping visually because one's
  fade-out extends past the next one's fade-in, or (see the pill-flurry
  note above) an element inside a scaled rig landing somewhere other than
  where its raw coordinates suggest.
- Verify timing/visual changes by opening `scene.html` in a browser first
  (fast, self-playing loop) before running a full `npm run render` (slow —
  real-time is not real-time here, it's ~900 individual screenshots at
  30fps for 30 seconds). For anything involving a scaled rig (pills,
  camera-relative positioning), also spot-check with
  `getBoundingClientRect()` against known on-screen boxes — visual
  eyeballing of a couple of frames can miss an element that's silently
  landed off-canvas or behind another element for most of its lifetime.
