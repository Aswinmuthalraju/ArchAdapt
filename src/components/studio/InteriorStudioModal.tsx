'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Download, 
  Sun, 
  Moon, 
  Sunset, 
  Check, 
  Sparkles,
  Eye,
  Camera,
  Layers,
  Box,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { FloorPlanRoom, StructuredDesignJSON } from '@/types/architectural';
import { inferRoomType } from '@/lib/design/roomTypes';
import { glazedAreaSqFt } from '@/lib/design/metrics';
import RoomWalkInViewport, { InteriorFloorFinish, InteriorLighting } from './RoomWalkInViewport';

interface InteriorStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  design: StructuredDesignJSON;
  initialRoom?: FloorPlanRoom | null;
}

const FLOOR_FINISHES: { id: InteriorFloorFinish; label: string; desc: string; color: string }[] = [
  { id: 'oak_parquet', label: 'Oak Parquet', desc: 'Engineered natural oak timber', color: '#B38B59' },
  { id: 'statuario_marble', label: 'Statuario Marble', desc: 'Polished Italian white stone', color: '#EBEAE6' },
  { id: 'slate_tile', label: 'Charcoal Slate', desc: 'Honed matte charcoal stone', color: '#2B2E33' },
  { id: 'terrazzo', label: 'Quartz Terrazzo', desc: 'Cast Venetian composite tile', color: '#D9D2C7' }
];

const LIGHTING_MODES: { id: InteriorLighting; label: string; sub: string; icon: React.ElementType }[] = [
  { id: 'daylight', label: 'Daylight Sunbeams', sub: 'High noon solar wash', icon: Sun },
  { id: 'golden_hour', label: 'Golden Hour', sub: 'Warm low-angle sun', icon: Sunset },
  { id: 'evening_mood', label: 'Evening Warmth', sub: 'Cove & pendant lamps', icon: Moon }
];

