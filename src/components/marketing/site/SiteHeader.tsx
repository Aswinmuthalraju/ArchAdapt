'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RotatingBadge } from '@/components/brand/Logo';
import { lenisRef } from '@/lib/motion';
import { useAuth } from '@/lib/auth/AuthProvider';

const PRIMARY = [
  { name: 'Try it', href: '/onboarding' },
  { name: 'Gallery', href: '/styles' },
  { name: 'Process', href: '/how-it-works' },
];
const MENU = [
  { name: 'Start a plan', href: '/onboarding' },
  { name: 'Styles', href: '/styles' },
  { name: 'How it works', href: '/how-it-works' },
  { name: 'Design modes', href: '/modes' },
];

/** Badge top-left, stacked uppercase nav top-right, full-screen menu below 900px. */
export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signedIn = Boolean(useAuth().user);

  useEffect(() => {
    if (!open) return;
    lenisRef.current?.stop();
    document.documentElement.classList.add('menu-open');
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      lenisRef.current?.start();
      document.documentElement.classList.remove('menu-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const account = signedIn ? { name: 'My projects', href: '/dashboard' } : { name: 'Sign in', href: '/login' };
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 40;
      setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <Link href="/" className="site-badge" aria-label="ArchAdapt AI home" data-magnetic>
        <RotatingBadge />
      </Link>
      <nav className="site-nav" aria-label="Main">
        {[...PRIMARY, account].map((item) => (
          <Link key={item.href} href={item.href} className="site-nav-link" aria-current={pathname === item.href ? 'page' : undefined}>
            {item.name}
          </Link>
        ))}
      </nav>
      <button type="button" className="site-menu-btn" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((value) => !value)}>
        {open ? 'Close' : 'Menu'}
      </button>
      <div id="site-menu" className="site-menu" data-open={open} hidden={!open}>
        <nav aria-label="Menu">
          {[...MENU, account].map((item, index) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{ transitionDelay: `${index * 60}ms` }}>
              <small>0{index + 1}</small>{item.name}
            </Link>
          ))}
        </nav>
        <p className="label">Concept plans for early design</p>
      </div>
    </header>
  );
}
