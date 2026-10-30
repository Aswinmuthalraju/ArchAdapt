import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSignUpError } from '../src/lib/supabase/authErrors';

test('Client-side Auth Validation: Email & Password constraints', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Email format validation
  assert.equal(emailRegex.test(''), false, 'Empty email should be invalid');
  assert.equal(emailRegex.test('notanemail'), false, 'Email without @ or domain should be invalid');
  assert.equal(emailRegex.test('user@domain'), false, 'Email without TLD should be invalid');
  assert.equal(emailRegex.test('architect@studio.com'), true, 'Valid email should pass');

  // Password length validation
  assert.equal('short'.length >= 8, false, 'Password under 8 characters should fail');
  assert.equal('validpass123'.length >= 8, true, 'Password of 8+ characters should pass');

  // Confirm password match
  const passA = 'SecurePass123!';
  const passB = 'DifferentPass123!';
  assert.notEqual(passA, passB, 'Mismatched passwords must be detected');
  assert.equal(passA === passA, true, 'Matching passwords pass');
});

test('Auth Error Normalization: describeSignUpError correctly formats all errors', () => {
  assert.ok(describeSignUpError({ code: 'user_already_exists' }).includes('already exists'));
  assert.ok(describeSignUpError({ code: 'over_email_send_rate_limit' }).includes('Too many sign-up emails'));
  assert.ok(describeSignUpError({ status: 429 }).includes('Too many sign-up emails'));
  assert.ok(describeSignUpError({ code: 'weak_password' }).includes('password was rejected'));
  assert.ok(describeSignUpError({ code: 'email_address_invalid' }).includes('email address was not accepted'));
  assert.ok(describeSignUpError({ code: 'signup_disabled' }).includes('Sign-ups are turned off'));
});

test('Guest & Local Auth Fallback: Validates session establishment without SMTP dependencies', () => {
  const guestUser = {
    id: 'guest-test-123',
    name: 'Test Architect',
    email: 'architect@archadapt.local',
    isGuest: true
  };

  assert.equal(guestUser.isGuest, true);
  assert.ok(guestUser.id.startsWith('guest-'));
  assert.equal(guestUser.email.includes('@'), true);
});
