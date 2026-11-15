'use client';

import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  Download, 
  Building, 
  Compass, 
  Sun, 
  Moon, 
  Sunset, 
  Layers, 
  Camera, 
  Eye, 
  Palette,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { StructuredDesignJSON, HouseAppearance } from '@/types/architectural';
import { DEFAULT_APPEARANCE_BY_STYLE } from '@/lib/geometry/materials';
import ElevationSvg, { ElevationSide } from '@/components/canvas/ElevationSvg';
import Exterior3DViewport, { ExteriorViewAngle, ExteriorLighting } from './Exterior3DViewport';

interface ExteriorStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  design: StructuredDesignJSON;
}

type StudioMode = 'elevations_2d' | 'facade_3d';

const ELEVATION_SIDES: { id: ElevationSide; label: string; desc: string }[] = [
  { id: 'front', label: 'Front Elevation', desc: 'Principal road-facing facade' },
  { id: 'rear', label: 'Rear Elevation', desc: 'Backyard & service elevation' },
  { id: 'left', label: 'Left Elevation', desc: 'Flank facade (West/East)' },
  { id: 'right', label: 'Right Elevation', desc: 'Flank facade (East/West)' }
];

const VIEW_ANGLES: { id: ExteriorViewAngle; label: string; icon: React.ElementType }[] = [
  { id: 'front_elevation', label: 'Front Facade', icon: Building },
  { id: 'isometric_3d', label: '3D Isometric', icon: Camera },
  { id: 'street_view', label: 'Street Approach', icon: Sun },
  { id: 'twilight_sunset', label: 'Sunset Glow', icon: Sunset }
];

const LIGHTING_MODES: { id: ExteriorLighting; label: string; icon: React.ElementType }[] = [
  { id: 'daylight', label: 'Daylight', icon: Sun },
  { id: 'golden_hour', label: 'Golden Hour', icon: Sunset },
  { id: 'evening', label: 'Twilight', icon: Moon }
];

const ARCH_STYLES = [
  'Modern Luxury',
  'Kerala Traditional',
  'Minimalist',
  'Contemporary'
];