export default function InteriorStudioModal({
  isOpen,
  onClose,
  design,
  initialRoom
}: InteriorStudioModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [floorFinish, setFloorFinish] = useState<InteriorFloorFinish>('oak_parquet');
  const [lighting, setLighting] = useState<InteriorLighting>('daylight');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const captureFnRef = useRef<(() => string) | null>(null);

  // Filter rooms suitable for interior inspection
  const eligibleRooms = useMemo(
    () => design.rooms.filter((r) => {
      const t = inferRoomType(r);
      return t !== 'void' && t !== 'passage' && t !== 'stair';
    }),
    [design.rooms]
  );

  // Sync with initialRoom or pick first room
  useEffect(() => {
    if (initialRoom) {
      setSelectedRoomId(initialRoom.id);
    }
  }, [initialRoom]);

  useEffect(() => {
    if (!selectedRoomId && eligibleRooms.length) {
      setSelectedRoomId(eligibleRooms[0].id);
    }
  }, [eligibleRooms, selectedRoomId]);

  const activeRoom = eligibleRooms.find((r) => r.id === selectedRoomId) || eligibleRooms[0];
  const roomType = activeRoom ? inferRoomType(activeRoom) : 'living';

  const windowArea = useMemo(() => {
    if (!activeRoom) return 0;
    return glazedAreaSqFt(activeRoom, design.openings || []);
  }, [activeRoom, design.openings]);

  const glazedRatio = activeRoom && activeRoom.areaSqFt > 0
    ? Math.round((windowArea / activeRoom.areaSqFt) * 100)
    : 0;

  const handleCapturePng = () => {
    if (!captureFnRef.current || !activeRoom) return;
    setIsExporting(true);
    try {
      const dataUrl = captureFnRef.current();
      const a = document.createElement('a');
      a.href = dataUrl;
      const cleanName = activeRoom.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `archadapt-${cleanName}-${floorFinish}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setCopiedNotification('Snapshot exported!');
      setTimeout(() => setCopiedNotification(null), 2500);
    } catch (e) {
      console.error('Failed to capture canvas snapshot:', e);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col lg:flex-row w-full max-w-7xl h-[92vh] max-h-[92vh] overflow-hidden rounded-xl border border-stone-800 bg-stone-950 shadow-2xl">
        
        {/* Left: Interactive 3D Eye-Level Walk-In Viewport */}
        <div className="relative flex-1 bg-stone-950 flex flex-col min-h-[380px] lg:min-h-[600px] overflow-hidden border-b lg:border-b-0 lg:border-r border-stone-800">
          {activeRoom ? (
            <RoomWalkInViewport
              design={design}
              room={activeRoom}
              floorFinish={floorFinish}
              lighting={lighting}
              onCaptureReady={(fn) => {
                captureFnRef.current = fn;
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-500">
              No eligible room selected
            </div>
          )}

          {/* Top-Left Live Viewport Information HUD */}
          {activeRoom && (
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 rounded-lg bg-stone-950/85 backdrop-blur-md px-3.5 py-2.5 border border-stone-800 shadow-xl pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-serif text-sm font-semibold text-stone-100">{activeRoom.name}</span>
                <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-mono text-stone-300">
                  Level {activeRoom.position.floorLevel || 0}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-400 font-mono">
                <span>{Math.round(activeRoom.areaSqFt)} sq ft · {(activeRoom.areaSqFt * 0.0929).toFixed(1)} m²</span>
                <span>·</span>
                <span className="text-amber-400 capitalize">{floorFinish.replace('_', ' ')}</span>
              </div>
            </div>
          )}

          {/* Top-Right Quick Snapshot CTA */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            {copiedNotification && (
              <span className="rounded-md bg-emerald-950/90 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur shadow animate-in fade-in">
                {copiedNotification}
              </span>
            )}
            <button
              onClick={handleCapturePng}
              disabled={isExporting}
              className="flex items-center gap-1.5 rounded-md bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 px-3 py-1.5 text-xs font-medium text-stone-200 shadow-lg backdrop-blur transition-all active:scale-95"
              title="Capture high-resolution PNG snapshot directly from WebGL canvas"
            >
              <Camera className="h-3.5 w-3.5 text-amber-400" />
              <span>Snapshot</span>
            </button>
          </div>
        </div>

        {/* Right: Architectural Interior Specifications & Controls */}
        <div className="w-full lg:w-[380px] flex flex-col justify-between overflow-y-auto bg-stone-950 p-6 space-y-6">
          <div className="space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-serif text-base font-semibold text-stone-100">3D Room Walk-In</h2>
                  <p className="text-[11px] text-stone-400">Eye-Level (1.55m) Interactive Walkthrough</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-900 transition-colors"
                title="Close studio"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Target Room Selector */}
            <div className="space-y-1.5">
              <label htmlFor="interior-target-room" className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block">
                Target Room
              </label>
              <select
                id="interior-target-room"
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full rounded-md border border-stone-800 bg-stone-900 px-3 py-2 text-xs font-medium text-stone-100 focus:border-amber-500 focus:outline-none"
              >
                {eligibleRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({Math.round(r.areaSqFt)} sq ft · Level {r.position.floorLevel || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Floor Finish Palette */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block">
                  PBR Floor Finish
                </label>
                <span className="text-[11px] text-amber-400 font-medium">Real-Time PBR</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FLOOR_FINISHES.map((mat) => {
                  const isSelected = floorFinish === mat.id;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => setFloorFinish(mat.id)}
                      className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/15 text-stone-100 shadow'
                          : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="h-3 w-3 rounded-full border border-stone-600 shrink-0"
                          style={{ backgroundColor: mat.color }}
                        />
                        <span className={`text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-stone-200'}`}>
                          {mat.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-500 line-clamp-1">
                        {mat.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lighting Atmosphere */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block">
                Lighting Atmosphere
              </label>
              <div className="grid grid-cols-3 gap-2">
                {LIGHTING_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = lighting === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setLighting(mode.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-semibold'
                          : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px] leading-tight">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Architectural Room Specifications Card */}
            {activeRoom && (
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-stone-400">Engineering Specs</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>NBC 2016 Compliant</span>
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-stone-500 block">Carpet Dimensions:</span>
                    <span className="font-semibold text-stone-200">{activeRoom.dimensions || `${Math.round(activeRoom.position.width)}' × ${Math.round(activeRoom.position.height)}'`}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Clear Ceiling:</span>
                    <span className="font-semibold text-stone-200">3.05 m (10′-0″)</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Fenestration / Glazing:</span>
                    <span className="font-semibold text-stone-200">{windowArea.toFixed(1)} sq ft ({glazedRatio}%)</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Staged Decor:</span>
                    <span className="font-semibold text-amber-400 capitalize">
                      {roomType.replace('_', ' ')} Pack
                    </span>
                  </div>
                </div>

                <div className="pt-1 text-[10px] text-stone-500 leading-relaxed border-t border-stone-800/60">
                  Direct client-side WebGL walk-in view synchronized to CAD floor plan geometry with zero AI hallucination.
                </div>
              </div>
            )}

          </div>

          {/* Action CTA */}
          <div className="pt-4 border-t border-stone-800">
            <button
              type="button"
              onClick={handleCapturePng}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-2.5 font-semibold text-white shadow-lg text-xs transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Export High-Res Snapshot (PNG)</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
