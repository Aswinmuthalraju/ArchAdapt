'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import type Lenis from 'lenis';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

/** The live Lenis instance on marketing pages; null on app pages or with reduced motion. */
export const lenisRef: { current: Lenis | null } = { current: null };

export const MQ = {
  desktop: '(min-width: 900px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 899px) and (prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const;

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia(MQ.reduced).matches;
}

export function scrollToTop() {
  if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.6 });
  else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