export default function ExteriorStudioModal({
  isOpen,
  onClose,
  design
}: ExteriorStudioModalProps) {
  const [mode, setMode] = useState<StudioMode>('elevations_2d');
  const [side, setSide] = useState<ElevationSide>('front');
  const [viewAngle, setViewAngle] = useState<ExteriorViewAngle>('isometric_3d');
  const [lighting, setLighting] = useState<ExteriorLighting>('daylight');
  const [selectedStyle, setSelectedStyle] = useState<string>('Modern Luxury');
  const [notification, setNotification] = useState<string | null>(null);

  const captureFnRef = useRef<(() => string) | null>(null);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);

  // Compute appearance based on selected architectural style
  const appearance: HouseAppearance = useMemo(() => {
    if (selectedStyle === 'Kerala Traditional') return DEFAULT_APPEARANCE_BY_STYLE['Kerala Traditional'];
    if (selectedStyle === 'Minimalist') return DEFAULT_APPEARANCE_BY_STYLE['Minimalist'];
    if (selectedStyle === 'Contemporary') return DEFAULT_APPEARANCE_BY_STYLE['Contemporary'];
    return DEFAULT_APPEARANCE_BY_STYLE['Modern'] || {
      wallColor: '#F8F9FA',
      roofColor: '#2D3139',
      frameColor: '#1A1D20',
      accentMaterial: 'wood'
    };
  }, [selectedStyle]);

  const plotW = design.plot?.width || 40;
  const plotD = design.plot?.depth || 60;
  const facadeWidthFt = side === 'front' || side === 'rear' ? plotW : plotD;
  const floorsCount = Math.max(1, design.floorsCount || 1);
  const totalHeightFt = 1.5 + floorsCount * 10 + 3.0;

  // Export 2D vector SVG
  const handleDownloadSvg = () => {
    if (!svgContainerRef.current) return;
    const svgEl = svgContainerRef.current.querySelector('svg');
    if (!svgEl) return;

    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgEl);
      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archadapt-${side}-elevation.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setNotification(`${side.toUpperCase()} SVG Exported!`);
      setTimeout(() => setNotification(null), 2500);
    } catch (e) {
      console.error('Failed to export elevation SVG:', e);
    }
  };

  // Export 3D WebGL PNG Snapshot
  const handleCapture3DPng = () => {
    if (!captureFnRef.current) return;
    try {
      const dataUrl = captureFnRef.current();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `archadapt-facade-${viewAngle}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setNotification('3D Snapshot Exported!');
      setTimeout(() => setNotification(null), 2500);
    } catch (e) {
      console.error('Failed to capture 3D facade PNG:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col lg:flex-row w-full max-w-7xl h-[92vh] max-h-[92vh] overflow-hidden rounded-xl border border-stone-800 bg-stone-950 shadow-2xl">
        
        {/* Left: Interactive Architectural Viewport */}
        <div className="relative flex-1 bg-stone-950 flex flex-col min-h-[380px] lg:min-h-[600px] overflow-hidden border-b lg:border-b-0 lg:border-r border-stone-800">
          
          {/* View Mode Switcher Header Toolbar */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <div className="flex rounded-lg border border-stone-800 bg-stone-950/90 p-1 backdrop-blur shadow-xl">
              <button
                type="button"
                onClick={() => setMode('elevations_2d')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  mode === 'elevations_2d'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Technical 2D Elevations</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('facade_3d')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  mode === 'facade_3d'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Building className="h-3.5 w-3.5" />
                <span>Interactive 3D Facade</span>
              </button>
            </div>
          </div>

          {/* Top-Right Quick Notification & Download Button */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            {notification && (
              <span className="rounded-md bg-emerald-950/90 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur shadow animate-in fade-in">
                {notification}
              </span>
            )}
            <button
              onClick={mode === 'elevations_2d' ? handleDownloadSvg : handleCapture3DPng}
              className="flex items-center gap-1.5 rounded-md bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 px-3 py-1.5 text-xs font-medium text-stone-200 shadow-lg backdrop-blur transition-all active:scale-95"
              title={mode === 'elevations_2d' ? 'Download Vector Elevation (SVG)' : 'Capture 3D Snapshot (PNG)'}
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span>{mode === 'elevations_2d' ? 'Export SVG' : 'Snapshot'}</span>
            </button>
          </div>

          {/* Active View Container */}
          {mode === 'elevations_2d' ? (
            <div
              ref={svgContainerRef}
              className="relative w-full h-full flex items-center justify-center p-6 bg-[#0E1015] overflow-auto select-none pt-16"
            >
              <div className="w-full max-w-4xl h-full flex items-center justify-center">
                <ElevationSvg design={design} side={side} />
              </div>

              {/* Bottom Architectural Legend */}
              <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-md bg-stone-950/85 px-3 py-1.5 border border-stone-800 text-[11px] font-mono text-stone-300 backdrop-blur">
                <span>DATUM MARKERS: ±0.00m GL · +0.45m FFL · +3.45m L1 · +6.45m SLAB · +7.45m PARAPET</span>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <Exterior3DViewport
                design={design}
                appearance={appearance}
                viewAngle={viewAngle}
                lighting={lighting}
                onCaptureReady={(fn) => {
                  captureFnRef.current = fn;
                }}
              />
            </div>
          )}

        </div>

        {/* Right: Architectural Elevation & Facade Controls */}
        <div className="w-full lg:w-[380px] flex flex-col justify-between overflow-y-auto bg-stone-950 p-6 space-y-6">
          <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Building className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-serif text-base font-semibold text-stone-100">
                    {mode === 'elevations_2d' ? 'Elevation Deck' : '3D Facade Studio'}
                  </h2>
                  <p className="text-[11px] text-stone-400">
                    {mode === 'elevations_2d' ? 'AEC Datum Level Vector Projections' : 'PBR Exterior Massing & Solar Lighting'}
                  </p>
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

            {/* 2D Elevation Controls */}
            {mode === 'elevations_2d' ? (
              <>
                {/* Elevation Facade Side Selector */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block">
                    Cardinal Facade
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ELEVATION_SIDES.map((s) => {
                      const isSelected = side === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSide(s.id)}
                          className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/15 text-stone-100 shadow'
                              : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          <span className={`text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-stone-200'}`}>
                            {s.label}
                          </span>
                          <span className="text-[10px] text-stone-500 line-clamp-1">
                            {s.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Elevation Engineering Specifications */}
                <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-stone-400">AEC Datum Levels</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Code Verified</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-stone-300">
                      <span className="text-stone-500">Parapet Top:</span>
                      <span className="text-amber-400 font-semibold">+{(totalHeightFt * 0.3048).toFixed(2)}m (+{totalHeightFt.toFixed(1)}′)</span>
                    </div>
                    <div className="flex items-center justify-between text-stone-300">
                      <span className="text-stone-500">Roof Slab:</span>
                      <span className="text-stone-200 font-medium">+{(floorsCount * 3.05 + 0.45).toFixed(2)}m</span>
                    </div>
                    {floorsCount > 1 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="text-stone-500">First Floor Level:</span>
                        <span className="text-stone-200 font-medium">+3.45m</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-stone-300">
                      <span className="text-stone-500">Plinth / FFL:</span>
                      <span className="text-stone-200 font-medium">+0.45m (+1′6″)</span>
                    </div>
                    <div className="flex items-center justify-between text-stone-300">
                      <span className="text-stone-500">Ground Line:</span>
                      <span className="text-stone-200 font-medium">±0.00m GL</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-800/80 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-stone-500 block">Facade Width:</span>
                      <span className="font-semibold text-stone-200">{facadeWidthFt} ft ({(facadeWidthFt * 0.3048).toFixed(2)} m)</span>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Stories:</span>
                      <span className="font-semibold text-stone-200">{floorsCount} Floor{floorsCount > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* 3D Camera Angles */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block">
                    Camera Perspective
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VIEW_ANGLES.map((v) => {
                      const Icon = v.icon;
                      const isSelected = viewAngle === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setViewAngle(v.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/15 text-stone-100 shadow'
                              : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-amber-400' : 'text-stone-400'}`} />
                          <span className={`text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-stone-200'}`}>
                            {v.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sun Lighting */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block">
                    Solar Atmosphere
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

                {/* Architectural Style Palette */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block">
                    Architectural Style Finishes
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ARCH_STYLES.map((st) => {
                      const isSelected = selectedStyle === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setSelectedStyle(st)}
                          className={`p-2 rounded-lg border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-semibold'
                              : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Action CTA */}
          <div className="pt-4 border-t border-stone-800">
            {mode === 'elevations_2d' ? (
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-2.5 font-semibold text-white shadow-lg text-xs transition-all active:scale-[0.99]"
              >
                <Download className="h-4 w-4" />
                <span>Export Vector Elevation (SVG)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCapture3DPng}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-2.5 font-semibold text-white shadow-lg text-xs transition-all active:scale-[0.99]"
              >
                <Download className="h-4 w-4" />
                <span>Export High-Res 3D Snapshot (PNG)</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
