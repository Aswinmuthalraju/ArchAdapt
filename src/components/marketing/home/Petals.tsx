'use client';

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

const COUNT = 18;

interface PetalState {
  x: number;
  y: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  rot: number;
  vRot: number;
  pitch: number;
  vPitch: number;
  roll: number;
  vRoll: number;
  scale: number;
  baseColor: string;
  midColor: string;
  tipColor: string;
  alpha: number;
}

const PALETTES = [
  { base: '#C2185B', mid: '#E91E63', tip: '#FCE4EC' }, // Bougainvillea magenta
  { base: '#D81B60', mid: '#F06292', tip: '#FFF0F5' }, // Soft rose
  { base: '#AD1457', mid: '#EC407A', tip: '#F8BBD0' }, // Deep blossom
  { base: '#E0218A', mid: '#F472B6', tip: '#FDF2F8' }, // Vibrant cherry pink
];

/** Realistic organic flower petal path with tapered calyx base, curved flanks, and apical notch */
function createPetalPath(): Path2D {
  const p = new Path2D();
  p.moveTo(0, 14);
  p.bezierCurveTo(-4, 10, -11, 4, -11.5, -4);
  p.bezierCurveTo(-12, -12, -6, -17, -1.2, -18);
  p.bezierCurveTo(-0.5, -18.3, -0.1, -15.8, 0, -15.4); // Apical cleft / petal notch
  p.bezierCurveTo(0.1, -15.8, 0.5, -18.3, 1.2, -18);
  p.bezierCurveTo(6, -17, 12, -12, 11.5, -4);
  p.bezierCurveTo(11, 4, 4, 10, 0, 14);
  p.closePath();
  return p;
}

/** Realistic fluttering bougainvillea & blossom petals drifting down the hero with 3D tumbling. */
export default function Petals() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || prefersReducedMotion()) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;

    const resize = () => {
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const petalPath = createPetalPath();

    const petals: PetalState[] = Array.from({ length: COUNT }, (_, i) => {
      const palette = PALETTES[i % PALETTES.length];
      return {
        x: Math.random() * (width || 800),
        y: Math.random() * (height || 600) - (height || 600),
        vy: 0.35 + Math.random() * 0.45,
        swayAmp: 18 + Math.random() * 22,
        swayFreq: 0.0007 + Math.random() * 0.0006,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.016,
        pitch: Math.random() * Math.PI * 2,
        vPitch: 0.012 + Math.random() * 0.018,
        roll: Math.random() * Math.PI * 2,
        vRoll: (Math.random() - 0.5) * 0.015,
        scale: 0.8 + Math.random() * 0.55,
        baseColor: palette.base,
        midColor: palette.mid,
        tipColor: palette.tip,
        alpha: 0.72 + Math.random() * 0.25,
      };
    });

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      for (const p of petals) {
        p.y += p.vy;
        p.rot += p.vRot;
        p.pitch += p.vPitch;
        p.roll += p.vRoll;

        // Multiphase horizontal drift
        const sway =
          Math.sin(time * p.swayFreq + p.phase) * p.swayAmp +
          Math.cos(time * 0.0014 + p.phase * 2) * 6;
        const x = p.x + sway;

        // Reset if off bottom
        if (p.y > height + 40) {
          p.y = -35;
          p.x = Math.random() * width;
        }

        // 3D tumbling factors
        const cosPitch = Math.cos(p.pitch);
        const cosRoll = Math.cos(p.roll);
        const flip = cosPitch < 0;
        const scaleX = p.scale * (0.65 + 0.35 * Math.abs(cosRoll));
        const scaleY = p.scale * Math.abs(cosPitch) * 0.95;

        // When viewed almost edge-on, keep minimum thickness
        const safeScaleY = Math.max(0.12 * p.scale, scaleY);

        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(scaleX, safeScaleY);

        // Petal gradient from base to apical notch
        const grad = ctx.createLinearGradient(0, 14, 0, -18);
        if (!flip) {
          grad.addColorStop(0, p.baseColor);
          grad.addColorStop(0.55, p.midColor);
          grad.addColorStop(1, p.tipColor);
        } else {
          // Underside: softer translucent blush tone
          grad.addColorStop(0, p.midColor);
          grad.addColorStop(0.6, p.tipColor);
          grad.addColorStop(1, '#FFF5F8');
        }

        ctx.globalAlpha = p.alpha * (flip ? 0.75 : 0.92);
        ctx.fillStyle = grad;
        ctx.fill(petalPath);

        // Delicate central vein spine
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.quadraticCurveTo(flip ? 0.4 : -0.4, 0, 0, -13);
        ctx.strokeStyle = flip ? 'rgba(216, 27, 96, 0.25)' : 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // Subtle lateral micro-veins
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(-4, 0);
        ctx.moveTo(0, 4);
        ctx.lineTo(4, 0);
        ctx.moveTo(0, -3);
        ctx.lineTo(-5, -7);
        ctx.moveTo(0, -3);
        ctx.lineTo(5, -7);
        ctx.strokeStyle = flip ? 'rgba(216, 27, 96, 0.15)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Refined outer margin edge rim
        ctx.strokeStyle = flip ? 'rgba(255, 255, 255, 0.25)' : 'rgba(194, 24, 91, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke(petalPath);

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
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvas} className="petals" aria-hidden="true" />;
}
