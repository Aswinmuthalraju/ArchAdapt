'use client';

import { useEffect, useRef, useState } from 'react';
import { Emblem } from '@/components/brand/Logo';
import { gsap, lenisRef, prefersReducedMotion } from '@/lib/motion';

let release: () => void;
/** Resolves when the hero may play its intro: after the preloader lifts, or at once if it is skipped. */
export const introReady = new Promise<void>((resolve) => { release = resolve; });
let shown = false;

/** Ivory cover: the emblem draws in gold, a counter runs to 100, then a curtain wipes up. Once per session. */
export default function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(shown);

  useEffect(() => {
    if (shown) { release(); return; }
    const el = root.current!;
    const html = document.documentElement;
    const finish = () => {
      shown = true;
      try { sessionStorage.setItem('aa-intro', '1'); } catch { /* storage blocked */ }
      html.classList.remove('is-loading'); lenisRef.current?.start(); release(); setDone(true);
    };
    let seen = false;
    try { seen = sessionStorage.getItem('aa-intro') === '1'; } catch { /* storage blocked: show it */ }

    if (seen || prefersReducedMotion()) {
      gsap.to(el, { opacity: 0, duration: 0.45, delay: 0.1, onComplete: finish });
      return;
    }

    html.classList.add('is-loading');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const raf = requestAnimationFrame(() => lenisRef.current?.stop());
    const counter = { value: 0 };
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(el.querySelectorAll('.emblem *'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.15 }, 0)
      .to(counter, { value: 100, duration: 2.1, ease: 'power3.inOut', onUpdate: () => { if (count.current) count.current.textContent = String(Math.round(counter.value)).padStart(3, '0'); } }, 0)
      .to(el.querySelector('.preloader-inner'), { yPercent: -30, opacity: 0, duration: 0.7, ease: 'power3.in' }, '+=0.15')
      .to(el, { yPercent: -100, duration: 1.1, ease: 'expo.inOut', onStart: () => release() }, '-=0.3')
      .add(finish);

    // Hold the curtain until fonts are in, so the hero never reflows behind it.
    const fonts = document.fonts?.ready ?? Promise.resolve();
    tl.play();
    tl.addPause(2.1, () => { fonts.then(() => tl.play()); });
    return () => { cancelAnimationFrame(raf); tl.kill(); html.classList.remove('is-loading'); };
  }, []);

  if (done) return null;
  return (
    <div ref={root} className="preloader" role="status" aria-label="Loading ArchAdapt AI">
      <div className="preloader-inner">
        <Emblem className="preloader-emblem" />
        <span ref={count} className="preloader-count" aria-hidden="true">000</span>
        <span className="label">ArchAdapt AI</span>
      </div>
    </div>
  );
}
