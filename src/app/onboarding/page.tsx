'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navigation/Navbar';
import {
  Upload, ArrowRight, ArrowLeft, Check, Sparkles, Wind, Users, DollarSign, RefreshCw, FileText, X, AlertTriangle, CheckCircle2, Ruler
} from 'lucide-react';
import { SiteInfo, LocationInfo, DesignRequirements, SpecialMode, ArchitecturalStyle, Project, SiteSetbacks } from '@/types/architectural';
import { createProjectInSupabase } from '@/lib/services/projectService';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { buildableEnvelope, defaultSetbacks } from '@/lib/design/layoutEngine';
import { styleBySlug } from '@/lib/styles/styleCatalog';
import { saveSitePlan, shrinkImage } from '@/lib/siteplan/sitePlanStore';

type Audience = 'homeowner' | 'architect';
type Precheck =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'fits'; summary?: { footprintWidth?: number; footprintDepth?: number; builtUpAreaSqFt?: number; rooms?: number }; notes: string[] }
  | { state: 'blocked'; reason: string; details: string[] };

const STEPS = [
  { num: 1, label: 'SITE' },
  { num: 2, label: 'YOUR HOME' },
  { num: 3, label: 'STYLE & GENERATE' }
];

const STYLES: { name: ArchitecturalStyle; blurb: string }[] = [
  { name: 'Kerala Traditional', blurb: 'Nalukettu court, deep verandah, sloped tile roof' },
  { name: 'Traditional Indian', blurb: 'Chowk courtyard, baithak, jali screens' },
  { name: 'Colonial', blurb: 'Symmetrical portico, formal rooms, hipped roof' },
  { name: 'Tropical', blurb: 'Breezy verandahs, cross-ventilation, garden' },
  { name: 'Modern', blurb: 'Open plan, flat roof, large glazing' },
  { name: 'Minimalist', blurb: 'Compact, quiet, concealed storage' },
  { name: 'Contemporary', blurb: 'Stepped massing, terraces, home office' },
  { name: 'Modern Luxury', blurb: 'Suites for every bedroom, great room, 2 cars' }
];

const MODES: { id: SpecialMode; title: string; icon: typeof Wind; desc: string }[] = [
  { id: 'climate_adaptive', title: 'Climate-Adaptive', icon: Wind, desc: 'Cooler sides for living, shading, cross-ventilation.' },
  { id: 'life_stage', title: 'Life-Stage', icon: Users, desc: 'Ground-floor bedroom and accessible bath for elders.' },
  { id: 'budget_first', title: 'Budget-First', icon: DollarSign, desc: 'Compact footprint, stacked plumbing, leaner rooms.' },
  { id: 'renovation', title: 'Renovation', icon: RefreshCw, desc: 'Regular wall lines for adapting an existing structure.' }
];

const SPACES = [
  ['dining', 'Dining Room'], ['balcony', 'Balcony'], ['studyWorkspace', 'Study'], ['storage', 'Store Room'],
  ['prayerRoom', 'Puja Room'], ['courtyard', 'Courtyard'], ['guestRoom', 'Guest Room'], ['outdoorGarden', 'Garden']
] as const;

