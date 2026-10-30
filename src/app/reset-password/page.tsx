'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthProvider';

/** Set a new password after following the reset link. The link's session is already active when this opens. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'The password could not be changed. Request a new reset link.');
      } else {
        setDone(true);
        setTimeout(() => router.replace('/dashboard'), 1200);
      }
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const noSession = status === 'anonymous' || status === 'guest';

  return (
    <AuthShell switchTo={{ href: '/login', prompt: 'Remembered it?', action: 'Sign in' }}>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center bg-plum-900 text-gold-300"><KeyRound className="h-5 w-5 stroke-[1.5]" /></div>
          <h1 className="font-serif text-4xl font-medium text-stone-950">New password</h1>
        </div>
        {done ? (
          <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Password updated. Taking you to your projects…
          </div>
        ) : noSession ? (
          <div className="space-y-4 text-sm text-stone-700" role="alert">
            <p>This page needs the link from your reset email. Request a new one from the sign-in page.</p>
            <Link href="/login" className="inline-block btn-gem px-6 py-3 text-sm font-semibold text-white">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && (
              <div role="alert" className="flex items-start gap-3 border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /> <span className="font-medium">{error}</span>
              </div>
            )}
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-[11px] text-stone-700">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="w-full border border-stone-300 bg-white px-4 py-3 text-sm focus:border-stone-900 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-[11px] text-stone-700">Confirm password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full border border-stone-300 bg-white px-4 py-3 text-sm focus:border-stone-900 focus:outline-none" />
            </div>
            <button type="submit" disabled={saving} className="w-full btn-gem py-3.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Update password'}</button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
