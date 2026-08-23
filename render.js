#!/usr/bin/env node
/**
 * UPSCALD demo video renderer
 * ----------------------------------------------------------------
 * Renders scene.html to a real MP4 by driving window.__setTime(ms)
 * frame-by-frame in a headless browser and screenshotting each
 * frame, then encoding the PNG sequence with ffmpeg. This makes the
 * render deterministic and frame-accurate regardless of how fast or
 * slow the machine actually is — no dropped frames, no timing drift.
 *
 * USAGE (run from this folder):
 *   npm install
 *   node render.js
 *
 * Optional: put a music bed at ./assets/music.mp3 and it will be
 * muxed into the final video automatically. If it's missing, the
 * script still produces a silent MP4 — you can add music later in
 * any editor, or re-run once you've dropped a track in.
 *
 * Output: ./output/upscald-demo.mp4
 * ----------------------------------------------------------------
 */

const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');
const { chromium } = require('playwright');

const FPS = 30;
const DURATION_MS = 20000;
const TOTAL_FRAMES = Math.round((DURATION_MS / 1000) * FPS);
const WIDTH = 1080;
const HEIGHT = 1920;

const ROOT = __dirname;
const SCENE_PATH = path.join(ROOT, 'scene.html');
const FRAMES_DIR = path.join(ROOT, 'frames');
const OUTPUT_DIR = path.join(ROOT, 'output');
const MUSIC_PATH = path.join(ROOT, 'assets', 'music.mp3');
const OUTPUT_SILENT = path.join(OUTPUT_DIR, 'upscald-demo-silent.mp4');
const OUTPUT_FINAL = path.join(OUTPUT_DIR, 'upscald-demo.mp4');

function checkFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (r.status !== 0) {
    console.error('\n[render.js] ffmpeg not found on PATH.');
    console.error('Install it first:');
    console.error('  macOS:   brew install ffmpeg');
    console.error('  Ubuntu:  sudo apt-get install ffmpeg');
    console.error('  Windows: winget install ffmpeg\n');
    process.exit(1);
  }
}

function prepDirs() {
  for (const d of [FRAMES_DIR, OUTPUT_DIR]) {
    fs.rmSync(d, { recursive: true, force: true });
    fs.mkdirSync(d, { recursive: true });
  }
}

async function renderFrames() {
  console.log(`[render.js] Launching headless browser (${WIDTH}x${HEIGHT}, ${FPS}fps, ${TOTAL_FRAMES} frames)...`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  // Load the scene with render mode flagged BEFORE scripts run,
  // so scene.html skips its own requestAnimationFrame self-preview loop.
  await page.addInitScript(() => { window.__RENDER_MODE = true; });
  await page.goto('file://' + SCENE_PATH);

  // Wait until the scene has defined the timeline function.
  await page.waitForFunction(() => typeof window.__setTime === 'function');

  const t0 = Date.now();
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const ms = (i / (TOTAL_FRAMES - 1)) * DURATION_MS;
    await page.evaluate((t) => window.__setTime(t), ms);
    // Small settle delay lets any CSS transition-driven layout finish
    // painting before we screenshot (the scene itself is transform/
    // opacity-only per frame, so this is mostly a safety margin).
    await page.waitForTimeout(0);
    const framePath = path.join(FRAMES_DIR, `frame_${String(i).padStart(5, '0')}.png`);
    await page.screenshot({ path: framePath });

    if (i % 30 === 0 || i === TOTAL_FRAMES - 1) {
      const pct = Math.round(((i + 1) / TOTAL_FRAMES) * 100);
      process.stdout.write(`\r[render.js] Capturing frames: ${pct}% (${i + 1}/${TOTAL_FRAMES})   `);
    }
  }
  console.log(`\n[render.js] Frame capture done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await browser.close();
}

function encodeVideo() {
  console.log('[render.js] Encoding frames to video with ffmpeg...');
  const cmd = [
    'ffmpeg', '-y',
    '-framerate', String(FPS),
    '-i', path.join(FRAMES_DIR, 'frame_%05d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '16',
    '-preset', 'slow',
    OUTPUT_SILENT,
  ];
  execSync(cmd.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' '), { stdio: 'inherit' });
}

function muxAudio() {
  if (!fs.existsSync(MUSIC_PATH)) {
    console.log('\n[render.js] No music bed found at ./assets/music.mp3 — leaving video silent.');
    console.log('[render.js] Drop a track there and re-run to add music, or add it in any editor afterward.');
    fs.copyFileSync(OUTPUT_SILENT, OUTPUT_FINAL);
    return;
  }
  console.log('[render.js] Music bed found — muxing audio into final video...');
  const cmd = [
    'ffmpeg', '-y',
    '-i', OUTPUT_SILENT,
    '-i', MUSIC_PATH,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    '-map', '0:v:0',
    '-map', '1:a:0',
    OUTPUT_FINAL,
  ];
  execSync(cmd.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' '), { stdio: 'inherit' });
}

function cleanupFrames() {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
}

(async () => {
  console.log('=== UPSCALD demo video renderer ===\n');
  checkFfmpeg();
  prepDirs();
  await renderFrames();
  encodeVideo();
  muxAudio();
  cleanupFrames();
  console.log(`\n[render.js] Done. Final video: ${OUTPUT_FINAL}`);
})().catch((err) => {
  console.error('\n[render.js] Render failed:', err);
  process.exit(1);
});
