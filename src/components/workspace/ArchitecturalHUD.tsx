'use client';

import React, { useMemo, useState } from 'react';
import { StructuredDesignJSON, FloorPlanRoom } from '@/types/architectural';
import { 
  Building2, 
  Ruler, 
  Coins, 
  ShieldCheck, 
  SunMedium, 
  ChevronDown, 
  Maximize, 
  Sparkles, 
  CheckCircle2,
  XCircle,
  SlidersHorizontal 
} from 'lucide-react';
import { inferRoomType } from '@/lib/design/roomTypes';
import { COST_RATES, computeMetrics, glazedAreaSqFt } from '@/lib/design/metrics';

interface ArchitecturalHUDProps {
  design: StructuredDesignJSON;
  selectedRoomId?: string;
  onRoomSelect?: (roomId: string | undefined) => void;
  onOpenInteriorStudio?: (room: FloorPlanRoom) => void;
  onModifyRoom?: (prompt: string) => void;
}

export default function ArchitecturalHUD({
  design,
  selectedRoomId,
  onRoomSelect,
  onOpenInteriorStudio,
  onModifyRoom
}: ArchitecturalHUDProps) {
  const [activeSection, setActiveSection] = useState<'metrics' | 'cost' | 'compliance'>('metrics');

  const m = useMemo(() => computeMetrics(design), [design]);
  const plotW = design.plot.width;
  const plotD = design.plot.depth;
  const { builtUpSqFt: totalBua, carpetSqFt: carpetArea, carpetPct: efficiency, coveragePct, fsi, footprintSqFt: footprintArea, plotAreaSqFt: plotArea } = m;
  const costStandard = m.costLakhs.standard;
  const costLuxury = m.costLakhs.premium;
  const failedChecks = m.checks.filter((c) => c.status === 'fail');

  // Selected Room
  const selectedRoom = design.rooms.find((r) => r.id === selectedRoomId);
  const selectedType = selectedRoom ? inferRoomType(selectedRoom) : null;

  const floorFinishForType = (type: string | null) => {
    switch (type) {
      case 'master_bedroom':
      case 'bedroom':
      case 'guest_room':
        return 'Engineered Oak Parquet / Warm Hardwood';
      case 'living':
      case 'dining':
      case 'lounge':
      case 'entrance':
        return 'Italian Statuario Marble / Large-format Terrazzo';
      case 'kitchen':
        return 'Anti-skid Quartz Stone Tile';
      case 'bathroom':
        return 'Matte Charcoal Porcelain & Waterproof Grout';
      case 'courtyard':
      case 'terrace':
      case 'balcony':
        return 'Terracotta Pavers & Stepping Stones';
      default:
        return 'Polished Vitrified Tile';
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Selected Room Focus Inspector (When a room is selected) */}
      {selectedRoom ? (
        <div className="rounded-lg border border-amber-500/40 bg-gradient-to-b from-stone-900 to-stone-950 p-4 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="font-serif text-sm font-semibold text-stone-100">{selectedRoom.name}</h3>
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300 uppercase">
                  Level {selectedRoom.position.floorLevel || 0}
                </span>
              </div>
              <p className="mt-1 font-mono text-stone-400">
                {selectedRoom.dimensions} · {Math.round(selectedRoom.areaSqFt)} sq ft ({Math.round(selectedRoom.areaSqFt * 0.0929)} m²)
              </p>
            </div>
            <button
              onClick={() => onRoomSelect && onRoomSelect(undefined)}
              className="text-stone-500 hover:text-stone-300 text-sm p-1"
              title="Close Inspector"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-800 pt-2.5 text-[11px]">
            <div>
              <span className="text-stone-500 block">Suggested Floor Finish</span>
              <span className="text-stone-200 font-medium">{floorFinishForType(selectedType)}</span>
            </div>
            <div>
              <span className="text-stone-500 block">Daylight (glazed / floor)</span>
              <span className="text-stone-200 font-medium">{selectedRoom.areaSqFt > 0 ? Math.round((glazedAreaSqFt(selectedRoom, design.openings) / selectedRoom.areaSqFt) * 100) : 0}%</span>
            </div>
          </div>

          {/* Direct Actions on Selected Room */}
          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-stone-800 pt-3">
            <button
              type="button"
              onClick={() => onOpenInteriorStudio && onOpenInteriorStudio(selectedRoom)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-1.5 font-semibold text-white shadow hover:from-amber-500 hover:to-amber-400 transition-all text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Interior Render</span>
            </button>
            <button
              type="button"
              onClick={() => onModifyRoom && onModifyRoom(`Make ${selectedRoom.name} 15% larger`)}
              className="rounded-md border border-stone-700 bg-stone-800/80 px-2.5 py-1.5 text-stone-300 hover:border-amber-500/50 hover:text-white transition-colors"
              title="Enlarge room by 15%"
            >
              +15%
            </button>
            <button
              type="button"
              onClick={() => onModifyRoom && onModifyRoom(`Make ${selectedRoom.name} 15% smaller`)}
              className="rounded-md border border-stone-700 bg-stone-800/80 px-2.5 py-1.5 text-stone-300 hover:border-amber-500/50 hover:text-white transition-colors"
              title="Shrink room by 15%"
            >
              -15%
            </button>
          </div>
        </div>
      ) : null}

      {/* Main AEC Technical Deck Navigation */}
      <div className="flex border-b border-stone-800 text-[11px] font-medium">
        <button
          onClick={() => setActiveSection('metrics')}
          className={`flex items-center gap-1.5 pb-2 px-3 border-b-2 transition-colors ${
            activeSection === 'metrics'
              ? 'border-amber-400 text-amber-300 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Area</span>
        </button>
        <button
          onClick={() => setActiveSection('cost')}
          className={`flex items-center gap-1.5 pb-2 px-3 border-b-2 transition-colors ${
            activeSection === 'cost'
              ? 'border-amber-400 text-amber-300 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Coins className="h-3.5 w-3.5" />
          <span>Cost</span>
        </button>
        <button
          onClick={() => setActiveSection('compliance')}
          className={`flex items-center gap-1.5 pb-2 px-3 border-b-2 transition-colors ${
            activeSection === 'compliance'
              ? 'border-amber-400 text-amber-300 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Checks</span>
        </button>
      </div>

      {/* Tab 1: Area & FSI Statement */}
      {activeSection === 'metrics' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-stone-800 bg-stone-900/60 p-2.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-stone-500 block">Built-Up Area (BUA)</span>
              <span className="text-base font-semibold text-stone-100">{totalBua} <span className="text-xs font-normal text-stone-400">sq ft</span></span>
              <span className="text-[10px] text-stone-500 block">{Math.round(totalBua * 0.0929)} m²</span>
            </div>
            <div className="rounded-md border border-stone-800 bg-stone-900/60 p-2.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-stone-500 block">Carpet Area</span>
              <span className="text-base font-semibold text-amber-400">{carpetArea} <span className="text-xs font-normal text-stone-400">sq ft</span></span>
              <span className="text-[10px] text-stone-500 block">{efficiency}% space efficiency</span>
            </div>
            <div className="rounded-md border border-stone-800 bg-stone-900/60 p-2.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-stone-500 block">Ground Coverage</span>
              <span className="text-base font-semibold text-stone-100">{coveragePct}%</span>
              <span className="text-[10px] text-stone-500 block">{footprintArea} of {plotArea} sq ft</span>
            </div>
            <div className="rounded-md border border-stone-800 bg-stone-900/60 p-2.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-stone-500 block">FAR / FSI</span>
              <span className="text-base font-semibold text-stone-100">{fsi}</span>
              <span className="text-[10px] text-stone-500 block">Check the limit for your zone</span>
            </div>
          </div>

          <div className="rounded-md border border-stone-800 bg-stone-900/40 p-3 text-stone-300 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">Floors Configured</span>
              <span className="font-semibold text-stone-100">{design.floorsCount} Level{design.floorsCount > 1 ? 's' : ''} (G+{design.floorsCount - 1})</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">Setbacks</span>
              <span className="font-semibold text-stone-100">
                {m.setbacks ? `F ${m.setbacks.front}' · R ${m.setbacks.rear}' · L ${m.setbacks.left}' · R ${m.setbacks.right}'` : 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">Plot Dimensions</span>
              <span className="font-semibold text-stone-100">{plotW}&apos; × {plotD}&apos; ({plotArea} sq ft)</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Turnkey BOQ & Budgetary Cost Deck */}
      {activeSection === 'cost' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="rounded-md border border-stone-800 bg-stone-900/80 p-3.5 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400">Standard finish</span>
              <span className="font-serif text-lg font-bold text-amber-400">₹{costStandard} Lakhs</span>
            </div>
            <p className="text-[11px] text-stone-400">
              At ₹{COST_RATES.standard.toLocaleString('en-IN')}/sq ft of built-up area.
            </p>
          </div>

          <div className="rounded-md border border-stone-800 bg-stone-900/80 p-3.5 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400">Premium finish</span>
              <span className="font-serif text-lg font-bold text-stone-100">₹{costLuxury} Lakhs</span>
            </div>
            <p className="text-[11px] text-stone-400">
              At ₹{COST_RATES.premium.toLocaleString('en-IN')}/sq ft of built-up area.
            </p>
          </div>

          <div className="border-t border-stone-800 pt-2 text-[10px] text-stone-500 font-mono">
            *Indicative only: rates vary by city and year. Excludes land, sanction fees, foundations for poor soil and furniture.
          </div>
        </div>
      )}

      {/* Tab 3: checks computed from this plan's geometry */}
      {activeSection === 'compliance' && (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          <div className={`rounded-md border p-2.5 text-xs flex items-center gap-2 ${failedChecks.length ? 'border-red-500/30 bg-red-950/20 text-red-300' : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-300'}`}>
            {failedChecks.length ? <XCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
            <span>{failedChecks.length ? `${failedChecks.length} of ${m.checks.length} checks need attention` : `All ${m.checks.length} checks pass`}</span>
          </div>

          <ul className="space-y-2 text-[11px] text-stone-300">
            {m.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded bg-stone-900/40 p-2 border border-stone-800/80">
                <span className={c.status === 'pass' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{c.status === 'pass' ? '✓' : '✗'}</span>
                <div>
                  <span className="font-semibold text-stone-200 block">{c.label}</span>
                  <span className="text-stone-400">{c.detail}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-stone-500">Computed from this plan&apos;s geometry. A design check, not statutory approval: confirm limits with your local authority.</p>
        </div>
      )}
    </div>
  );
}
