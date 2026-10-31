import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { generateDesign } from '../src/lib/design/pipeline';
import { getRelevantKnowledge } from '../src/lib/genai/rag/architecturalKnowledge';
import { designCells, sharedEdge, PlanCell } from '../src/lib/geometry/planGeometry';
import { buildHouseGeometry, FT } from '../src/lib/geometry/buildHouseGeometry';
import { planStair } from '../src/lib/geometry/stairGeometry';
import type { ArchitecturalStyle, DesignRequirements, LocationInfo, StructuredDesignJSON } from '../src/types/architectural';

const location: LocationInfo = { name: 'Kochi, Kerala', city: 'Kochi', country: 'India', lat: 9.9312, lng: 76.2673, climateZone: 'Warm & Humid' };
const brief = (bedrooms: number, floors: number): DesignRequirements => ({
  familySize: 4, bedrooms, bathrooms: 2, floors, budgetRange: 'Moderate',
  spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false }
});

beforeEach(() => {
  delete process.env.GENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

async function generate(style: ArchitecturalStyle, plotWidth: number, plotDepth: number, bedrooms: number, floors: number) {
  const outcome = await generateDesign({
    site: { plotWidth, plotDepth, totalArea: plotWidth * plotDepth, orientation: 'E' },
    location, requirements: brief(bedrooms, floors), preferences: { modes: [], primaryStyle: style }, engine: 'local'
  });
  assert.equal(outcome.status, 'OK', JSON.stringify(outcome));
  if (outcome.status !== 'OK') throw new Error('unreachable');
  return outcome;
}

/** Share of each side of `cell` that is closed by another room on the same floor. */
function enclosure(cell: PlanCell, cells: PlanCell[]) {
  const others = cells.filter((other) => other.floor === cell.floor && other.id !== cell.id);
  const side = (at: number, orientation: 'horizontal' | 'vertical', length: number) => {
    const covered = others.reduce((total, other) => {
      const edge = sharedEdge(cell.rect, other.rect);
      return edge && edge.orientation === orientation && Math.abs(edge.at - at) < 0.1 ? total + edge.length : total;
    }, 0);
    return covered / length;
  };
  const { x, y, w, d } = cell.rect;
  return [side(y, 'horizontal', w), side(y + d, 'horizontal', w), side(x, 'vertical', d), side(x + w, 'vertical', d)];
}

function assertRealCourtyard(design: StructuredDesignJSON) {
  const cells = designCells(design);
  for (const court of cells.filter((cell) => cell.type === 'courtyard')) {
    assert.ok(Math.min(court.rect.w, court.rect.d) >= 9 - 0.05, `courtyard is only ${court.rect.w.toFixed(1)} x ${court.rect.d.toFixed(1)} ft`);
    const sides = enclosure(court, cells);
    assert.ok(sides.every((share) => share >= 0.85), `courtyard is not surrounded by rooms (front/rear/left/right closed: ${sides.map((s) => s.toFixed(2)).join(', ')})`);
  }
}

test('Kerala on a generous plot puts a real Nadumuttam at the heart of the plan, enclosed by rooms', async () => {
  const { design } = await generate('Kerala Traditional', 50, 70, 3, 2);
  assert.ok(design.rooms.some((room) => room.roomType === 'courtyard'), 'a generous Kerala plot should keep its Nadumuttam');
  assertRealCourtyard(design);
});

test('Kerala single storey on a generous plot also gets an enclosed courtyard', async () => {
  const { design } = await generate('Kerala Traditional', 50, 70, 3, 1);
  assertRealCourtyard(design);
});

test('Kerala on a small plot leaves the courtyard out instead of squeezing a slot, and says so', async () => {
  const outcome = await generate('Kerala Traditional', 35, 55, 2, 1);
  assertRealCourtyard(outcome.design);
  if (!outcome.design.rooms.some((room) => room.roomType === 'courtyard')) {
    assert.ok(outcome.warnings.some((line) => /courtyard|Nadumuttam/i.test(line)), 'the user must be told the courtyard was left out');
    assert.ok(outcome.design.rooms.some((room) => room.roomType === 'puja'), 'the other Kerala rooms are kept when only the courtyard cannot fit');
  }
});

test('No courtyard anywhere is ever a slot or pushed against the outside wall', async () => {
  for (const [w, d, floors] of [[40, 60, 2], [45, 65, 2], [60, 80, 2], [40, 60, 1]] as const) {
    for (const style of ['Kerala Traditional', 'Traditional Indian', 'Tropical'] as ArchitecturalStyle[]) {
      const { design } = await generate(style, w, d, 3, floors);
      assertRealCourtyard(design);
    }
  }
});

test('Style knowledge is retrieved per style and never leaks between styles', () => {
  const kerala = getRelevantKnowledge('', [], 'Kerala Traditional');
  const colonial = getRelevantKnowledge('', [], 'Colonial');
  const minimalist = getRelevantKnowledge('', [], 'Minimalist');
  assert.match(kerala, /Nadumuttam/);
  assert.match(colonial, /portico|symmetr/i);
  assert.match(minimalist, /storage|clutter/i);
  assert.doesNotMatch(colonial, /Nadumuttam|Kerala/);
  assert.doesNotMatch(minimalist, /Nadumuttam|Kerala|terracotta/i);
  assert.notEqual(kerala, colonial);
  // Modes add their own knowledge on top of the style.
  assert.match(getRelevantKnowledge('', ['life_stage'], 'Modern'), /Aging in Place|wheelchair/i);
});

test('The top of the stair is not blocked by its guard rail in 3D', async () => {
  const { design } = await generate('Modern', 40, 60, 3, 2);
  const geometry = buildHouseGeometry(design);
  const top = designCells(design).find((cell) => cell.type === 'stair' && cell.floor === 1)!;
  const plan = planStair(top.rect, design.stairs?.[0]?.footSide || 'rear');
  // The second flight arrives on the half of the stair away from the first flight (plan x from rect.x + w/2 to rect.x + w).
  const plotWidth = design.plot.width;
  const X = (ft: number) => (plotWidth / 2 - ft) * FT;
  const [arrivalA, arrivalB] = [X(top.rect.x + top.rect.w / 2), X(top.rect.x + top.rect.w)].sort((a, b) => a - b);
  const Z = (ft: number) => (ft - design.plot.depth / 2) * FT;
  const rails = geometry.railings.filter((rail) => rail.floorLevel === 1 && rail.size[0] > rail.size[2]
    && rail.position[2] > Z(top.rect.y) + 0.01 && rail.position[2] < Z(top.rect.y + top.rect.d) - 0.01);
  for (const rail of rails) {
    const [lo, hi] = [rail.position[0] - rail.size[0] / 2, rail.position[0] + rail.size[0] / 2];
    const overlap = Math.min(hi, arrivalB) - Math.max(lo, arrivalA);
    assert.ok(overlap < 0.05, `a rail crosses the arrival of the upper flight (${overlap.toFixed(2)} m)`);
  }
  assert.ok(plan.footDepth > 0);
});
