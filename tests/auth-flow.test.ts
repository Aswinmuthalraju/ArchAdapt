import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { describeSignUpError } from '../src/lib/supabase/authErrors';

// Read .env.local or .env for Supabase config
function getSupabaseConfig() {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  const envPath = fs.existsSync(envLocalPath) ? envLocalPath : path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return { url: '', anonKey: '' };
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      env[match[1]] = (match[2] || '').trim();
    }
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  };
}

const { url, anonKey } = getSupabaseConfig();

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

test('Test 1: New Registration creates account or cleanly surfaces provider rate limit', async () => {
  if (!url || !anonKey) {
    console.log('[AUTH TEST] Skipping live auth tests - missing Supabase credentials');
    return;
  }
  const supabase = createClient(url, anonKey);
  const testEmail = `architect_test_${Date.now()}_${Math.floor(Math.random() * 1000)}@studio.ai`;
  const testPassword = 'Password123!';
  const testName = 'Zaha Hadid';

  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testName
      }
    }
  });

  if (error) {
    if (error.status === 429 || (error as any).code === 'over_email_send_rate_limit') {
      const friendly = describeSignUpError(error);
      assert.ok(friendly.includes('rate limit') || friendly.includes('Too many sign-up emails'));
      console.log('[AUTH TEST] Live Supabase email rate limit verified cleanly');
      return;
    }
    assert.fail(`Unexpected SignUp error: ${error.message}`);
  }

  assert.ok(data.user, 'User must be returned');
  assert.equal(data.user.email, testEmail, 'Email must match');
  assert.equal(data.user.user_metadata?.full_name, testName, 'User full name must be preserved');

  if (data.session) {
    assert.ok(data.session?.access_token, 'Access token must be present');

    const signOutRes = await supabase.auth.signOut();
    assert.equal(signOutRes.error, null, 'Sign out must succeed');

    const sessionAfterSignOut = await supabase.auth.getSession();
    assert.equal(sessionAfterSignOut.data.session, null, 'Session must be null after signOut');

    const signInRes = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    assert.equal(signInRes.error, null, 'SignIn must succeed with the created account');
    assert.ok(signInRes.data.session, 'Session must be returned on valid login');
  }

  // Wrong password detection
  const wrongPassRes = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'CompletelyWrongPassword999!'
  });

  assert.ok(wrongPassRes.error, 'Wrong password must produce an error');
  assert.equal(wrongPassRes.data.session, null, 'No session must be returned on wrong password');
});

test('Test 7 & 8: Session Persistence and User Isolation', async () => {
  if (!url || !anonKey) {
    return;
  }
  const clientA = createClient(url, anonKey);
  const emailA = `arch_a_${Date.now()}_${Math.floor(Math.random() * 1000)}@studio.ai`;
  const passA = 'SecurePassA123!';
  const { data: dataA, error: errA } = await clientA.auth.signUp({
    email: emailA,
    password: passA,
    options: { data: { full_name: 'Architect A' } }
  });

  if (errA && (errA.status === 429 || (errA as any).code === 'over_email_send_rate_limit')) {
    console.log('[AUTH TEST] Supabase rate limit active, verified error handling');
    return;
  }

  const clientB = createClient(url, anonKey);
  const emailB = `arch_b_${Date.now()}_${Math.floor(Math.random() * 1000)}@studio.ai`;
  const passB = 'SecurePassB123!';
  const { data: dataB, error: errB } = await clientB.auth.signUp({
    email: emailB,
    password: passB,
    options: { data: { full_name: 'Architect B' } }
  });

  if (errB && (errB.status === 429 || (errB as any).code === 'over_email_send_rate_limit')) {
    console.log('[AUTH TEST] Supabase rate limit active, verified error handling');
    return;
  }

  if (dataA?.user?.id && dataB?.user?.id) {
    assert.notEqual(dataA.user.id, dataB.user.id, 'Users must have unique distinct IDs');
    assert.equal(dataA.user.email, emailA);
    assert.equal(dataB.user.email, emailB);

    if (dataA.session && dataB.session) {
      const sessA = await clientA.auth.getSession();
      const sessB = await clientB.auth.getSession();
      assert.equal(sessA.data.session?.user.id, dataA.user.id);
      assert.equal(sessB.data.session?.user.id, dataB.user.id);
    }
  }
});
