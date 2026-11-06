import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { factsBlock, intentFromFacts, mergeIntent, preprocessBrief } from '../src/lib/genai/briefing';
import { SYSTEM_ARCHITECTURAL_PROMPT, buildProgramPrompt } from '../src/lib/genai/prompts';
import { buildLocalProgram } from '../src/lib/genai/localPlanner';
import { buildConstraints, parseIntent, parseProgram } from '../src/lib/design/program';
import { generateDesign } from '../src/lib/design/pipeline';
import { designCells, sharedEdge } from '../src/lib/geometry/planGeometry';
import type { DesignRequirements, LocationInfo } from '../src/types/architectural';
import { location } from './tools/cases';

beforeEach(() => { delete process.env.GENAI_API_KEY; delete process.env.GEMINI_API_KEY; });

const requirements = (over: Partial<DesignRequirements> = {}, spaces: Partial<DesignRequirements['spaces']> = {}): DesignRequirements => ({
  familySize: 5, bedrooms: 3, bathrooms: 2, floors: 2, budgetRange: 'Moderate',
  spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false, ...spaces },
  ...over
});
const constraintsFor = (over: Partial<DesignRequirements> = {}, spaces: Partial<DesignRequirements['spaces']> = {}) => buildConstraints(requirements(over, spaces), { modes: [], primaryStyle: 'Modern' });

test('the brief reader understands household, lifestyle and cultural needs from plain words', () => {
  const facts = preprocessBrief('My elderly parents live with us and we both work from home. We love entertaining relatives, and want a vastu friendly puja room. Privacy for bedrooms matters. Two dogs.', constraintsFor());
  assert.equal(facts.household.elders, true);
  assert.equal(facts.household.remoteWork, true);
  assert.equal(facts.household.entertains, true);
  assert.equal(facts.household.pets, true);
  assert.equal(facts.preferences.privacy, true);
  assert.equal(facts.vastu, true);
  assert.ok(facts.extraSpaces.some((s) => s.space === 'prayerRoom'), 'a puja room named in the notes but not in the form is offered as optional');
  assert.ok(facts.understood.length >= 5);
});

test('notes never override the form: contradictions are reported and the form value stands', () => {
  const facts = preprocessBrief('We want a 4 bedroom single storey house', constraintsFor({ bedrooms: 3, floors: 2 }));
  assert.ok(facts.conflicts.some((c) => /4 bedrooms.*form says 3/.test(c)));
  assert.ok(facts.conflicts.some((c) => /1 floor.*form says 2/.test(c)));
});

test('a requested space that the form already switched on is not reported as extra', () => {
  const facts = preprocessBrief('We need a puja room', constraintsFor({}, { prayerRoom: true }));
  assert.equal(facts.extraSpaces.length, 0);
});

test('facts become weighted planning pressure, with reasons the client can read', () => {
  const facts = preprocessBrief('We entertain a lot and want an open plan kitchen. Privacy for the bedrooms.', constraintsFor());
  const intent = intentFromFacts(facts, constraintsFor());
  const weight = (a: string, b: string, kind = 'adj') => intent.adjacency!.find((l) => l.a === a && l.b === b && (l.kind || 'adj') === kind)?.weight;
  assert.ok((weight('kitchen', 'dining') ?? 0) >= 9);
  assert.ok((weight('bedroom', 'living', 'avoid') ?? 0) >= 5);
  assert.ok(intent.preferredArchetypes!.includes('compact') && intent.preferredArchetypes!.includes('spine'));
  assert.ok(intent.reasons!.every((r) => r.length > 20));
});

