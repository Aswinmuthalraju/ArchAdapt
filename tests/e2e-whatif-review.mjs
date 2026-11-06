// Browser test for the What-If review flow: propose -> preview -> reject keeps the old plan -> propose -> accept -> persists.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.E2E_URL || 'http://localhost:3000';
const shots = 'docs/screenshots/agent3/ui';
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
if (process.env.E2E_DEBUG) page.on('response', async (r) => { if (r.url().includes('/what-if')) console.log('  [net]', r.status(), (await r.text().catch(() => '')).slice(0, 400)); });

const roomCount = async () => Number(await page.locator('svg[role="img"]').first().getAttribute('data-rooms').catch(() => null)) || null;
const step = (m) => console.log('  PASSED:', m);

await page.goto(`${base}/login?next=%2Fonboarding`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Continue as Studio Guest/i }).click();
await page.waitForURL('**/onboarding**');
await page.locator('#plot-width').fill('40');
await page.locator('#plot-depth').fill('60');
await page.getByRole('button', { name: /Next: Your home/i }).click();
await page.getByRole('button', { name: /Next: Style/i }).click();
await page.getByRole('button', { name: /I am an architect/i }).click();
await page.locator('#engine').selectOption('local');
await page.getByRole('button', { name: /Generate design/i }).click();
await page.waitForURL('**/workspace/**', { timeout: 60000 });
await page.locator('svg[role="img"]').first().waitFor({ state: 'visible', timeout: 20000 });
step('generated through the optimiser and opened the workspace');
const url = page.url();

// The planner panel says how the plan was made, and that no AI was used.
const panel = page.getByRole('region', { name: /How this plan was made/i });
await panel.waitFor({ state: 'visible', timeout: 10000 });
const panelText = await panel.innerText();
assert.match(panelText, /no AI|rule reader/i, 'panel must label the built-in reader');
step('planner panel labels the rule reader (not AI)');
await page.screenshot({ path: `${shots}/workspace-planner-panel.png` });

const planBefore = await page.locator('svg[role="img"]').first().innerHTML();
const ask = async (text) => {
  const tab = page.getByRole('tab', { name: /Assistant/i });
  if (await tab.isVisible()) await tab.click();
  await page.locator('#whatif').fill(text);
  await page.keyboard.press('Enter');
};

// 1. Propose, then reject: the stored plan must be untouched.
await ask('Make the kitchen 20% larger');
const card = page.getByRole('region', { name: /Proposed change/i });
await card.waitFor({ state: 'visible', timeout: 60000 });
const cardText = await card.innerText();
assert.match(cardText, /Accept as new version/);
step('a What-If request produces a proposal card with accept / reject');
await page.screenshot({ path: `${shots}/whatif-proposal.png` });
const previewPlan = await page.locator('svg[role="img"]').first().innerHTML();
assert.notEqual(previewPlan, planBefore, 'the preview should show the proposed plan');
step('the plan shows a preview of the proposal');
await card.getByRole('button', { name: /Reject/i }).click();
await card.waitFor({ state: 'hidden', timeout: 5000 });
const afterReject = await page.locator('svg[role="img"]').first().innerHTML();
assert.equal(afterReject, planBefore, 'rejecting must restore exactly the previous plan');
await page.reload({ waitUntil: 'networkidle' });
await page.locator('svg[role="img"]').first().waitFor({ state: 'visible' });
assert.equal(await page.locator('svg[role="img"]').first().innerHTML(), planBefore, 'a reload after reject still shows the old plan');
step('reject restores the previous plan, also after a reload');

// 2. Propose, then accept: persists across a reload.
await ask('Make the kitchen 20% larger');
await card.waitFor({ state: 'visible', timeout: 60000 });
await card.getByRole('button', { name: /Accept as new version/i }).click();
await card.waitFor({ state: 'hidden', timeout: 30000 });
const accepted = await page.locator('svg[role="img"]').first().innerHTML();
assert.notEqual(accepted, planBefore);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('svg[role="img"]').first().waitFor({ state: 'visible' });
assert.equal(await page.locator('svg[role="img"]').first().innerHTML(), accepted, 'accepted plan persists');
step('accept saves the new version and it survives a reload');

// 3. 3D uses the same accepted design.
await page.getByRole('tab', { name: /3D model/i }).click();
await page.locator('canvas').waitFor({ state: 'visible', timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${shots}/workspace-3d-after-accept.png` });
step('3D view renders after the accepted change');

assert.deepEqual(errors, [], 'no uncaught page errors: ' + errors.join(' | '));
await browser.close();
console.log('\nWHAT-IF REVIEW E2E PASSED');
void url; void roomCount;
