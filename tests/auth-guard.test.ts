import test from 'node:test';
import assert from 'node:assert/strict';
import { authRedirect, safeNext, statusForUser, AuthStatus } from '../src/lib/auth/guard';

const STATUSES: AuthStatus[] = ['loading', 'anonymous', 'guest', 'authenticated'];
const PROTECTED = ['/dashboard', '/workspace/abc'];
const AUTH_PAGES = ['/login', '/register'];

test('statusForUser maps a user (or none) to one status', () => {
  assert.equal(statusForUser(null), 'anonymous');
  assert.equal(statusForUser({ id: 'g', name: 'g', email: '', isGuest: true }), 'guest');
  assert.equal(statusForUser({ id: 'u', name: 'u', email: 'u@x.io', isGuest: false }), 'authenticated');
});

test('nothing redirects while the session is still loading', () => {
  for (const path of [...PROTECTED, ...AUTH_PAGES, '/', '/onboarding']) assert.equal(authRedirect('loading', path), null, path);
});

test('guests and signed-in users may use protected pages', () => {
  for (const status of ['guest', 'authenticated'] as AuthStatus[]) {
    for (const path of PROTECTED) assert.equal(authRedirect(status, path), null, `${status} ${path}`);
  }
});

test('anonymous visitors are sent to sign-in and returned afterwards', () => {
  assert.equal(authRedirect('anonymous', '/dashboard'), '/login?next=%2Fdashboard');
  assert.equal(authRedirect('anonymous', '/workspace/abc'), '/login?next=%2Fworkspace%2Fabc');
});

test('signed-in people are moved off sign-in and sign-up pages', () => {
  for (const status of ['guest', 'authenticated'] as AuthStatus[]) {
    for (const path of AUTH_PAGES) assert.equal(authRedirect(status, path, '/dashboard'), '/dashboard');
  }
});

// Regression: guests used to bounce /login <-> /dashboard forever (2,000+ navigations in 8 seconds).
test('no auth state can produce a redirect cycle', () => {
  const pages = [...PROTECTED, ...AUTH_PAGES, '/', '/onboarding'];
  for (const status of STATUSES) {
    for (const start of pages) {
      let path = start;
      const seen = [path];
      for (let hop = 0; hop < 4; hop++) {
        const target = authRedirect(status, path, '/dashboard');
        if (!target) break;
        path = target.split('?')[0];
        seen.push(path);
      }
      assert.ok(authRedirect(status, path, '/dashboard') === null, `${status} starting at ${start} never settles: ${seen.join(' > ')}`);
    }
  }
});

test('safeNext only allows same-site paths', () => {
  assert.equal(safeNext('/workspace/1'), '/workspace/1');
  assert.equal(safeNext(null), '/dashboard');
  assert.equal(safeNext('https://evil.example'), '/dashboard');
  assert.equal(safeNext('//evil.example'), '/dashboard');
  assert.equal(safeNext('/\\evil.example'), '/dashboard');
  assert.equal(safeNext('/login'), '/dashboard', 'must not return to an auth page');
});
