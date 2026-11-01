// Renders the explainer's frames in headless Edge.
//
// Usage:  node render.mjs --stills 12.5,40,90 [--out build/stills]
//         node render.mjs [--workers 3] [--from 0] [--to end] [--clean]
//
// Finished frames are kept in build/frames, so an interrupted render picks up where it left off.
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const VIDEO = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(VIDEO, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.stl': 'model/stl', '.woff2': 'font/woff2' };

const option = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? fallback : process.argv[at + 1] ?? true;
};

const server = createServer((request, response) => {
  const path = normalize(join(REPO, decodeURIComponent(request.url.split('?')[0])));
  if (!path.startsWith(REPO) || !existsSync(path)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const url = `http://127.0.0.1:${server.address().port}/video/scene/index.html`;

async function openPage() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.sceneReady || window.sceneError, null, { timeout: 180000 });
  const error = await page.evaluate(() => window.sceneError);
  if (error) throw new Error(error);
  return { browser, page };
}

const capture = async (page, t, path) => {
  await page.evaluate((time) => window.renderAt(time), t);
  writeFileSync(path, await page.screenshot({ type: 'jpeg', quality: 94 }));
};

const stills = option('stills');
if (stills) {
  const out = resolve(VIDEO, option('out', 'build/stills'));
  mkdirSync(out, { recursive: true });
  const { browser, page } = await openPage();
  for (const t of stills.split(',').map(Number)) {
    const started = Date.now();
    await capture(page, t, join(out, `t${t.toFixed(2).padStart(7, '0')}.jpg`));
    console.log(`${t} s: ${Date.now() - started} ms`);
  }
  await browser.close();
} else {
  const timeline = JSON.parse(readFileSync(join(VIDEO, 'build', 'timeline.json'), 'utf8'));
  const total = Math.ceil(timeline.duration * timeline.fps);
  const from = Number(option('from', 0)), to = Math.min(Number(option('to', total)), total);
  const frames = join(VIDEO, 'build', 'frames');
  if (option('clean', false)) rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const name = (n) => join(frames, `${String(n).padStart(6, '0')}.jpg`);
  const queue = [];
  for (let n = from; n < to; n++) if (!existsSync(name(n))) queue.push(n);
  const count = queue.length;
  console.log(`${count} frames to render of ${total}`);
  const started = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: Number(option('workers', 3)) }, async () => {
    const { browser, page } = await openPage();
    for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
      // Written under a temporary name so that a crash can't leave a partial frame
      const temporary = `${name(n)}.tmp`;
      await capture(page, n / timeline.fps, temporary);
      renameSync(temporary, name(n));
      if (++done % 150 === 0) console.log(`${done}/${count}, ${((Date.now() - started) / done).toFixed(0)} ms per frame`);
    }
    await browser.close();
  }));
  console.log(`done in ${((Date.now() - started) / 60000).toFixed(1)} minutes`);
}
server.close();
