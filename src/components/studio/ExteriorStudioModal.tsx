'use client';

import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  Camera, 
  Sun, 
  Moon, 
  Sunset, 
  Building, 
  RefreshCw 
} from 'lucide-react';
import { StructuredDesignJSON } from '@/types/architectural';
import { captureViewport } from '@/lib/rendering/viewportCapture';

interface ExteriorStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  design: StructuredDesignJSON;
}

const ANGLES = [
  { id: 'front_elevation', label: 'Front Elevation', icon: Building },
  { id: 'isometric_3d', label: '3D Isometric', icon: Camera },
  { id: 'street_view', label: 'Street-Level Approach', icon: Sun },
  { id: 'twilight_sunset', label: 'Twilight Sunset Glow', icon: Sunset }
];

const STYLES = [
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
  const [viewAngle, setViewAngle] = useState<string>('front_elevation');
  const [selectedStyle, setSelectedStyle] = useState<string>('Modern Luxury');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [renderResult, setRenderResult] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null); // live 3D capture shown when the AI render fails

  const handleGenerate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setPreview(null);
    const reference = captureViewport();
    try {
      const res = await fetch('/api/render/exterior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design, style: selectedStyle, viewAngle, reference })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || `Render failed (HTTP ${res.status}).`);
      setRenderResult(data);
    } catch (err: any) {
      setError(err?.message || 'Render failed.');
      setPreview(reference);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col lg:flex-row w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-xl border border-stone-800 bg-stone-950 shadow-2xl">
        
        {/* Left: 4K Render Output Canvas */}
        <div className="relative flex-1 bg-stone-900 flex flex-col items-center justify-center min-h-[380px] lg:min-h-[600px] overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-amber-400">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <span className="text-xs font-mono uppercase tracking-widest text-stone-300">
                Rendering facade… this can take up to a minute
              </span>
            </div>
          ) : error ? (
            <div className="max-w-sm p-8 text-center text-sm text-red-300" role="alert">
              <p className="font-semibold mb-1">Could not render the facade</p>
              <p className="text-red-300/80">{error}</p>
              {preview && (
                <div className="mt-4">
                  <img src={preview} alt="Live 3D view of your design" className="max-h-64 w-auto mx-auto rounded border border-stone-700" />
                  <p className="mt-1 text-[11px] text-stone-400">3D preview of your model (not an AI render)</p>
                </div>
              )}
            </div>
          ) : renderResult?.imageUrl ? (
            <div className="relative w-full h-full flex items-center justify-center p-3">
              <img
                src={renderResult.imageUrl}
                alt={`AI facade render, ${renderResult.style}`}
                className="max-h-[560px] w-auto max-w-full rounded-lg object-contain shadow-2xl border border-stone-800"
              />
              <div className="absolute top-6 left-6 rounded-md bg-stone-950/80 backdrop-blur px-3 py-1.5 border border-stone-700 text-xs text-stone-200 shadow">
                <span className="font-semibold text-amber-400">{renderResult.style}</span> · {renderResult.viewAngle?.replace(/_/g, ' ')}
              </div>
              <a
                href={renderResult.imageUrl}
                download="archadapt-facade.png"
                className="absolute bottom-6 right-6 flex items-center gap-1.5 rounded-md bg-stone-900/90 hover:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-200 border border-stone-700 shadow backdrop-blur transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PNG</span>
              </a>
            </div>
          ) : (
            <div className="text-center p-8 text-stone-500">
              <Building className="h-10 w-10 mx-auto text-amber-500/40 mb-3" />
              <p className="text-sm">Select a view and style, then press Render.</p>
            </div>
          )}
        </div>

        {/* Right: Architectural Elevation Controls */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-stone-800 p-6 flex flex-col justify-between overflow-y-auto bg-stone-950">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-amber-400" />
                <h2 className="font-serif text-lg font-semibold text-stone-100">Facade Studio</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1 text-stone-400 hover:text-stone-100 hover:bg-stone-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Camera Elevation Angles */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-stone-400 block">
                Camera Perspective
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {ANGLES.map((angle) => {
                  const Icon = angle.icon;
                  return (
                    <button
                      key={angle.id}
                      type="button"
                      onClick={() => setViewAngle(angle.id)}
                      className={`flex items-center gap-2 rounded border p-2 text-xs text-left transition-all ${
                        viewAngle === angle.id
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-semibold'
                          : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{angle.label}</span>
                    </button>
                  );
                })}
              </div>
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

            {renderResult?.basis && (
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-3.5 space-y-1 text-xs">
                <span className="font-bold text-[11px] uppercase tracking-wider text-amber-400 block">Generated from your plan</span>
                <p className="text-stone-300 text-[11px]">{renderResult.basis.floors} storey · plot {renderResult.basis.plot}</p>
                <p className={`text-[11px] ${renderResult.anchoredTo3D ? 'text-emerald-400' : 'text-amber-400'}`}>{renderResult.anchoredTo3D ? 'Anchored to your 3D model view' : 'Not anchored to the 3D model: open the 3D tab first for a closer match'}</p>
                <p className="text-stone-500 text-[11px]">AI imagery is an illustration of the massing described, not a drawing. Window positions and details may differ from the plan.</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-stone-800">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-2.5 font-semibold text-white shadow-lg text-xs transition-all disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isLoading ? 'Rendering…' : renderResult ? 'Render again' : 'Render facade'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
