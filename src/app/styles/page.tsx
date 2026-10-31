'use client';

import React from 'react';
import Image from 'next/image';
import MotionPage from '@/components/marketing/site/MotionPage';
import Blossom from '@/components/motion/Blossom';
import CircleButton from '@/components/motion/CircleButton';
import SplitText from '@/components/motion/SplitText';

export default function ArchitecturalStylesPage() {
  const stylesList = [
    {
      name: 'Kerala Traditional',
      tagline: 'Vernacular Tropical Heritage & Monsoon Climate Architecture',
      img: '/images/styles/kerala-traditional.jpg',
      characteristics: [
        'Nadumuttam central open-to-sky courtyard',
        'Sloped terracotta gable rooflines with deep monsoon overhangs',
        'Wood-louvered Sit-out verandahs',
        'Exposed laterite stone masonry and earthen textures'
      ],
      spatialImpact: 'Adds a Nadumuttam courtyard, a puja room and a store to every brief, and opens the plan with a deep Poomukham sit-out.'
    },
    {
      name: 'Modern',
      tagline: 'Clean Geometries, Open Floor Plans & Seamless Indoor-Outdoor Transition',
      img: '/images/styles/modern.jpg',
      characteristics: [
        'Cantilevered upper floor massing & clean horizontal parapets',
        'Floor-to-ceiling sliding glass facade panels',
        'Open-plan living, dining, and kitchen spatial spine',
        'Minimalist metal accents and architectural pivot doors'
      ],
      spatialImpact: 'Plans a linear spine with the living room as the largest space, flowing into dining and kitchen.'
    },
    {
      name: 'Minimalist',
      tagline: 'Restrained Spatial Composition, Compact Cores & Quiet Materials',
      img: '/images/styles/minimalist.jpg',
      characteristics: [
        'Compact central plumbing & utility core',
        'Flush wall transitions & concealed storage alcoves',
        'Polished cement render & monochrome stone surfaces',
        'Restrained perimeter footprint minimizing circulation loss'
      ],
      spatialImpact: 'Trims every room to a compact size, adds concealed storage, and leaves out the utility room, courtyard and any extras you did not ask for.'
    },
    {
      name: 'Contemporary',
      tagline: 'Adaptive Fluid Geometry, Sculptural Facades & High Performance',
      img: '/images/styles/contemporary.jpg',
      characteristics: [
        'Asymmetrical rooflines & dynamic volume intersections',
        'Integrated solar shading louvers & green wall recesses',
        'Flexible multi-purpose transition spaces',
        'High-performance insulated glazing'
      ],
      spatialImpact: 'Adds a study and a generous balcony, enlarges the family lounge, and staggers the upper floor against the ground floor.'
    },
    {
      name: 'Colonial',
      tagline: 'Symmetrical Formality, High Ceilings & Covered Colonnades',
      img: '/images/styles/colonial.jpg',
      characteristics: [
        'Formal central entrance porch & archways',
        'High 12ft ceilings with transom window ventilation',
        'Symmetrical window placement & perimeter colonnades',
        'Dedicated foyer & reception spaces'
      ],
      spatialImpact: 'Gives the house a grand colonnaded portico, a formal dining room, a library-style study and an upper veranda, each in its own room.'
    },
    {
      name: 'Tropical',
      tagline: 'Lush Landscape Integration, Deep Overhangs & Natural Light Shafts',
      img: '/images/styles/tropical.jpg',
      characteristics: [
        'Semi-open garden courtyards & outdoor showers',
        'Wide roof eaves shading glass openings from zenith solar heat',
        'Natural timber slats & woven bamboo textures',
        'Cross-ventilation wind corridors'
      ],
      spatialImpact: 'Adds an open courtyard, a wide balcony or veranda and open garden area, with passages along the open edges for cross-ventilation.'
    },
    {
      name: 'Traditional Indian',
      tagline: 'Courtyard-Centered Courtyards, Jali Screens & Sacred Orientations',
      img: '/images/styles/traditional-indian.jpg',
      characteristics: [
        'Sacred North-East Puja room positioning',
        'Carved wooden accents & terracotta jali shading screens',
        'Central family courtyard (Chowk) for social gathering',
        'Shaded roof terraces & sit-outs'
      ],
      spatialImpact: 'Rings the rooms around a central Chowk courtyard, adds a puja room, and keeps a separate Baithak guest room by the entrance.'
    },
    {
      name: 'Modern Luxury',
      tagline: 'Double-Height Voids, Premium Materiality & Private Suites',
      img: '/images/styles/modern-luxury.jpg',
      characteristics: [
        'Double-height grand living hall with ceiling light shafts',
        'Spacious ensuite master bedrooms with walk-in wardrobes',
        'Covered multi-car parking garage & security foyer',
        'Private infinity balcony terraces'
      ],
      spatialImpact: 'Gives every bedroom its own bathroom, adds a dressing suite to the master, a study, a guest room and two-car parking, with every room sized generously.'
    }
  ];

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
            <article key={st.name} className="style-card">
              <div className="style-card-media" data-curtain data-cursor="View">
                <div className="style-card-img" data-curtain-img>
                  <Image src={st.img} alt={st.name} fill sizes="(max-width: 899px) 100vw, 45vw" quality={70} />
                </div>
              </div>
              <div className="style-card-body" data-fade>
                <p className="label">{String(idx + 1).padStart(2, '0')} · {st.tagline}</p>
                <h2 className="row-title">{st.name}</h2>
                <p className="label label--muted">Architectural Characteristics</p>
                <ul className="dash-list">{st.characteristics.map((c) => <li key={c}>{c}</li>)}</ul>
                <p className="label label--muted">Spatial Layout Impact</p>
                <p className="body quote">“{st.spatialImpact}”</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </MotionPage>
  );
}
