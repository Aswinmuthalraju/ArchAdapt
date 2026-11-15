'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  Layers, 
  Sun, 
  Moon, 
  Sunset, 
  Check, 
  Palette, 
  RefreshCw, 
  SlidersHorizontal 
} from 'lucide-react';
import { FloorPlanRoom, StructuredDesignJSON } from '@/types/architectural';
import { inferRoomType } from '@/lib/design/roomTypes';

interface InteriorStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  design: StructuredDesignJSON;
  initialRoom?: FloorPlanRoom | null;
}

const STYLES = [
  'Modern Luxury',
  'Minimalist',
  'Kerala Traditional',
  'Contemporary'
];

const LIGHTING_MODES = [
  { id: 'daylight', label: 'Daylight Sunbeams', icon: Sun },
  { id: 'golden_hour', label: 'Golden Hour', icon: Sunset },
  { id: 'evening_mood', label: 'Evening Warmth', icon: Moon }
];

export default function InteriorStudioModal({
  isOpen,
  onClose,
  design,
  initialRoom
}: InteriorStudioModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('Modern Luxury');
  const [lightingMode, setLightingMode] = useState<string>('daylight');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [renderResult, setRenderResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Rooms a person can be photographed in (not voids, passages, stairs).
  const eligibleRooms = useMemo(
    () => design.rooms.filter((r) => {
      const t = inferRoomType(r);
      return t !== 'void' && t !== 'passage' && t !== 'stair';
    }),
    [design.rooms]
  );

  // Follow the room chosen outside the modal; otherwise default to the first eligible room.
  useEffect(() => {
    if (initialRoom) setSelectedRoomId(initialRoom.id);
  }, [initialRoom]);
  useEffect(() => {
    if (!selectedRoomId && eligibleRooms.length) setSelectedRoomId(eligibleRooms[0].id);
  }, [eligibleRooms, selectedRoomId]);

  const activeRoom = eligibleRooms.find((r) => r.id === selectedRoomId) || eligibleRooms[0];

  const handleGenerate = async () => {
    if (!activeRoom || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/render/interior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design, roomId: activeRoom.id, style: selectedStyle, lightingMode, customPrompt })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || `Render failed (HTTP ${res.status}).`);
      setRenderResult(data);
    } catch (err: any) {
      setError(err?.message || 'Render failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col lg:flex-row w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-xl border border-stone-800 bg-stone-950 shadow-2xl">
        
        {/* Left: Render Output Showcase */}
        <div className="relative flex-1 bg-stone-900 flex flex-col items-center justify-center min-h-[380px] lg:min-h-[600px] overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-amber-400">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <span className="text-xs font-mono uppercase tracking-widest text-stone-300">
                Rendering interior… this can take up to a minute
              </span>
            </div>
          ) : error ? (
            <div className="max-w-sm p-8 text-center text-sm text-red-300" role="alert">
              <p className="font-semibold mb-1">Could not render this room</p>
              <p className="text-red-300/80">{error}</p>
            </div>
          ) : renderResult?.imageUrl ? (
            <div className="relative w-full h-full flex items-center justify-center p-3">
              <img
                src={renderResult.imageUrl}
                alt={`AI render of ${renderResult.roomName}`}
                className="max-h-[560px] w-auto max-w-full rounded-lg object-contain shadow-2xl border border-stone-800"
              />
              <div className="absolute top-6 left-6 rounded-md bg-stone-950/80 backdrop-blur px-3 py-1.5 border border-stone-700 text-xs text-stone-200 shadow">
                <span className="font-semibold text-amber-400">{renderResult.roomName}</span> · {renderResult.style}
              </div>
              <a
                href={renderResult.imageUrl}
                download={`archadapt-${renderResult.roomId}.png`}
                className="absolute bottom-6 right-6 flex items-center gap-1.5 rounded-md bg-stone-900/90 hover:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-200 border border-stone-700 shadow backdrop-blur transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PNG</span>
              </a>
            </div>
          ) : (
            <div className="text-center p-8 text-stone-500">
              <Sparkles className="h-10 w-10 mx-auto text-amber-500/40 mb-3" />
              <p className="text-sm">Choose a room, style and lighting, then press Render.</p>
            </div>
          )}
        </div>

        {/* Right: Studio Controls & Architectural Specifications */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-stone-800 p-6 flex flex-col justify-between overflow-y-auto bg-stone-950">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h2 className="font-serif text-lg font-semibold text-stone-100">AI Room Studio</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1 text-stone-400 hover:text-stone-100 hover:bg-stone-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Room Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-stone-400 block">
                Target Room
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => {
                  setSelectedRoomId(e.target.value);
                  setRenderResult(null);
                  setError(null);
                }}
                className="w-full rounded-md border border-stone-800 bg-stone-900 px-3 py-2 text-xs font-medium text-stone-100 focus:border-amber-500 focus:outline-none"
              >
                {eligibleRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({Math.round(r.areaSqFt)} sq ft · Level {r.position.floorLevel || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Style Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-stone-400 block">
                Architectural Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedStyle(s)}
                    className={`rounded border px-2.5 py-1.5 text-xs text-left transition-all ${
                      selectedStyle === s
                        ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-semibold'
                        : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Lighting Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-stone-400 block">
                Lighting Atmosphere
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {LIGHTING_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setLightingMode(mode.id)}
                      className={`flex flex-col items-center gap-1 rounded border p-2 text-[10px] transition-all ${
                        lightingMode === mode.id
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-semibold'
                          : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="interior-extra" className="text-xs font-mono uppercase tracking-wider text-stone-400 block">
                Extra direction (optional)
              </label>
              <textarea
                id="interior-extra"
                value={customPrompt}
                maxLength={300}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. green accent wall, writing desk by the window"
                className="w-full rounded-md border border-stone-800 bg-stone-900 px-3 py-2 text-xs text-stone-100 placeholder:text-stone-600 focus:border-amber-500 focus:outline-none"
                rows={2}
              />
            </div>

            {/* What the render was told about this room (taken from the plan) */}
            {renderResult?.basis && (
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-3.5 space-y-1 text-xs">
                <span className="font-bold text-[11px] uppercase tracking-wider text-amber-400 block">Generated from your plan</span>
                <p className="text-stone-300 text-[11px]">{renderResult.roomName}: {renderResult.basis.dimensions} · {renderResult.basis.areaSqFt} sq ft · floor {renderResult.basis.floor}</p>
                <p className="text-stone-500 text-[11px]">AI imagery is an illustration. Check it against the drawings; furniture and finishes are suggestions.</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-stone-800 space-y-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-2.5 font-semibold text-white shadow-lg text-xs transition-all disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isLoading ? 'Rendering…' : renderResult ? 'Render again' : 'Render this room'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
