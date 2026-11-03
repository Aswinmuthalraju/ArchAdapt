import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { callGeminiJson, geminiApiKeys, resetGeminiKeyState } from '../src/lib/genai/gemini';

const realFetch = globalThis.fetch;
type Reply = { status: number; body: unknown };
const good: Reply = { status: 200, body: { candidates: [{ content: { parts: [{ text: '{"status":"OK","rooms":[]}' }] } }] } };
const reply = ({ status, body }: Reply) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers each call from a script keyed by the API key that was sent, and records the order of keys used. */
function stub(script: Record<string, Reply[]>) {
  const used: string[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const key = (init?.headers as Record<string, string>)['x-goog-api-key'];
    used.push(key);
    const next = script[key]?.shift();
    return reply(next || { status: 500, body: { error: { message: 'script exhausted' } } });
  }) as typeof fetch;
  return used;
}

beforeEach(() => {
  resetGeminiKeyState();
  for (const name of Object.keys(process.env)) if (/^(GENAI|GEMINI)_/.test(name)) delete process.env[name];
  process.env.GENAI_API_KEY = 'key-one-real';
  process.env.GENAI_API_KEY_2 = 'key-two-real';
  process.env.GENAI_API_KEY_3 = 'key-three-real';
  process.env.GEMINI_MODELS = 'model-a,model-b';
});
afterEach(() => { globalThis.fetch = realFetch; });

const deadline = () => Date.now() + 120_000;

test('all three keys are read in order and placeholders are ignored', () => {
  process.env.GENAI_API_KEY_2 = 'your-second-gemini-key';
  assert.deepEqual(geminiApiKeys(), ['key-one-real', 'key-three-real']);
});

test('a rate-limited key hands over to the next key, which answers', async () => {
  const used = stub({ 'key-one-real': [{ status: 429, body: { error: { message: 'quota' } } }], 'key-two-real': [good] });
  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, true);
  assert.deepEqual(used.slice(0, 2), ['key-one-real', 'key-two-real']);
});

test('a key that returns an empty or malformed answer also hands over, not only HTTP errors', async () => {
  const empty: Reply = { status: 200, body: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] } };
  const malformed: Reply = { status: 200, body: { candidates: [{ content: { parts: [{ text: '{"rooms": [' }] } }] } };
  const used = stub({ 'key-one-real': [empty], 'key-two-real': [malformed], 'key-three-real': [good] });
  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, true);
  assert.deepEqual(used.slice(0, 3), ['key-one-real', 'key-two-real', 'key-three-real']);
});

test('when every key fails on the first model, the next model is tried', async () => {
  const down: Reply = { status: 503, body: { error: { message: 'overloaded' } } };
  stub({ 'key-one-real': [down, good], 'key-two-real': [down], 'key-three-real': [down] });
  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.modelId, 'model-b');
});

test('a request the service rejects as invalid is reported as the input, without burning the other keys', async () => {
  const used = stub({ 'key-one-real': [{ status: 400, body: { error: { status: 'INVALID_ARGUMENT', message: 'Request contains an invalid argument.' } } }] });
  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.kind, 'INPUT_REJECTED');
  assert.equal(used.length, 1);
});

test('a bad key (400 "API key not valid") is the key at fault, so the next key is used', async () => {
  const bad: Reply = { status: 400, body: { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } } };
  const used = stub({ 'key-one-real': [bad], 'key-two-real': [good] });
  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, true);
  assert.deepEqual(used.slice(0, 2), ['key-one-real', 'key-two-real']);
});

test('a timeout on the first key hands over to the next key', async () => {
  let callCount = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    callCount++;
    if (callCount === 1) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }
    return reply(good);
  }) as typeof fetch;

  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, true);
  assert.equal(callCount, 2);
});

test('a bad model name (404 not found) falls over to the next model', async () => {
  const notFound: Reply = { status: 404, body: { error: { message: 'models/invalid-model is not found' } } };
  stub({ 'key-one-real': [notFound, good], 'key-two-real': [notFound], 'key-three-real': [notFound] });
  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.modelId, 'model-b');
});

test('when everything is down the failure says which key and model failed', async () => {
  const down: Reply = { status: 503, body: { error: { message: 'overloaded' } } };
  stub({ 'key-one-real': Array(4).fill(down), 'key-two-real': Array(4).fill(down), 'key-three-real': Array(4).fill(down) });
  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, 'UNAVAILABLE');
    assert.match(result.detail, /model-a key 1.*HTTP 503/);
    assert.match(result.detail, /model-b key 3/);
  }
});

test('a model that is overloaded on two keys is skipped for the third, and the next model answers', async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: unknown) => {
    const u = String(url);
    urls.push(u);
    return u.includes('model-a') ? reply({ status: 503, body: { error: { message: 'high demand' } } }) : reply(good);
  }) as typeof fetch;

  const result = await callGeminiJson('s', 'u', deadline());
  assert.equal(result.ok, true);
  assert.equal(urls.filter((u) => u.includes('model-a')).length, 2, 'only two keys are spent on the overloaded model');
  assert.equal(urls.filter((u) => u.includes('model-b')).length, 1);
});

test('the built-in model list names models that exist today, newest first', () => {
  delete process.env.GEMINI_MODELS;
  const { geminiModels } = require('../src/lib/genai/gemini') as typeof import('../src/lib/genai/gemini');
  const models = geminiModels();
  assert.ok(models.length >= 2);
  assert.ok(!models.some((id) => id.startsWith('gemini-2.')), `retired models in the default list: ${models.join(', ')}`);
});