const fieldClass = 'w-full border border-stone-300 px-4 py-3 font-sans text-sm font-semibold text-stone-900 focus:border-stone-900 focus:outline-none bg-white';
const labelClass = 'block text-[11px] text-stone-600 mb-1';

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audience, setAudience] = useState<Audience>('homeowner');
  const isArchitect = audience === 'architect';
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [activeStageKey, setActiveStageKey] = useState<string>('checking_brief');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generationError, setGenerationError] = useState<{ title: string; message: string; details: string[]; canUseLocalEngine: boolean; canRetry: boolean } | null>(null);
  const { user } = useAuth();
  // Guests have no account row; only real accounts may write to Supabase.
  const accountUser = user && !user.isGuest ? user : null;

  // ---- Step 1: site and location ----
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; previewUrl: string } | null>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo>({ plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' });
  const [customSetbacks, setCustomSetbacks] = useState<SiteSetbacks | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({ name: 'Kochi Site Plot', city: 'Kochi', country: 'India', lat: 9.9312, lng: 76.2673, climateZone: 'Warm & Humid' });
  const [dimensionError, setDimensionError] = useState<string | null>(null);

  // ---- Step 2: the home ----
  const [requirements, setRequirements] = useState<DesignRequirements>({
    familySize: 4, bedrooms: 3, bathrooms: 2, floors: 2, budgetRange: 'Moderate',
    spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false },
    customRequirements: ''
  });

  // ---- Step 3: style, modes, engine ----
  const [selectedModes, setSelectedModes] = useState<SpecialMode[]>([]);
  const [primaryStyle, setPrimaryStyle] = useState<ArchitecturalStyle>('Modern');
  const [secondaryStyle, setSecondaryStyle] = useState<ArchitecturalStyle | ''>('');
  const [engine, setEngine] = useState<'auto' | 'local'>('auto');

  const effectiveSite: SiteInfo = useMemo(() => ({ ...siteInfo, ...(isArchitect && customSetbacks ? { setbacks: customSetbacks } : {}) }), [siteInfo, customSetbacks, isArchitect]);
  const envelope = useMemo(() => {
    if (!(siteInfo.plotWidth > 0) || !(siteInfo.plotDepth > 0)) return null;
    return buildableEnvelope(effectiveSite);
  }, [effectiveSite, siteInfo.plotWidth, siteInfo.plotDepth]);

  const preferences = useMemo(() => ({ modes: selectedModes, primaryStyle, ...(isArchitect && secondaryStyle ? { secondaryStyle } : {}) }), [selectedModes, primaryStyle, secondaryStyle, isArchitect]);

  // A style page links here with ?style=<slug>; start on that style.
  useEffect(() => {
    try {
      const slug = new URLSearchParams(window.location.search).get('style');
      const match = slug ? styleBySlug(slug) : undefined;
      if (match) setPrimaryStyle(match.name);
    } catch { /* no query string available */ }
  }, []);

  // ---- Live feasibility: the same deterministic layout the real generation uses, without the AI ----
  const [precheck, setPrecheck] = useState<Precheck>({ state: 'idle' });
  const briefKey = JSON.stringify({ effectiveSite, requirements, preferences });
  useEffect(() => {
    if (step < 2) return;
    setPrecheck({ state: 'checking' });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/design/precheck', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ site: effectiveSite, location: locationInfo, requirements, preferences })
        });
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (!data.ok || data.problems?.length) setPrecheck({ state: 'blocked', reason: data.problems?.[0] || 'The inputs are not valid.', details: data.problems || [] });
        else if (!data.feasible) setPrecheck({ state: 'blocked', reason: data.reason || 'The brief does not fit the plot.', details: data.violatedConstraints || [] });
        else setPrecheck({ state: 'fits', summary: data.summary, notes: data.notes || [] });
      } catch (err: any) {
        if (err?.name !== 'AbortError') setPrecheck({ state: 'idle' });
      }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefKey, step]);

  const sketchData = useRef<string | null>(null);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sketchData.current = null;
    void shrinkImage(file).then((data) => { sketchData.current = data; });
    const isImage = file.type.startsWith('image/');
    setUploadedFile({ name: file.name, size: (file.size / (1024 * 1024)).toFixed(2) + ' MB', previewUrl: isImage ? URL.createObjectURL(file) : '' });
    if (accountUser) {
      try {
        await supabase.storage.from('site-plans').upload(`${accountUser.id}/${Date.now()}.${file.name.split('.').pop()}`, file);
      } catch (err) {
        console.warn('Storage upload notice:', err);
      }
    }
  };

  const setPlot = (patch: Partial<Pick<SiteInfo, 'plotWidth' | 'plotDepth'>>) => {
    const next = { ...siteInfo, ...patch };
    setSiteInfo({ ...next, totalArea: Math.round(next.plotWidth * next.plotDepth) });
    setDimensionError(null);
  };

  const goToHome = () => {
    const { plotWidth, plotDepth } = siteInfo;
    if (!(plotWidth >= 10 && plotDepth >= 10)) return setDimensionError('Plot width and depth must each be at least 10 ft.');
    if (plotWidth > 1000 || plotDepth > 1000) return setDimensionError('Plot width and depth must each be at most 1000 ft.');
    if (!envelope || envelope.width < 16 || envelope.depth < 20) return setDimensionError(`After setbacks only ${Math.max(0, Math.round(envelope?.width ?? 0))} x ${Math.max(0, Math.round(envelope?.depth ?? 0))} ft is buildable, which is too small for a house. ${isArchitect ? 'Reduce the setbacks or enlarge the plot.' : 'Enter a larger plot.'}`);
    setDimensionError(null);
    setStep(2);
  };

  const toggleMode = (m: SpecialMode) => setSelectedModes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  const setCount = (key: 'bedrooms' | 'bathrooms' | 'floors' | 'familySize', value: number, min: number, max: number) =>
    setRequirements((prev) => ({ ...prev, [key]: Math.min(max, Math.max(min, Math.round(value) || min)) }));

  const handleGenerate = async (engineChoice: 'auto' | 'local' = engine) => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationError(null);
    setElapsedSeconds(0);
    setLoadingStage(engineChoice === 'local' ? 'PLANNING WITH THE BUILT-IN RULE ENGINE' : 'AI PLANNER IS REASONING ABOUT YOUR BRIEF');
    const startedAt = Date.now();
    const ticker = setInterval(() => setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000)), 1000);
    const abortController = new AbortController();
    const clientTimeout = setTimeout(() => abortController.abort(), 185_000);

    try {
      const res = await fetch('/api/design/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        signal: abortController.signal,
        body: JSON.stringify({ site: effectiveSite, location: locationInfo, requirements, preferences, engine: engineChoice, stream: true })
      });

      let data: any = null;
      if (res.headers.get('content-type')?.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const chunk of parts) {
            const trimmed = chunk.trim();
            if (!trimmed) continue;
            let eventType = 'message';
            let eventData = '';
            for (const line of trimmed.split('\n')) {
              if (line.startsWith('event:')) eventType = line.slice(6).trim();
              else if (line.startsWith('data:')) eventData += line.slice(5).trim();
            }
            if (eventData) {
              try {
                const parsed = JSON.parse(eventData);
                if (eventType === 'stage') {
                  setLoadingStage(parsed.message.toUpperCase());
                  setActiveStageKey(parsed.stage);
                } else if (eventType === 'complete' || eventType === 'failure' || eventType === 'error') {
                  data = parsed;
                }
              } catch { /* json parse error */ }
            }
          }
        }
      } else {
        try { data = await res.json(); } catch { /* handled below */ }
      }

      if (!res.ok || !data?.success) {
        const status = data?.status as string | undefined;
        // Anything caused by what the user entered is a render error about the inputs; provider trouble is reported as such.
        const inputCaused = status === 'INFEASIBLE' || status === 'INPUT_REJECTED' || status === 'BAD_REQUEST';
        setGenerationError({
          title: inputCaused ? 'Render error: these inputs cannot produce a plan'
            : status === 'INVALID_DESIGN' ? 'No valid design was produced'
            : status === 'ENGINE_UNAVAILABLE' ? 'The AI planner is unavailable'
            : 'Generation failed',
          message: data?.error || `The server answered HTTP ${res.status}. Please try again.`,
          details: Array.isArray(data?.violatedConstraints) ? data.violatedConstraints : [],
          canUseLocalEngine: !!data?.canUseLocalEngine,
          canRetry: !inputCaused
        });
        return;
      }

      const design = data.design;
      if (!design || !Array.isArray(design.rooms) || design.rooms.length === 0) {
        setGenerationError({ title: 'Generation failed', message: 'The server returned an incomplete design. Nothing was saved.', details: [], canUseLocalEngine: false, canRetry: true });
        return;
      }

      setLoadingStage('SAVING THE VALIDATED DESIGN');
      const rationale = data.rationale || design.rationale || '';
      const projectTitle = `${primaryStyle} Concept — ${locationInfo.city}`;

      let savedProject = null;
      if (accountUser) {
        savedProject = await createProjectInSupabase(accountUser.id, projectTitle, effectiveSite, locationInfo, requirements, preferences as any, design, rationale);
      }
      const projectId = savedProject?.id || `proj-${Date.now()}`;

      if (!savedProject) {
        const now = new Date().toISOString();
        const localProject: Project = {
          id: projectId, userId: user?.id || 'guest', title: projectTitle, location: locationInfo, siteInfo: effectiveSite, requirements, preferences: preferences as any,
          currentVersionId: 'v1', storage: 'local',
          versions: [{ id: 'v1', projectId, versionNumber: 1, title: 'Initial Conceptual Floor Plan', structuredDesign: design, rationale, tradeOffs: design.layoutNotes || [], createdAt: now }],
          createdAt: now, updatedAt: now
        };
        try {
          localStorage.setItem(`project_${projectId}`, JSON.stringify(localProject));
        } catch {
          setGenerationError({ title: 'The design could not be saved', message: 'The design was generated, but neither your account nor this browser could store it. Please try again.', details: [], canUseLocalEngine: false, canRetry: true });
          return;
        }
      }
      if (sketchData.current && uploadedFile) saveSitePlan(projectId, sketchData.current);
      router.push(`/workspace/${projectId}`);
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      setGenerationError({
        title: isTimeout ? 'Generation timed out' : 'Generation failed',
        message: isTimeout ? 'The server did not answer within 3 minutes. Nothing was saved.' : err?.message || 'An unexpected error occurred. Nothing was saved.',
        details: [], canUseLocalEngine: isTimeout, canRetry: true
      });
    } finally {
      clearInterval(ticker);
      clearTimeout(clientTimeout);
      setIsGenerating(false);
    }
  };

  const blocked = precheck.state === 'blocked';
  const setbackValues = customSetbacks || defaultSetbacks(siteInfo.plotWidth || 40, siteInfo.plotDepth || 60);

  return (
    <div className="min-h-screen bg-[#FBF8F4] text-stone-900">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Audience: same flow, the architect sees extra controls */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex border border-stone-300 bg-white text-xs" role="group" aria-label="Who is designing">
            {(['homeowner', 'architect'] as Audience[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                aria-pressed={audience === a}
                className={`px-4 py-2 font-semibold transition-colors ${audience === a ? 'bg-plum-900 text-gold-200' : 'text-stone-600 hover:text-stone-900'}`}
              >
                {a === 'homeowner' ? 'I am building a home' : 'I am an architect / designer'}
              </button>
            ))}
          </div>
          {isArchitect && <span className="text-[11px] text-stone-500">Advanced controls are on: setbacks, secondary style and engine choice.</span>}
        </div>

        {/* Progress */}
        <div className="mb-10 flex items-center justify-between border-b border-stone-300 pb-4">
          {STEPS.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => s.num < step && setStep(s.num)}
              className={`flex items-center gap-2 text-xs ${step === s.num ? 'text-stone-900 font-bold border-b-2 border-magenta-500 pb-1' : step > s.num ? 'text-stone-700 cursor-pointer' : 'text-stone-400 cursor-default'}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === s.num ? 'bg-magenta-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
                {step > s.num ? <Check className="h-3 w-3" /> : s.num}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* STEP 1: SITE */}
        {step === 1 && (
          <div className="space-y-8 bg-white border border-stone-200 p-8 shadow-sm">
            <div>
              <h2 className="font-serif text-3xl font-normal text-stone-900">Your plot</h2>
              <p className="font-sans text-xs text-stone-600 mt-1">Enter the plot size, which side the road is on and where it is. The buildable area is worked out for you.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className={labelClass} htmlFor="plot-width">Plot width (ft)</label>
                <input id="plot-width" type="number" min={10} max={1000} value={siteInfo.plotWidth || ''} onChange={(e) => setPlot({ plotWidth: Number(e.target.value) })} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="plot-depth">Plot depth (ft)</label>
                <input id="plot-depth" type="number" min={10} max={1000} value={siteInfo.plotDepth || ''} onChange={(e) => setPlot({ plotDepth: Number(e.target.value) })} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="plot-orientation">Road is on the</label>
                <select id="plot-orientation" value={siteInfo.orientation} onChange={(e) => setSiteInfo({ ...siteInfo, orientation: e.target.value as SiteInfo['orientation'] })} className={fieldClass}>
                  {[['E', 'East'], ['N', 'North'], ['W', 'West'], ['S', 'South'], ['NE', 'North-East'], ['NW', 'North-West'], ['SE', 'South-East'], ['SW', 'South-West']].map(([v, l]) => <option key={v} value={v}>{l} side</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="city">City / region</label>
                <input id="city" type="text" value={locationInfo.city} onChange={(e) => setLocationInfo({ ...locationInfo, city: e.target.value, name: `${e.target.value} Site Plot` })} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="climate">Climate</label>
                <select id="climate" value={locationInfo.climateZone} onChange={(e) => setLocationInfo({ ...locationInfo, climateZone: e.target.value as LocationInfo['climateZone'] })} className={fieldClass}>
                  <option value="Warm & Humid">Warm &amp; Humid (coastal / monsoon)</option>
                  <option value="Tropical">Tropical</option>
                  <option value="Hot & Dry">Hot &amp; Dry (arid)</option>
                  <option value="Moderate">Moderate / temperate</option>
                  <option value="Cold">Cold</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="w-full border border-stone-200 bg-[#FBF8F4] px-4 py-3 text-xs text-stone-700" aria-live="polite">
                  <div className="flex items-center gap-2 font-semibold text-stone-900"><Ruler className="h-3.5 w-3.5 text-magenta-500" /> Buildable area</div>
                  {envelope && envelope.width > 0 && envelope.depth > 0
                    ? <div className="mt-1">{Math.round(envelope.width)} × {Math.round(envelope.depth)} ft ≈ {Math.round(envelope.width * envelope.depth).toLocaleString()} sq ft per floor</div>
                    : <div className="mt-1 text-red-600">Enter a valid plot</div>}
                </div>
              </div>
            </div>

            {isArchitect && (
              <div className="border border-stone-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-900">Setbacks (ft)</h3>
                  <button type="button" className="text-[11px] text-magenta-600 hover:underline" onClick={() => setCustomSetbacks(null)}>Use local defaults</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(['front', 'rear', 'left', 'right'] as const).map((side) => (
                    <div key={side}>
                      <label className={labelClass} htmlFor={`sb-${side}`}>{side[0].toUpperCase() + side.slice(1)}</label>
                      <input
                        id={`sb-${side}`} type="number" min={0} max={100} value={setbackValues[side]}
                        onChange={(e) => setCustomSetbacks({ ...setbackValues, [side]: Math.max(0, Number(e.target.value) || 0) })}
                        className={fieldClass}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="lat">Latitude</label>
                    <input id="lat" type="number" step="0.0001" value={locationInfo.lat} onChange={(e) => setLocationInfo({ ...locationInfo, lat: Number(e.target.value) })} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="lng">Longitude</label>
                    <input id="lng" type="number" step="0.0001" value={locationInfo.lng} onChange={(e) => setLocationInfo({ ...locationInfo, lng: Number(e.target.value) })} className={fieldClass} />
                  </div>
                </div>
              </div>
            )}

            <div>
              <input id="site-plan-upload" type="file" ref={fileInputRef} accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
              <label htmlFor="site-plan-upload" className="flex items-center gap-4 border border-dashed border-stone-300 bg-[#FBF8F4] px-5 py-4 text-xs cursor-pointer hover:border-stone-900 transition-colors">
                {uploadedFile?.previewUrl ? <img src={uploadedFile.previewUrl} alt="Plot preview" className="h-12 w-12 object-cover border border-stone-300" /> : uploadedFile ? <FileText className="h-6 w-6 text-magenta-500" /> : <Upload className="h-6 w-6 text-stone-400" />}
                <span className="flex-1">
                  {uploadedFile ? <><span className="font-bold text-stone-900">{uploadedFile.name}</span> <span className="text-stone-500">({uploadedFile.size})</span></> : <><span className="font-semibold text-stone-800">Attach a site plan or sketch (optional)</span><span className="block text-[11px] text-stone-500">PNG, JPG or PDF. Kept with your project for reference; dimensions come from the fields above.</span></>}
                </span>
                {uploadedFile && (
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUploadedFile(null); sketchData.current = null; }} className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"><X className="h-3 w-3" /> Remove</button>
                )}
              </label>
            </div>

            {uploadedFile?.previewUrl && (
              <div className="relative border border-stone-200 bg-stone-100 p-4 rounded overflow-hidden">
                <div className="text-[11px] font-semibold text-stone-700 mb-2 flex items-center justify-between">
                  <span>Site Plan Reference Overlay</span>
                  <span className="text-stone-500">{siteInfo.plotWidth} × {siteInfo.plotDepth} ft Plot Boundary</span>
                </div>
                <div className="relative h-44 w-full flex items-center justify-center bg-stone-50 border border-stone-300 overflow-hidden rounded">
                  <img src={uploadedFile.previewUrl} alt="Site sketch overlay" className="absolute inset-0 w-full h-full object-contain opacity-35 filter grayscale" />
                  <div className="relative z-10 border-2 border-dashed border-magenta-600 bg-magenta-500/10 px-6 py-4 text-center rounded">
                    <span className="font-mono text-xs font-bold text-magenta-900 bg-white/90 px-2.5 py-1 rounded shadow-sm">
                      {siteInfo.plotWidth} ft (W) × {siteInfo.plotDepth} ft (D)
                    </span>
                    <div className="text-[10px] text-magenta-800 font-semibold mt-1">Road: {siteInfo.orientation} Side</div>
                  </div>
                </div>
              </div>
            )}

            {dimensionError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold" role="alert">{dimensionError}</div>}

            <div className="flex justify-end pt-2">
              <button onClick={goToHome} className="flex items-center gap-2 btn-gem px-8 py-3.5 text-sm font-semibold text-white transition-all">
                Next: Your home <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: THE HOME */}
        {step === 2 && (
          <div className="space-y-8 bg-white border border-stone-200 p-8 shadow-sm">
            <div>
              <h2 className="font-serif text-3xl font-normal text-stone-900">What does the home need?</h2>
              <p className="font-sans text-xs text-stone-600 mt-1">Living room and kitchen are always included. Everything you tick is a hard requirement: the plan is rejected if any of it is missing.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {([['bedrooms', 'Bedrooms', 1, 12], ['bathrooms', 'Bathrooms', 1, 12], ['floors', 'Floors', 1, 4], ['familySize', 'Family size', 1, 20]] as const).map(([key, label, min, max]) => (
                <div key={key}>
                  <label className={labelClass} htmlFor={`req-${key}`}>{label}</label>
                  <input id={`req-${key}`} type="number" min={min} max={max} value={requirements[key]} onChange={(e) => setCount(key, Number(e.target.value), min, max)} className={fieldClass} />
                </div>
              ))}
              <div>
                <label className={labelClass} htmlFor="req-parking">Car parking</label>
                <input id="req-parking" type="number" min={0} max={4} value={requirements.spaces.parkingCars} onChange={(e) => setRequirements({ ...requirements, spaces: { ...requirements.spaces, parkingCars: Math.min(4, Math.max(0, Number(e.target.value) || 0)) } })} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="req-budget">Budget tier</label>
                <select id="req-budget" value={requirements.budgetRange} onChange={(e) => setRequirements({ ...requirements, budgetRange: e.target.value as DesignRequirements['budgetRange'] })} className={fieldClass}>
                  {['Economy', 'Moderate', 'Premium', 'Luxury'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <span className={`${labelClass} font-bold mb-2`}>Extra spaces</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SPACES.map(([key, label]) => {
                  const active = !!requirements.spaces[key];
                  return (
                    <button
                      key={key} type="button" aria-pressed={active}
                      onClick={() => setRequirements({ ...requirements, spaces: { ...requirements.spaces, [key]: !active } })}
                      className={`flex items-center gap-2 px-3 py-2.5 border text-xs text-left transition-all ${active ? 'border-magenta-500 bg-amber-50/40 text-stone-900 font-bold' : 'border-stone-300 bg-white text-stone-600 hover:border-stone-900'}`}
                    >
                      <span className={`flex h-3.5 w-3.5 items-center justify-center border ${active ? 'border-magenta-500 bg-magenta-500 text-white' : 'border-stone-400'}`}>{active && <Check className="h-2.5 w-2.5" />}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={`${labelClass} font-bold`} htmlFor="req-notes">{isArchitect ? 'Design brief / notes' : 'Anything else we should know? (optional)'}</label>
              <textarea
                id="req-notes" rows={isArchitect ? 4 : 2} value={requirements.customRequirements}
                onChange={(e) => setRequirements({ ...requirements, customRequirements: e.target.value })}
                placeholder={isArchitect ? 'Client brief, structural grid, material constraints, adjacencies, vastu or accessibility requirements…' : 'For example: large living room, elderly parents live with us, home office used daily…'}
                className="w-full border border-stone-300 p-3 font-sans text-xs text-stone-900 focus:border-stone-900 focus:outline-none"
              />
            </div>

            <FeasibilityBadge precheck={precheck} />

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 border border-stone-300 px-6 py-3 font-sans text-xs font-semibold text-stone-700 hover:border-stone-900"><ArrowLeft className="h-4 w-4" /> Back</button>
              <button onClick={() => setStep(3)} className="flex items-center gap-2 btn-gem px-8 py-3.5 text-sm font-semibold text-white transition-all">Next: Style <ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* STEP 3: STYLE AND GENERATE */}
        {step === 3 && (
          <div className="space-y-8 bg-white border border-stone-200 p-8 shadow-sm">
            <div>
              <h2 className="font-serif text-3xl font-normal text-stone-900">Style and design priorities</h2>
              <p className="font-sans text-xs text-stone-600 mt-1">Each style changes the rooms and proportions of the plan, not only its look.</p>
            </div>

            <div>
              <span className={`${labelClass} font-bold mb-2`}>Architectural style</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {STYLES.map(({ name, blurb }) => (
                  <button
                    key={name} type="button" aria-pressed={primaryStyle === name} onClick={() => setPrimaryStyle(name)}
                    className={`px-3 py-3 border text-left transition-all ${primaryStyle === name ? 'border-plum-900 bg-plum-900 text-gold-200' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-900'}`}
                  >
                    <span className="block text-xs font-semibold">{name}</span>
                    <span className={`block text-[10.5px] mt-1 leading-snug ${primaryStyle === name ? 'text-stone-300' : 'text-stone-500'}`}>{blurb}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={`${labelClass} font-bold mb-2`}>Design priorities (optional)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MODES.map((m) => {
                  const active = selectedModes.includes(m.id);
                  return (
                    <button
                      key={m.id} type="button" aria-pressed={active} onClick={() => toggleMode(m.id)}
                      className={`p-4 border text-left transition-all flex items-start gap-3 ${active ? 'border-magenta-500 bg-amber-50/40' : 'border-stone-300 hover:border-stone-900'}`}
                    >
                      <m.icon className={`h-5 w-5 mt-0.5 ${active ? 'text-magenta-500' : 'text-stone-500'}`} />
                      <span>
                        <span className="block font-serif text-base font-medium text-stone-900">{m.title}</span>
                        <span className="block font-sans text-xs text-stone-600 mt-0.5">{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedModes.includes('life_stage') && selectedModes.includes('budget_first') && (
                <p className="mt-2 text-[11px] text-stone-500">Life-Stage and Budget-First pull in different directions (a ground-floor bedroom suite costs more); both are honoured, so the plan may be tight.</p>
              )}
            </div>

            {isArchitect && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border border-stone-200 p-5">
                <div>
                  <label className={labelClass} htmlFor="secondary-style">Secondary style influence</label>
                  <select id="secondary-style" value={secondaryStyle} onChange={(e) => setSecondaryStyle(e.target.value as ArchitecturalStyle | '')} className={fieldClass}>
                    <option value="">None</option>
                    {STYLES.filter((s) => s.name !== primaryStyle).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="engine">Planning engine</label>
                  <select id="engine" value={engine} onChange={(e) => setEngine(e.target.value as 'auto' | 'local')} className={fieldClass}>
                    <option value="auto">AI planner, with automatic rule-engine fallback</option>
                    <option value="local">Built-in rule engine only (instant, deterministic)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Review */}
            <div className="border border-stone-200 bg-[#FBF8F4] p-4 text-xs text-stone-700 space-y-1">
              <div className="font-bold text-stone-900">Your brief</div>
              <div>{siteInfo.plotWidth} × {siteInfo.plotDepth} ft plot, road on the {siteInfo.orientation} side, {locationInfo.city}</div>
              <div>{requirements.bedrooms} bedroom{requirements.bedrooms > 1 ? 's' : ''}, {requirements.bathrooms} bathroom{requirements.bathrooms > 1 ? 's' : ''}, {requirements.floors} floor{requirements.floors > 1 ? 's' : ''}, {requirements.spaces.parkingCars} car{requirements.spaces.parkingCars === 1 ? '' : 's'}, {requirements.budgetRange} budget</div>
            </div>

            <FeasibilityBadge precheck={precheck} />

            {isGenerating && (
              <div className="p-6 border border-plum-800 bg-plum-900 text-stone-50 space-y-4 shadow-md" role="status">
                <div className="flex items-center justify-between border-b border-plum-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 text-magenta-400 animate-spin" />
                    <span className="font-semibold text-xs tracking-wide text-gold-200 uppercase">Generating Architectural Design</span>
                  </div>
                  <span className="font-mono text-xs text-stone-300">{elapsedSeconds}s elapsed</span>
                </div>

                {/* Stage Steps Indicator */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[
                    { key: 'checking_brief', label: '1. Brief' },
                    { key: 'planning', label: '2. Planning' },
                    { key: 'laying_out', label: '3. Layout' },
                    { key: 'validating', label: '4. Validate' }
                  ].map((stg) => {
                    const stageOrder = ['checking_brief', 'planning', 'laying_out', 'validating', 'saving'];
                    const currentIdx = stageOrder.indexOf(activeStageKey || 'planning');
                    const thisIdx = stageOrder.indexOf(stg.key);
                    const isDone = currentIdx > thisIdx;
                    const isCurrent = currentIdx === thisIdx;

                    return (
                      <div key={stg.key} className="space-y-1">
                        <div className={`h-1.5 w-full rounded-full transition-all duration-300 ${isDone ? 'bg-gold-400' : isCurrent ? 'bg-magenta-500 animate-pulse' : 'bg-plum-700'}`} />
                        <span className={`block text-[10px] text-center font-semibold ${isDone ? 'text-gold-300' : isCurrent ? 'text-magenta-300 font-bold' : 'text-stone-400'}`}>{stg.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="text-center pt-2">
                  <p className="text-xs text-magenta-300 font-bold">{loadingStage}</p>
                  <p className="font-sans text-[11px] text-stone-300 mt-1">Every room is algorithmically proportioned, wall lines aligned and circulation checked before saving.</p>
                </div>
              </div>
            )}

            {generationError && !isGenerating && (
              <div className="p-6 border-2 border-red-400 bg-red-50 text-stone-900 space-y-4 shadow-sm" role="alert">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-red-900">{generationError.title}</h3>
                    <p className="font-sans text-xs text-red-800">{generationError.message}</p>
                  </div>
                </div>

                {generationError.details.length > 0 && (
                  <div className="border border-red-200 bg-white p-3 rounded text-xs space-y-1">
                    <span className="font-semibold text-red-900 block text-[11px] uppercase tracking-wide">Offending constraints / shortfall:</span>
                    <ul className="font-sans text-xs text-red-800 list-disc pl-5 space-y-1">
                      {generationError.details.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}

                <div className="border-t border-red-200 pt-3 flex flex-wrap items-center justify-between gap-3">
                  <button onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50">
                    <ArrowLeft className="h-3 w-3" /> Adjust Plot or Setbacks
                  </button>
                  <div className="flex items-center gap-2">
                    {generationError.canUseLocalEngine && (
                      <button onClick={() => handleGenerate('local')} className="inline-flex items-center gap-1.5 bg-plum-900 text-gold-200 px-4 py-2 text-xs font-semibold hover:bg-plum-800">
                        Try Built-in Rule Engine
                      </button>
                    )}
                    {generationError.canRetry && (
                      <button onClick={() => handleGenerate('auto')} className="inline-flex items-center gap-1.5 btn-gem px-5 py-2 text-xs font-semibold text-white">
                        <RefreshCw className="h-3 w-3" /> Retry Generation
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-stone-200">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 border border-stone-300 px-6 py-3 font-sans text-xs font-semibold text-stone-700 hover:border-stone-900"><ArrowLeft className="h-4 w-4" /> Back</button>
              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating || blocked}
                title={blocked ? 'Change the brief first: it does not fit the plot' : undefined}
                className="flex items-center gap-3 bg-magenta-500 px-10 py-4 font-sans text-xs font-semibold text-white hover:bg-magenta-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating…' : 'Generate design'} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FeasibilityBadge({ precheck }: { precheck: Precheck }) {
  if (precheck.state === 'idle') return null;
  if (precheck.state === 'checking') {
    return <div className="flex items-center gap-2 text-xs text-stone-500" role="status"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking that this brief fits your plot…</div>;
  }
  if (precheck.state === 'fits') {
    const s = precheck.summary;
    return (
      <div className="flex items-start gap-3 border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900" role="status">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-bold">This brief fits your plot</div>
          {s?.footprintWidth ? <div>About {s.footprintWidth} × {s.footprintDepth} ft on the ground floor, {s.builtUpAreaSqFt?.toLocaleString()} sq ft built up in all.</div> : null}
          {precheck.notes.slice(0, 3).map((n, i) => <div key={i} className="text-emerald-800">{n}</div>)}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 border border-red-300 bg-red-50 p-3 text-xs text-red-800" role="alert">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <div className="font-bold">This brief does not fit as entered</div>
        <div>{precheck.reason}</div>
        {precheck.details.slice(0, 4).map((d, i) => <div key={i}>• {d}</div>)}
        <div className="mt-1 text-red-700">Try fewer rooms, another floor, or a larger plot.</div>
      </div>
    </div>
  );
}
