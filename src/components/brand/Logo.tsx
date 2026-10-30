'use client';

import React, { useEffect, useRef } from 'react';
import { gsap, lenisRef, prefersReducedMotion } from '@/lib/motion';

export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" fill="none">
      <path d="M7 31 20 7 33 31M12 23h16M20 7v24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return <span className={`font-sans text-[1.25rem] font-medium leading-none tracking-[-0.055em] ${tone === 'dark' ? 'text-stone-50' : 'text-stone-900'}`}>ArchAdapt<span className="ml-1.5 text-[10px] font-normal tracking-normal opacity-70">AI</span></span>;
}

/** The gable mark inside a fine ring. Every stroke has pathLength 1 so it can be drawn on. */
export function Emblem({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`emblem ${className}`} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="24" cy="24" r="22.5" pathLength={1} />
      <path d="M12 34 24 12 36 34" pathLength={1} />
      <path d="M16.5 27h15M24 12v22" pathLength={1} />
    </svg>
  );
}

/** Circular badge: ring text spins slowly and speeds up with scroll velocity. */
export function RotatingBadge({ className = '' }: { className?: string }) {
  const ring = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let angle = 0;
    const tick = (_time: number, delta: number) => {
      angle = (angle + delta * 0.006 + Math.min(Math.abs(lenisRef.current?.velocity ?? 0), 80) * 0.09) % 360;
      if (ring.current) ring.current.style.transform = `rotate(${angle}deg)`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  return (
    <span className={`badge ${className}`}>
      <svg ref={ring} className="badge-ring" viewBox="0 0 100 100" aria-hidden="true">
        <defs><path id="badge-path" d="M50,50 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0" /></defs>
        <text><textPath href="#badge-path" textLength="255" lengthAdjust="spacing">ArchAdapt AI · Plans that fit ·</textPath></text>
      </svg>
      <Emblem className="badge-emblem" />
    </span>
  );
}
