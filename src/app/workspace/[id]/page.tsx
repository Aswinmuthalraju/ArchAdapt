'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import FloorPlan2DRenderer from '@/components/canvas/FloorPlan2DRenderer';
import Massing3DViewer from '@/components/canvas/Massing3DViewer';
import VersionComparisonModal from '@/components/workspace/VersionComparisonModal';
import DrawingSetPanel from '@/components/workspace/DrawingSetPanel';
import ExportMenu from '@/components/workspace/ExportMenu';
import { analyseDesign, DEFAULT_LIMITS, PlanLimits } from '@/lib/pro/analysis';
import { Layers, Box, Send, Sparkles, ArrowLeft, History, GitCompare, CheckCircle, AlertTriangle, ClipboardList, MessageSquare } from 'lucide-react';
import { Project, FloorPlanVersion, StructuredDesignJSON, WhatIfMessage } from '@/types/architectural';
import { supabase, authHeaders } from '@/lib/supabase/client';
import { getUserProjectsFromSupabase, setCurrentVersionInSupabase } from '@/lib/services/projectService';
import { validateFloorPlan } from '@/lib/design/validateFloorPlan';
import { checkRenderConsistency } from '@/lib/geometry/buildHouseGeometry';
import { countBedrooms, countRoomsOfType } from '@/lib/design/roomTypes';

const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const isValidDesign = (design?: StructuredDesignJSON | null): design is StructuredDesignJSON => !!design && Array.isArray(design.rooms) && design.rooms.length > 0 && !!design.plot;
const WELCOME: WhatIfMessage = {
  id: 'msg-welcome',
  sender: 'assistant',
  content: 'Ask for a change to this design and I will apply it to the existing plan, check that it still fits, and save it as a new version. For example: "Add a bedroom upstairs", "Make the kitchen 20% larger", "Move the study next to the living room", or "Generate another concept".',
  timestamp: ''
};

type LoadState = 'loading' | 'ready' | 'not_found';

