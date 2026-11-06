import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLocalProgram } from '../src/lib/genai/localPlanner';
import { layoutProgram } from '../src/lib/design/layoutEngine';
import { planLayout } from '../src/lib/design/planner';
import { computeEnvelope, polygonArea, validatePolygon } from '../src/lib/design/planner/envelope';
import { subtractRects } from '../src/lib/design/planner/slicing';
import { evaluateDesign } from '../src/lib/design/quality';
import { validateFloorPlan } from '../src/lib/design/validateFloorPlan';
import { designCells } from '../src/lib/geometry/planGeometry';
import type { StructuredDesignJSON } from '../src/types/architectural';
import { CASES, briefFor, location } from './tools/cases';

const byId = (id: string) => CASES.find((c) => c.id === id)!;
const plan = (id: string) => {
  const c = byId(id);
  const constraints = briefFor(c);
  const program = buildLocalProgram(c.site, location, constraints, '', 0);
  return { c, constraints, program, out: planLayout(program, c.site, constraints, { hot: true }) };
};
const designOf = (out: ReturnType<typeof planLayout>): StructuredDesignJSON => {
  assert.ok(out.result.ok, out.result.ok ? '' : `planning failed: ${out.result.reason}`);
  return (out.result as { design: StructuredDesignJSON }).design;
};
const count = (design: StructuredDesignJSON, ...types: string[]) => design.rooms.filter((r) => types.includes(r.roomType || '')).length;

test('a plot outline must have three real corners and may not cross itself', () => {
  assert.equal(validatePolygon([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 60 }, { x: 0, y: 60 }]), null);
  assert.match(validatePolygon([{ x: 0, y: 0 }, { x: 40, y: 0 }])!, /three corners/);
  assert.match(validatePolygon([{ x: 0, y: 0 }, { x: 40, y: 60 }, { x: 40, y: 0 }, { x: 0, y: 60 }])!, /crosses itself/);
  assert.match(validatePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])!, /less than 200/);
});

test('the buildable region of an L-shaped plot excludes the notch and honours setbacks on every edge', () => {
  const l = CASES.find((c) => c.id === 'F2')!.site;
  const env = computeEnvelope(l);
  assert.equal(env.rectangular, false);
  assert.ok(env.buildableArea < polygonArea(env.plot), 'setbacks must remove area');
  assert.equal(env.fits({ x: 40, y: 40, w: 10, d: 10 }), false, 'a rectangle inside the notch is not buildable');
  assert.equal(env.fits({ x: 8, y: 12, w: 15, d: 15 }), true);
  assert.equal(env.fits({ x: 0, y: 12, w: 15, d: 15 }), false, 'a rectangle touching the plot edge breaks the setback');
  const placed = env.place(20, 25, 'front')!;
  assert.ok(placed && env.fits(placed));
});

test('subtracting blocks from a region conserves area and never overlaps', () => {
  const region = { x: 0, y: 0, w: 30, d: 24 };
  const blocks = [{ x: 10, y: 6, w: 7, d: 12 }, { x: 22, y: 0, w: 8, d: 5 }];
  for (const horizontalFirst of [true, false]) {
    const pieces = subtractRects(region, blocks, horizontalFirst);
    const area = pieces.reduce((s, p) => s + p.w * p.d, 0);
    assert.ok(Math.abs(area - (720 - 84 - 40)) < 1e-6, `area ${area}`);
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      assert.ok(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) <= 1e-9 || Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y) <= 1e-9, 'pieces overlap');
    }
  }
});

test('planning is deterministic: the same brief gives the same plan', () => {
  const a = designOf(plan('B').out);
  const b = designOf(plan('B').out);
  assert.deepEqual(a.rooms.map((r) => [r.id, r.position]), b.rooms.map((r) => [r.id, r.position]));
});

test('a 25 x 50 ft plot with 2 bedrooms and a car: honest, valid plan with every requirement kept', () => {
  const { c, constraints, program, out } = plan('B');
  // The band solver alone reports this brief infeasible; the optimiser finds a real arrangement.
  assert.equal(layoutProgram(program, c.site, constraints).ok, false, 'documents the old limitation');
  const design = designOf(out);
  assert.equal(count(design, 'master_bedroom', 'bedroom'), 2);
  assert.ok(count(design, 'bathroom') >= 2);
  assert.equal(count(design, 'parking'), 1);
  assert.ok(validateFloorPlan(design).isValid);
  assert.equal(design.planner?.engine, 'spatial-optimizer');
  assert.ok((design.layoutNotes || []).some((n) => /reduced|compress|minimum/i.test(n)), 'the squeeze is reported, not hidden');
});

