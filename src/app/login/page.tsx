'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Compass, Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import AuthShell from '@/components/auth/AuthShell';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(searchParams.get('registered') ? 'Account created. If your project asks for email confirmation, confirm your address first, then sign in.' : null);

  // Forgot password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // If already authenticated, redirect to target
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.replace(nextUrl);
      }
    });
  }, [router, nextUrl]);

  // Google OAuth intentionally disabled for the current release.
  // Can be re-enabled after authentication flow is fully verified.
  /*
  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  };
  */

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        const code = (error as { code?: string }).code || '';
        if (code === 'email_not_confirmed' || error.message?.toLowerCase().includes('not confirmed')) {
          setErrorMessage('Your email address is not confirmed yet. Open the confirmation email we sent, then sign in.');
        } else if (code === 'over_request_rate_limit' || error.status === 429) {
          setErrorMessage('Too many attempts. Wait a few minutes and try again.');
        } else if (error.status && error.status >= 500) {
          setErrorMessage('The sign-in service had a problem. Please try again shortly.');
        } else {
          setErrorMessage('Invalid email or password.');
        }
        return;
      }

      if (data.session) {
        router.replace(nextUrl);
      } else {
        setErrorMessage('Unable to establish session. Please try again.');
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(false);

    if (!resetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setResetError('Please enter a valid email address.');
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`
      });

      if (error) {
        // Don't leak whether the account exists
        setResetSuccess(true);
      } else {
        setResetSuccess(true);
      }
    } catch {
      setResetError('Unable to send reset instructions. Please try again later.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AuthShell switchTo={{ href: '/register', prompt: 'New to ArchAdapt?', action: 'Create an account' }}>
        <div className="w-full max-w-md">
          {!isForgotPassword ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <div className="mb-5 flex h-11 w-11 items-center justify-center bg-plum-900 text-gold-300">
                  <Lock className="h-5 w-5 stroke-[1.5]" />
                </div>
                <h1 className="font-serif text-4xl font-medium text-stone-950">Sign In</h1>
                <p className="mt-2 font-sans text-xs text-stone-600 leading-relaxed">
                  Enter your credentials to access your architectural projects and workspace.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mb-6 flex items-start gap-3 border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <span className="font-sans font-medium">{errorMessage}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-[11px] text-stone-700 mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="architect@studio.com"
                      className="w-full border border-stone-300 bg-white px-4 py-3 font-sans text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none transition-colors"
                    />
                    <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-stone-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-[11px] text-stone-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setIsForgotPassword(true);
                        setErrorMessage(null);
                      }}
                      className="text-[11px] text-stone-500 hover:text-magenta-600 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="••••••••"
                      className="w-full border border-stone-300 bg-white px-4 py-3 pr-10 font-sans text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-700 p-0.5"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 btn-gem py-3.5 px-4 text-sm font-semibold text-white disabled:opacity-60 transition-all mt-2"
                >
                  {loading ? (
                    <span className="text-xs">Authenticating…</span>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Navigation to Register */}
              <div className="mt-8 border-t border-stone-200 pt-6 text-center">
                <p className="font-sans text-xs text-stone-600">
                  Don't have an account?{' '}
                  <Link
                    href={`/register${nextUrl !== '/dashboard' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`}
                    className="font-semibold text-magenta-600 hover:text-magenta-700 underline underline-offset-4 transition-colors"
                  >
                    Create Account
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Forgot Password View */}
              <div className="mb-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetSuccess(false);
                    setResetError(null);
                  }}
                  className="mb-4 inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </button>
                <h2 className="font-serif text-2xl font-normal text-stone-950">Reset Password</h2>
                <p className="mt-1 font-sans text-xs text-stone-600">
                  Enter your registered email to receive password reset instructions.
                </p>
              </div>

              {resetSuccess ? (
                <div className="space-y-4">
                  <div className="border border-sage-500/30 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
                    <div>
                      <p className="font-medium">Instructions Sent</p>
                      <p className="mt-1 text-emerald-800">
                        If an account exists for {resetEmail}, instructions to reset your password have been sent.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setResetSuccess(false);
                    }}
                    className="w-full border border-stone-300 py-3 font-sans text-xs font-semibold text-stone-800 hover:border-stone-900 transition-colors"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {resetError && (
                    <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                      <span>{resetError}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] text-stone-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="architect@studio.com"
                      className="w-full border border-stone-300 bg-white px-4 py-3 font-sans text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full btn-gem py-3.5 text-sm font-semibold text-white disabled:opacity-60 transition-all"
                  >
                    {resetLoading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </>
          )}

          {/* RLS Security Badge */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-stone-500">
            <ShieldCheck className="h-3.5 w-3.5 text-sage-500" />
            Protected by Supabase Row Level Security
          </div>
        </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBF8F4] flex items-center justify-center text-xs text-stone-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
