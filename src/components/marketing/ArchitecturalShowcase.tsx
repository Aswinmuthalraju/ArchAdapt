'use client';

import { Component, ReactNode, useCallback, useEffect, useReducer, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight, Layers3, Moon, MoveUpRight, RotateCcw, RotateCw, Sun } from 'lucide-react';
import { initialShowcaseState, showcaseReducer, ShowcaseSpace } from '@/lib/showcase-state';

const CourtyardScene = dynamic(() => import('./CourtyardScene'), { ssr: false });
const spaces: Record<ShowcaseSpace, { title: string; text: string; detail: string }> = {
  courtyard: { title: 'Room for the outdoors.', text: 'A planted heart, open to the sky. The house makes space for a quieter kind of everyday life.', detail: 'The courtyard' },
  living: { title: 'Life, without hard edges.', text: 'A sheltered veranda extends the living room into the garden. Slide the doors back and let the spaces meet.', detail: 'The living space' },
  studio: { title: 'A little space to focus.', text: 'Set apart from the shared spaces, a quiet studio offers room to work, read, or simply take a moment.', detail: 'The studio' },
};

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function ArchitecturalShowcase() {
  const [state, dispatch] = useReducer(showcaseReducer, initialShowcaseState);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => { setSupported(false); setReady(false); }, []);
  const onSpace = useCallback((space: ShowcaseSpace) => dispatch({ type: 'space', value: space }), []);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    setSupported(Boolean(context));
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(preference.matches);
    sync(); preference.addEventListener('change', sync);
    return () => { preference.removeEventListener('change', sync); document.body.style.cursor = ''; };
  }, []);
  const info = spaces[state.space];
  return <section className={`architecture-showcase ${state.lighting === 'evening' ? 'is-evening' : ''}`} aria-label="Interactive courtyard house" data-ready={ready}>
    <div className="showcase-topline"><span><i aria-hidden="true" />An idea you can explore</span><span>Courtyard house / concept study</span></div>
    <div className="showcase-viewport">
      <div className="showcase-quiet-word" aria-hidden="true">Space to live.</div>
      {!ready && <div className="showcase-fallback">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/residential-interior.jpg" alt="A residential interior opening onto a garden" />
        <p>{supported === false ? 'A considered home, inside and out.' : 'Preparing your architectural model…'}</p>
      </div>}
      {supported && <div className={`showcase-canvas ${ready ? 'is-ready' : ''}`} role="img" aria-label="Interactive three-dimensional model of a stone courtyard house with timber screens and planted terraces. Use the buttons below to rotate, lift the roof and change the lighting.">
        <SceneBoundary onError={onError}><CourtyardScene state={state} reducedMotion={reducedMotion} onSpace={onSpace} onReady={onReady} /></SceneBoundary>
      </div>}
      <div className="showcase-caption"><span className="showcase-model-tag">The courtyard house</span><p>A study in light, privacy<br />and living with nature.</p></div>
      <div className="showcase-orbit-hint" aria-hidden="true"><MoveUpRight size={14} /> Drag to explore</div>
    </div>
    <div className="showcase-controls" aria-label="Model controls">
      <div className="showcase-control-group" role="group" aria-label="Time of day">
        <button disabled={!ready} aria-pressed={state.lighting === 'day'} onClick={() => dispatch({ type: 'lighting', value: 'day' })}><Sun size={16} />Daylight</button>
        <button disabled={!ready} aria-pressed={state.lighting === 'evening'} onClick={() => dispatch({ type: 'lighting', value: 'evening' })}><Moon size={15} />Evening</button>
      </div>
      <div className="showcase-control-group">
        <button disabled={!ready} aria-pressed={state.roofOpen} onClick={() => dispatch({ type: 'roof' })}><Layers3 size={16} /><span>{state.roofOpen ? 'Lower roof' : 'Lift the roof'}</span></button>
        <button disabled={!ready} onClick={() => dispatch({ type: 'rotate' })} aria-label="Rotate model by 90 degrees" title="Rotate view"><RotateCw size={17} /><span className="showcase-rotate-label">Rotate</span></button>
        <button disabled={!ready} onClick={() => dispatch({ type: 'reset' })} aria-label="Reset model, lighting and camera" title="Reset model"><RotateCcw size={16} /></button>
      </div>
    </div>
    <div className="showcase-details">
      <div className="showcase-space-tabs" role="group" aria-label="Explore the spaces">{(Object.keys(spaces) as ShowcaseSpace[]).map(space => <button key={space} aria-pressed={state.space === space} onClick={() => onSpace(space)}>{spaces[space].detail}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div>
      <div className="showcase-space-copy" aria-live="polite"><h3>{info.title}</h3><p>{info.text}</p></div>
      <span className="showcase-study-note">Illustrative design study.<br />Your plan begins with your plot.</span>
    </div>
  </section>;
}
