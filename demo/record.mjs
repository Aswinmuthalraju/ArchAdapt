// Records each scene of the demo from the REAL app (no custom pages), paced to the narration.
// Usage: node demo/setup.mjs && node demo/record.mjs [scene ...]     (scenes: a1 a2 a3 b1 onb c1 c2a c2b)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = 'http://localhost:3000';
const CLIPS = path.join(HERE, 'clips');
const ST = JSON.parse(fs.readFileSync(path.join(CLIPS, 'state.json'), 'utf8'));
const dur = JSON.parse(fs.readFileSync(path.join(HERE, 'audio', 'durations.json'), 'utf8'));
const TEMPO = 0.93, PAD = 0.3;
const T = (id) => dur[id] / TEMPO + PAD;            // seconds each narrated scene lasts on screen
const W = 1600, H = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });

const CURSOR = `(() => { const mk = () => { if (document.getElementById('__cur')) return; const d = document.createElement('div'); d.id='__cur';
 d.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;width:26px;height:26px;will-change:transform';
 d.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7 19 3-8 8-3z" fill="#1B1B1F" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
 (document.body||document.documentElement).appendChild(d);
 window.addEventListener('mousemove', e => { d.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
 window.addEventListener('mousedown', () => { d.firstChild.style.transform = 'scale(.82)'; }, true);
 window.addEventListener('mouseup', () => { d.firstChild.style.transform = 'none'; }, true); };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk(); })()`;

let mouse = { x: W / 2, y: H / 2 };
async function glide(page, x, y, ms = 600) {
  const n = Math.max(10, Math.round(ms / 20)); const { x: x0, y: y0 } = mouse;
  for (let i = 1; i <= n; i++) { const t = i / n, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e); await sleep(ms / n); }
  mouse = { x, y };
}
async function glideTo(page, loc, ms = 600) { await loc.scrollIntoViewIfNeeded(); await sleep(120); const b = await loc.boundingBox(); await glide(page, b.x + b.width / 2, b.y + b.height / 2, ms); }
async function clickOn(page, loc, ms = 600) { await glideTo(page, loc, ms); await sleep(100); await page.mouse.down(); await sleep(60); await page.mouse.up(); await sleep(120); }
// Constant, calm page scroll: set scrollY every animation frame with a gentle ease (time-accurate, no wheel lag).
const smoothScroll = (page, toY, ms) => page.evaluate(({ toY, ms }) => new Promise((res) => {
  const y0 = scrollY, t0 = performance.now();
  const step = (now) => { const f = Math.min(1, (now - t0) / ms), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; scrollTo(0, y0 + (toY - y0) * e); f < 1 ? requestAnimationFrame(step) : res(); };
  requestAnimationFrame(step);
}), { toY, ms });
// Wheel scroll for inner scroll containers (e.g. the compliance report), time-accurate.
async function wheelScroll(page, total, ms) {
  const t0 = Date.now(); let sent = 0;
  while (true) { const f = Math.min(1, (Date.now() - t0) / ms), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; const d = total * e - sent; if (Math.abs(d) >= 1) { await page.mouse.wheel(0, d); sent += d; } if (f >= 1) break; await sleep(16); }
}

async function scene(name, { state, url }, fn) {
  if (want.length && !want.includes(name)) return;
  const dir = path.join(CLIPS, `_${name}`); fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } }, storageState: state });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage(); const t0 = Date.now(); const marks = {}; mouse = { x: W / 2, y: H / 2 };
  const mark = (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); };
  await page.goto(`${APP}${url}`, { waitUntil: 'load' });
  await fn(page, mark); mark('end');
  await page.close(); await ctx.close();
  fs.copyFileSync(path.join(dir, fs.readdirSync(dir).find((x) => x.endsWith('.webm'))), path.join(CLIPS, `${name}.webm`));
  fs.writeFileSync(path.join(CLIPS, `${name}.json`), JSON.stringify(marks, null, 1));
  console.log(name, JSON.stringify(marks));
}
const hold = async (until, t0ms) => { const left = until * 1000 - (Date.now() - t0ms); if (left > 0) await sleep(left); };

