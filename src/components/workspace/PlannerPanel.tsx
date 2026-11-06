'use client';

import type { StructuredDesignJSON } from '@/types/architectural';

/**
 * Says how this plan was made, with no spin: which engine drew it, how it scored on the measures an architect checks,
 * what else was considered, and what the client's own words changed. A rule-engine plan is never labelled AI.
 */
export default function PlannerPanel({ design }: { design: StructuredDesignJSON }) {
  const planner = design.planner;
  const meta = design.generationMetadata;
  const reading = design.briefReading;
  if (!planner && !reading) return null;
  const aiAssisted = meta?.engine === 'gemini';
  return (
    <section className="space-y-3 border-b border-plum-700 p-5" aria-label="How this plan was made">
      <h2 className="text-sm font-semibold text-gold-300">How this plan was made</h2>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-stone-400">Brief interpreted by</dt><dd className="text-right text-stone-100">{aiAssisted ? `AI (${meta?.modelId}) plus rule reader` : 'Built-in rule reader (no AI)'}</dd></div>
        {planner && <div className="flex justify-between gap-3"><dt className="text-stone-400">Layout solved by</dt><dd className="text-right text-stone-100">{planner.engine === 'spatial-optimizer' ? 'Spatial optimiser' : 'Zoned-band solver'}</dd></div>}
        {planner && <div className="flex justify-between gap-3"><dt className="text-stone-400">Planning idea</dt><dd className="text-right text-stone-100">{planner.label}</dd></div>}
        {planner && <div className="flex justify-between gap-3"><dt className="text-stone-400">Plan quality</dt><dd className="font-semibold text-gold-200">{planner.score.toFixed(1)} / 100</dd></div>}
      </dl>
      {planner && (
        <div className="space-y-1.5">
          {planner.scoreParts.map((p) => (
            <div key={p.key} title={p.detail}>
              <div className="flex justify-between text-[11px] text-stone-400"><span>{p.label}</span><span>{Math.round(p.score * 100)}%</span></div>
              <div className="h-1 bg-plum-700"><div className="h-1 bg-gold-400" style={{ width: `${Math.round(p.score * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      {planner && planner.rationale.length > 0 && <p className="text-xs leading-relaxed text-stone-300">{planner.rationale.join(' ')}</p>}
      {planner && planner.alternatives.length > 1 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-stone-200">Also considered</h3>
          <ul className="space-y-1 text-xs text-stone-400">
            {planner.alternatives.filter((a) => !a.selected).map((a) => (
              <li key={a.id}><span className="text-stone-200">{a.label}</span> ({a.score.toFixed(1)}): {a.tradeoff}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-stone-500">Ask for “another concept” to see the next best arrangement.</p>
        </div>
      )}
      {reading && reading.understood.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-stone-200">What we understood from your notes</h3>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-stone-300">{reading.understood.map((u) => <li key={u}>{u}</li>)}</ul>
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
