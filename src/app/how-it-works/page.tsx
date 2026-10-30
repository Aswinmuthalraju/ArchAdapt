'use client';

import React from 'react';
import MotionPage from '@/components/marketing/site/MotionPage';
import Blossom from '@/components/motion/Blossom';
import CircleButton from '@/components/motion/CircleButton';
import SplitText from '@/components/motion/SplitText';
import { Upload, MapPin, Sliders, Palette, Layers, Box, Sparkles } from 'lucide-react';

export default function HowItWorksPage() {
  const steps = [
    {
      num: '01',
      title: 'Upload Site & Boundary',
      icon: Upload,
      desc: 'Input plot dimensions (width × depth), site area, and road-facing orientation (North, East, South, West). Attach land documents or sketches if available.',
      details: ['Plot Boundary Grid Mapping', 'Road Facing Alignment', 'Site Orientation Rules']
    },
    {
      num: '02',
      title: 'Select Location & Climate Context',
      icon: MapPin,
      desc: 'Specify your city and country location. ArchAdapt retrieves geographical and regional climate parameters (e.g. tropical humid monsoon in Kochi, Kerala).',
      details: ['Latitude/Longitude Mapping', 'Climate Zone Adaptation', 'Passive Wind Capture Strategy']
    },
    {
      num: '03',
      title: 'Define Family Requirements',
      icon: Sliders,
      desc: 'Specify family size, bedroom counts, ensuite bathrooms, floors, parking capacity, and requested spatial amenities like courtyards, study rooms, or balconies.',
      details: ['Spatial Area Budgeting', 'Room Adjacency Matrix', 'Custom Lifestyle Directives']
    },
    {
      num: '04',
      title: 'Choose Special Modes & Style',
      icon: Palette,
      desc: 'Select from Climate-Adaptive, Life-Stage, Budget-First, or Renovation modes, and select your primary architectural style (e.g., Kerala Traditional, Modern, Minimalist).',
      details: ['Your design priorities', 'Design Signature Generation', 'Style-Aware Facade Directives']
    },
    {
      num: '05',
      title: 'Generate 2D Conceptual Floor Plan',
      icon: Layers,
      desc: 'Our constraint-driven architectural engine transforms your parameters into a validated, non-generic 2D floor plan JSON rendered in an interactive SVG editor.',
      details: ['100% Validated Structured JSON', 'Normalized Grid Percentages', 'Room Dimension Tags']
    },
    {
      num: '06',
      title: 'Interactive 3D Massing Preview',
      icon: Box,
      desc: 'Inspect exterior volumes, floor heights, open-to-sky courtyard light wells, and style-aware roof geometry (sloped terracotta gables vs flat modern parapets) in Three.js.',
      details: ['Deterministic Massing Builder', 'Style-Aware Roof Geometry', 'Orbit & Daylight Controls']
    },
    {
      num: '07',
      title: 'Iterate via What-If Conversational Engine',
      icon: Sparkles,
      desc: 'Refine your design naturally by chatting: "Add another bedroom", "Make kitchen 20% larger", or "Change to Kerala + Modern". Compare versions side-by-side.',
      details: ['Delta-Based What-If Processing', 'Version History Comparison', 'Feasibility Rejection Handling']
    }
  ];

  return (
    <MotionPage>
      <section className="page-hero" data-section="Workflow" data-header="ink">
        <Blossom branch="c" side="right" className="blossom--page" speed={-20} />
        <p className="label label--rule">The ArchAdapt AI Workflow</p>
        <h1 className="display display--sm" data-stretch><SplitText text={'How ArchAdapt AI\nEngine Works'} /></h1>
        <p className="body" data-fade>
          From site boundaries and location climate to 2D structured floor plans and style-aware 3D previews — discover how our 7-stage generative workflow transforms constraints into living architectural concepts.
        </p>
      </section>

      <section className="page-list" data-section="Stages" data-bg="ivory" data-header="ink">
        <ol className="row-list">
          {steps.map((s) => (
            <li key={s.num} className="row" data-fade>
              <span className="numeral gold-shimmer">{s.num}</span>
              <div className="row-main">
                <h2 className="row-title">{s.title}</h2>
                <p className="body">{s.desc}</p>
              </div>
              <div className="row-aside">
                <p className="label">Key Technical Features</p>
                <ul>{s.details.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-callout" data-section="Begin" data-bg="sky" data-header="ink">
        <div>
          <p className="label">Start Your Project</p>
          <h2 className="callout-title" data-stretch><SplitText text="Ready to generate your first adaptive house concept?" /></h2>
          <p className="body" data-fade>Enter your plot constraints, choose your preferred design modes and style, and explore endless What-If possibilities.</p>
        </div>
        <CircleButton href="/onboarding" label="Start" ring="Start Designing Now · " />
      </section>
    </MotionPage>
  );
}
