import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src', 'tests', 'supabase'];
const TEXT = /\.(tsx?|css|mjs|json|sql|svg)$/;
// UTF-8 text that was decoded as Windows-1252 leaves these lead sequences behind (written as escapes so this file stays clean).
const chr = (...codes: number[]) => String.fromCharCode(...codes);
const MOJIBAKE = new RegExp([chr(0xe2, 0x20ac), chr(0xc3) + '[' + chr(0xa0) + '-' + chr(0xbf) + ']', chr(0xc2) + '[' + chr(0xa0) + '-' + chr(0xbf) + ']', chr(0xfffd)].join('|'));

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : TEXT.test(entry.name) ? [full] : [];
  });
}

const all = ROOTS.flatMap((root) => (fs.existsSync(root) ? files(root) : []));

test('every source file is valid UTF-8 without a BOM, without mojibake, with LF endings', () => {
  const problems: string[] = [];
  for (const file of all) {
    const bytes = fs.readFileSync(file);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) problems.push(`${file}: has a BOM`);
    let text = '';
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      problems.push(`${file}: not valid UTF-8`);
      continue;
    }
    if (text.includes('\r')) problems.push(`${file}: has CR line endings`);
    if (MOJIBAKE.test(text)) problems.push(`${file}: contains mojibake or a replacement character`);
  }
  assert.deepEqual(problems, []);
});

test('dev and build use different output folders', async () => {
  const mod = await import('../next.config.mjs');
  const config = mod.default;
  const dev = config('phase-development-server').distDir;
  const build = config('phase-production-build').distDir;
  assert.notEqual(dev, build);
});
