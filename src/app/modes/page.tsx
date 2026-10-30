'use client';

import React from 'react';
import MotionPage from '@/components/marketing/site/MotionPage';
import Blossom from '@/components/motion/Blossom';
import CircleButton from '@/components/motion/CircleButton';
import SplitText from '@/components/motion/SplitText';
import { Wind, Users, DollarSign, RefreshCw } from 'lucide-react';

export default function SpecialModesPage() {
  const modesList = [
    {
      id: 'climate_adaptive',
      name: 'Climate-Adaptive Mode',
      icon: Wind,
      color: 'text-sage-500',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      summary: 'Optimizes passive ventilation, solar heat mitigation, and stack-effect cooling based on regional climate.',
      keyPillars: [
        'Central open-to-sky courtyards (Nadumuttam) for passive stack ventilation',
        'North-South window alignment for prevailing wind capture',
        'Deep roof eaves pitch (30-45°) to shade openings from monsoon rain & zenith sun',
        'Thermal buffer zones placing closets/utility along high-heat West facades'
      ],
      architecturalResult: 'Floor plan automatically positions living and dining halls for cross ventilation and creates natural light cores.'
    },
    {
      id: 'life_stage',
      name: 'Life-Stage Mode',
      icon: Users,
      color: 'text-blueprint-500',
      badgeBg: 'bg-blue-50 text-blue-800 border-blue-300',
      summary: 'Prioritizes lifelong accessibility, aging-in-place, and flexible space conversion over family life cycles.',
      keyPillars: [
        'Mandatory ground-floor Master Bedroom suite with ensuite bathroom',
        'Zero-step threshold entrances and wider 36-inch (3-foot) door passages',
        'Flex-rooms near entrance transitioning from office to nursery to senior suite',
        'Vertical plumbing stack alignment for simple future upper-floor additions'
      ],
      architecturalResult: 'Eliminates step barriers on the ground level and reduces circulation complexity for elderly family members.'
    },
    {
      id: 'budget_first',
      name: 'Budget-First Mode',
      icon: DollarSign,
      color: 'text-magenta-500',
      badgeBg: 'bg-amber-50 text-amber-900 border-amber-300',
      summary: 'Minimizes structural footprint complexity and consolidates wet services to lower construction costs.',
      keyPillars: [
        'Compact rectilinear building perimeter footprint reducing wall surface area',
        'Consolidated wet zones (kitchen, bathrooms, utility) sharing back-to-back plumbing stacks',
        'Prioritizes multi-functional high-ceiling spaces over excess unused square footage',
        'Modular expansion nodes enabling future financial phase additions without structural teardowns'
      ],
      architecturalResult: 'Reduces plumbing pipe runs, structural wall overhangs, and unnecessary corridor square footage.'
    },
    {
      id: 'renovation',
      name: 'Renovation Mode',
      icon: RefreshCw,
      color: 'text-stone-800',
      badgeBg: 'bg-stone-100 text-stone-900 border-stone-300',
      summary: 'Preserves existing structural walls while integrating new room additions and modern opening extensions.',
      keyPillars: [
        'Identifies retained vs modified vs new structural walls',
        'Preserves load-bearing structural cores during space re-allocation',
        'Integrates new room expansion nodes smoothly into existing circulation spines',
        'Modern facade cladding extensions wrapping existing masonry'
      ],
      architecturalResult: 'Maintains key existing room locations while introducing modern open-plan extensions.'
    }
  ];

  return (
    <MotionPage>
      <section className="page-hero" data-section="Modes" data-header="ink">
        <Blossom branch="c" side="right" className="blossom--page" speed={-20} />
        <p className="label label--rule">Architectural Design Modes</p>
        <h1 className="display display--sm" data-stretch><SplitText text={'Special Architectural\nModes'} /></h1>
        <p className="body" data-fade>
          Special modes steer the spatial reasoning of our architectural engine. They directly influence room placement, door threshold sizing, plumbing consolidation, and solar shading.
        </p>
      </section>

      <section className="page-callout" data-section="Combine" data-bg="sky" data-header="ink">
        <div>
          <p className="label">Your design priorities</p>
          <h2 className="callout-title" data-stretch><SplitText text={'Combine Multiple Modes (e.g. "Climate-Adaptive + Life-Stage + Budget-First")'} /></h2>
          <p className="body" data-fade>
            You can activate multiple modes simultaneously. The engine synthesizes their objectives: placing an accessible ground-floor master suite (<strong>Life-Stage</strong>) next to a stack-ventilation courtyard (<strong>Climate-Adaptive</strong>) while sharing back-to-back wet walls (<strong>Budget-First</strong>).
          </p>
        </div>
        <CircleButton href="/onboarding" label="Select" ring="Select Active Modes · " />
      </section>

      <section className="page-list" data-section="The modes" data-bg="ivory" data-header="ink">
        <ol className="row-list">
          {modesList.map((mode, idx) => (
            <li key={mode.id} className="row" data-fade>
              <span className="numeral gold-shimmer">{String(idx + 1).padStart(2, '0')}</span>
              <div className="row-main">
                <h2 className="row-title">{mode.name}</h2>
                <p className="body">{mode.summary}</p>
                <p className="label label--muted">What this means for your plan</p>
                <p className="body quote">“{mode.architecturalResult}”</p>
              </div>
              <div className="row-aside">
                <p className="label">Design considerations</p>
                <ul>{mode.keyPillars.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </MotionPage>
  );
}
