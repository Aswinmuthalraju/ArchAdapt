'use client';

import type { StructuredDesignJSON } from '@/types/architectural';

const tone = (score: number) =>
  score >= 0.85 ? { bar: 'bg-emerald-400', text: 'text-emerald-300' }
  : score >= 0.65 ? { bar: 'bg-gold-400', text: 'text-gold-300' }
  : { bar: 'bg-rose-400', text: 'text-rose-300' };

/**
 * Says how this plan was made, with no spin: which engine drew it, how it scored on the measures an architect checks,
 * what else was considered, and what the client's own words changed. A rule-engine plan is never labelled AI.
 * Kept compact and colour-coded so it reads at a glance; the long explanations fold away.
 */
export default function PlannerPanel({ design }: { design: StructuredDesignJSON }) {
  const planner = design.planner;
  const meta = design.generationMetadata;
  const reading = design.briefReading;
  if (!planner && !reading) return null;
  const aiAssisted = meta?.engine === 'gemini';
  const others = planner ? planner.alternatives.filter((a) => !a.selected) : [];
  const score = planner ? planner.score : 0;
  const ring = Math.max(0, Math.min(100, score));
  return (
    <section className="space-y-4 border-b border-plum-700 p-5" aria-label="How this plan was made">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gold-300">How this plan was made</h2>
          {planner && <p className="mt-1 font-serif text-lg leading-tight text-stone-50">{planner.label}</p>}
          <p className="mt-1 text-xs text-stone-300">{aiAssisted ? `AI (${meta?.modelId}) plus rule reader` : 'Built-in rule reader (no AI)'}{planner ? ` · ${planner.engine === 'spatial-optimizer' ? 'spatial optimiser' : 'zoned-band solver'}` : ''}</p>
        </div>
        {planner && (
          <div
            className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(#E8CF7A ${ring * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
            aria-label={`Plan quality ${score.toFixed(1)} out of 100`}
          >
            <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-plum-850">
              <span className="text-base font-semibold leading-none text-gold-200">{Math.round(score)}</span>
              <span className="-mt-2 text-[9px] uppercase tracking-wider text-stone-400">/100</span>
            </div>
          </div>
        )}
      </div>

      {planner && (
        <div className="space-y-2">
          {planner.scoreParts.map((p) => {
            const t = tone(p.score);
            return (
              <div key={p.key} title={p.detail}>
                <div className="flex justify-between text-xs"><span className="text-stone-200">{p.label}</span><span className={`font-semibold ${t.text}`}>{Math.round(p.score * 100)}%</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-plum-700/80"><div className={`h-1.5 rounded-full ${t.bar}`} style={{ width: `${Math.round(p.score * 100)}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}

      {planner && (planner.rationale.length > 0 || others.length > 0) && (
        <details className="group rounded border border-plum-700 bg-plum-800/60 p-3 text-xs">
          <summary className="flex cursor-pointer select-none items-center justify-between font-semibold text-gold-200">
            <span>Why this arrangement{others.length ? ` · ${others.length} others compared` : ''}</span>
            <span className="text-[10px] text-stone-400 transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="mt-3 space-y-3 border-t border-plum-700 pt-3">
            {planner.rationale.length > 0 && <p className="leading-relaxed text-stone-200">{planner.rationale.join(' ')}</p>}
            {others.length > 0 && (
              <ul className="space-y-1.5 text-stone-300">
                {others.map((a) => (
                  <li key={a.id}><span className="font-medium text-stone-100">{a.label}</span> <span className="text-gold-300">{a.score.toFixed(1)}</span> · {a.tradeoff}</li>
                ))}
              </ul>
            )}
            {others.length > 0 && <p className="text-[11px] text-stone-400">Ask for “another concept” to see the next best arrangement.</p>}
          </div>
        </details>
      )}

      {reading && reading.understood.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-stone-100">What we understood from your notes</h3>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-stone-200">{reading.understood.map((u) => <li key={u}>{u}</li>)}</ul>
        </div>
      )}
      {reading && reading.conflicts.length > 0 && (
        <div className="border-l-2 border-amber-400/70 pl-3 text-xs text-amber-100">
          {reading.conflicts.map((c) => <p key={c}>{c}</p>)}
        </div>
      )}
    </section>
  );
}
