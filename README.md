# UPSCALD Demo Video — Render Project

Renders the 30-second "One Call" demo video to a real MP4 file — no
HyperFrames, Higgsfield, or paid video-generation service required.
This runs the whole pipeline locally: a headless browser plays the
scene frame-by-frame, screenshots each frame, and ffmpeg encodes the
sequence into video.

## What's in this folder

- `scene.html` — the actual animated video, built as a deterministic
  timeline. Every visual moment (logo, the two phones — customer and
  Mike's Electric — notifications, message thread, booking card,
  notification pill flurry, review stars, camera dolly/pull-back) is
  driven by a single function, `window.__setTime(ms)`, that sets the
  whole scene to look exactly as it should at any millisecond. This is
  what makes the render frame-accurate — the renderer doesn't have
  to "hope" it captured the right moment, it can ask for any exact
  timestamp directly.
- `render.js` — drives a headless Chromium browser through the scene
  at 30fps, screenshots every frame, then calls ffmpeg to encode.
- `package.json` — the one dependency (Playwright, for the headless
  browser) and the `npm run render` shortcut.

## One-time setup

Run these from inside this folder, in Claude Code (or any terminal
with Node.js installed):

```bash
npm install
```

This also runs `playwright install chromium` automatically (via the
`postinstall` script), which downloads a headless browser Playwright
needs — this is a one-time ~150MB download.

You also need **ffmpeg** installed on your machine. If you don't
have it already:

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt-get install ffmpeg

# Windows (with winget)
winget install ffmpeg
```

`render.js` checks for ffmpeg automatically and will tell you clearly
if it's missing before doing anything else.

## Rendering the video

```bash
npm run render
```

This will:
1. Launch a headless browser at 1080×1920 (9:16, ready for
   Instagram/TikTok/Reels or a vertical sales demo)
2. Step through the full 30 seconds at 30fps (900 frames total),
   capturing a PNG screenshot of the exact visual state at each frame
3. Encode those 600 PNGs into `output/upscald-demo-silent.mp4` with
   ffmpeg (high quality, CRF 16, slow preset — this is intentionally
   a quality-over-speed encode since it's a short clip)
4. If you've dropped a music file at `assets/music.mp3`, mux it into
   the final video automatically
5. Clean up the intermediate PNG frames

Expect the frame-capture step to take a few minutes — it's not real-
time playback, it's rendering ~600 individual screenshots one at a
time, which is slower than watching the video but far more reliable
than trying to capture a live screen recording.

**Output:** `output/upscald-demo.mp4`

## Adding music

Drop any royalty-free track at:

```
assets/music.mp3
```

Then re-run `npm run render`. The script automatically detects the
file and muxes it in — no code changes needed. If the file's longer
than 30 seconds, ffmpeg trims it to match the video length
automatically (`-shortest` flag). If you don't have music yet, the
video still renders fine without it — you'll just get a silent MP4
you can add sound to later in any editor.

For a track that matches the brief (sparse, percussive, minimal,
builds under the phone, swells at the review moment, drops out for
the pull-back), search "minimal tech ambient" or "Apple product film
style" on a royalty-free library like Epidemic Sound, Artlist, or
YouTube Audio Library (free).

## Adjusting the video

Everything about *what happens and when* lives in one place: the
`setTime(t)` function inside `scene.html`. Each shot from the
original script is commented and mapped to its exact millisecond
range, e.g.:

```js
// ---------- Shot 10 [18000-21000]: booking bottom sheet ----------
```

To change timing, find the relevant shot's comment block and adjust
the millisecond values. To change copy, find the relevant text in
the HTML body (bubbles, captions, notification titles) and edit it
directly — no need to touch the timeline logic.

If you change `DURATION_MS` in `scene.html`, update the matching
`DURATION_MS` constant at the top of `render.js` to the same value,
or the video will be cut short or padded with the final frame.

## Troubleshooting

- **"ffmpeg not found"** — install it with the commands above, then
  re-run `npm run render`.
- **Playwright browser download fails / times out** — re-run
  `npx playwright install chromium` manually, then try
  `npm run render` again.
- **Video looks different from the live preview** — opening
  `scene.html` directly in a browser also works as a live preview
  (it self-plays on a loop), which is useful for checking timing
  changes quickly before doing a full render. The rendered MP4 and
  the live preview use the exact same `setTime()` function, so they
  should always match.
- **Render is slow** — this is expected; frame-by-frame screenshot
  capture at high quality is inherently slower than real-time. A
  faster but lower-quality option: lower `FPS` in `render.js` to 24,
  or change `-crf 16` to a higher number like `23` for a smaller,
  faster encode.
