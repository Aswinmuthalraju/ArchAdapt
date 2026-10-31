'use client';

import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/motion';

/**
 * A dot that follows the pointer and opens into a labelled circle over `[data-cursor]` items.
 * Elements with `data-magnetic` lean toward the pointer. Fine pointers only.
 */
export default function Cursor() {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || prefersReducedMotion()) return;
    document.documentElement.classList.add('has-cursor');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' });
    let magnet: HTMLElement | null = null;

    const release = () => {
      if (magnet) gsap.to(magnet, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      magnet = null;
    };
    const move = (event: PointerEvent) => {
      xTo(event.clientX);
      yTo(event.clientY);
      el.dataset.visible = 'true';
      if (magnet) {
        if (!magnet.isConnected) {
          release();
          return;
        }
        const box = magnet.getBoundingClientRect();
        gsap.to(magnet, { x: (event.clientX - box.left - box.width / 2) * 0.28, y: (event.clientY - box.top - box.height / 2) * 0.28, duration: 0.4, ease: 'power3' });
      }
    };
    const over = (event: PointerEvent) => {
      const rawTarget = event.target;
      if (!rawTarget) return;
      const target = rawTarget instanceof Element
        ? rawTarget
        : (rawTarget as Node).parentElement;
      if (!target || typeof target.closest !== 'function') return;

      const labelled = target.closest<HTMLElement>('[data-cursor]');
      const interactive = target.closest('a, button, [role="button"], input, select, textarea');
      const text = labelled?.dataset.cursor || '';
      if (label.current) label.current.textContent = text;
      el.dataset.state = text ? 'label' : interactive ? 'link' : '';
      const nextMagnet = target.closest<HTMLElement>('[data-magnetic]');
      if (nextMagnet !== magnet) { release(); magnet = nextMagnet; }
    };
    const leave = () => { el.dataset.visible = 'false'; release(); };

    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.documentElement.classList.remove('has-cursor');
      release();
    };
  }, []);

  return (
    <div ref={root} className="cursor" aria-hidden="true">
      <div className="cursor-disc"><span ref={label} className="cursor-label" /></div>
    </div>
  );
}