// ---- A: landing page and "More than a chatbot"
await scene('a1', { state: ST.guest, url: '/' }, async (page, mark) => {
  await sleep(900); mark('go'); const t0 = Date.now();
  await glide(page, W * .62, H * .55, 700);
  await smoothScroll(page, 1500, (T('a1') - 1.2) * 1000); await hold(T('a1'), t0);
});
await scene('a2', { state: ST.guest, url: '/' }, async (page, mark) => {
  const cmp = await page.evaluate(() => { const r = document.querySelector('.compare').getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
  await page.evaluate((y) => scrollTo(0, y), cmp.top - 40); await sleep(1100); mark('go'); const t0 = Date.now();
  await glide(page, W * .7, H * .5, 500);
  await smoothScroll(page, cmp.top + cmp.h - H + 40, (T('a2') - 0.9) * 1000); await hold(T('a2'), t0);
});
await scene('a3', { state: ST.guest, url: '/how-it-works' }, async (page, mark) => {
  await sleep(1000); mark('go'); const t0 = Date.now();
  await glide(page, W * .6, H * .5, 500);
  await smoothScroll(page, 2300, (T('a3') - 1.1) * 1000); await hold(T('a3'), t0);
});

// ---- B: click Start, two modes, then the homeowner flow with optional extras
await scene('b1', { state: ST.guest, url: '/how-it-works' }, async (page, mark) => {
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(1100); mark('go'); const t0 = Date.now();
  const start = page.locator('a[href="/onboarding"]', { hasText: /Start Designing/i }).first();
  await clickOn(page, start, 900);
  if (!(await page.waitForURL('**/onboarding**', { timeout: 6000 }).then(() => true).catch(() => false))) { await start.click({ force: true }); await page.waitForURL('**/onboarding**'); }
  await sleep(900);
  await clickOn(page, page.getByRole('button', { name: /I am an architect/i }), 700); await sleep(1100);
  await clickOn(page, page.getByRole('button', { name: /I am building a home/i }), 600); await hold(T('b1'), t0);
});
await scene('onb', { state: ST.guest, url: '/onboarding' }, async (page, mark) => {
  await sleep(700); mark('go'); const t0 = Date.now();
  // plot (target: b2)
  await clickOn(page, page.locator('#plot-width'), 360); await page.locator('#plot-width').fill(''); await page.locator('#plot-width').pressSequentially('40', { delay: 85 });
  await clickOn(page, page.locator('#plot-depth'), 340); await page.locator('#plot-depth').fill(''); await page.locator('#plot-depth').pressSequentially('60', { delay: 85 }); await sleep(250);
  await clickOn(page, page.getByRole('button', { name: /Next: Your home/i }), 420); await sleep(250);
  await hold(T('b2'), t0); mark('p2');
  // optional extras + note to the AI (target: b3)
  const t1 = Date.now();
  for (const n of ['Study', 'Puja Room']) await clickOn(page, page.getByText(n, { exact: true }).first(), 360);
  const note = page.locator('textarea').first(); await clickOn(page, note, 360);
  await note.pressSequentially('Elderly parents live with us, lots of light.', { delay: 30 }); await sleep(800);
  await clickOn(page, page.getByRole('button', { name: /Next: Style/i }), 420); await sleep(500);
  await hold(T('b3'), t1); mark('p3');
  // style + generate (silent beat, 3.4s)
  await clickOn(page, page.getByRole('button', { name: /^Kerala Traditional/ }), 420);
  await clickOn(page, page.getByRole('button', { name: /Climate-Adaptive/ }), 360);
  const gen = page.getByRole('button', { name: /Generate design/i }); await gen.scrollIntoViewIfNeeded(); await sleep(200);
  await clickOn(page, gen, 420); await sleep(700); mark('p4');
});

async function quickClick(page, loc, ms = 260) { const b = await loc.boundingBox(); await glide(page, b.x + b.width / 2, b.y + b.height / 2, ms); await page.mouse.down(); await sleep(40); await page.mouse.up(); }

// ---- C: the output (saved edition, shown instantly)
const WS = new URL(ST.wsUrl).pathname;
await scene('c1', { state: ST.v1, url: WS }, async (page, mark) => {
  await page.locator('svg[role="img"]').waitFor(); await sleep(700); mark('go');
  await glide(page, W * .5, H * .5, 700); await sleep(1100); mark('p1');
  await clickOn(page, page.getByRole('tab', { name: /Drawing set/i }), 600); await sleep(600); mark('c0');
  await glide(page, W * .5, H * .62, 400); await wheelScroll(page, 520, 2800); await sleep(400); mark('c1');
});
await scene('c2a', { state: ST.v1, url: WS }, async (page, mark) => {
  await page.locator('svg[role="img"]').waitFor(); await sleep(400);
  await clickOn(page, page.getByRole('tab', { name: /First Floor/i }), 600); await sleep(600); mark('go');
  await clickOn(page, page.locator('#whatif'), 500); await page.locator('#whatif').pressSequentially('Add a bedroom upstairs', { delay: 55 }); await sleep(250);
  await page.keyboard.press('Enter'); await sleep(1100); mark('sent');
});
await scene('c2b', { state: ST.v2, url: WS }, async (page, mark) => {
  await page.locator('svg[role="img"]').waitFor(); await sleep(400); await clickOn(page, page.getByRole('tab', { name: /First Floor/i }), 600); mark('go'); await glide(page, W * .62, H * .45, 500); await sleep(1700); mark('res');
  await clickOn(page, page.getByRole('tab', { name: /3D model/i }), 800); await page.locator('canvas').waitFor(); await sleep(800); mark('d0');
  // one smooth drag across the canvas = a full 360-degree turn (OrbitControls: 2*pi per canvas-height of horizontal drag)
  const cb = await page.locator('canvas').boundingBox();
  const x0 = cb.x + (cb.width - cb.height) / 2, y = cb.y + cb.height * .55;
  await glide(page, x0, y, 450); await page.mouse.down();
  const tt = Date.now(); while (true) { const f = Math.min(1, (Date.now() - tt) / 2400), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; await page.mouse.move(x0 + cb.height * e, y); if (f >= 1) break; }
  await page.mouse.up(); mouse = { x: x0 + cb.height, y }; mark('r360');
  await quickClick(page, page.getByRole('button', { name: /Roof/i }).first()); await sleep(700); mark('roof');       // roof off: look inside
  await quickClick(page, page.getByRole('button', { name: /Evening/i }).first()); await sleep(1100); mark('eve');          // evening lighting
  await clickOn(page, page.getByRole('button', { name: /Export/i }), 700); await sleep(3200); mark('x1');
});
await browser.close();
