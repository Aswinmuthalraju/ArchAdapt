import test from 'node:test';
import assert from 'node:assert/strict';

import { generateDesign } from '../src/lib/design/pipeline';
import { analyseDesign } from '../src/lib/pro/analysis';
import { designJson, modelObj, planDxf, schedulesCsv } from '../src/lib/pro/exporters';
import type { StructuredDesignJSON } from '../src/types/architectural';

async function house(bedrooms: number, floors: number, bathrooms: number): Promise<StructuredDesignJSON> {
  const outcome = await generateDesign({
    site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' },
    location: { name: 'Kochi', city: 'Kochi', country: 'India', lat: 9.9, lng: 76.2, climateZone: 'Warm & Humid' },
    requirements: { familySize: 4, bedrooms, bathrooms, floors, budgetRange: 'Moderate', spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: true, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false } },
    preferences: { modes: ['climate_adaptive'], primaryStyle: 'Modern' },
    engine: 'local'
  });
  assert.equal(outcome.status, 'OK');
  if (outcome.status !== 'OK') throw new Error('unreachable');
  return outcome.design;
}

test('analysis: schedules list every room and opening, and the area statement adds up', async () => {
  const design = await house(3, 2, 2);
  const a = analyseDesign(design);
  assert.equal(a.rooms.length, design.rooms.length);
  assert.equal(a.openings.length, design.openings.length);
  assert.equal(new Set(a.openings.map((o) => o.mark)).size, a.openings.length, 'opening marks are unique');
  assert.equal(a.areas.floors.length, 2);
  const sum = a.areas.floors.reduce((s, f) => s + f.builtUpSqFt, 0);
  assert.ok(Math.abs(sum - a.areas.builtUpSqFt) < 0.1);
  assert.ok(Math.abs(a.areas.far - a.areas.builtUpSqFt / a.areas.plotSqFt) < 0.01);
  assert.ok(a.areas.coveragePct > 0 && a.areas.coveragePct < 100);
  assert.equal(a.summary.fail, 0, a.checks.filter((c) => c.status === 'fail').map((c) => c.detail).join(' | '));
  assert.ok(a.checks.length >= 10);
});

test('analysis: a limit the plan breaks is reported as a failure, not hidden', async () => {
  const design = await house(3, 2, 2);
  const strict = analyseDesign(design, { maxCoveragePct: 5, maxFar: 0.1, minGlazingPct: 10 });
  assert.equal(strict.checks.find((c) => c.id === 'coverage')?.status, 'fail');
  assert.equal(strict.checks.find((c) => c.id === 'far')?.status, 'fail');
});

test('DXF export is well formed and contains the walls, doors and room names of the plan', async () => {
  const design = await house(3, 2, 2);
  const { content, filename } = planDxf(design, 'Test House');
  assert.match(filename, /test-house-plan\.dxf/);
  const lines = content.split('\r\n');
  assert.equal(lines[0], '0');
  assert.equal(lines[lines.length - 2], 'EOF');
  const entities = lines.filter((l, i) => lines[i - 1] === '0' && ['LINE', 'ARC', 'TEXT'].includes(l));
  assert.ok(entities.length > 100);
  assert.ok(content.includes('A-WALL') && content.includes('A-DOOR') && content.includes('A-GLAZ'));
  assert.ok(content.includes('Living'));
  assert.doesNotMatch(content, /NaN|undefined|Infinity/);
  // group codes and values alternate: an even number of lines
  assert.equal((lines.length - 1) % 2, 0);
});

test('OBJ export only references vertices that exist and has no invalid numbers', async () => {
  const design = await house(2, 1, 2);
  const { content } = modelObj(design, 'Test House');
  const vertices = content.split('\n').filter((l) => l.startsWith('v ')).length;
  const faces = content.split('\n').filter((l) => l.startsWith('f '));
  assert.ok(vertices > 100 && faces.length > 100);
  for (const face of faces) for (const idx of face.slice(2).split(' ').map(Number)) assert.ok(idx >= 1 && idx <= vertices, face);
  assert.doesNotMatch(content, /NaN|undefined|Infinity/);
});

test('CSV and JSON exports carry the schedules and the design', async () => {
  const design = await house(3, 2, 2);
  const a = analyseDesign(design);
  const csv = schedulesCsv(a, 'Test House').content;
  assert.match(csv, /ROOM SCHEDULE/);
  assert.match(csv, /DOOR AND WINDOW SCHEDULE/);
  assert.match(csv, /COMPLIANCE CHECKS/);
  const json = JSON.parse(designJson(design, 'Test House', 1).content);
  assert.equal(json.design.rooms.length, design.rooms.length);
});

test('SVG drawings and the printable sheet render for every floor, and the schedule panel renders', async () => {
  const { planSvg, drawingSheetHtml } = await import('../src/lib/pro/sheet');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  const { default: DrawingSetPanel } = await import('../src/components/workspace/DrawingSetPanel');
  const { DEFAULT_LIMITS } = await import('../src/lib/pro/analysis');
  const design = await house(3, 2, 2);
  const analysis = analyseDesign(design);
  for (const floor of [0, 1]) {
    const svg = planSvg(design, floor);
    assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.doesNotMatch(svg, /NaN|undefined/);
  }
  const html = drawingSheetHtml(design, analysis, { title: 'A <b>House</b>', location: 'Kochi', style: 'Modern', version: 1, engine: 'Test' });
  assert.ok(html.includes('A &lt;b&gt;House&lt;/b&gt;'), 'titles are escaped');
  assert.ok(html.includes('Door and window schedule'));
  const panel = renderToStaticMarkup(createElement(DrawingSetPanel, { analysis, limits: DEFAULT_LIMITS, onLimitsChange: () => {} }));
  assert.ok(panel.includes('Compliance report') && panel.includes('Room schedule'));
});
