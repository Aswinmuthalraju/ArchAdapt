'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import MotionPage from '@/components/marketing/site/MotionPage';
import CircleButton from '@/components/motion/CircleButton';
import SplitText from '@/components/motion/SplitText';
import type { StyleEntry } from '@/lib/styles/styleCatalog';
import StylePhoto from './StylePhoto';

const pad = (n: number) => String(n).padStart(2, '0');

export default function StyleDetail({ style, index, next, prev }: { style: StyleEntry; index: number; next: StyleEntry; prev: StyleEntry }) {
  return (
    <MotionPage>
      <section className="page-hero style-hero" data-section={style.name} data-header="ink">
        <p className="label label--rule">Style {pad(index + 1)} · {style.tagline}</p>
        <h1 className="display display--sm" data-stretch><SplitText text={style.name.replace(' ', '\n')} /></h1>
        <p className="body" data-fade>{style.overview}</p>
      </section>

      <section className="style-feature" data-section="Look" data-bg="ivory" data-header="ink">
        <div className="style-feature-art">
          <StylePhoto style={style} sizes="(max-width: 899px) 100vw, 60vw" priority />
        </div>
        <div className="style-feature-facts" data-fade>
          <p className="label label--muted">At a glance</p>
          <dl className="fact-list">
            {style.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="label label--muted">Best for</p>
          <p className="body">{style.bestFor}</p>
        </div>
      </section>

      <section className="style-columns" data-section="Design" data-bg="ivory" data-header="ink">
        <div data-fade>
          <p className="label label--gold-deep">What defines it</p>
          <ul className="dash-list">{style.characteristics.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <div data-fade>
          <p className="label label--gold-deep">What changes in your plan</p>
          <p className="body quote">“{style.spatialImpact}”</p>
          <p className="label label--muted" style={{ marginTop: 28 }}>Rooms and spaces</p>
          <ul className="chip-list">{style.rooms.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      </section>

      <section className="style-process" data-section="Process" data-bg="sky" data-header="ink">
        <h2 className="label">How we design it</h2>
        <ol className="step-list">
          {style.process.map((step, i) => (
            <li key={step.title} data-fade>
              <span className="step-num">{pad(i + 1)}</span>
              <h3>{step.title}</h3>
              <p className="body">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-callout" data-section="Try it" data-bg="ivory" data-header="ink">
        <div>
          <p className="label">Make it yours</p>
          <h2 className="callout-title" data-stretch><SplitText text={`Plan a ${style.name} home`} /></h2>
          <p className="body" data-fade>Enter your plot and your brief. The engine draws the rooms, doors and stairs in this style, then builds the 3D model to match.</p>
        </div>
        <CircleButton href={`/onboarding?style=${encodeURIComponent(style.slug)}`} label="Start" ring={`Design in ${style.name} · `} />
      </section>

      <nav className="style-pager" aria-label="More styles" data-section="More" data-header="ink">
        <Link href={`/styles/${prev.slug}`} className="style-pager-link">
          <ArrowLeft size={16} aria-hidden="true" />
          <span><small>Previous</small>{prev.name}</span>
        </Link>
        <Link href="/styles" className="style-pager-all">All styles</Link>
        <Link href={`/styles/${next.slug}`} className="style-pager-link style-pager-link--next">
          <span><small>Next</small>{next.name}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </nav>
    </MotionPage>
  );
}
