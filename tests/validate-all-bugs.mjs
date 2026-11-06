import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

const nextBin = path.resolve('node_modules/next/dist/bin/next');

async function isServerRunning(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function runTests() {
  const targetUrl = 'http://localhost:3000';
  let serverProcess = null;

  const running = await isServerRunning(targetUrl);
  if (!running) {
    console.log('[E2E Setup] Starting Next.js server on port 3000...');
    serverProcess = spawn(process.execPath, [nextBin, 'start', '-p', '3000'], {
      stdio: 'pipe'
    });

    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await isServerRunning(targetUrl)) break;
      attempts++;
    }
    if (!await isServerRunning(targetUrl)) {
      console.warn('[E2E Setup] Production build server not responding; attempting next dev...');
      if (serverProcess) serverProcess.kill();
      serverProcess = spawn(process.execPath, [nextBin, 'dev', '-p', '3000'], {
        stdio: 'pipe'
      });
      attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 1000));
        if (await isServerRunning(targetUrl)) break;
        attempts++;
      }
    }
    console.log('[E2E Setup] Server is active at', targetUrl);
  }

  try {
    console.log('Starting Playwright test suite for all bug fixes & V1.4 E2E flow...\n');
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    const pageErrors = [];
    const browserErrors = [];
    page.on('pageerror', (err) => {
      console.error('  [UNEXPECTED PAGE ERROR]:', err.message);
      pageErrors.push(err);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });

    // ==========================================
    // Test 1: Bug 1 — Zero-dimension validation
    // ==========================================
    console.log('✓ TEST 1: Bug 1 — Form accepts zero-dimension inputs');
    await page.goto(`${targetUrl}/onboarding`, { waitUntil: 'networkidle' });
    
    const widthInput = page.locator('#plot-width');
    const depthInput = page.locator('#plot-depth');
    await widthInput.fill('0');
    await depthInput.fill('0');

    const nextBtn = page.getByRole('button', { name: /Next: Your home/i });
    await nextBtn.click();
    await page.waitForTimeout(300);

    // Assert error message exists and is visible
    const errorAlert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await assert.doesNotReject(errorAlert.waitFor({ state: 'visible', timeout: 2000 }));
    const alertText = await errorAlert.textContent();
    assert.ok(alertText.includes('at least 10 ft'), `Expected validation message, got: ${alertText}`);

    // Assert page did NOT navigate to step 2
    const currentStepTitle = await page.locator('h2').first().textContent();
    assert.equal(currentStepTitle, 'Your plot', 'Should remain on Step 1 when dimensions are 0');
    console.log('  PASSED: Zero dimensions are rejected with validation error:', alertText);

    // Verify valid dimensions allow progression
    await widthInput.fill('40');
    await depthInput.fill('60');
    await nextBtn.click();
    await page.waitForTimeout(500);

    const step2Title = await page.locator('h2').first().textContent();
    assert.ok(step2Title.includes('home need'), 'Should navigate to Step 2 with valid dimensions');
    console.log('  PASSED: Valid dimensions allow proceeding to Step 2.\n');

    // ==========================================
    // Test 2: Bug 4 — Client-side exception when navigating to Gallery (/styles)
    // ==========================================
    console.log('✓ TEST 2: Bug 4 — Client-side exception when navigating to Gallery (/styles)');
    await page.goto(`${targetUrl}/how-it-works`, { waitUntil: 'networkidle' });

    // Move mouse and trigger pointer events, then scroll slightly up to bring header back
    await page.mouse.move(250, 250);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);

    // Click Gallery in the header nav
    const galleryLink = page.locator('.site-nav-link[href="/styles"]');
    await galleryLink.waitFor({ state: 'visible', timeout: 10000 });
    {
      await galleryLink.hover();
      await galleryLink.click();
      await page.waitForURL('**/styles');
      await page.waitForTimeout(1000);

      await page.mouse.move(500, 400);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(500);
    }

    assert.equal(pageErrors.length, 0, `Expected 0 page errors, found: ${pageErrors.length}`);
    console.log('  PASSED: Successfully navigated from /how-it-works to /styles with 0 client exceptions.\n');

    // ==========================================
    // Test 3: Bug 3 — Sidebar stage indicator on /how-it-works
    // ==========================================
    console.log('✓ TEST 3: Bug 3 — Sidebar stage indicator inconsistent with 7-stage process content');
    await page.goto(`${targetUrl}/how-it-works`, { waitUntil: 'networkidle' });

    const totalEl = page.locator('.rail-total');
    await totalEl.waitFor({ state: 'visible', timeout: 10000 });
    {
      const initialTotal = await totalEl.textContent();
      assert.equal(initialTotal, '07', `Expected rail total to be 07, got ${initialTotal}`);

      const rows = await page.locator('.row').all();
      assert.equal(rows.length, 7, 'Expected exactly 7 stages in how-it-works');

      for (let i = 0; i < Math.min(rows.length, 3); i++) {
        await rows[i].evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.waitForTimeout(300);

        const currLabel = await page.locator('.rail-label').textContent();
        const currCount = await page.locator('.rail-count b').textContent();
        const currTotal = await totalEl.textContent();

        const expectedStageNum = String(i + 1).padStart(2, '0');
        assert.equal(currLabel, `Stage ${expectedStageNum}`);
        assert.equal(currCount, expectedStageNum);
        assert.equal(currTotal, '07');
      }
      console.log('  PASSED: Sidebar stage indicator dynamically reflects process stages.\n');
    }

    // ==========================================
    // Test 4: Bug 2 — Header logo overlaps with page content on scroll in /styles
    // ==========================================
    console.log('✓ TEST 4: Bug 2 — Header logo overlaps with page content on scroll');
    await page.goto(`${targetUrl}/styles`, { waitUntil: 'networkidle' });

    const header = page.locator('.site-header');
    await header.waitFor({ state: 'visible', timeout: 10000 });
    {
      const keralaCard = page.locator('article.style-card', { hasText: 'Kerala Traditional' });
      await keralaCard.waitFor({ state: 'visible', timeout: 10000 });
    {
        await keralaCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);

        const isScrolled = await header.getAttribute('data-scrolled');
        assert.equal(isScrolled, 'true', 'Header must have data-scrolled="true" when scrolled');
      }
      console.log('  PASSED: Header transitions to compact frosted bar.\n');
    }

    // ==========================================
    // Test 5: Full E2E Journey — Guest login -> Onboarding -> Local Generation -> Workspace 2D & 3D -> What-If -> Export
    // ==========================================
    console.log('✓ TEST 5: Full E2E Flow — Guest Login -> Onboarding -> Generate (local) -> Workspace 2D/3D -> What-If -> Export');
    await page.goto(`${targetUrl}/login?next=%2Fonboarding`, { waitUntil: 'networkidle' });

    // Click "Continue as Studio Guest"
    const guestBtn = page.getByRole('button', { name: /Continue as Studio Guest/i });
    await guestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await guestBtn.click();
    await page.waitForURL('**/onboarding**', { timeout: 10000 });
    console.log('  PASSED: Guest session established and navigated to onboarding.');

    // Step 1: Site
    await page.locator('#plot-width').fill('40');
    await page.locator('#plot-depth').fill('60');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
    await page.locator('#site-plan-upload').setInputFiles({ name: 'site.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: /Next: Your home/i }).click();
    await page.waitForTimeout(500);

    // Step 2: The home
    await page.getByRole('button', { name: /Next: Style/i }).click();
    await page.waitForTimeout(500);

    // Step 3: Switch to architect mode to choose built-in local engine
    const architectToggle = page.getByRole('button', { name: /I am an architect/i });
    await architectToggle.waitFor({ state: 'visible', timeout: 10000 });
    {
      await architectToggle.click();
      await page.waitForTimeout(300);
    }
    const engineSelect = page.locator('#engine');
    await engineSelect.waitFor({ state: 'visible', timeout: 10000 });
    {
      await engineSelect.selectOption('local');
    }

    // Generate design
    const generateBtn = page.getByRole('button', { name: /Generate design/i });
    await generateBtn.click();

    // Wait for workspace page
    await page.waitForURL('**/workspace/**', { timeout: 30000 });
    console.log('  PASSED: Generated design and redirected to workspace:', page.url());

    // Verify 2D Plan SVG
    const planSvg = page.locator('svg[role="img"]');
    await planSvg.waitFor({ state: 'visible', timeout: 10000 });
    assert.ok(await planSvg.isVisible(), '2D Floor Plan SVG must be visible');
    console.log('  PASSED: 2D floor plan rendered in workspace.');

    // The uploaded site sketch is drawn under the plan, with its own toggle.
    await page.getByRole('button', { name: 'Site sketch' }).waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('img[alt="Uploaded site sketch"]').waitFor({ state: 'visible', timeout: 5000 });
    console.log('  PASSED: Uploaded site sketch is drawn under the 2D plan.');

    // Switch to 3D tab
    const tab3D = page.getByRole('tab', { name: /3D model/i });
    await tab3D.waitFor({ state: 'visible', timeout: 10000 });
    {
      await tab3D.click();
      const canvasEl = page.locator('canvas');
      try {
        await canvasEl.waitFor({ state: 'visible', timeout: 15000 });
      } catch (error) {
        console.error('  [3D DIAGNOSTICS]', { pageErrors: pageErrors.map((e) => e.message), browserErrors });
        throw error;
      }
      assert.ok(await canvasEl.isVisible(), '3D Canvas must be visible');
      console.log('  PASSED: 3D massing model rendered.');
    }

    // What-If: on a wide screen the assistant is always open; on a narrow one it sits behind a tab. Either way the box must appear.
    const tabAsk = page.getByRole('tab', { name: /Assistant/i });
    if (await tabAsk.isVisible()) await tabAsk.click();
    const whatIfInput = page.locator('#whatif');
    await whatIfInput.waitFor({ state: 'visible', timeout: 10000 });
    await whatIfInput.fill('Add a study upstairs');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    assert.ok(await page.locator('#whatif').isVisible(), 'The assistant must stay usable after a What-If request');
    console.log('  PASSED: What-If change submitted.');

    // Verify Export menu
    const exportBtn = page.getByRole('button', { name: /Export/i });
    await exportBtn.waitFor({ state: 'visible', timeout: 10000 });
    {
      await exportBtn.click();
      await page.waitForTimeout(400);
      const dxfOption = page.locator('button', { hasText: /DXF/i }).or(page.locator('text=Floor plan drawing (.dxf)'));
      assert.ok(await dxfOption.isVisible(), 'DXF Export option must be visible');
      console.log('  PASSED: Export menu accessible.');
    }

    // ==========================================
    // Test 6: a phone can open every style page and start a plan in that style
    // ==========================================
    console.log('✓ TEST 6: Phone — style pages open, nothing overflows, Start preselects the style');
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await phone.newPage();
    const phoneErrors = [];
    mp.on('pageerror', (err) => phoneErrors.push(err.message));
    const slugs = ['kerala-traditional', 'modern', 'minimalist', 'contemporary', 'colonial', 'tropical', 'traditional-indian', 'modern-luxury'];
    for (const slug of slugs) {
      await mp.goto(`${targetUrl}/styles/${slug}`, { waitUntil: 'networkidle' });
      await mp.locator('.style-feature-art img, .style-feature-art svg').waitFor({ state: 'visible', timeout: 8000 });
      const widths = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.ok(widths.sw <= widths.cw + 1, `${slug} scrolls sideways on a phone (${widths.sw} > ${widths.cw})`);
    }
    await mp.goto(`${targetUrl}/styles`, { waitUntil: 'networkidle' });
    const firstMore = mp.locator('a.style-card-more').first();
    await firstMore.scrollIntoViewIfNeeded();
    await firstMore.tap();
    await mp.waitForURL('**/styles/kerala-traditional', { timeout: 8000 });
    const startLink = mp.locator('a[href*="onboarding?style=kerala-traditional"]').first();
    await startLink.scrollIntoViewIfNeeded();
    await startLink.tap();
    await mp.waitForURL('**/onboarding**', { timeout: 8000 });
    assert.equal(phoneErrors.length, 0, `Phone page errors: ${phoneErrors.join(' | ')}`);
    await phone.close();
    console.log('  PASSED: All 8 style pages fit a phone and open from the list.');

    const missing = await page.goto(`${targetUrl}/styles/not-a-style`);
    assert.equal(missing?.status(), 404, 'An unknown style should be a 404 page');
    console.log('  PASSED: Unknown style shows the not-found page.\n');

    await browser.close();
    console.log('\n==============================================');
    console.log('ALL E2E & REGRESSION TESTS PASSED!');
    console.log('==============================================\n');
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

runTests().catch((err) => {
  console.error('\nPlaywright validation failed:', err);
  process.exit(1);
});
