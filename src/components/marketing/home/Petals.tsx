'use client';

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

const COUNT = 14;

/** A few bougainvillea bracts drifting down the hero. Pauses off screen; absent with reduced motion. */
export default function Petals() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || prefersReducedMotion()) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0, height = 0, frame = 0, visible = true;
    const resize = () => {
      width = el.clientWidth; height = el.clientHeight;
      el.width = width * dpr; el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const shape = new Path2D('M0 0 C9 -2 10 -14 0 -18 C-10 -14 -9 -2 0 0Z');
    const colors = ['#E0218A', '#EA4FA2', '#C9157A', '#F6B8D6'];
    const petals = Array.from({ length: COUNT }, (_, i) => ({
      x: Math.random() * width, y: Math.random() * height - height,
      vy: 0.25 + Math.random() * 0.45, sway: 0.6 + Math.random() * 1.2, phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.02, scale: 0.6 + Math.random() * 0.7,
      color: colors[i % colors.length], alpha: 0.55 + Math.random() * 0.4,
    }));
    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const p of petals) {
        p.y += p.vy; p.rot += p.vr;
        const x = p.x + Math.sin(time * 0.0006 + p.phase) * 24 * p.sway;
        if (p.y > height + 30) { p.y = -30; p.x = Math.random() * width; }
        ctx.save();
        ctx.translate(x, p.y); ctx.rotate(p.rot); ctx.scale(p.scale, p.scale * (0.7 + 0.3 * Math.sin(time * 0.002 + p.phase)));
        ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.fill(shape);
        ctx.restore();
      }
      if (visible) frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) frame = requestAnimationFrame(draw);
    });
    observer.observe(el);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvas} className="petals" aria-hidden="true" />;
}
