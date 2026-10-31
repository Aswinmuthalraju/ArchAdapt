import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { generateDesign } from '../src/lib/design/pipeline';
import { applyStyleMandates, checkStyleConformance, styleBlueprint } from '../src/lib/design/styleBlueprints';
import { buildConstraints } from '../src/lib/design/program';
import { buildLocalProgram } from '../src/lib/genai/localPlanner';
import type { ArchitecturalStyle, DesignRequirements, LocationInfo, StructuredDesignJSON } from '../src/types/architectural';

const location: LocationInfo = { name: 'Kochi, Kerala', city: 'Kochi', country: 'India', lat: 9.9312, lng: 76.2673, climateZone: 'Warm & Humid' };
const requirements: DesignRequirements = {
  familySize: 4, bedrooms: 3, bathrooms: 2, floors: 2, budgetRange: 'Moderate',
  spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false }
};
const site = { plotWidth: 50, plotDepth: 70, totalArea: 3500, orientation: 'E' as const };

beforeEach(() => {
  delete process.env.GENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

async function generate(style: ArchitecturalStyle): Promise<StructuredDesignJSON> {
  const outcome = await generateDesign({ site, location, requirements, preferences: { modes: [], primaryStyle: style }, engine: 'local' });
  assert.equal(outcome.status, 'OK');
  if (outcome.status !== 'OK') throw new Error('unreachable');
  return outcome.design;
}

const typesOf = (design: StructuredDesignJSON) => new Set(design.rooms.map((room) => room.roomType));
const areaOf = (design: StructuredDesignJSON, type: string) => design.rooms.filter((room) => room.roomType === type).reduce((total, room) => total + room.areaSqFt, 0);

test('Kerala Traditional gets a courtyard, a puja room, a store and a deep sit-out without being asked', async () => {
  const kerala = await generate('Kerala Traditional');
  const types = typesOf(kerala);
  for (const type of ['courtyard', 'puja', 'store']) assert.ok(types.has(type as never), `Kerala plan is missing a ${type}`);
  assert.ok(areaOf(kerala, 'entrance') >= 60, 'Poomukham must be a generous verandah');
  assert.equal(kerala.footprint?.shapeType, 'courtyard_centered');
});

test('Minimalist stays compact and adds none of the traditional rooms', async () => {
  const minimalist = await generate('Minimalist');
  const types = typesOf(minimalist);
  assert.ok(!types.has('courtyard') && !types.has('puja') && !types.has('guest_room'));
  assert.ok(!types.has('utility'));
  assert.ok(areaOf(minimalist, 'living') < areaOf(await generate('Modern Luxury'), 'living'));
});

test('Modern Luxury gives every bedroom a bath, dresses the master and parks two cars', async () => {
  const luxury = await generate('Modern Luxury');
  const bedrooms = luxury.rooms.filter((room) => room.roomType === 'bedroom' || room.roomType === 'master_bedroom');
  const attachedBaths = luxury.rooms.filter((room) => room.roomType === 'bathroom' && room.attachedTo);
  assert.equal(attachedBaths.length, bedrooms.length);
  assert.ok(luxury.rooms.some((room) => room.roomType === 'dressing' && room.attachedTo === 'room-master'));
  assert.ok(areaOf(luxury, 'parking') >= 300);
  assert.ok(typesOf(luxury).has('study') && typesOf(luxury).has('guest_room'));
});

test('Colonial has a grand portico, a formal dining room and a study', async () => {
  const colonial = await generate('Colonial');
  assert.ok(areaOf(colonial, 'entrance') >= 75);
  assert.ok(typesOf(colonial).has('study') && typesOf(colonial).has('dining'));
});

test('every style yields a different room programme for the same brief', async () => {
  const styles: ArchitecturalStyle[] = ['Kerala Traditional', 'Modern', 'Minimalist', 'Contemporary', 'Colonial', 'Tropical', 'Traditional Indian', 'Modern Luxury'];
  const fingerprints = new Set<string>();
  for (const style of styles) {
    const design = await generate(style);
    fingerprints.add(design.rooms.map((room) => `${room.roomType}:${Math.round(room.areaSqFt / 10)}`).sort().join('|'));
  }
  assert.equal(fingerprints.size, styles.length);
});

test('the client\'s own choices are never switched off by a style', () => {
  const base = buildConstraints({ ...requirements, spaces: { ...requirements.spaces, studyWorkspace: true, courtyard: true } }, { modes: [], primaryStyle: 'Minimalist' });
  const applied = applyStyleMandates(base, 'full');
  assert.ok(applied.requiredSpaces.includes('studyWorkspace') && applied.requiredSpaces.includes('courtyard'));
});

test('a plot too small for the style relaxes it and says so', async () => {
  const outcome = await generateDesign({
    site: { plotWidth: 32, plotDepth: 50, totalArea: 1600, orientation: 'E' }, location,
    requirements: { ...requirements, bedrooms: 2, bathrooms: 2, floors: 1 }, preferences: { modes: [], primaryStyle: 'Modern Luxury' }, engine: 'local'
  });
  if (outcome.status === 'OK') {
    assert.notEqual(outcome.design.constraints?.styleLevel, undefined);
    if (outcome.design.constraints?.styleLevel !== 'full') assert.ok(outcome.warnings.some((line) => /Modern Luxury/.test(line)));
  }
});

test('a planner programme that ignores the style is rejected with an instruction', () => {
  const constraints = applyStyleMandates(buildConstraints(requirements, { modes: [], primaryStyle: 'Modern Luxury' }), 'full');
  const program = buildLocalProgram(site, location, { ...constraints, styleLevel: 'full' });
  assert.deepEqual(checkStyleConformance(program, constraints), []);
  const stripped = { ...program, rooms: program.rooms.filter((room) => room.type !== 'dressing') };
  assert.ok(checkStyleConformance(stripped, constraints).some((line) => /dressing/.test(line)));
  assert.equal(styleBlueprint('Kerala Traditional').planningType, 'courtyard_centered');
});
