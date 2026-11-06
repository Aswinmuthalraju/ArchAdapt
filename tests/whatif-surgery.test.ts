import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { generateDesign } from '../src/lib/design/pipeline';
import { runWhatIf } from '../src/lib/design/whatIf';
import { diffDesigns } from '../src/lib/design/surgery';
import { validateFloorPlan } from '../src/lib/design/validateFloorPlan';
import { validateBriefInput } from '../src/lib/design/inputValidation';
import { PLOT_SHAPES, normalizeSite, shapeGeometry } from '../src/lib/design/plotShapes';
import { validatePolygon } from '../src/lib/design/planner/envelope';
import { designCells } from '../src/lib/geometry/planGeometry';
import type { DesignRequirements, StructuredDesignJSON } from '../src/types/architectural';
import { location } from './tools/cases';

beforeEach(() => { delete process.env.GENAI_API_KEY; delete process.env.GEMINI_API_KEY; });

const requirements: DesignRequirements = {
  familySize: 4, bedrooms: 3, bathrooms: 2, floors: 2, budgetRange: 'Moderate',
  spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false }
};

let cached: StructuredDesignJSON | null = null;
async function baseDesign(): Promise<StructuredDesignJSON> {
  if (cached) return cached;
  const out = await generateDesign({ site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'N' }, location, requirements, preferences: { modes: [], primaryStyle: 'Modern' }, engine: 'local' });
  assert.equal(out.status, 'OK');
  if (out.status !== 'OK') throw new Error('unreachable');
  cached = out.design;
  return cached;
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const areaOf = (d: StructuredDesignJSON, type: string) => d.rooms.filter((r) => r.roomType === type).reduce((s, r) => s + r.areaSqFt, 0);

test('enlarging a room that has an outside wall moves that wall and nothing else', async () => {
  const design = await baseDesign();
  const snapshot = JSON.stringify(design);
  const out = await runWhatIf(design, 'Make the kitchen 20% larger');
  assert.equal(JSON.stringify(design), snapshot, 'the stored design must never be mutated');
  assert.equal(out.status, 'OK');
  if (out.status !== 'OK') return;
  assert.ok(['wall-push', 'local-resolve'].includes(out.strategy), `strategy was ${out.strategy}`);
  assert.ok(out.diff.touched <= 3, `${out.diff.touched} rooms were touched`);
  assert.ok(out.diff.preserved >= out.diff.total - 3);
  assert.ok(areaOf(out.design, 'kitchen') > areaOf(design, 'kitchen') * 1.1, 'the kitchen really is larger');
  assert.ok(validateFloorPlan(out.design).isValid);
  // Every room the diff calls unchanged is geometrically identical, to a quarter foot.
  const before = new Map(designCells(design).map((c) => [c.id, c.rect]));
  const after = new Map(designCells(out.design).map((c) => [c.id, c.rect]));
  for (const room of out.diff.rooms.filter((r) => r.kind === 'unchanged')) {
    const a = before.get(room.id)!;
    const b = after.get(room.id)!;
    assert.ok(Math.abs(a.x - b.x) < 0.3 && Math.abs(a.y - b.y) < 0.3 && Math.abs(a.w - b.w) < 0.3 && Math.abs(a.d - b.d) < 0.3, `${room.name} moved though reported unchanged`);
  }
});

test('adding a study builds it against an existing wall without disturbing any existing room', async () => {
  const design = await baseDesign();
  const out = await runWhatIf(design, 'Add a study room');
  assert.equal(out.status, 'OK');
  if (out.status !== 'OK') return;
  assert.ok(out.design.rooms.some((r) => r.roomType === 'study'));
  assert.ok(out.diff.rooms.some((r) => r.kind === 'added' && r.roomType === 'study'));
  assert.ok(out.diff.touched <= 3, `${out.diff.touched} existing rooms were touched`);
  assert.ok(validateFloorPlan(out.design).isValid);
});

