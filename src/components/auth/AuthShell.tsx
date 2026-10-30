import React from 'react';
import Link from 'next/link';
import { LogoMark, Wordmark } from '@/components/brand/Logo';

/** Split-screen frame for sign-in and sign-up: a brand panel on the left, the form on the right. */
export default function AuthShell({ children, switchTo }: { children: React.ReactNode; switchTo: { href: string; prompt: string; action: string } }) {
  return (
    <div className="grid min-h-screen bg-stone-50 text-stone-900 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-plum-900 lg:block">
        <div className="absolute inset-0 bg-arch-grid-dark opacity-60" aria-hidden="true" />
        <svg viewBox="0 0 400 520" className="absolute inset-x-0 bottom-0 mx-auto h-[50%] w-auto opacity-90" aria-hidden="true" fill="none" stroke="#B1BCA0" strokeWidth="2">
          <path d="M40 40 H360 V480 H40 Z" strokeWidth="5" stroke="#E1E6D6" />
          <path d="M40 220 H210 M210 40 V300 M210 300 H360 M120 220 V480" stroke="#E1E6D6" strokeWidth="3" />
          <path d="M210 150 A36 36 0 0 1 246 186" stroke="#98A67E" strokeDasharray="4 4" strokeWidth="1.4" />
          <path d="M120 400 A30 30 0 0 0 150 430" stroke="#98A67E" strokeDasharray="4 4" strokeWidth="1.4" />
          <path d="M60 40 H110 M250 480 H320" stroke="#4B7FA0" strokeWidth="6" opacity="0.7" />
          <path d="M40 520 H210" strokeWidth="1" />
        </svg>
        <div className="relative flex h-full flex-col p-12">
          <Link href="/" className="flex items-center gap-3" aria-label="ArchAdapt AI home">
            <LogoMark />
            <Wordmark tone="dark" />
          </Link>
          <div className="mt-20">
            <p className="max-w-sm font-serif text-4xl font-medium leading-[1.12] text-stone-50">Your plot, your family, one checked plan.</p>
            <p className="mt-4 max-w-sm leading-relaxed text-stone-300">Projects, versions and every change you ask for are kept in your account.</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 lg:justify-end lg:px-12">
          <Link href="/" className="flex items-center gap-3 lg:hidden" aria-label="ArchAdapt AI home">
            <LogoMark className="h-8 w-8" />
            <Wordmark />
          </Link>
          <p className="text-sm text-stone-600">
            {switchTo.prompt}{' '}
            <Link href={switchTo.href} className="font-semibold text-magenta-600 underline decoration-gold-400 underline-offset-4 hover:text-magenta-700">
              {switchTo.action}
            </Link>
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16 pt-4">{children}</div>
      </main>
    </div>
  );
}