test('irregular plots: every room sits inside the real buildable outline, never inside a rectangle that merely contains it', () => {
  for (const id of ['F1', 'F2', 'F3']) {
    const { c, out } = plan(id);
    const design = designOf(out);
    const env = computeEnvelope({ ...c.site, setbacks: design.plot.setbacks });
    for (const cell of designCells(design).filter((x) => x.type !== 'void')) {
      assert.ok(env.fits({ x: cell.rect.x + 0.05, y: cell.rect.y + 0.05, w: cell.rect.w - 0.1, d: cell.rect.d - 0.1 }), `${id}: a ${cell.type} on floor ${cell.floor} leaves the buildable area`);
    }
    assert.ok(design.plot.polygon && design.plot.polygon.length >= 4, `${id}: the plot outline travels with the design for the renderers`);
    assert.equal(design.planner?.engine, 'spatial-optimizer', `${id}: the rectangular band solver must not claim an irregular site`);
  }
});

test('different road orientations produce different, valid plans (the plan answers to the site)', () => {
  const fingerprints = ['A', 'G1', 'G2'].map((id) => {
    const design = designOf(plan(id).out);
    assert.ok(validateFloorPlan(design).isValid, id);
    return design.rooms.filter((r) => r.position.floorLevel === 0).map((r) => `${r.roomType}@${Math.round(r.position.x)},${Math.round(r.position.y)}`).sort().join('|');
  });
  assert.equal(new Set(fingerprints).size, 3, 'north- and west-facing plots must not be copies of the east-facing plan');
});

test('alternatives are genuinely different arrangements, not relabelled copies', () => {
  const { out } = plan('A');
  const optimizer = out.ranked.filter((r) => r.engine === 'spatial-optimizer');
  assert.ok(optimizer.length >= 3, `only ${optimizer.length} optimiser layouts`);
  const centroids = (d: StructuredDesignJSON) => new Map(d.rooms.filter((r) => r.position.floorLevel === 0).map((r) => [r.roomType!, [r.position.x + r.position.width / 2, r.position.y + r.position.height / 2]]));
  let differentPairs = 0;
  let pairs = 0;
  for (let i = 0; i < out.ranked.length; i++) for (let j = i + 1; j < out.ranked.length; j++) {
    const a = centroids(out.ranked[i].success.design);
    const b = centroids(out.ranked[j].success.design);
    let moved = 0;
    a.forEach((pa, type) => { const pb = b.get(type); if (pb && Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) > 6) moved++; });
    pairs++;
    if (moved >= 3) differentPairs++;
  }
  assert.ok(differentPairs / pairs >= 0.8, `only ${differentPairs} of ${pairs} pairs differ in at least three ground-floor room positions`);
  const best = out.ranked[0].success.design.planner!;
  assert.equal(best.alternatives.filter((a) => a.selected).length, 1);
  assert.ok(best.alternatives.every((a) => a.selected || a.tradeoff.length > 5), 'every alternative explains its trade-off');
});

test('every benchmark case yields a valid plan whose mandatory requirements are intact', () => {
  for (const c of CASES) {
    const { out } = plan(c.id);
    const design = designOf(out);
    const report = validateFloorPlan(design);
    assert.ok(report.isValid, `${c.id}: ${report.errors.join(' | ')}`);
    assert.equal(count(design, 'master_bedroom', 'bedroom'), c.bedrooms, `${c.id} bedrooms`);
    assert.equal(design.floorsCount, c.floors, `${c.id} floors`);
    assert.equal(count(design, 'parking'), 1, `${c.id} parking`);
    if (c.court) assert.ok(count(design, 'courtyard') >= 1, `${c.id} courtyard requested but missing`);
    const q = evaluateDesign(design);
    assert.equal(q.metrics.unreachableRooms, 0, `${c.id}: unreachable rooms by the door graph`);
    assert.equal(q.metrics.envelopeViolations, 0, `${c.id}`);
  }
});

test('a plot that truly cannot hold the brief is refused with the real conflict, never silently reduced', () => {
  const c = byId('B');
  const constraints = { ...briefFor({ ...c, bedrooms: 4 }), bathrooms: 3 };
  const site = { plotWidth: 18, plotDepth: 30, totalArea: 540, orientation: 'E' as const };
  const program = buildLocalProgram(site, location, constraints, '', 0);
  const out = planLayout(program, site, constraints, { hot: true, effort: 0.3 });
  assert.equal(out.result.ok, false);
  if (!out.result.ok) assert.match(out.result.reason, /cannot fit|too small/i);
});

test('the quality score rewards what an architect would reward and never scores an invalid plan', () => {
  const { out } = plan('A');
  const best = out.ranked[0];
  assert.ok(best.quality.score > 0 && best.quality.score <= 100);
  assert.ok(Math.abs(best.quality.parts.reduce((s, p) => s + p.weight, 0) - 100) < 0.6);
  const broken = JSON.parse(JSON.stringify(best.success.design)) as StructuredDesignJSON;
  broken.rooms[1].position.x = broken.rooms[0].position.x; // force an overlap
  broken.rooms[1].position.y = broken.rooms[0].position.y;
  assert.equal(evaluateDesign(broken).score, 0);
});
