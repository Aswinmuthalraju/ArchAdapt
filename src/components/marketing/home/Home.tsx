'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ReactNode, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Emblem } from '@/components/brand/Logo';
import Blossom from '@/components/motion/Blossom';
import CircleButton from '@/components/motion/CircleButton';
import SplitText from '@/components/motion/SplitText';
import { gsap, MQ, useGSAP } from '@/lib/motion';
import Petals from './Petals';
import Preloader, { introReady } from './Preloader';

const STEPS = [
  { title: 'Your plot', text: 'Width, depth, the side the road runs along and which way the land faces. Sketches and documents are welcome too.' },
  { title: 'Your brief', text: 'Who lives here, how many bedrooms and floors, what the climate asks for, and the rooms that matter most to you.' },
  { title: 'Your plan', text: 'A checked floor plan and a matching 3D model, both from one design. Ask for changes in plain words and compare versions side by side.' },
];

const img = (name: string) => `/images/styles/${name}.jpg`;
const STYLES = [
  { name: 'Kerala Traditional', note: 'Courtyards, deep eaves, monsoon roofs', img: img('kerala-traditional') },
  { name: 'Modern', note: 'Clean lines and open plans', img: img('modern') },
  { name: 'Minimalist', note: 'Compact cores, quiet materials', img: img('minimalist') },
  { name: 'Contemporary', note: 'Sculpted volumes, shaded glass', img: img('contemporary') },
  { name: 'Colonial', note: 'Symmetry, high ceilings, colonnades', img: img('colonial') },
  { name: 'Tropical', note: 'Overhangs, light shafts, gardens', img: img('tropical') },
  { name: 'Traditional Indian', note: 'Courtyards and jali screens', img: img('traditional-indian') },
  { name: 'Modern Luxury', note: 'Double-height voids, private suites', img: img('modern-luxury') },
];

const MODES = [
  { name: 'Climate-adaptive', text: 'Courtyards, cross-breezes and deep eaves placed for the weather where you build.', img: img('climate-adaptive') },
  { name: 'Life-stage', text: 'A ground-floor suite, step-free thresholds and rooms that change as the family does.', img: img('life-stage') },
  { name: 'Budget-first', text: 'A compact footprint and shared plumbing walls, so more of the budget goes into the home.', img: img('budget-first') },
  { name: 'Renovation', text: 'Keeps the walls worth keeping and works new rooms into the house you already have.', img: img('renovation') },
];

const NUMBERS = [
  { n: '07', label: 'Steps', text: 'from an empty plot to a model you can walk around' },
  { n: '08', label: 'Styles', text: 'to start from, or mix' },
  { n: '04', label: 'Modes', text: 'for climate, family, budget and renovation' },
];

