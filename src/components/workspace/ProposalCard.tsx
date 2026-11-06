'use client';

import { Check, GitCompare, X } from 'lucide-react';
import type { EditDiff } from '@/lib/design/surgery';

export interface Proposal {
  design: import('@/types/architectural').StructuredDesignJSON;
  summary: string;
  tradeOffs: string[];
  title?: string;
  message: string;
  intent?: string;
  engine?: string;
  aiModel?: string;
  notice?: string | null;
  warnings: string[];
  edit?: { diff: EditDiff; strategy: string; quality?: { before: number; after: number }; surgeryNote?: string };
}

const STRATEGY_LABEL: Record<string, string> = {
  'wall-push': 'Edited the existing walls',
  'local-resolve': 'Re-planned only the rooms around the change',
  'full-replan': 'Whole plan re-planned',
  'appearance-only': 'Appearance only, plan unchanged'
};

const area = (r?: { w: number; d: number }) => (r ? Math.round(r.w * r.d) : 0);

/** The reviewable change: what it touched, what it left alone, and whether it is better or worse. The client decides. */
export default function ProposalCard({ proposal, busy, onAccept, onReject }: { proposal: Proposal; busy: boolean; onAccept: () => void; onReject: () => void }) {
  const diff = proposal.edit?.diff;
  const changed = diff ? diff.rooms.filter((r) => r.kind !== 'unchanged') : [];
  const strategy = proposal.edit?.strategy;
  const quality = proposal.edit?.quality;
  const global = strategy === 'full-replan';
  return (
    <section aria-label="Proposed change" className={`border p-4 text-sm ${global ? 'border-amber-400/70 bg-amber-950/20' : 'border-gold-400/70 bg-plum-900'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <GitCompare className="h-4 w-4 text-gold-300" />
        <h3 className="font-serif text-base font-medium text-stone-50">Proposed change</h3>
        {strategy && <span className={`border px-2 py-0.5 text-[11px] ${global ? 'border-amber-400/60 text-amber-200' : 'border-emerald-400/50 text-emerald-200'}`}>{STRATEGY_LABEL[strategy] || strategy}</span>}
      </div>
      <p className="leading-relaxed text-stone-200">{proposal.summary}</p>

      {diff && diff.total > 0 && (
        <p className="mt-2 text-xs text-stone-300">
          <b className="text-gold-300">{diff.preserved}</b> of {diff.total} existing rooms are exactly where they were
          {changed.length ? `; ${changed.length} ${changed.length === 1 ? 'room is' : 'rooms are'} affected.` : '.'}
        </p>
      )}
      {changed.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto border-t border-plum-700 pt-2 text-xs text-stone-300">
          {changed.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3">
              <span><span className={r.kind === 'added' ? 'text-emerald-300' : r.kind === 'removed' ? 'text-rose-300' : 'text-amber-200'}>{r.kind}</span> · {r.name}</span>
              <span className="font-mono text-stone-400">{r.kind === 'added' ? `${area(r.after)} sq ft` : r.kind === 'removed' ? `was ${area(r.before)} sq ft` : r.kind === 'moved' ? 'moved' : `${area(r.before)} → ${area(r.after)} sq ft`}</span>
            </li>
          ))}
        </ul>
      )}
      {quality && (
        <p className="mt-2 text-xs text-stone-300">
          Plan quality score: {quality.before.toFixed(1)} → <b className={quality.after >= quality.before - 0.5 ? 'text-emerald-300' : 'text-amber-200'}>{quality.after.toFixed(1)}</b>
          <span className="text-stone-500"> (circulation, room shape, adjacency, daylight, services)</span>
        </p>
      )}
      {proposal.edit?.surgeryNote && <p className="mt-2 border-l-2 border-amber-400/70 pl-3 text-xs leading-relaxed text-amber-100">{proposal.edit.surgeryNote}</p>}
      {proposal.tradeOffs.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-stone-400">{proposal.tradeOffs.slice(0, 4).map((t) => <li key={t}>{t}</li>)}</ul>
      )}
      {proposal.notice && <p className="mt-2 text-xs text-stone-400">{proposal.notice}</p>}

      <p className="mt-3 text-xs text-stone-400">The plan on screen is a preview. Nothing is saved until you accept.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={onAccept} className="inline-flex items-center gap-1.5 border border-emerald-400/70 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> Accept as new version
        </button>
        <button type="button" disabled={busy} onClick={onReject} className="inline-flex items-center gap-1.5 border border-plum-600 px-3 py-1.5 text-xs text-stone-200 hover:border-rose-400 hover:text-rose-200 disabled:opacity-50">
          <X className="h-3.5 w-3.5" /> Reject
        </button>
      </div>
    </section>
  );
}