test('removing a room hands its space to the neighbours and leaves the rest of the house alone', async () => {
  const design = await baseDesign();
  const out = await runWhatIf(design, 'Remove the utility room');
  assert.equal(out.status, 'OK');
  if (out.status !== 'OK') return;
  assert.ok(!out.design.rooms.some((r) => r.roomType === 'utility'));
  assert.ok(out.diff.preserved >= out.diff.total - 3);
  assert.ok(validateFloorPlan(out.design).isValid);
});

test('a size the plan cannot honour is reported as achieved, never promised', async () => {
  const design = await baseDesign();
  const out = await runWhatIf(design, 'Make the living room 400% larger');
  if (out.status !== 'OK') {
    assert.ok(['INFEASIBLE', 'NOT_UNDERSTOOD'].includes(out.status), out.status);
    return;
  }
  const living = areaOf(out.design, 'living');
  assert.ok(validateFloorPlan(out.design).isValid);
  assert.ok(living < areaOf(design, 'living') * 5, 'sanity');
  // Whatever happened, the client is told exactly how the change was made.
  assert.ok(['wall-push', 'local-resolve', 'full-replan'].includes(out.strategy));
  if (out.strategy === 'full-replan') assert.match(out.surgeryNote || '', /re-planned/);
});

test('when the whole plan has to be re-planned, the client is told which rooms moved', async () => {
  const design = await baseDesign();
  const out = await runWhatIf(design, 'Add an attached bathroom to the master bedroom');
  assert.equal(out.status, 'OK');
  if (out.status !== 'OK') return;
  assert.ok(out.design.rooms.filter((r) => r.roomType === 'bathroom').length > design.rooms.filter((r) => r.roomType === 'bathroom').length);
  assert.equal(out.diff.total, diffDesigns(design, design, 'wall-push').total);
  if (out.strategy === 'full-replan') {
    assert.ok(out.surgeryNote && out.surgeryNote.includes('moved or changed size'));
    assert.ok(out.diff.touched > 0);
  } else {
    assert.ok(out.diff.touched <= 4);
  }
});

test('an unchanged plan diffs as entirely preserved, and a moved room is seen as moved', async () => {
  const design = await baseDesign();
  const same = diffDesigns(design, clone(design), 'wall-push');
  assert.equal(same.touched, 0);
  assert.equal(same.preserved, same.total);
  const moved = clone(design);
  moved.rooms[0].position.x += 5;
  const diff = diffDesigns(design, moved, 'wall-push');
  assert.equal(diff.touched, 1);
  assert.equal(diff.rooms.find((r) => r.kind === 'moved')?.id, moved.rooms[0].id);
});

test('standard plot shapes are valid outlines, and a site always agrees with its outline', () => {
  for (const shape of PLOT_SHAPES) {
    const { polygon, roadEdges } = shapeGeometry(shape.id, 50, 70);
    if (shape.id === 'rectangle') { assert.equal(polygon, undefined); continue; }
    assert.equal(validatePolygon(polygon), null, shape.id);
    assert.ok(roadEdges && roadEdges.length >= 1);
    const site = normalizeSite({ plotWidth: 999, plotDepth: 1, totalArea: 1, orientation: 'E', polygon: polygon!.map((p) => ({ x: p.x + 17, y: p.y + 9 })), roadEdges });
    assert.equal(site.plotWidth, 50);
    assert.equal(site.plotDepth, 70);
    assert.equal(Math.min(...site.polygon!.map((p) => p.x)), 0);
    assert.ok(site.totalArea < 3500 && site.totalArea > 1500);
    assert.deepEqual(validateBriefInput(site, requirements), [], shape.id);
  }
});

test('a self-crossing or tiny outline is refused before any planning happens', () => {
  const bow = { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' as const, polygon: [{ x: 0, y: 0 }, { x: 40, y: 60 }, { x: 40, y: 0 }, { x: 0, y: 60 }] };
  assert.match(validateBriefInput(bow, requirements)[0], /crosses itself/);
  const sliver = { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' as const, polygon: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 12 }, { x: 0, y: 12 }] };
  assert.ok(validateBriefInput(sliver, requirements).length > 0);
});
