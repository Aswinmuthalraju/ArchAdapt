'use client';

import { ReactNode, useRef } from 'react';
import Cursor from '@/components/motion/Cursor';
import SmoothScroll from '@/components/motion/SmoothScroll';
import { motionReveals } from '@/components/motion/reveals';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/motion';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Shell for marketing pages: smooth scroll, cursor, header, footer, the crossfading colour stage
 * (`data-bg="ivory|sky|plum"` on sections), header tone (`data-header="ink|ivory"`) and the
 * vertical section rail (`data-section="Name"`). Children create their own pins first; their
 * layout effects run before this one, so the shared triggers measure the pinned layout.
 */
export default function MotionPage({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);

  useGSAP(() => {
    const el = root.current!;
    const html = document.documentElement;
    html.dataset.header = 'ink';

    const layers = Array.from(stage.current!.querySelectorAll<HTMLElement>('[data-layer]'));
    const show = (bg: string) => layers.forEach((layer) => gsap.to(layer, { opacity: layer.dataset.layer === bg ? 1 : 0, duration: 0.9, ease: 'power2.out', overwrite: true }));
    el.querySelectorAll<HTMLElement>('[data-bg]').forEach((section) =>
      ScrollTrigger.create({ trigger: section, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && show(section.dataset.bg!) })
    );

    el.querySelectorAll<HTMLElement>('[data-header]').forEach((section) =>
      ScrollTrigger.create({ trigger: section, start: 'top 48px', end: 'bottom 48px', onToggle: (self) => { if (self.isActive) html.dataset.header = section.dataset.header; } })
    );

    const sections = Array.from(el.querySelectorAll<HTMLElement>('[data-section]'));
    const label = rail.current!.querySelector('.rail-label')!;
    const count = rail.current!.querySelector('.rail-count b')!;
    rail.current!.querySelector('.rail-total')!.textContent = pad(sections.length);
    sections.forEach((section, index) =>
      ScrollTrigger.create({ trigger: section, start: 'top 50%', end: 'bottom 50%', onToggle: (self) => {
        if (!self.isActive) return;
        label.textContent = section.dataset.section!;
        count.textContent = pad(index + 1);
      } })
    );
    gsap.fromTo(rail.current!.querySelector('.rail-line i'), { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });

    const mm = motionReveals(el);
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => { mm.revert(); delete html.dataset.header; };
  }, { scope: root });

  return (
    <div ref={root} className="motion-page">
      <SmoothScroll />
      <div ref={stage} className="stage" aria-hidden="true">
        <i data-layer="sky" />
        <i data-layer="plum" />
      </div>
      <SiteHeader />
      <aside ref={rail} className="section-rail" aria-hidden="true">
        <span className="rail-label">Intro</span>
        <span className="rail-line"><i /></span>
        <span className="rail-count"><b>01</b> / <span className="rail-total">01</span></span>
      </aside>
      <main id="main">{children}</main>
      <SiteFooter />
      <Cursor />
    </div>
  );
}