export default function WorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'2d' | '3d' | 'sheet' | 'ask'>('2d');
  const [currentVersion, setCurrentVersion] = useState<FloorPlanVersion | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareVersionA, setCompareVersionA] = useState<FloorPlanVersion | null>(null);
  const [chatMessages, setChatMessages] = useState<WhatIfMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_LIMITS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('archadapt_limits');
      if (stored) setLimits({ ...DEFAULT_LIMITS, ...JSON.parse(stored) });
    } catch { /* defaults */ }
  }, []);
  const updateLimits = (next: PlanLimits) => {
    setLimits(next);
    try { localStorage.setItem('archadapt_limits', JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    // Listen for sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login');
      }
    });

    async function load() {
      let found: Project | null = null;
      let signedIn = false;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace(`/login?next=/workspace/${projectId}`);
          return;
        }

        const user = session.user;
        signedIn = true;
        try {
          const projects = await getUserProjectsFromSupabase(user.id);
          const match = projects.find((p) => p.id === projectId);
          if (match) found = { ...match, storage: 'supabase' };
        } catch (err) {
          console.warn('[Workspace] Supabase load failed, checking this browser:', err);
        }
      } catch {
        router.replace(`/login?next=/workspace/${projectId}`);
        return;
      }

      if (!found) {
        try {
          const stored = localStorage.getItem(`project_${projectId}`);
          if (stored) found = { ...JSON.parse(stored), storage: 'local' };
        } catch { /* unreadable local copy */ }
      }
      if (cancelled) return;

      const versions = (found?.versions || []).filter((v) => isValidDesign(v.structuredDesign)).sort((a, b) => a.versionNumber - b.versionNumber);
      if (!found || versions.length === 0) {
        setLoadState('not_found');
        return;
      }
      found = { ...found, versions };
      setProject(found);
      setCurrentVersion(versions.find((v) => v.id === found!.currentVersionId) || versions[versions.length - 1]);

      // Conversation history: from Supabase for account projects, from this browser for local ones.
      let history: WhatIfMessage[] = [];
      if (found.storage === 'supabase' && signedIn) {
        try {
          const { data } = await supabase.from('design_conversations').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
          history = (data || []).map((c) => ({
            id: c.id,
            sender: c.sender as 'user' | 'assistant',
            content: c.content,
            timestamp: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            versionIdResult: c.resulting_version_id || undefined
          }));
        } catch { /* history is optional */ }
      } else {
        try { history = JSON.parse(localStorage.getItem(`chat_${projectId}`) || '[]'); } catch { /* ignore */ }
      }
      if (cancelled) return;
      setChatMessages(history.length ? history : [{ ...WELCOME, timestamp: timeNow() }]);
      setLoadState('ready');
    }

    load();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [projectId, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isProcessing]);

  const activeDesign = currentVersion && isValidDesign(currentVersion.structuredDesign) ? currentVersion.structuredDesign : null;

  // The same checks the server ran before saving, re-run on what is actually on screen.
  const checks = useMemo(() => {
    if (!activeDesign) return null;
    return { validation: validateFloorPlan(activeDesign), consistency: checkRenderConsistency(activeDesign) };
  }, [activeDesign]);

  const analysis = useMemo(() => (activeDesign ? analyseDesign(activeDesign, limits) : null), [activeDesign, limits]);

  const pushMessages = (messages: WhatIfMessage[], localProjectId?: string) => {
    setChatMessages((prev) => {
      const next = [...prev, ...messages];
      if (localProjectId) {
        try { localStorage.setItem(`chat_${localProjectId}`, JSON.stringify(next.filter((m) => m.id !== 'msg-welcome'))); } catch { /* storage full */ }
      }
      return next;
    });
  };

  const handleWhatIfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputPrompt.trim();
    if (!text || !currentVersion || !project || !activeDesign || isProcessing) return;

    const isLocal = project.storage !== 'supabase';
    const localKey = isLocal ? project.id : undefined;
    setInputPrompt('');
    pushMessages([{ id: `user-${Date.now()}`, sender: 'user', content: text, timestamp: timeNow() }], localKey);
    setIsProcessing(true);
    setElapsed(0);
    const startedAt = Date.now();
    const ticker = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 185_000);
    const reply = (content: string, versionIdResult?: string) =>
      pushMessages([{ id: `assistant-${Date.now()}`, sender: 'assistant', content, timestamp: timeNow(), versionIdResult }], localKey);

    try {
      const res = await fetch('/api/design/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        signal: controller.signal,
        body: JSON.stringify({
          projectId: project.id,
          currentVersionId: currentVersion.id,
          message: text,
          currentDesign: activeDesign,
          location: project.location
        })
      });

      let data: any = null;
      try { data = await res.json(); } catch { /* handled below */ }
      if (!data) {
        reply(`The request failed (HTTP ${res.status}). Your design was not changed.`);
        return;
      }

      if (!data.success) {
        const list = (data.violatedConstraints || []).map((c: string) => `• ${c}`).join('\n');
        const heading =
          data.status === 'INFEASIBLE' ? 'Not feasible. Your design was not changed.'
          : data.status === 'NOT_UNDERSTOOD' ? 'I could not act on that request. Your design was not changed.'
          : data.status === 'INVALID_DESIGN' ? 'No valid design was produced. Your design was not changed.'
          : data.status === 'ENGINE_UNAVAILABLE' ? 'The AI planner is unavailable. Your design was not changed.'
          : 'The request failed. Your design was not changed.';
        reply(`${heading}\n\n${data.explanation || data.error || ''}${list ? `\n\n${list}` : ''}`.trim());
        return;
      }

      const updatedDesign: StructuredDesignJSON = data.updatedDesign;
      if (!isValidDesign(updatedDesign)) {
        reply('The server answered without a usable design. Your design was not changed.');
        return;
      }

      const versionNumber = data.versionNumber || Math.max(0, ...project.versions.map((v) => v.versionNumber)) + 1;
      const newVersion: FloorPlanVersion = {
        id: data.versionId || `v${versionNumber}`,
        projectId: project.id,
        versionNumber,
        title: data.title || data.summary || `Version ${versionNumber}`,
        structuredDesign: updatedDesign,
        rationale: updatedDesign.rationale || data.summary,
        tradeOffs: data.tradeOffs || [],
        parentVersionId: currentVersion.id,
        createdByPrompt: text,
        createdAt: new Date().toISOString()
      };
      const updatedProject: Project = { ...project, currentVersionId: newVersion.id, versions: [...project.versions, newVersion], updatedAt: new Date().toISOString() };
      setProject(updatedProject);
      setCurrentVersion(newVersion);
      setSelectedRoomId(undefined);
      if (isLocal) {
        try { localStorage.setItem(`project_${project.id}`, JSON.stringify(updatedProject)); } catch { /* storage full */ }
      }

      const lines = [
        data.intent === 'GENERATE_ALTERNATIVE_CONCEPT' ? data.summary : `Applied as version ${versionNumber}: ${data.summary}`,
        (data.tradeOffs || []).length ? `\nWhat this changes:\n${data.tradeOffs.map((t: string) => `• ${t}`).join('\n')}` : '',
        (data.validationWarnings || []).length ? `\nNotes from validation:\n${data.validationWarnings.slice(0, 4).map((t: string) => `• ${t}`).join('\n')}` : '',
        data.notice ? `\n${data.notice}` : '',
        !isLocal && !data.persisted ? `\nThis version could not be saved to your account${data.persistError ? ` (${data.persistError})` : ''}. It is only held in this browser tab.` : ''
      ];
      reply(lines.filter(Boolean).join('\n'), newVersion.id);
    } catch (err: any) {
      reply(err?.name === 'AbortError' ? 'The server did not answer within 3 minutes. Your design was not changed.' : `The request failed: ${err?.message || 'network error'}. Your design was not changed.`);
    } finally {
      clearInterval(ticker);
      clearTimeout(timeout);
      setIsProcessing(false);
    }
  };

  /** Makes a version the active one, here and wherever the project is stored. */
  const activateVersion = async (version: FloorPlanVersion) => {
    setCurrentVersion(version);
    setSelectedRoomId(undefined);
    if (!project) return;
    const updated = { ...project, currentVersionId: version.id };
    setProject(updated);
    if (project.storage === 'supabase') {
      await setCurrentVersionInSupabase(project.id, version.id);
    } else {
      try { localStorage.setItem(`project_${project.id}`, JSON.stringify(updated)); } catch { /* storage full */ }
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-plum-900 text-sm text-stone-400" role="status">
        Opening your project…
      </div>
    );
  }

  if (loadState === 'not_found' || !project || !currentVersion || !activeDesign) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center">
        <h1 className="font-serif text-3xl font-medium text-stone-900">We couldn&apos;t find that project</h1>
        <p className="max-w-md leading-relaxed text-stone-600">
          No saved design exists for it in your account or in this browser. If you made it while signed in, sign in again to open it.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard" className="border border-stone-900 px-6 py-3 text-sm font-medium text-stone-900 hover:bg-stone-900 hover:text-gold-200">My projects</Link>
          <Link href="/onboarding" className="btn-gem px-6 py-3 text-sm font-semibold text-white">Start a plan</Link>
        </div>
      </div>
    );
  }

  const meta = activeDesign.generationMetadata;
  const engineLabel = !meta ? 'Legacy design' : meta.engine === 'gemini' ? `Gemini · ${meta.modelId}` : 'Built-in rule engine';
  const bedroomCount = countBedrooms(activeDesign);
  const bathroomCount = countRoomsOfType(activeDesign, 'bathroom');
  const notes = activeDesign.layoutNotes || [];
  const heading = 'text-sm font-semibold text-gold-300';
  const chip = 'inline-flex items-center gap-1 border px-2 py-0.5 text-xs';
  const fact = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between border-b border-plum-700 py-2 text-sm last:border-0">
      <dt className="text-stone-400">{label}</dt>
      <dd className="font-medium text-stone-100">{value}</dd>
    </div>
  );

  const chat = (
    <>
  <div className="flex items-center gap-3 border-b border-plum-700 p-4">
    <div className="btn-gem flex h-9 w-9 items-center justify-center text-white">
      <Sparkles className="h-4 w-4" />
    </div>
    <div>
      <h2 className="font-serif text-lg font-medium leading-none text-stone-50">What-if assistant</h2>
      <p className="mt-1 text-xs text-stone-400">Edits version {currentVersion.versionNumber}</p>
    </div>
  </div>

  <div className="scrollbar-plum flex-1 space-y-4 overflow-y-auto p-4 text-sm select-text">
    {chatMessages.map((msg) => (
      <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
        <div className={`max-w-[92%] border p-3.5 ${msg.sender === 'user' ? 'border-magenta-500/50 bg-magenta-600/20 text-stone-50' : 'border-plum-700 bg-plum-900 text-stone-200'}`}>
          <div className="mb-1 flex items-center justify-between gap-4 text-xs text-stone-400">
            <span className={msg.sender === 'user' ? 'text-magenta-200' : 'text-gold-300'}>{msg.sender === 'user' ? 'You' : 'ArchAdapt'}</span>
            <span>{msg.timestamp}</span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
      </div>
    ))}
    {isProcessing && (
      <div className="flex items-center gap-2 text-sm text-stone-300" role="status">
        <Sparkles className="h-4 w-4 animate-spin text-gold-300" />
        Working out the change and re-checking the plan… {elapsed}s
      </div>
    )}
    <div ref={chatEndRef} />
  </div>

  <form onSubmit={handleWhatIfSubmit} className="border-t border-plum-700 bg-plum-800 p-4">
    <label htmlFor="whatif" className="sr-only">Ask for a change</label>
    <div className="relative flex items-center">
      <input
        id="whatif"
        type="text"
        value={inputPrompt}
        onChange={(e) => setInputPrompt(e.target.value)}
        disabled={isProcessing}
        maxLength={2000}
        placeholder="Try: add a bedroom upstairs"
        className="w-full border border-plum-600 bg-plum-900 py-3 pl-4 pr-11 text-sm text-stone-100 placeholder-stone-500 focus:border-gold-400 focus:outline-none disabled:opacity-60"
      />
      <button type="submit" disabled={isProcessing || !inputPrompt.trim()} className="absolute right-2 p-1.5 text-gold-300 transition-colors hover:text-gold-100 disabled:opacity-40" title="Send" aria-label="Send">
        <Send className="h-4 w-4" />
      </button>
    </div>
    <p className="mt-2 text-xs text-stone-500">Each accepted change becomes a new version. Earlier versions are kept.</p>
  </form>

    </>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-plum-900 text-stone-100 select-none">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-plum-700 bg-plum-850 px-5 py-2">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/dashboard" className="text-stone-400 transition-colors hover:text-gold-200" title="Back to my projects" aria-label="Back to my projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-6 w-px bg-plum-700" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-serif text-xl font-medium text-stone-50">{project.title}</h1>
              <span className={`${chip} border-gold-400/50 text-gold-300`}>Version {currentVersion.versionNumber}</span>
              <span className={`${chip} ${meta?.engine === 'gemini' ? 'border-magenta-400/50 text-magenta-300' : 'border-plum-600 text-stone-300'}`}>
                <Sparkles className="h-3 w-3" />
                {engineLabel}
              </span>
              {project.storage !== 'supabase' && (
                <span className={`${chip} border-plum-600 text-stone-300`} title="Sign in before creating a project to save it to your account">
                  Saved in this browser only
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-stone-400">
              {project.location.city}, {project.location.country} · {activeDesign.plot.width}′ × {activeDesign.plot.depth}′ plot · {project.preferences.primaryStyle}
            </p>
          </div>
        </div>

        <div role="tablist" aria-label="View" className="flex max-w-full overflow-x-auto border border-plum-600 bg-plum-800 p-0.5">
          {([['2d', 'Floor plan', Layers], ['3d', '3D model', Box], ['sheet', 'Drawing set', ClipboardList], ['ask', 'Assistant', MessageSquare]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`${id === 'ask' ? 'xl:hidden ' : ''}flex items-center gap-2 px-3 py-1.5 text-sm transition-colors sm:px-4 ${activeTab === id ? 'bg-gold-400 font-semibold text-plum-950' : 'text-stone-300 hover:text-gold-200'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <ExportMenu
          design={activeDesign}
          analysis={analysis!}
          title={project.title}
          version={currentVersion.versionNumber}
          location={`${project.location.city}, ${project.location.country}`}
          style={project.preferences.primaryStyle}
          engine={engineLabel}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="scrollbar-plum hidden w-80 shrink-0 flex-col overflow-y-auto border-r border-plum-700 bg-plum-850 lg:flex">
          <section className="space-y-2 border-b border-plum-700 p-5">
            <h2 className={heading}>This version</h2>
            <dl>
              {fact('Bedrooms', bedroomCount)}
              {fact('Bathrooms', bathroomCount)}
              {fact('Floors', activeDesign.floorsCount)}
              {fact('Built-up area', `${activeDesign.totalBuiltUpAreaSqFt || 0} sq ft`)}
            </dl>
            {project.preferences.modes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {project.preferences.modes.map((m) => (
                  <span key={m} className={`${chip} border-magenta-400/40 capitalize text-magenta-300`}>
                    {m.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </section>

          {checks && (
            <section className="space-y-2.5 border-b border-plum-700 p-5">
              <h2 className={heading}>Checks</h2>
              {[
                { ok: checks.validation.isValid, good: 'Requirements, geometry and circulation all pass.', bad: `${checks.validation.errors.length} problem(s) found in this version.` },
                { ok: checks.consistency.consistent, good: 'The 2D plan and 3D model are the same house.', bad: checks.consistency.problems[0] }
              ].map((row, index) => (
                <div key={index} className={`flex items-start gap-2 text-sm leading-snug ${row.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                  {row.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{row.ok ? row.good : row.bad}</span>
                </div>
              ))}
              {[...checks.validation.errors, ...checks.validation.warnings, ...notes].slice(0, 6).map((line, index) => (
                <p key={index} className="border-l border-gold-400/40 pl-3 text-xs leading-snug text-stone-400">{line}</p>
              ))}
            </section>
          )}

          <section className="border-b border-plum-700 p-5">
            <h2 className={`${heading} mb-2`}>Why it&apos;s laid out this way</h2>
            <p className="text-sm leading-relaxed text-stone-300">{activeDesign.rationale || currentVersion.rationale}</p>
            {(activeDesign.modeConsiderations || []).map((item) => (
              <p key={item.mode} className="mt-2.5 text-xs leading-snug text-stone-400">
                <span className="font-semibold capitalize text-gold-300">{item.mode.replace(/_/g, ' ')}: </span>
                {item.note}
              </p>
            ))}
          </section>

          <section className="flex-1 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className={`${heading} flex items-center gap-1.5`}>
                <History className="h-4 w-4" />
                Version history
              </h2>
              <span className="text-xs text-stone-400">{project.versions.length} {project.versions.length === 1 ? 'version' : 'versions'}</span>
            </div>

            <div className="space-y-2.5">
              {project.versions.slice().reverse().map((ver) => {
                const isActive = ver.id === currentVersion.id;
                return (
                  <div key={ver.id} className={`border p-3 transition-colors ${isActive ? 'border-gold-400 bg-plum-800' : 'border-plum-700 bg-plum-900 hover:border-plum-600'}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={isActive ? 'font-semibold text-gold-300' : 'text-stone-400'}>Version {ver.versionNumber}{isActive && ' · viewing'}</span>
                      <span className="text-stone-500">{countBedrooms(ver.structuredDesign)} bed · {ver.structuredDesign.floorsCount} fl</span>
                    </div>
                    <p className="mt-1 font-serif text-base text-stone-100">{ver.title}</p>
                    {!isActive && (
                      <div className="mt-2.5 flex items-center gap-2 border-t border-plum-700 pt-2.5 text-xs">
                        <button onClick={() => activateVersion(ver)} className="border border-plum-600 px-2.5 py-1 text-stone-200 transition-colors hover:border-gold-400 hover:text-gold-200">
                          View
                        </button>
                        <button
                          onClick={() => { setCompareVersionA(ver); setIsCompareOpen(true); }}
                          className="flex items-center gap-1 px-2 py-1 text-stone-400 transition-colors hover:text-gold-200"
                        >
                          <GitCompare className="h-3.5 w-3.5" />
                          Compare
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        {/* Both views render the same canonical design object */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-plum-950">
          {activeTab === '2d' && <FloorPlan2DRenderer design={activeDesign} selectedRoomId={selectedRoomId} onRoomSelect={(room) => setSelectedRoomId(room && room.id !== selectedRoomId ? room.id : undefined)} />}
          {activeTab === '3d' && <Massing3DViewer design={activeDesign} />}
          {activeTab === 'sheet' && analysis && (
            <DrawingSetPanel analysis={analysis} limits={limits} onLimitsChange={updateLimits} onRoomSelect={(id) => { setSelectedRoomId(id); setActiveTab('2d'); }} />
          )}
          {activeTab === 'ask' && <div className="flex h-full flex-col bg-plum-850">{chat}</div>}
        </main>

        {activeTab !== 'ask' && <aside className="hidden w-96 shrink-0 flex-col border-l border-plum-700 bg-plum-850 xl:flex">{chat}</aside>}
      </div>

      <VersionComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        versionA={compareVersionA}
        versionB={currentVersion}
        onRestoreVersion={(ver) => activateVersion(ver)}
      />
    </div>
  );
}
