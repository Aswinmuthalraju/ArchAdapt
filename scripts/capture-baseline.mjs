import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/baseline');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    console.log(`Capturing landing page at ${vp.name} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    // Allow any initial animations/preloader to settle
    await page.waitForTimeout(2500);

    // Viewport screenshot
    await page.screenshot({
      path: path.join(outDir, `landing-${vp.name}-viewport.png`),
      fullPage: false
    });
    // Full page screenshot
    await page.screenshot({
      path: path.join(outDir, `landing-${vp.name}-full.png`),
      fullPage: true
    });
    await context.close();
  }

  // Also capture onboarding baseline
  console.log('Capturing onboarding baseline...');
  const obContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const obPage = await obContext.newPage();
  await obPage.goto('http://localhost:3000/onboarding', { waitUntil: 'networkidle' });
  await obPage.waitForTimeout(1000);
  await obPage.screenshot({ path: path.join(outDir, 'onboarding-desktop.png') });
  await obContext.close();

  // Styles catalog baseline
  console.log('Capturing styles baseline...');
  const stContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const stPage = await stContext.newPage();
  await stPage.goto('http://localhost:3000/styles', { waitUntil: 'networkidle' });
  await stPage.waitForTimeout(1000);
  await stPage.screenshot({ path: path.join(outDir, 'styles-desktop.png') });
  await stContext.close();

  await browser.close();
  console.log('All baseline screenshots captured in:', outDir);
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
