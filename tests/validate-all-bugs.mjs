import { chromium } from 'playwright';
import assert from 'node:assert/strict';

async function runTests() {
  console.log('Starting Playwright test suite for all 4 bug fixes...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (err) => {
    console.error('  [UNEXPECTED PAGE ERROR]:', err.message);
    pageErrors.push(err);
  });

  // ==========================================
  // Test 1: Bug 1 — Zero-dimension validation
  // ==========================================
  console.log('✓ TEST 1: Bug 1 — Form accepts zero-dimension inputs');
  await page.goto('http://localhost:3000/onboarding', { waitUntil: 'networkidle' });
  
  const widthInput = page.locator('input[type="number"]').nth(0);
  const depthInput = page.locator('input[type="number"]').nth(1);
  await widthInput.fill('0');
  await depthInput.fill('0');

  const nextBtn = page.getByRole('button', { name: /Next: Location/i });
  await nextBtn.click();
  await page.waitForTimeout(300);

  // Assert error message exists and is visible
  const errorAlert = page.locator('.bg-red-50[role="alert"]');
  await assert.doesNotReject(errorAlert.waitFor({ state: 'visible', timeout: 2000 }));
  const alertText = await errorAlert.textContent();
  assert.ok(alertText.includes('greater than 0'), `Expected validation message, got: ${alertText}`);

  // Assert page did NOT navigate to step 2 (Property Location)
  const currentStepTitle = await page.locator('h2').first().textContent();
  assert.equal(currentStepTitle, 'Plot & Site Information', 'Should remain on Step 1 when dimensions are 0');
  console.log('  PASSED: Zero dimensions are rejected with validation error:', alertText);

  // Verify valid dimensions allow progression
  await widthInput.fill('40');
  await depthInput.fill('60');
  await nextBtn.click();
  await page.waitForTimeout(500);

  const step2Title = await page.locator('h2').first().textContent();
  assert.equal(step2Title, 'Property Location', 'Should navigate to Step 2 with valid dimensions');
  console.log('  PASSED: Valid dimensions allow proceeding to Property Location.\n');

  // ==========================================
  // Test 2: Bug 4 — Client-side exception when navigating to Gallery (/styles)
  // ==========================================
  console.log('✓ TEST 2: Bug 4 — Client-side exception when navigating to Gallery (/styles)');
  await page.goto('http://localhost:3000/how-it-works', { waitUntil: 'networkidle' });

  // Move mouse and trigger pointer events
  await page.mouse.move(250, 250);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);

  // Click Gallery in the header nav
  const galleryLink = page.locator('.site-nav-link[href="/styles"]');
  await galleryLink.hover();
  await galleryLink.click();
  await page.waitForURL('**/styles');
  await page.waitForTimeout(1000);

  // Move around on /styles to test cursor over text and images
  await page.mouse.move(500, 400);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);

  assert.equal(pageErrors.length, 0, `Expected 0 page errors, found: ${pageErrors.length}`);
  console.log('  PASSED: Successfully navigated from /how-it-works to /styles with 0 client exceptions.\n');

  // ==========================================
  // Test 3: Bug 3 — Sidebar stage indicator on /how-it-works
  // ==========================================
  console.log('✓ TEST 3: Bug 3 — Sidebar stage indicator inconsistent with 7-stage process content');
  await page.goto('http://localhost:3000/how-it-works', { waitUntil: 'networkidle' });

  const totalEl = page.locator('.rail-total');
  const initialTotal = await totalEl.textContent();
  assert.equal(initialTotal, '07', `Expected rail total to be 07, got ${initialTotal}`);

  const rows = await page.locator('.row').all();
  assert.equal(rows.length, 7, 'Expected exactly 7 stages in how-it-works');

  for (let i = 0; i < rows.length; i++) {
    await rows[i].evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(500);

    const currLabel = await page.locator('.rail-label').textContent();
    const currCount = await page.locator('.rail-count b').textContent();
    const currTotal = await totalEl.textContent();

    const expectedStageNum = String(i + 1).padStart(2, '0');
    console.log(`  Stage ${expectedStageNum} indicator -> Label: "${currLabel}", Count: "${currCount} / ${currTotal}"`);
    assert.equal(currLabel, `Stage ${expectedStageNum}`);
    assert.equal(currCount, expectedStageNum);
    assert.equal(currTotal, '07');
  }
  console.log('  PASSED: Sidebar stage indicator dynamically reflects all 7 stages from Stage 01 to Stage 07.\n');

  // ==========================================
  // Test 4: Bug 2 — Header logo overlaps with page content on scroll in /styles
  // ==========================================
  console.log('✓ TEST 4: Bug 2 — Header logo overlaps with page content on scroll');
  await page.goto('http://localhost:3000/styles', { waitUntil: 'networkidle' });

  // Before scroll: header is transparent and unscrolled
  const header = page.locator('.site-header');
  assert.equal(await header.getAttribute('data-scrolled'), 'false');

  // Scroll down to Kerala Traditional section
  const keralaCard = page.locator('article.style-card', { hasText: 'Kerala Traditional' });
  await keralaCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  // Verify header has data-scrolled="true"
  const isScrolled = await header.getAttribute('data-scrolled');
  assert.equal(isScrolled, 'true', 'Header must have data-scrolled="true" when scrolled');

  // Check header bounding box and backdrop
  const headerBox = await header.boundingBox();
  const badgeBox = await page.locator('.site-badge').boundingBox();
  const keralaHeading = page.locator('h2.row-title', { hasText: 'Kerala Traditional' });
  const headingBox = await keralaHeading.boundingBox();

  console.log(`  Scrolled header height: ${headerBox?.height}px`);
  console.log(`  Scrolled badge size: ${badgeBox?.width}px x ${badgeBox?.height}px`);
  console.log(`  Heading position Y: ${headingBox?.y}px, Header bottom Y: ${(headerBox?.y || 0) + (headerBox?.height || 0)}px`);

  // When scrolling to Kerala Traditional, heading is positioned cleanly below the compact frosted header bar
  assert.ok(
    headingBox.y >= (headerBox.y + headerBox.height - 10),
    `Heading Y (${headingBox.y}) should be below header bottom (${headerBox.y + headerBox.height})`
  );
  console.log('  PASSED: Header transitions to compact frosted bar; logo does not overlap heading text.\n');

  await browser.close();
  console.log('==============================================');
  console.log('ALL 4 BUGS HAVE BEEN VALIDATED AND CONFIRMED FIXED!');
  console.log('==============================================\n');
}

runTests().catch((err) => {
  console.error('\nPlaywright validation failed:', err);
  process.exit(1);
});
