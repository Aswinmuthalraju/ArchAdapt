// Off-camera: signs in as guest, generates the demo plan with the real engine, applies the "study upstairs" what-if,
// and saves the browser state after each so the recorder can show finished output without waiting.
// Usage: node demo/setup.mjs   (app must be running on :3000)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = 'http://localhost:3000';
const OUT = path.join(HERE, 'clips'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage();

await p.goto(`${APP}/login?next=%2Fonboarding`, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Continue as Studio Guest/i }).click();
await p.waitForURL('**/onboarding**');
const guest = await ctx.storageState();

await p.locator('#plot-width').fill('40'); await p.locator('#plot-depth').fill('60');
await p.getByRole('button', { name: /Next: Your home/i }).click();
for (const n of ['Study', 'Puja Room']) await p.getByText(n, { exact: true }).first().click();
await p.locator('textarea').first().fill('Elderly parents live with us, and we want lots of natural light.');
await p.getByRole('button', { name: /Next: Style/i }).click();
await p.getByRole('button', { name: /^Kerala Traditional/ }).click();
await p.getByRole('button', { name: /Climate-Adaptive/ }).click();
const t = Date.now();
await p.getByRole('button', { name: /Generate design/i }).click();
await p.waitForURL('**/workspace/**', { timeout: 240000 }); await p.locator('svg[role="img"]').waitFor({ timeout: 60000 });
await p.waitForTimeout(1500);
const wsUrl = p.url();
const badge = await p.locator('text=/Gemini|rule engine/i').first().innerText().catch(() => '?');
console.log('generated in', ((Date.now() - t) / 1000).toFixed(0) + 's', '| engine badge:', badge);
const v1 = await ctx.storageState();

await p.locator('#whatif').fill('Add a bedroom upstairs'); await p.keyboard.press('Enter');
await p.getByText(/Version 2/).first().waitFor({ timeout: 240000 });
await p.waitForTimeout(2000);
console.log('what-if applied;', await p.locator('text=/Version 2/').count(), 'Version 2 marker(s)');
const v2 = await ctx.storageState();
fs.writeFileSync(path.join(OUT, 'state.json'), JSON.stringify({ wsUrl, guest, v1, v2 }));
await browser.close();
console.log('saved states for', wsUrl);
