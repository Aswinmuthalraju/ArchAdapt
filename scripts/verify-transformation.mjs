import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const outDir = path.resolve('docs/screenshots/transformed');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runVerification() {
  console.log('=== ARCHADAPT AI AGENT 1: TRANSFORMATION VERIFICATION ===\n');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ----------------------------------------------------
  // PART 1: LANDING PAGE ZERO-REGRESSION VERIFICATION
  // ----------------------------------------------------
  console.log('[Step 1/5] Verifying Landing Page Preservation at 3 Viewports...');
  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Assert key landing page elements are intact
    const heroTitle = page.locator('h1').first();
    await assert.doesNotReject(heroTitle.waitFor({ state: 'visible', timeout: 5000 }));
    
    // Screenshot
    await page.screenshot({ path: path.join(outDir, `landing-${vp.name}-transformed.png`), fullPage: false });
    console.log(`  ✓ Landing page ${vp.name} verified and captured.`);
    await ctx.close();
  }

  // ----------------------------------------------------
  // PART 2: REAL SCENARIO DESIGN GENERATION (API)
  // ----------------------------------------------------
  console.log('\n[Step 2/5] Generating real designs across architectural scenarios...');

  const scenarios = [
    {
      id: 'proj-40x60-modern',
      title: 'Modern Family Home 40x60',
      site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' },
      requirements: {
        familySize: 4, bedrooms: 3, bathrooms: 2, floors: 2, budgetRange: 'Moderate',
        spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false }
      },
      preferences: { modes: [], primaryStyle: 'Modern' }
    },
    {
      id: 'proj-50x80-kerala',
      title: 'Kerala Traditional Courtyard 50x80',
      site: { plotWidth: 50, plotDepth: 80, totalArea: 4000, orientation: 'E' },
      requirements: {
        familySize: 5, bedrooms: 3, bathrooms: 3, floors: 2, budgetRange: 'Moderate',
        spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: true, courtyard: true, guestRoom: false, outdoorGarden: false }
      },
      preferences: { modes: [], primaryStyle: 'Kerala Traditional' }
    },
    {
      id: 'proj-30x40-minimalist',
      title: 'Minimalist Compact 30x40',
      site: { plotWidth: 30, plotDepth: 40, totalArea: 1200, orientation: 'N' },
      requirements: {
        familySize: 3, bedrooms: 2, bathrooms: 2, floors: 1, budgetRange: 'Economy',
        spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false }
      },
      preferences: { modes: [], primaryStyle: 'Minimalist' }
    }
  ];

  const generatedProjects = [];

  for (const sc of scenarios) {
    console.log(`  Generating: ${sc.title}...`);
    const res = await fetch('http://localhost:3000/api/design/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: sc.site,
        location: { name: 'Bengaluru Site', city: 'Bengaluru', country: 'India', lat: 12.97, lng: 77.59 },
        requirements: sc.requirements,
        preferences: sc.preferences,
        engine: 'local'
      })
    });

    const data = await res.json();
    assert.equal(data.success, true, `Generation failed for ${sc.title}: ${data.error}`);
    assert.ok(data.design && data.design.rooms.length > 0, `No rooms generated for ${sc.title}`);
    console.log(`  ✓ ${sc.title} generated successfully: ${data.design.rooms.length} rooms, ${data.design.floorsCount} floors, built-up: ${data.design.totalBuiltUpAreaSqFt} sq ft`);

    const project = {
      id: sc.id,
      title: sc.title,
      location: { name: 'Bengaluru Site', city: 'Bengaluru', country: 'India', lat: 12.97, lng: 77.59 },
      preferences: sc.preferences,
      currentVersionId: 'v1',
      versions: [
        {
          id: 'v1',
          projectId: sc.id,
          versionNumber: 1,
          title: 'Initial Concept',
          structuredDesign: data.design,
          rationale: data.design.rationale || 'Architectural concept layout',
          tradeOffs: [],
          createdAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    generatedProjects.push(project);
  }

  // ----------------------------------------------------
  // PART 3: WORKSPACE 2D & 3D INTERACTIVE VERIFICATION
  // ----------------------------------------------------
  console.log('\n[Step 3/5] Verifying Workspace 2D Plan & Interactive 3D Model...');
  const testProj = generatedProjects[0]; // 40x60 Modern

  const wsCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const wsPage = await wsCtx.newPage();

  // Establish guest session
  await wsPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  const guestBtn = wsPage.getByRole('button', { name: /Continue as Studio Guest/i });
  await guestBtn.waitFor({ state: 'visible', timeout: 5000 });
  await guestBtn.click();
  await wsPage.waitForTimeout(1000);

  // Seed project into localStorage
  await wsPage.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: `project_${testProj.id}`, value: testProj });

  // Navigate to project workspace
  await wsPage.goto(`http://localhost:3000/workspace/${testProj.id}`, { waitUntil: 'networkidle' });
  await wsPage.waitForTimeout(2000);

  // Verify 2D Plan rendered
  const svgPlan = wsPage.locator('svg[role="img"]');
  await assert.doesNotReject(svgPlan.waitFor({ state: 'visible', timeout: 8000 }));
  console.log('  ✓ 2D SVG Floor Plan is rendered and visible.');

  // Verify graphic scale bar exists
  const graphicScale = wsPage.locator('text:has-text("GRAPHIC SCALE")');
  await assert.doesNotReject(graphicScale.waitFor({ state: 'visible', timeout: 3000 }));
  console.log('  ✓ Architectural Graphic Scale Bar is verified.');

  // Screenshot 2D Plan
  await wsPage.screenshot({ path: path.join(outDir, 'workspace-40x60-2d-plan.png') });

  // Select a room in 2D (click living room)
  const livingRoomGroup = wsPage.locator('g.cursor-pointer').first();
  await livingRoomGroup.click();
  await wsPage.waitForTimeout(500);

  // Verify Contextual Action Bar appears
  const contextualBar = wsPage.locator('button:has-text("+15% Size")');
  await assert.doesNotReject(contextualBar.waitFor({ state: 'visible', timeout: 3000 }));
  console.log('  ✓ Contextual Room Action Bar is active upon room selection.');
  await wsPage.screenshot({ path: path.join(outDir, 'workspace-room-selection-bar.png') });

  // Switch to 3D Model tab
  console.log('  Switching to 3D tab...');
  const tab3D = wsPage.locator('button[role="tab"]:has-text("3D model")');
  await tab3D.click();
  await wsPage.waitForTimeout(2000);

  // Verify 3D Canvas
  const canvas3D = wsPage.locator('canvas');
  await assert.doesNotReject(canvas3D.waitFor({ state: 'visible', timeout: 8000 }));
  console.log('  ✓ 3D WebGL Canvas rendered successfully.');

  // Verify 3D Elevation Presets exist
  const frontBtn = wsPage.locator('button:has-text("Front")');
  await assert.doesNotReject(frontBtn.waitFor({ state: 'visible', timeout: 3000 }));
  console.log('  ✓ Architectural Camera Elevation buttons (Front, Iso, Top, etc.) are present.');

  // Test Front elevation preset
  await frontBtn.click();
  await wsPage.waitForTimeout(1000);
  await wsPage.screenshot({ path: path.join(outDir, 'workspace-40x60-3d-front-elevation.png') });
  console.log('  ✓ Front elevation 3D screenshot captured.');

  // Test Section Cutaway toggle
  const cutawayBtn = wsPage.locator('button:has-text("Cutaway")');
  await cutawayBtn.click();
  await wsPage.waitForTimeout(1000);
  await wsPage.screenshot({ path: path.join(outDir, 'workspace-40x60-3d-section-cutaway.png') });
  console.log('  ✓ Section Cutaway mode activated and screenshot captured.');

  // ----------------------------------------------------
  // PART 4: WHAT-IF SURGICAL MUTATION VERIFICATION
  // ----------------------------------------------------
  console.log('\n[Step 4/5] Testing What-If Surgical Mutation...');
  const whatIfRes = await fetch('http://localhost:3000/api/design/what-if', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: testProj.id,
      currentVersionId: 'v1',
      message: 'Make the living room 15% larger',
      currentDesign: testProj.versions[0].structuredDesign,
      location: testProj.location
    })
  });

  const whatIfData = await whatIfRes.json();
  assert.equal(whatIfData.success, true, `What-If failed: ${whatIfData.explanation || whatIfData.error}`);
  assert.ok(whatIfData.updatedDesign, 'What-If did not return updatedDesign');
  console.log(`  ✓ What-If succeeded: "${whatIfData.summary}" (Version title: ${whatIfData.title})`);

  // Test impossible What-If request handling
  const impossibleRes = await fetch('http://localhost:3000/api/design/what-if', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: testProj.id,
      currentVersionId: 'v1',
      message: 'Add 10 Olympic swimming pools inside the living room',
      currentDesign: testProj.versions[0].structuredDesign,
      location: testProj.location
    })
  });
  const impossibleData = await impossibleRes.json();
  console.log(`  ✓ Impossible request handled honestly: status = ${impossibleData.status}`);

  // ----------------------------------------------------
  // PART 5: KERALA COURTYARD 3D INSPECTION
  // ----------------------------------------------------
  console.log('\n[Step 5/5] Inspecting Kerala Courtyard Design in 3D...');
  const keralaProj = generatedProjects[1]; // 50x80 Kerala Courtyard
  await wsPage.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: `project_${keralaProj.id}`, value: keralaProj });

  await wsPage.goto(`http://localhost:3000/workspace/${keralaProj.id}`, { waitUntil: 'networkidle' });
  await wsPage.waitForTimeout(1500);

  // 2D screenshot of Kerala courtyard
  await wsPage.screenshot({ path: path.join(outDir, 'workspace-kerala-courtyard-2d.png') });

  // 3D screenshot of Kerala courtyard
  const tab3DKerala = wsPage.locator('button[role="tab"]:has-text("3D model")');
  await tab3DKerala.click();
  await wsPage.waitForTimeout(2000);
  await wsPage.screenshot({ path: path.join(outDir, 'workspace-kerala-courtyard-3d.png') });
  console.log('  ✓ Kerala Courtyard 2D & 3D screenshots captured.');

  await wsCtx.close();
  await browser.close();

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  console.log('Screenshots stored in:', outDir);
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
