/** Turns a Supabase Auth sign-up error into a message the person can act on. Unknown errors keep their code so they can be reported. */
export function describeSignUpError(error: { message?: string; code?: string; status?: number }): string {
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  if (code === 'user_already_exists' || message.includes('already registered') || message.includes('already exists')) return 'An account with this email already exists. Try signing in instead.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || message.includes('rate limit') || error.status === 429) return 'Too many sign-up emails were requested just now. Wait a few minutes and try again.';
  if (code === 'weak_password' || message.includes('password')) return 'That password was rejected. Use at least 8 characters, mixing letters and numbers.';
  if (code === 'email_address_invalid' || message.includes('invalid email') || message.includes('email address') && message.includes('invalid')) return 'That email address was not accepted. Check it for typos.';
  if (code === 'signup_disabled' || message.includes('signups not allowed')) return 'Sign-ups are turned off for this project. Ask the administrator to enable them.';
  if (message.includes('sending confirmation') || message.includes('error sending')) return 'The confirmation email could not be sent. Ask the administrator to check the project’s email settings.';
  if (message.includes('database error')) return 'The account database rejected the new user. Ask the administrator to run the latest SQL migration (supabase/migrations/002_auth_hardening.sql).';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Could not reach the sign-in service. Check your connection and try again.';
  return `Unable to create the account (${error.code || error.status || 'unknown'}${error.message ? `: ${error.message}` : ''}).`;
}
