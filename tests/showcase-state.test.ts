import test from 'node:test';
import assert from 'node:assert/strict';
import { initialShowcaseState, showcaseReducer, roofLiftOffset } from '../src/lib/showcase-state';

test('lighting and roof controls preserve the selected view and space', () => {
  let state = showcaseReducer(initialShowcaseState, { type: 'rotate' });
  state = showcaseReducer(state, { type: 'space', value: 'courtyard' });
  state = showcaseReducer(state, { type: 'lighting', value: 'evening' });
  state = showcaseReducer(state, { type: 'roof' });
  assert.equal(state.view, 1);
  assert.equal(state.space, 'courtyard');
  assert.equal(state.lighting, 'evening');
  assert.equal(state.roofOpen, true);
});

test('view rotation cycles and reset restores the original composition', () => {
  let state = initialShowcaseState;
  for (let i = 0; i < 4; i++) state = showcaseReducer(state, { type: 'rotate' });
  assert.equal(state.view, 0);
  state = showcaseReducer(state, { type: 'roof' });
  const reset = showcaseReducer(state, { type: 'reset' });
  assert.deepEqual(reset, { ...initialShowcaseState, resetKey: 1 });
});

test('roof lift clamps extremes and reaches the exact open and closed offsets', () => {
  assert.equal(roofLiftOffset(0), 0);
  assert.equal(roofLiftOffset(1), 3.8);
  assert.equal(roofLiftOffset(-1), 0);
  assert.equal(roofLiftOffset(2), 3.8);
});
