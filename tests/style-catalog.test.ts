import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { STYLE_CATALOG, styleBySlug, styleSlugForName } from '../src/lib/styles/styleCatalog';
import { STYLE_BLUEPRINTS } from '../src/lib/design/styleBlueprints';

test('the catalogue covers exactly the styles the engine supports', () => {
  const engine = Object.keys(STYLE_BLUEPRINTS).sort();
  const shown = STYLE_CATALOG.map((s) => s.name.toLowerCase().replace(/ /g, '_')).sort();
  assert.deepEqual(shown, engine);
});

test('slugs are unique, URL safe and round-trip from the style name', () => {
  const slugs = STYLE_CATALOG.map((s) => s.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of STYLE_CATALOG) {
    assert.match(s.slug, /^[a-z]+(-[a-z]+)*$/);
    assert.equal(styleBySlug(s.slug)?.name, s.name);
    assert.equal(styleSlugForName(s.name), s.slug);
  }
});

test('every style has the content its page needs', () => {
  for (const s of STYLE_CATALOG) {
    assert.ok(s.overview.length > 60, `${s.name} overview`);
    assert.ok(s.characteristics.length >= 3, `${s.name} characteristics`);
    assert.equal(s.process.length, 4, `${s.name} process steps`);
    assert.ok(s.rooms.length >= 3, `${s.name} rooms`);
    assert.equal(s.facts.length, 4, `${s.name} facts`);
    assert.match(s.tint.sky, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('the style illustrations exist for every slug', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/styles/StyleIllustration.tsx'), 'utf8');
  const scenes = source.slice(source.indexOf('const SCENES'));
  for (const s of STYLE_CATALOG) assert.ok(scenes.includes(`'${s.slug}':`) || scenes.includes(`${s.slug}:`), `${s.slug} illustration`);
});
