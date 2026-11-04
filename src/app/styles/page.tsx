'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import MotionPage from '@/components/marketing/site/MotionPage';
import Blossom from '@/components/motion/Blossom';
import CircleButton from '@/components/motion/CircleButton';
import SplitText from '@/components/motion/SplitText';
import StylePhoto from '@/components/styles/StylePhoto';
import { STYLE_CATALOG } from '@/lib/styles/styleCatalog';

export default function ArchitecturalStylesPage() {
  const stylesList = STYLE_CATALOG;

  return (
    <MotionPage>
      <section className="page-hero" data-section="Styles" data-header="ink">
        <Blossom branch="c" side="right" className="blossom--page" speed={-20} />
        <p className="label label--rule">Supported Architectural Styles</p>
        <h1 className="display display--sm" data-stretch><SplitText text={'Architectural Styles\n& Expressions'} /></h1>
        <p className="body" data-fade>
          ArchAdapt AI supports a curated library of architectural styles. Each style dynamically alters spatial layout strategies, roof profiles, verandah placements, and opening proportions.
        </p>
      </section>

      <section className="page-callout" data-section="Hybrids" data-bg="sky" data-header="ink">
        <div>
          <p className="label">Your architectural direction</p>
          <h2 className="callout-title" data-stretch><SplitText text={'Combine Styles for Unique Hybrid Concepts (e.g. "Kerala + Modern")'} /></h2>
          <p className="body" data-fade>
            You can select a primary style (e.g. <strong>Kerala Traditional</strong>) and secondary style (e.g. <strong>Modern</strong>). The engine combines compatible characteristics: traditional Nadumuttam courtyards and sloped terracotta gables with crisp floor-to-ceiling glass sliders.
          </p>
        </div>
        <CircleButton href="/onboarding" label="Try it" ring="Try Hybrid Styles · " />
      </section>

      <section className="page-list" data-section="Library" data-bg="ivory" data-header="ink">
        <div className="card-grid">
          {stylesList.map((st, idx) => (
            <article key={st.slug} className="style-card">
              <Link href={`/styles/${st.slug}`} className="style-card-link" aria-label={`${st.name}: see how we design it`}>
                <div className="style-card-media" data-curtain data-cursor="View">
                  <div className="style-card-img" data-curtain-img>
                    <StylePhoto style={st} sizes="(max-width: 899px) 100vw, 45vw" />
                  </div>
                </div>
              </Link>
              <div className="style-card-body" data-fade>
                <p className="label">{String(idx + 1).padStart(2, '0')} · {st.tagline}</p>
                <h2 className="row-title"><Link href={`/styles/${st.slug}`} className="style-card-link">{st.name}</Link></h2>
                <p className="label label--muted">Architectural Characteristics</p>
                <ul className="dash-list">{st.characteristics.map((c) => <li key={c}>{c}</li>)}</ul>
                <p className="label label--muted">Spatial Layout Impact</p>
                <p className="body quote">“{st.spatialImpact}”</p>
                <Link href={`/styles/${st.slug}`} className="style-card-more">How we design it <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </MotionPage>
  );
}
