import test from 'node:test';
import assert from 'node:assert/strict';
import { admitted, BusyError, plannerLoad } from '../src/lib/design/admission';

test('requests beyond the limit are turned away at once, and capacity is released afterwards', async () => {
  process.env.ARCHADAPT_MAX_CONCURRENT_PLANS = '2';
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const a = admitted(() => gate);
  const b = admitted(() => gate);
  assert.equal(plannerLoad().inFlight, 2);
  let ran = false;
  await assert.rejects(() => admitted(async () => { ran = true; }), BusyError);
  assert.equal(ran, false, 'a rejected request must not run');
  release();
  await Promise.all([a, b]);
  assert.equal(plannerLoad().inFlight, 0);
  assert.equal(await admitted(async () => 'ok'), 'ok');
});

test('a failing plan still frees its slot', async () => {
  process.env.ARCHADAPT_MAX_CONCURRENT_PLANS = '1';
  await assert.rejects(() => admitted(async () => { throw new Error('boom'); }), /boom/);
  assert.equal(plannerLoad().inFlight, 0);
  delete process.env.ARCHADAPT_MAX_CONCURRENT_PLANS;
});
