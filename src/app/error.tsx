'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/** A friendly fallback for any unexpected error, so a visitor never sees a raw crash screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-[#F4F1EA] px-6 text-center">
      <div className="max-w-md">
        <p className="text-[11px] tracking-[0.2em] uppercase text-stone-500">Something went wrong</p>
        <h1 className="font-serif text-3xl mt-4 text-stone-900">That page did not load</h1>
        <p className="text-sm text-stone-600 mt-3 leading-relaxed">It was a problem on our side, not yours. Try again, or go back to the start.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className="px-5 py-3 bg-plum-900 text-white text-sm min-h-[44px]">Try again</button>
          <Link href="/" className="px-5 py-3 border border-stone-400 text-sm text-stone-800 min-h-[44px] inline-flex items-center">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
