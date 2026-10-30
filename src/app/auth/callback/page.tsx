'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { safeNext } from '@/lib/auth/guard';

const GIVE_UP_MS = 8000;
const DEAD_LINK = 'This link is no longer valid. Request a new one.';

/**
 * Landing page for links in Supabase emails (confirm address, reset password). The browser client reads the
 * token from the URL and creates the session itself, so this page only waits for that and then moves on.
 */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const urlError = params.get('error_description') || hash.get('error_description');
    if (urlError) {
      setFailure(urlError.replace(/\+/g, ' '));
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') router.replace('/reset-password');
      else if (event === 'SIGNED_IN') router.replace(next);
    });
    const code = params.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setFailure(DEAD_LINK);
      });
    }
    const giveUp = setTimeout(() => setFailure(DEAD_LINK), GIVE_UP_MS);
    return () => {
      subscription.unsubscribe();
      clearTimeout(giveUp);
    };
  }, [next, params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF8F4] px-6 text-center text-stone-700">
      {failure ? (
        <div className="max-w-sm space-y-4" role="alert">
          <p className="font-serif text-2xl text-stone-950">That link did not work</p>
          <p className="text-sm">{failure}</p>
          <Link href="/login" className="inline-block btn-gem px-6 py-3 text-sm font-semibold text-white">Back to sign in</Link>
        </div>
      ) : (
        <p className="text-sm" role="status">Signing you in…</p>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
