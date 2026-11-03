import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { generateDesign } from '../src/lib/design/pipeline';
import { validateBriefInput } from '../src/lib/design/inputValidation';
import type { ArchitecturalStyle, DesignRequirements, LocationInfo } from '../src/types/architectural';

const location: LocationInfo = { name: 'Kochi', city: 'Kochi', country: 'India', lat: 9.9, lng: 76.2, climateZone: 'Warm & Humid' };
const brief = (bedrooms: number, floors: number): DesignRequirements => ({
  familySize: 4, bedrooms, bathrooms: 2, floors, budgetRange: 'Moderate',
  spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false }
});

beforeEach(() => { delete process.env.GENAI_API_KEY; delete process.env.GEMINI_API_KEY; });

async function plan(style: ArchitecturalStyle, w: number, d: number, bedrooms = 3, floors = 2) {
  const outcome = await generateDesign({ site: { plotWidth: w, plotDepth: d, totalArea: w * d, orientation: 'E' }, location, requirements: brief(bedrooms, floors), preferences: { modes: [], primaryStyle: style }, engine: 'local' });
  assert.equal(outcome.status, 'OK', JSON.stringify(outcome));
  if (outcome.status !== 'OK') throw new Error('unreachable');
  return outcome.design;
}

test('a large plot gets a larger house than a modest one for the same brief', async () => {
  const modest = await plan('Modern', 40, 60);
  const large = await plan('Modern', 100, 120);
  assert.ok(large.totalBuiltUpAreaSqFt > modest.totalBuiltUpAreaSqFt * 1.5, `large ${large.totalBuiltUpAreaSqFt} vs modest ${modest.totalBuiltUpAreaSqFt}`);
  const living = (d: typeof large) => d.rooms.filter((room) => room.roomType === 'living').reduce((t, room) => t + room.areaSqFt, 0);
  assert.ok(living(large) > living(modest) * 1.4);
  assert.ok((large.layoutNotes || []).some((note) => /increased by about/.test(note)), 'growth is reported to the user');
});

test('growth keeps the validated brief: bedroom count, a main door and a way into the stair on every floor', async () => {
  for (const style of ['Kerala Traditional', 'Colonial', 'Modern Luxury', 'Minimalist'] as ArchitecturalStyle[]) {
    const design = await plan(style, 80, 120, 4, 2);
    assert.equal(design.rooms.filter((r) => r.roomType === 'bedroom' || r.roomType === 'master_bedroom').length, 4, style);
    assert.ok(design.openings.some((op) => op.isExterior && op.type === 'door'), `${style} has no main door`);
    const stairIds = new Set(design.rooms.filter((r) => r.roomType === 'stair').map((r) => r.id));
    for (const level of [0, 1]) {
      assert.ok(design.openings.some((op) => op.floorLevel === level && op.connects?.some((id) => stairIds.has(id))), `${style}: no way into the stair on floor ${level}`);
    }
  }
});

test('Minimalist stays more compact than Modern Luxury on the same large plot', async () => {
  const minimal = await plan('Minimalist', 100, 120);
  const luxury = await plan('Modern Luxury', 100, 120);
  assert.ok(minimal.totalBuiltUpAreaSqFt < luxury.totalBuiltUpAreaSqFt);
});

test('a small plot is not inflated', async () => {
  const design = await plan('Modern', 40, 60);
  assert.ok(!(design.layoutNotes || []).some((note) => /increased by about/.test(note)));
});

test('input validation explains what is wrong in plain language', () => {
  const site = { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' as const };
  assert.deepEqual(validateBriefInput(site, brief(3, 2)), []);
  assert.ok(validateBriefInput({ ...site, plotWidth: 5 }, brief(3, 2))[0].includes('between 10 and 1000'));
  assert.ok(validateBriefInput(site, brief(0, 2))[0].includes('Bedrooms'));
  assert.ok(validateBriefInput({ ...site, setbacks: { front: 30, rear: 30, left: 20, right: 20 } }, brief(3, 2))[0].includes('too small'));
});

test('a courtyard that cannot be enclosed on a very large plot is drawn open and explained, not refused', async () => {
  const outcome = await generateDesign({
    site: { plotWidth: 100, plotDepth: 150, totalArea: 15000, orientation: 'N' }, location,
    requirements: { ...brief(2, 1), spaces: { ...brief(2, 1).spaces, courtyard: true, outdoorGarden: true, prayerRoom: true, studyWorkspace: true, guestRoom: true, balcony: true, storage: true } },
    preferences: { modes: [], primaryStyle: 'Modern' }, engine: 'local'
  });
  assert.equal(outcome.status, 'OK', JSON.stringify(outcome));
  if (outcome.status === 'OK') assert.ok(outcome.design.rooms.some((room) => room.roomType === 'courtyard'));
});

test('no bathroom in any plan is drawn larger than 190 sq ft', async () => {
  for (const [w, d] of [[30, 50], [60, 40], [40, 60]] as const) {
    for (const bedrooms of [1, 2, 3]) {
      const outcome = await generateDesign({ site: { plotWidth: w, plotDepth: d, totalArea: w * d, orientation: 'E' }, location, requirements: brief(bedrooms, 2), preferences: { modes: ['budget_first'], primaryStyle: 'Modern' }, engine: 'local' });
      if (outcome.status !== 'OK') continue;
      for (const room of outcome.design.rooms.filter((r) => r.roomType === 'bathroom')) assert.ok(room.areaSqFt <= 190, `${w}x${d} ${bedrooms}BR ${room.name} ${room.areaSqFt}`);
    }
  }
});

test('studies and guest rooms are never drawn as narrow strips, and no upstairs balcony is left without a door', async () => {
  for (const [w, d] of [[50, 80], [60, 100], [80, 120], [100, 150]] as const) {
    for (const [bedrooms, floors] of [[2, 1], [3, 2], [5, 3]] as const) {
      const outcome = await generateDesign({ site: { plotWidth: w, plotDepth: d, totalArea: w * d, orientation: 'N' }, location, requirements: brief(bedrooms, floors), preferences: { modes: [], primaryStyle: 'Modern Luxury' }, engine: 'local' });
      if (outcome.status !== 'OK') continue;
      for (const room of outcome.design.rooms) {
        const [rw, rd] = (room.dimensions.match(/[\d.]+/g) || ['1', '1']).map(Number);
        if (room.roomType === 'study' || room.roomType === 'guest_room') assert.ok(Math.max(rw, rd) / Math.min(rw, rd) < 2.7, `${w}x${d} ${bedrooms}BR ${room.name} ${room.dimensions}`);
        if ((room.position.floorLevel || 0) > 0 && room.derived && (room.roomType === 'terrace' || room.roomType === 'balcony')) assert.ok((room.connections || []).length > 0, `${w}x${d} ${bedrooms}BR orphan ${room.name}`);
      }
    }
  }
});
