'use client';

import { describeSignUpError } from '@/lib/supabase/authErrors';
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Compass, UserPlus, Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import AuthShell from '@/components/auth/AuthShell';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/dashboard';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setLoading(true);
    try {
      const cleanEmail = email.trim();
      const cleanName = name.trim();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName
          }
        }
      });

      if (error) {
        console.warn('[auth] sign-up failed:', error.code, error.status, error.message);
        setErrorMessage(describeSignUpError(error));
        return;
      }

      // Check if user already exists (Supabase sometimes returns existing user with empty identities)
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setErrorMessage('An account with this email already exists.');
        return;
      }

      // Ensure active session is established immediately without email confirmation
      if (data?.session) {
        router.replace(nextUrl);
        return;
      }

      // Fallback: in case session was not attached on signUp, immediately log in with password
      const signInRes = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (signInRes.data?.session) {
        router.replace(nextUrl);
      } else {
        // The project requires email confirmation before the first sign-in.
        router.replace(`/login?registered=true&next=${encodeURIComponent(nextUrl)}`);
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell switchTo={{ href: '/login', prompt: 'Already have an account?', action: 'Sign in' }}>
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center bg-plum-900 text-gold-300">
              <UserPlus className="h-5 w-5 stroke-[1.5]" />
            </div>
            <h1 className="font-serif text-4xl font-medium text-stone-950">Create Account</h1>
            <p className="mt-2 font-sans text-xs text-stone-600 leading-relaxed">
              Register to access conceptual floor plans, 3D massing models, and revision history.
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

          {/* Registration Form */}
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="register-name"
                className="block text-[11px] text-stone-700 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <input
                  id="register-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Elena Rostova"
                  className="w-full border border-stone-300 bg-white px-4 py-3 font-sans text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none transition-colors"
                />
                <User className="absolute right-3.5 top-3.5 h-4 w-4 text-stone-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-[11px] text-stone-700 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  id="register-email"
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
              <label
                htmlFor="register-password"
                className="block text-[11px] text-stone-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="At least 8 characters"
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

            <div>
              <label
                htmlFor="register-confirm-password"
                className="block text-[11px] text-stone-700 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Re-enter your password"
                  className="w-full border border-stone-300 bg-white px-4 py-3 pr-10 font-sans text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-stone-400 hover:text-stone-700 p-0.5"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 btn-gem py-3.5 px-4 text-sm font-semibold text-white disabled:opacity-60 transition-all mt-3"
            >
              {loading ? (
                <span className="text-xs">Creating Account…</span>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Navigation to Login */}
          <div className="mt-8 border-t border-stone-200 pt-6 text-center">
            <p className="font-sans text-xs text-stone-600">
              Already have an account?{' '}
              <Link
                href={`/login${nextUrl !== '/dashboard' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`}
                className="font-semibold text-magenta-600 hover:text-magenta-700 underline underline-offset-4 transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>

          {/* RLS Security Badge */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-stone-500">
            <ShieldCheck className="h-3.5 w-3.5 text-sage-500" />
            Protected by Supabase Row Level Security
          </div>
        </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBF8F4] flex items-center justify-center text-xs text-stone-500">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