const COMPARE = [
  { topic: 'Geometry', chat: 'Writes a description, an image or loose code. Walls often fail to meet, rooms overlap and doors open into nothing.', us: 'One canonical design. Walls, doors and stairs are derived from the rooms, so the plan always closes.' },
  { topic: '2D and 3D', chat: 'Two separate answers that can disagree about the same house.', us: 'Both views are built from the same object, and the app re-checks that they match.' },
  { topic: 'Rules', chat: 'No checking. Undersized rooms, windowless bedrooms and unreachable kitchens pass unnoticed.', us: 'Room sizes, circulation, stair landings, daylight and ventilation are validated before a plan is shown.' },
  { topic: 'Impossible briefs', chat: 'Produces something anyway.', us: 'Says the brief does not fit, and which constraint breaks it.' },
  { topic: 'Changes', chat: 'Regenerates a different house each time you ask.', us: 'Edits the same plan, re-validates it and keeps every version to compare.' },
  { topic: 'Hand-off', chat: 'A picture or a chat transcript.', us: 'Area statement, room and door/window schedules, a compliance report, CAD (.dxf), 3D (.obj), SVG and a printable drawing sheet.' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Homepage sections. Render inside MotionPage so the gallery pin exists before the shared triggers measure. */
export default function Home({ plan }: { plan: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();

    mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: MQ.desktop }, (ctx) => {
      const { motion, desktop } = ctx.conditions as { motion: boolean; desktop: boolean };
      if (!motion) return;

      // Hero intro, held until the preloader lifts.
      const intro = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
      intro.fromTo(q('.hero-media-inner'), { scale: 1.25 }, { scale: 1, duration: 2.6 }, 0)
        .fromTo(q('.hero-char'), { yPercent: 100, scaleY: 0, opacity: 0 }, { yPercent: 0, scaleY: 1, opacity: 1, duration: 1.5, stagger: 0.055 }, 0.15)
        .fromTo(q('.hero-script'), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'power2.inOut' }, 0.9)
        .fromTo(q('.hero-script-line'), { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 1, duration: 1.2, ease: 'power3.inOut' }, 2.1)
        .fromTo(q('.hero-tag--left'), { xPercent: -120, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 1.6 }, 0.8)
        .fromTo(q('.hero-tag--right'), { xPercent: 120, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 1.6 }, 0.8)
        .fromTo(q('[data-hero-fade]'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: 0.1 }, 1.2);
      let alive = true;
      introReady.then(() => { if (alive) intro.play(); });

      // Hero on scroll: the picture pushes in while the title lifts away faster.
      const hero = { trigger: q('.hero')[0], start: 'top top', end: 'bottom top', scrub: true };
      gsap.to(q('.hero-media'), { scale: 1.15, ease: 'none', scrollTrigger: hero });
      gsap.to(q('.hero-title-wrap'), { yPercent: desktop ? -45 : -25, ease: 'none', scrollTrigger: hero });
      gsap.to(q('.hero-tags'), { yPercent: -80, opacity: 0, ease: 'none', scrollTrigger: hero });

      // Process picture breathes as the steps pass it.
      gsap.fromTo(q('.process-media-img'), { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: q('.process')[0], start: 'top bottom', end: 'bottom top', scrub: true } });

      // Modes: each picture drifts slightly inside its mask.
      q('.mode-media img').forEach((img) => gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));

      if (desktop) {
        // The gallery pins and runs sideways; each picture parallaxes inside its card.
        const track = q('.gallery-track')[0];
        const distance = () => track.scrollWidth - window.innerWidth;
        const run = gsap.to(track, { x: () => -distance(), ease: 'none', scrollTrigger: { trigger: q('.gallery')[0], start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 } });
        q('.gallery-card-img').forEach((media) =>
          gsap.fromTo(media, { xPercent: -8 }, { xPercent: 8, ease: 'none', scrollTrigger: { trigger: media.parentElement, containerAnimation: run, start: 'left right', end: 'right left', scrub: true } })
        );
        gsap.to(q('.gallery-progress i'), { scaleX: 1, ease: 'none', scrollTrigger: { trigger: q('.gallery')[0], start: 'top top', end: () => `+=${distance()}`, scrub: true } });
      }
      return () => { alive = false; };
    });

    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root}>
        <Preloader />
        {/* 01 Hero */}
        <section className="hero" data-section="Intro" data-header="ivory" aria-labelledby="hero-title">
          <div className="hero-media">
            <div className="hero-media-inner">
              <Image src="/images/garden-house.jpg" alt="A two-storey timber and white house at dusk, its living rooms open to a lawn under a eucalyptus tree" fill priority sizes="100vw" quality={80} style={{ objectPosition: '50% 60%' }} />
            </div>
          </div>
          <div className="hero-shade" aria-hidden="true" />
          <Petals />
          <p className="hero-kicker label" data-hero-fade>AI planning for architects · Plot to drawing set</p>
          <div className="hero-title-wrap">
            <h1 id="hero-title" className="hero-title">
              <span className="sr-only">Plans that fit your life</span>
              <span className="display" aria-hidden="true">
                {['Plans', 'that fit'].map((line) => (
                  <span key={line} className="hero-line">{Array.from(line).map((char, i) => <span key={i} className="hero-char">{char === ' ' ? ' ' : char}</span>)}</span>
                ))}
              </span>
              <span className="hero-script" aria-hidden="true">your life<i className="hero-script-line" /></span>
            </h1>
          </div>
          <div className="hero-tags" aria-hidden="true">
            <span className="hero-tag hero-tag--left">Your plot</span>
            <span className="hero-tag hero-tag--right">Your family</span>
          </div>
          <div className="hero-bottom">
            <a href="#idea" className="hero-scroll label" data-hero-fade><span className="hero-scroll-line" />Scroll to discover</a>
            <p className="hero-lede" data-hero-fade>Checked plans, a matching 3D model, schedules and CAD files from one design, drawn from the plot, the brief and the climate.</p>
            <div data-hero-fade><CircleButton href="/onboarding" label="Try it" ring="Start a plan · Plot to 3D · " tone="ivory" /></div>
          </div>
          <Blossom branch="b" side="right" className="blossom--hero" speed={-35} />
        </section>

        {/* 02 Statement */}
        <section id="idea" className="statement" data-section="Idea" data-bg="ivory" data-header="ink">
          <Blossom branch="a" side="left" className="blossom--statement" speed={-25} />
          <div className="statement-inner">
            <Emblem className="statement-emblem" />
            <p className="label label--rule label--center">The idea</p>
            <p className="statement-text" data-words>
              <SplitText by="words" gold={['checked', 'floor', 'plan', '3D', 'model']} text="Describe your plot, your family and your climate. ArchAdapt drafts a checked floor plan and a matching 3D model, then reshapes both as you ask for changes." />
            </p>
            <span className="hairline hairline--gold" aria-hidden="true" />
          </div>
        </section>

        {/* 03 Process on sky */}
        <section className="process" data-section="Process" data-bg="sky" data-header="ink">
          <header className="section-head">
            <p className="label label--rule">How it works</p>
            <h2 className="display display--md" data-stretch><SplitText text={'From plot\nto plan'} /></h2>
          </header>
          <div className="process-grid">
            <div className="process-media-wrap">
              <div className="process-media" data-curtain data-cursor="View">
                <div className="process-media-img" data-curtain-img>
                  <Image src="/images/open-house.jpg" alt="A dark-clad two-storey house with perforated screens and a lit timber entrance" fill sizes="(max-width: 899px) 100vw, 42vw" quality={75} />
                </div>
              </div>
            </div>
            <ol className="process-steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className="process-step" data-fade>
                  <span className="numeral gold-text" aria-hidden="true">{pad(i + 1)}</span>
                  <span className="hairline hairline--gold" aria-hidden="true" />
                  <h3 className="process-step-title">{step.title}</h3>
                  <p className="body">{step.text}</p>
                </li>
              ))}
              <li className="process-more" data-fade><Link href="/how-it-works" className="text-link">See every step <ArrowUpRight size={14} aria-hidden="true" /></Link></li>
            </ol>
          </div>
        </section>

        {/* 04 Horizontal gallery */}
        <section className="gallery" data-section="Styles" data-bg="ivory" data-header="ink" aria-labelledby="gallery-title">
          <Blossom branch="c" side="right" className="blossom--gallery" speed={-15} />
          <header className="gallery-head">
            <h2 id="gallery-title" className="display display--md" data-stretch><SplitText text="Styles" /></h2>
            <span className="gallery-count display gold-shimmer" aria-hidden="true">{pad(STYLES.length)}</span>
            <p className="body gallery-intro">Eight starting characters, each shaping the plan as well as the facade. Mix two and the engine weighs them both.</p>
          </header>
          <div className="gallery-track" data-cursor="Drag">
            <article className="gallery-card gallery-card--plan">
              <div className="gallery-card-media gallery-card-media--plan">{plan}</div>
              <div className="gallery-card-meta">
                <span className="label">00</span>
                <h3>Drawn by the engine</h3>
                <p>A real ground floor: 3 bedrooms, two floors, 40′ × 60′ plot</p>
              </div>
            </article>
            {STYLES.map((style, i) => (
              <Link key={style.name} href="/styles" className="gallery-card" data-cursor="View">
                <div className="gallery-card-media">
                  <div className="gallery-card-img">
                    <Image src={style.img} alt="" fill sizes="(max-width: 899px) 78vw, 28vw" quality={70} />
                  </div>
                </div>
                <div className="gallery-card-meta">
                  <span className="label">{pad(i + 1)}</span>
                  <h3>{style.name}</h3>
                  <p>{style.note}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="gallery-progress" aria-hidden="true"><i /></div>
        </section>

        {/* 05 Feature list */}
        <section className="modes" data-section="Modes" data-bg="sky" data-header="ink">
          <header className="section-head section-head--split">
            <div>
              <p className="label label--rule">Design modes</p>
              <h2 className="display display--md" data-stretch><SplitText text={'Set your\npriorities'} /></h2>
            </div>
            <p className="body" data-fade>Pick what matters most and the layout bends around it, from where the courtyard sits to how the plumbing stacks.</p>
          </header>
          <ul className="modes-list">
            {MODES.map((mode, i) => (
              <li key={mode.name} data-fade>
                <Link href="/modes" className="mode-card" data-cursor="View">
                  <span className="numeral gold-shimmer">{pad(i + 1)}</span>
                  <div className="mode-copy">
                    <h3>{mode.name}</h3>
                    <p className="body">{mode.text}</p>
                  </div>
                  <div className="mode-media">
                    <Image src={mode.img} alt="" fill sizes="(max-width: 899px) 100vw, 30vw" quality={70} />
                  </div>
                  <ArrowUpRight className="mode-arrow" size={22} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 05b Compared with a general chatbot */}
        <section className="compare" data-section="Compare" data-bg="ivory" data-header="ink" aria-labelledby="compare-title">
          <header className="section-head section-head--split">
            <div>
              <p className="label label--rule">Built for architects and designers</p>
              <h2 id="compare-title" className="display display--md" data-stretch><SplitText text={'More than\na chatbot'} /></h2>
            </div>
            <p className="body" data-fade>Asking a general AI for a house gives you a picture. ArchAdapt gives you a checked design you can measure, schedule, edit and take into CAD.</p>
          </header>
          <div className="compare-table" role="table" aria-label="ArchAdapt compared with a general chatbot">
            <div className="compare-row compare-row--head" role="row">
              <span role="columnheader" />
              <span role="columnheader" className="label">General chatbot</span>
              <span role="columnheader" className="label compare-us">ArchAdapt</span>
            </div>
            {COMPARE.map((row) => (
              <div key={row.topic} className="compare-row" role="row" data-fade>
                <h3 role="rowheader" className="compare-topic">{row.topic}</h3>
                <p role="cell" className="body compare-chat">{row.chat}</p>
                <p role="cell" className="body compare-us">{row.us}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 06 Numbers on plum */}
        <section className="numbers" data-section="Numbers" data-bg="plum" data-header="ivory">
          <Blossom branch="a" side="left" className="blossom--numbers" speed={-30} />
          <p className="label label--gold numbers-label">One design, start to finish</p>
          <ul className="numbers-list">
            {NUMBERS.map((item) => (
              <li key={item.label}>
                <span className="numbers-n display gold-text" data-stretch><SplitText text={item.n} /></span>
                <div>
                  <h3 className="numbers-title display">{item.label}</h3>
                  <p className="body">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="numbers-cta" data-fade>
            <p className="body">Every plan is checked for room sizes, circulation and stairs before you see it.</p>
            <CircleButton href="/onboarding" label="Begin" ring="Tell us about your plot · " tone="ivory" />
          </div>
        </section>
    </div>
  );
}
