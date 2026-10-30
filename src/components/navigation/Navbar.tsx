'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, FolderKanban, Menu, X } from 'lucide-react';
import AuthModal from '@/components/auth/AuthModal';
import { LogoMark, Wordmark } from '@/components/brand/Logo';
import { onAppAuthStateChange, logoutApp, AppUser } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { name: 'How it works', href: '/how-it-works' },
  { name: 'Styles', href: '/styles' },
  { name: 'Design modes', href: '/modes' }
];

export default function Navbar({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const dark = tone === 'dark';

  useEffect(() => {
    const unsubscribe = onAppAuthStateChange((currentUser) => {
      setUser(currentUser);
      if (!currentUser && (pathname === '/dashboard' || pathname?.startsWith('/workspace'))) {
        router.replace('/login');
      }
    });
    return () => unsubscribe();
  }, [pathname, router]);

  const handleSignOut = async () => {
    await logoutApp();
    setUser(null);
    router.replace('/login');
  };

  const link = (active: boolean) =>
    `relative py-1 text-[0.95rem] transition-colors ${dark ? (active ? 'text-gold-300' : 'text-stone-300 hover:text-gold-200') : active ? 'text-magenta-600' : 'text-stone-600 hover:text-stone-900'}`;

  return (
    <>
      <header className={`sticky top-0 z-40 w-full border-b backdrop-blur-md ${dark ? 'border-gold-400/20 bg-plum-900/80' : 'border-stone-200 bg-stone-50/85'}`}>
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 lg:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="ArchAdapt AI home">
            <LogoMark />
            <Wordmark tone={dark ? 'dark' : 'light'} />
          </Link>

          <nav className="hidden items-center gap-9 md:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className={link(pathname === item.href)} aria-current={pathname === item.href ? 'page' : undefined}>
                {item.name}
                {pathname === item.href && <span className="absolute -bottom-1 left-0 h-px w-full bg-gold-400" />}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <Link href="/dashboard" className={`flex h-10 items-center gap-2 px-4 text-sm font-medium transition-colors ${dark ? 'border border-gold-400/50 text-gold-200 hover:bg-gold-400/10' : 'border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-gold-200'}`}>
                  <FolderKanban className="h-4 w-4" />
                  My projects
                </Link>
                <button onClick={handleSignOut} className={`flex h-10 w-10 items-center justify-center border transition-colors ${dark ? 'border-plum-600 text-stone-300 hover:border-gold-400 hover:text-gold-200' : 'border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900'}`} title="Sign out" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={`px-3 py-2 text-[0.95rem] font-medium ${dark ? 'text-stone-200 hover:text-gold-200' : 'text-stone-700 hover:text-stone-900'}`}>
                  Sign in
                </Link>
                <Link href="/onboarding" className="btn-gem inline-flex h-10 items-center px-5 text-sm font-semibold text-white transition-transform active:scale-[0.98]">
                  Start a plan
                </Link>
              </>
            )}
          </div>

          <button className={`flex h-10 w-10 items-center justify-center md:hidden ${dark ? 'text-stone-100' : 'text-stone-900'}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className={`border-t px-5 pb-5 pt-3 md:hidden ${dark ? 'border-gold-400/20 bg-plum-900' : 'border-stone-200 bg-stone-50'}`}>
            <nav className="flex flex-col" aria-label="Mobile">
              {[...NAV_ITEMS, ...(user ? [{ name: 'My projects', href: '/dashboard' }] : [{ name: 'Sign in', href: '/login' }])].map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`border-b py-3 text-base ${dark ? 'border-plum-700 text-stone-100' : 'border-stone-200 text-stone-800'}`}>
                  {item.name}
                </Link>
              ))}
            </nav>
            <Link href="/onboarding" onClick={() => setOpen(false)} className="btn-gem mt-4 flex h-12 items-center justify-center text-sm font-semibold text-white">
              Start a plan
            </Link>
          </div>
        )}
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onAuthSuccess={(u) => setUser(u)} />
    </>
  );
}
