'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { ComplianceCheck, DesignAnalysis, PlanLimits, DEFAULT_LIMITS } from '@/lib/pro/analysis';

interface DrawingSetPanelProps {
  analysis: DesignAnalysis;
  limits: PlanLimits;
  onLimitsChange: (limits: PlanLimits) => void;
  onRoomSelect?: (roomId: string) => void;
}

const STATUS_STYLE: Record<ComplianceCheck['status'], { icon: typeof CheckCircle; text: string; label: string }> = {
  pass: { icon: CheckCircle, text: 'text-emerald-300', label: 'Pass' },
  warn: { icon: AlertTriangle, text: 'text-amber-300', label: 'Review' },
  fail: { icon: XCircle, text: 'text-red-300', label: 'Fails' }
};

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gold-300';
const td = 'px-3 py-2 text-sm text-stone-200';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border border-plum-700 bg-plum-850">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-plum-700 px-4 py-3">
        <h2 className="font-serif text-lg text-stone-50">{title}</h2>
        {hint && <p className="text-xs text-stone-400">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

/** Schedules, area statement and compliance report for the active version, derived live from the design. */
export default function DrawingSetPanel({ analysis, limits, onLimitsChange, onRoomSelect }: DrawingSetPanelProps) {
  const { areas, checks, rooms, openings, summary } = analysis;
  const groups = Array.from(new Set(checks.map((c) => c.group)));
  const numberField = (key: keyof PlanLimits, label: string, step: number) => (
    <label className="flex items-center justify-between gap-3 text-sm text-stone-300">
      {label}
      <input
        type="number"
        min={0}
        step={step}
        value={limits[key]}
        onChange={(e) => onLimitsChange({ ...limits, [key]: Math.max(0, Number(e.target.value) || 0) })}
        className="w-20 border border-plum-600 bg-plum-900 px-2 py-1 text-right text-stone-100 focus:border-gold-400 focus:outline-none"
      />
    </label>
  );

  return (
    <div className="scrollbar-plum h-full overflow-y-auto p-4 sm:p-6 select-text">
      <div className="mx-auto grid max-w-6xl gap-5">
        <Section title="Compliance report" hint={`${summary.pass} pass · ${summary.warn} to review · ${summary.fail} fail`}>
          <div className="grid gap-5 p-4 lg:grid-cols-[1fr_16rem]">
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">{group}</h3>
                  <ul className="space-y-1.5">
                    {checks.filter((c) => c.group === group).map((c) => {
                      const s = STATUS_STYLE[c.status];
                      const Icon = s.icon;
                      return (
                        <li key={c.id} className="flex items-start gap-2.5 text-sm">
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.text}`} aria-label={s.label} />
                          <div>
                            <p className="font-medium text-stone-100">{c.title}</p>
                            <p className="text-xs leading-snug text-stone-400">{c.detail}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="h-fit space-y-2.5 border border-plum-700 bg-plum-900 p-3.5">
              <h3 className="text-sm font-semibold text-gold-300">Your local limits</h3>
              {numberField('maxCoveragePct', 'Max coverage %', 1)}
              {numberField('maxFar', 'Max FAR', 0.05)}
              {numberField('minGlazingPct', 'Min glazing %', 1)}
              <p className="text-xs leading-snug text-stone-500">Set these to the bye-laws of the site. Checks re-run instantly. Defaults are common residential values, not a statutory ruling.</p>
              <button type="button" onClick={() => onLimitsChange(DEFAULT_LIMITS)} className="text-xs text-gold-300 underline-offset-2 hover:underline">Reset to defaults</button>
            </div>
          </div>
        </Section>

        <Section title="Area statement" hint="Derived from the plan, never typed in">
          <dl className="grid grid-cols-2 gap-px bg-plum-700 sm:grid-cols-4">
            {[
              ['Plot', `${areas.plotSqFt} sq ft`],
              ['Ground coverage', `${areas.coveragePct}%`],
              ['Built-up', `${areas.builtUpSqFt} sq ft`],
              ['FAR', String(areas.far)],
              ['Carpet', `${areas.carpetSqFt} sq ft`],
              ['Circulation', `${areas.circulationPct}%`],
              ['Open to sky', `${areas.openToSkySqFt} sq ft`],
              ['Plot (sq m)', `${areas.plotSqM}`]
            ].map(([label, value]) => (
              <div key={label} className="bg-plum-850 px-4 py-3">
                <dt className="text-xs text-stone-400">{label}</dt>
                <dd className="font-serif text-xl text-stone-50">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem]">
              <thead><tr className="border-t border-plum-700"><th className={th}>Floor</th><th className={th}>Built-up (sq ft)</th><th className={th}>Open (sq ft)</th></tr></thead>
              <tbody>
                {areas.floors.map((f) => (
                  <tr key={f.floor} className="border-t border-plum-700/60"><td className={td}>{f.name}</td><td className={td}>{f.builtUpSqFt}</td><td className={td}>{f.openSqFt}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Room schedule" hint="Click a row to find the room on the plan">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem]">
              <thead><tr><th className={th}>Room</th><th className={th}>Floor</th><th className={th}>Size (ft)</th><th className={th}>Area (sq ft)</th><th className={th}>Glazing</th><th className={th}>Doors</th><th className={th}>Windows</th></tr></thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} onClick={() => onRoomSelect?.(r.id)} className="cursor-pointer border-t border-plum-700/60 hover:bg-plum-800">
                    <td className={`${td} font-medium text-stone-50`}>{r.name}</td>
                    <td className={td}>{r.floorName}</td>
                    <td className={td}>{r.widthFt} × {r.depthFt}</td>
                    <td className={`${td} ${r.enclosed && r.areaSqFt + 0.5 < r.minAreaSqFt ? 'text-red-300' : ''}`}>{r.areaSqFt}</td>
                    <td className={td}>{r.habitable && r.enclosed ? `${r.glazingPct}%` : '—'}</td>
                    <td className={td}>{r.doors}</td>
                    <td className={td}>{r.windows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Door and window schedule" hint={`${openings.length} openings`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem]">
              <thead><tr><th className={th}>Mark</th><th className={th}>Type</th><th className={th}>Floor</th><th className={th}>Location</th><th className={th}>Width</th><th className={th}>Height</th><th className={th}>Swing</th></tr></thead>
              <tbody>
                {openings.map((o) => (
                  <tr key={o.id} className="border-t border-plum-700/60">
                    <td className={`${td} font-semibold text-gold-300`}>{o.mark}</td><td className={td}>{o.kind}</td><td className={td}>{o.floorName}</td>
                    <td className={td}>{o.location}</td><td className={td}>{o.widthFt}′</td><td className={td}>{o.heightFt}′</td><td className={td}>{o.swing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
