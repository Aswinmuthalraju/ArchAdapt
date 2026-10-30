'use client';

import { gsap, MQ, ScrollTrigger } from '@/lib/motion';

const all = (root: Element, selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));

/**
 * Wires the shared scroll reveals inside `root` from data attributes:
 * - `data-stretch`: glyphs start tall and blurred, then settle (scrubbed on desktop)
 * - `data-words`: words climb from 15% to full opacity with the scroll
 * - `data-fade`: rise and fade in
 * - `data-curtain` / `data-curtain-img`: clip-path wipe with the image scaling down inside
 * - `data-blossom`: slides in from its edge, then drifts at its own `data-speed`
 * - `data-cta`: letter-by-letter rise followed by a gold sweep
 * Returns the matchMedia handle so the caller can revert it.
 */
export function motionReveals(root: Element) {
  const mm = gsap.matchMedia();

  mm.add({ desktop: MQ.desktop, mobile: MQ.mobile, reduced: MQ.reduced }, (ctx) => {
    const { desktop, reduced } = ctx.conditions as { desktop: boolean; mobile: boolean; reduced: boolean };

    if (reduced) {
      all(root, '[data-stretch], [data-fade], [data-curtain], [data-cta]').forEach((el) =>
        gsap.from(el, { opacity: 0, duration: 0.6, scrollTrigger: { trigger: el, start: 'top 92%', once: true } })
      );
      return;
    }

    all(root, '[data-stretch]').forEach((el) => {
      const chars = el.querySelectorAll('.split-char');
      if (desktop) {
        gsap.fromTo(chars,
          { scaleY: 2.8, yPercent: -12, opacity: 0, filter: 'blur(10px)' },
          { scaleY: 1, yPercent: 0, opacity: 1, filter: 'blur(0px)', ease: 'none', stagger: { each: 0.06, from: 'start' },
            scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 48%', scrub: 0.8 } });
      } else {
        gsap.fromTo(chars,
          { scaleY: 1.9, opacity: 0 },
          { scaleY: 1, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.03, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      }
    });

    all(root, '[data-words]').forEach((el) => {
      const words = el.querySelectorAll('.split-word');
      gsap.fromTo(words, { opacity: 0.15 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: el, start: desktop ? 'top 75%' : 'top 85%', end: desktop ? 'bottom 55%' : 'bottom 70%', scrub: desktop ? 0.6 : true },
      });
    });

    all(root, '[data-fade]').forEach((el) =>
      gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', delay: Number(el.dataset.fade) || 0, scrollTrigger: { trigger: el, start: 'top 90%', once: true } })
    );

    all(root, '[data-curtain]').forEach((el) => {
      const img = el.querySelector('[data-curtain-img]');
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' });
      if (img) tl.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0.15);
    });

    all(root, '[data-blossom]').forEach((el) => {
      const slide = el.querySelector('.blossom-slide');
      const fromRight = el.dataset.blossom === 'right';
      if (slide) gsap.from(slide, { xPercent: fromRight ? 40 : -40, opacity: 0, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el.parentElement, start: 'top 80%', once: true } });
      if (desktop) gsap.to(el, { yPercent: Number(el.dataset.speed || -20), ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    all(root, '[data-cta]').forEach((el) => {
      const chars = el.querySelectorAll('.cta-base .split-char');
      const band = el.querySelector('.cta-sweep');
      const inner = el.querySelector('.cta-sweep-inner');
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      tl.fromTo(chars, { yPercent: 110, scaleY: 1.6 }, { yPercent: 0, scaleY: 1, duration: 1.2, ease: 'expo.out', stagger: 0.035 });
      if (band && inner) {
        const sweep = gsap.timeline({ repeat: -1, repeatDelay: 4.5, paused: true });
        sweep.set(band, { opacity: 1 }).fromTo(band, { xPercent: -100 }, { xPercent: 400, duration: 2.2, ease: 'power2.inOut' })
          // The band is a quarter of the line wide; the text inside counter-moves so it stays put.
          .fromTo(inner, { xPercent: 25 }, { xPercent: -100, duration: 2.2, ease: 'power2.inOut' }, 0);
        tl.add(() => { sweep.play(); }, '-=0.4');
        ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? sweep.resume() : sweep.pause()) });
      }
    });
  });

  return mm;
}
