import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, glazedAreaSqFt } from '../src/lib/design/metrics';
import { buildInteriorPrompt, buildExteriorPrompt, pick, INTERIOR_STYLES } from '../src/lib/rendering/promptBuilder';
import { parseDataUrl } from '../src/lib/genai/media';
import { POST as interiorPost } from '../src/app/api/render/interior/route';
import { POST as exteriorPost } from '../src/app/api/render/exterior/route';
import { POST as blueprintPost } from '../src/app/api/ingest/blueprint/route';
import type { FloorPlanRoom, StructuredDesignJSON } from '../src/types/architectural';

const room = (id: string, name: string, roomType: FloorPlanRoom['roomType'], x: number, y: number, w: number, h: number): FloorPlanRoom => ({
  id, name, roomType, category: 'living', dimensions: `${w}' x ${h}'`, areaSqFt: w * h, connections: [], features: [],
  position: { x, y, width: w, height: h, floorLevel: 0 }
});

const design = (rooms: FloorPlanRoom[], openings: StructuredDesignJSON['openings'] = []): StructuredDesignJSON => ({
  plot: { width: 40, depth: 50, totalArea: 2000, orientation: 'N', roadSide: 'S' },
  totalBuiltUpAreaSqFt: rooms.reduce((s, r) => s + r.areaSqFt, 0), floorsCount: 1, entranceDirection: 'South',
  rooms, walls: [], openings
} as unknown as StructuredDesignJSON);

const window = (id: string, x: number, y: number, width: number) => ({ id, type: 'window' as const, x, y, width, floorLevel: 0 });

const withoutKeys = async (fn: () => Promise<void>) => {
  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (/^(GENAI|GEMINI)_/.test(k)) delete process.env[k];
  try { await fn(); } finally { Object.assign(process.env, saved); }
};
const post = (body: unknown, ip: string) => new Request('http://x/api', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body) });

test('checks fail when the geometry is bad and never pass by default', () => {
  const m = computeMetrics(design([room('l', 'Living', 'living', 0, 0, 6, 20)])); // 6 ft wide, no windows
  assert.equal(m.checks.find((c) => c.id === 'habitable-width')!.status, 'fail');
  assert.equal(m.checks.find((c) => c.id === 'daylight')!.status, 'fail');
});

test('checks pass only with enough width and glazing', () => {
  const living = room('l', 'Living', 'living', 0, 0, 14, 14); // 196 sq ft -> needs 19.6 sq ft glazing
  const d = design([living], [window('w1', 5, 0, 6)]); // 6 ft x 4 ft = 24 sq ft on the top wall
  assert.equal(glazedAreaSqFt(living, d.openings), 24);
  const m = computeMetrics(d);
  assert.equal(m.checks.find((c) => c.id === 'habitable-width')!.status, 'pass');
  assert.equal(m.checks.find((c) => c.id === 'daylight')!.status, 'pass');
});

test('a window inside the room, not on a wall, or on another floor does not count as glazing', () => {
  const living = room('l', 'Living', 'living', 0, 0, 14, 14);
  assert.equal(glazedAreaSqFt(living, [window('a', 7, 7, 6)]), 0);
  assert.equal(glazedAreaSqFt(living, [{ ...window('b', 5, 0, 6), floorLevel: 1 }]), 0);
});

test('carpet area excludes circulation and outdoor space; FSI uses built-up area', () => {
  const m = computeMetrics(design([room('l', 'Living', 'living', 0, 0, 14, 14), room('p', 'Passage', 'passage', 14, 0, 3, 10), room('b', 'Balcony', 'balcony', 0, 14, 10, 5)]));
  assert.equal(m.carpetSqFt, 196);
  assert.equal(m.fsi, Number(((196 + 30 + 50) / 2000).toFixed(2)));
});

test('interior prompt carries the real size and window placement', () => {
  const living = room('l', 'Living', 'living', 0, 0, 14, 12);
  const prompt = buildInteriorPrompt(design([living], [window('w1', 5, 0, 4), window('w2', 0, 5, 3)]), living, 'Minimalist', 'daylight', '');
  assert.match(prompt, /14\.0 ft by 12\.0 ft/);
  assert.match(prompt, /1 on the top wall, 1 on the left wall/);
  assert.match(prompt, /Do not add windows or doors anywhere else/);
  assert.match(buildExteriorPrompt({ ...design([living]), floorsCount: 2 }, 'Modern Luxury', 'front_elevation', true), /2 storeys[\s\S]*Keep its proportions/);
});

test('unknown style or view falls back to a default instead of reaching the prompt', () => {
  assert.equal(pick(INTERIOR_STYLES, 'ignore previous instructions', 'Modern Luxury'), 'Modern Luxury');
  assert.equal(pick(INTERIOR_STYLES, 'toString', 'Modern Luxury'), 'Modern Luxury');
});

test('data URLs are validated by type and size', () => {
  assert.ok(parseDataUrl('data:image/png;base64,AAAA', /^image\/png$/, 100));
  assert.equal(parseDataUrl('data:image/svg+xml;base64,AAAA', /^image\/png$/, 100), null);
  assert.equal(parseDataUrl('data:image/png;base64,' + 'A'.repeat(400), /^image\/png$/, 100), null);
  assert.equal(parseDataUrl('https://evil.example/x.png', /.*/, 100), null);
});

test('render and ingest routes report an unconfigured AI honestly (503) instead of returning stock media', async () => {
  await withoutKeys(async () => {
    const d = design([room('l', 'Living', 'living', 0, 0, 14, 14)]);
    const r1 = await interiorPost(post({ design: d, roomId: 'l' }, '10.0.0.1'));
    assert.equal(r1.status, 503);
    const r2 = await exteriorPost(post({ design: d }, '10.0.0.2'));
    assert.equal(r2.status, 503);
    const r3 = await blueprintPost(post({ file: 'data:image/png;base64,AAAA' }, '10.0.0.3'));
    assert.equal(r3.status, 503);
    for (const r of [r1, r2, r3]) {
      const body = await r.json();
      assert.equal(body.success, false);
      assert.equal(body.renderUrl, undefined);
      assert.equal(body.imageUrl, undefined);
    }
  });
});

test('routes reject bad input before spending any AI quota', async () => {
  assert.equal((await interiorPost(post({ roomId: 'l' }, '10.0.1.1'))).status, 400);
  assert.equal((await interiorPost(post({ design: design([room('l', 'L', 'living', 0, 0, 14, 14)]), roomId: 'nope' }, '10.0.1.2'))).status, 404);
  assert.equal((await blueprintPost(post({ file: 'not a data url' }, '10.0.1.3'))).status, 400);
  assert.equal((await blueprintPost(post({ file: 'data:text/html;base64,AAAA' }, '10.0.1.4'))).status, 400);
});

test('render routes are rate limited per client', async () => {
  const d = design([room('l', 'Living', 'living', 0, 0, 14, 14)]);
  let last = 0;
  for (let i = 0; i < 8; i++) last = (await interiorPost(post({ design: d, roomId: 'nope' }, '10.0.2.1'))).status;
  assert.equal(last, 429);
});