test('the AI intent block is validated: unknown rooms dropped, weights clamped, planning ideas limited to known ones', () => {
  const rooms = buildLocalProgram({ plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' }, location as LocationInfo, constraintsFor(), '', 0).rooms;
  const intent = parseIntent({
    adjacency: [
      { a: 'kitchen', b: 'dining', weight: 99, kind: 'adj' },
      { a: 'kitchen', b: 'spaceship', weight: 5 },
      { a: 'bedroom', b: 'living', weight: -4, kind: 'avoid' },
      { a: 'living', b: 'living', weight: 5 }
    ],
    preferredArchetypes: ['hub', 'teleporter', 'courtyard', 'spine'],
    reasons: ['They host weekly dinners.'], priorities: ['a', 'b', 'c', 'd', 'e', 'f']
  }, rooms)!;
  assert.equal(intent.adjacency!.length, 2);
  assert.equal(intent.adjacency![0].weight, 10);
  assert.equal(intent.adjacency![1].weight, 1);
  assert.deepEqual(intent.preferredArchetypes, ['hub', 'courtyard']);
  assert.equal(intent.priorities!.length, 5);
  assert.equal(parseIntent('nonsense', rooms), undefined);
});

test('merging keeps the stronger weight and credits the AI', () => {
  const merged = mergeIntent(
    { adjacency: [{ a: 'kitchen', b: 'dining', weight: 6 }], preferredArchetypes: ['hub'], reasons: ['Because X'] },
    { adjacency: [{ a: 'dining', b: 'kitchen', weight: 9 }], preferredArchetypes: ['compact'], reasons: ['Because Y'] }
  );
  assert.equal(merged.adjacency!.length, 1);
  assert.equal(merged.adjacency![0].weight, 9);
  assert.deepEqual(merged.preferredArchetypes, ['hub', 'compact']);
  assert.ok(merged.reasons![0].startsWith('AI: '));
});

test('the AI prompt carries the verified facts, asks for intent, and no longer tells the AI to lay out front/middle/rear zones', () => {
  const constraints = constraintsFor();
  const facts = preprocessBrief('We work from home and host guests.', constraints);
  const site = { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' as const };
  const prompt = buildProgramPrompt({ site, location, constraints, customRequirements: 'We work from home and host guests.', ragContext: '', facts });
  assert.match(prompt, /WHAT WAS UNDERSTOOD/);
  assert.match(prompt, /"intent"/);
  assert.match(prompt, /never invent a hard requirement/i);
  assert.doesNotMatch(SYSTEM_ARCHITECTURAL_PROMPT, /three zones by depth/i);
  assert.match(SYSTEM_ARCHITECTURAL_PROMPT, /RELATIONSHIPS/);
  assert.match(factsBlock(preprocessBrief('', constraints)), /none were written/i);
});

test('a planner response with intent is parsed through to the program', () => {
  const constraints = constraintsFor({ bedrooms: 1, bathrooms: 1, floors: 1 });
  const raw = {
    status: 'OK',
    rooms: [
      { id: 'living', name: 'Living', type: 'living', floor: 0, areaSqFt: 200 },
      { id: 'kitchen', name: 'Kitchen', type: 'kitchen', floor: 0, areaSqFt: 100 },
      { id: 'master', name: 'Master', type: 'master_bedroom', floor: 0, areaSqFt: 160 },
      { id: 'bath', name: 'Bath', type: 'bathroom', floor: 0, areaSqFt: 40 }
    ],
    intent: { adjacency: [{ a: 'kitchen', b: 'living', weight: 8 }], preferredArchetypes: ['hub'], reasons: ['Cooks for guests.'] }
  };
  const parsed = parseProgram(raw, constraints);
  assert.ok(parsed.program);
  assert.deepEqual(parsed.program!.intent!.preferredArchetypes, ['hub']);
  assert.equal(parsed.program!.intent!.adjacency![0].a, 'room-kitchen');
});

test('end to end without a key: the client sees what was understood, and the stated privacy wish is honoured', async () => {
  const outcome = await generateDesign({
    site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' }, location,
    requirements: requirements({ bedrooms: 3, floors: 2 }), preferences: { modes: [], primaryStyle: 'Modern' }, engine: 'local'
  });
  assert.equal(outcome.status, 'OK');
  if (outcome.status !== 'OK') return;
  assert.equal(outcome.design.briefReading?.source, 'rules');

  const withNotes = await generateDesign({
    site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' }, location,
    requirements: { ...requirements({ bedrooms: 3, floors: 2 }), customRequirements: 'Privacy for the bedrooms is the top priority. We entertain guests often.' } as DesignRequirements,
    preferences: { modes: [], primaryStyle: 'Modern' }, engine: 'local'
  });
  assert.equal(withNotes.status, 'OK');
  if (withNotes.status !== 'OK') return;
  const reading = withNotes.design.briefReading!;
  assert.ok(reading.understood.some((u) => /privacy/i.test(u)) && reading.understood.some((u) => /entertain/i.test(u)));
  const cells = designCells(withNotes.design);
  const living = cells.filter((c) => c.type === 'living');
  const beds = cells.filter((c) => c.type === 'master_bedroom' || c.type === 'bedroom');
  const exposed = beds.filter((b) => living.some((l) => l.floor === b.floor && (sharedEdge(b.rect, l.rect)?.length ?? 0) >= 2));
  assert.equal(exposed.length, 0, 'no bedroom shares a wall with the living room when privacy was asked for');
  assert.ok(withNotes.design.planner!.alternatives.length >= 2, 'alternatives are offered');
  assert.equal(withNotes.design.generationMetadata?.engine, 'local-rule-engine', 'the engine used is recorded, never presented as AI');
});
