'use client';

import React from 'react';
import { HouseAppearance } from '@/types/architectural';
import { WALL_COLOR_PRESETS, ROOF_COLOR_PRESETS, FRAME_COLOR_PRESETS } from '@/lib/geometry/materials';
import { Palette, X } from 'lucide-react';

interface AppearancePanelProps {
  appearance: HouseAppearance;
  onChange: (updated: HouseAppearance) => void;
  onClose: () => void;
}

export default function AppearancePanel({ appearance, onChange, onClose }: AppearancePanelProps) {
  return (
    <div className="absolute right-5 top-[4.75rem] z-30 w-80 animate-rise border border-gold-400/40 bg-plum-850/95 p-5 text-stone-100 shadow-lift backdrop-blur-md space-y-5">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-plum-700 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gold-200">
          <Palette className="h-4 w-4 text-gold-300" />
          <span>House appearance</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-stone-400 hover:text-gold-200 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Wall colour */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-300">Wall colour</label>
        <div className="flex items-center gap-2">
          {WALL_COLOR_PRESETS.map((preset) => {
            const isSelected = appearance.wallColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.name}
                onClick={() => onChange({ ...appearance, wallColor: preset.hex })}
                className={`h-7 w-7 rounded-full border transition-all ${
                  isSelected ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-plum-850 scale-110 border-transparent' : 'border-plum-600 hover:scale-105'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            );
          })}
          <input
            type="color"
            value={appearance.wallColor}
            onChange={(e) => onChange({ ...appearance, wallColor: e.target.value })}
            className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            title="Custom Wall Color"
          />
        </div>
      </div>

      {/* Roof colour */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-300">Roof colour</label>
        <div className="flex items-center gap-2">
          {ROOF_COLOR_PRESETS.map((preset) => {
            const isSelected = appearance.roofColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.name}
                onClick={() => onChange({ ...appearance, roofColor: preset.hex })}
                className={`h-7 w-7 rounded-full border transition-all ${
                  isSelected ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-plum-850 scale-110 border-transparent' : 'border-plum-600 hover:scale-105'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            );
          })}
          <input
            type="color"
            value={appearance.roofColor}
            onChange={(e) => onChange({ ...appearance, roofColor: e.target.value })}
            className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            title="Custom Roof Color"
          />
        </div>
      </div>

      {/* Window Frame Color */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-300">Window and door frames</label>
        <div className="flex items-center gap-2">
          {FRAME_COLOR_PRESETS.map((preset) => {
            const isSelected = appearance.frameColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.name}
                onClick={() => onChange({ ...appearance, frameColor: preset.hex })}
                className={`h-7 w-7 rounded-full border transition-all ${
                  isSelected ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-plum-850 scale-110 border-transparent' : 'border-plum-600 hover:scale-105'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            );
          })}
        </div>
      </div>

      {/* Accent Material */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-300">Facade accent</label>
        <div className="grid grid-cols-3 gap-2">
          {(['wood', 'stone', 'concrete'] as const).map((mat) => {
            const isSelected = appearance.accentMaterial === mat;
            return (
              <button
                key={mat}
                onClick={() => onChange({ ...appearance, accentMaterial: mat })}
                className={`py-2 text-sm capitalize border text-center transition-colors ${
                  isSelected
                    ? 'border-gold-400 bg-gold-400 font-semibold text-plum-950'
                    : 'border-plum-600 text-stone-300 hover:border-gold-400'
                }`}
              >
                {mat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 text-xs text-stone-400 border-t border-plum-700">
        Changes affect the 3D model only. The 2D plan is not altered.
      </div>
    </div>
  );
}
