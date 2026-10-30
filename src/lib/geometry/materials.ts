import { HouseAppearance, ArchitecturalStyle } from '@/types/architectural';

export interface MaterialProperties {
  color: string;
  roughness: number;
  metalness: number;
  transmission?: number;
  opacity?: number;
  transparent?: boolean;
}

export interface HouseMaterialSystem {
  wall: MaterialProperties;
  roof: MaterialProperties;
  frame: MaterialProperties;
  glass: MaterialProperties;
  plinth: MaterialProperties;
  woodAccent: MaterialProperties;
  stoneAccent: MaterialProperties;
  lawn: MaterialProperties;
  driveway: MaterialProperties;
}

export const WALL_COLOR_PRESETS = [
  { name: 'Ivory', hex: '#F4F1EA' },
  { name: 'White', hex: '#FAFAFA' },
  { name: 'Sand', hex: '#E6DFD3' },
  { name: 'Warm Grey', hex: '#D5D0C7' },
  { name: 'Cool Grey', hex: '#B0B5BC' },
  { name: 'Terracotta', hex: '#C86A4B' }
];

export const ROOF_COLOR_PRESETS = [
  { name: 'Terracotta', hex: '#C86A4B' },
  { name: 'Dark Brown', hex: '#4A3525' },
  { name: 'Charcoal', hex: '#282623' },
  { name: 'Slate', hex: '#3A424B' },
  { name: 'Grey', hex: '#63666A' }
];

export const FRAME_COLOR_PRESETS = [
  { name: 'Black', hex: '#121417' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Dark Brown', hex: '#3B2A1E' },
  { name: 'Aluminium Grey', hex: '#78736A' }
];

export const DEFAULT_APPEARANCE_BY_STYLE: Record<string, HouseAppearance> = {
  'Kerala Traditional': {
    wallColor: '#F5EBE1',
    roofColor: '#BF573F',
    frameColor: '#3E2723',
    accentMaterial: 'wood'
  },
  'Modern': {
    wallColor: '#F8F9FA',
    roofColor: '#2D3139',
    frameColor: '#1A1D20',
    accentMaterial: 'wood'
  },
  'Minimalist': {
    wallColor: '#ECEEF0',
    roofColor: '#1E2229',
    frameColor: '#111315',
    accentMaterial: 'concrete'
  },
  'Contemporary': {
    wallColor: '#E3DDD3',
    roofColor: '#374151',
    frameColor: '#1F2937',
    accentMaterial: 'stone'
  },
  'Colonial': {
    wallColor: '#FBF8F1',
    roofColor: '#382E2B',
    frameColor: '#FFFFFF',
    accentMaterial: 'wood'
  },
  'Tropical': {
    wallColor: '#E8DFCE',
    roofColor: '#4A3728',
    frameColor: '#2C221E',
    accentMaterial: 'wood'
  },
  'Traditional Indian': {
    wallColor: '#EADCC3',
    roofColor: '#B34A34',
    frameColor: '#422518',
    accentMaterial: 'stone'
  },
  'Modern Luxury': {
    wallColor: '#EBE7DE',
    roofColor: '#18191B',
    frameColor: '#252321',
    accentMaterial: 'stone'
  }
};

/**
 * Computes Three.js procedural material definitions based on user appearance overrides and active style.
 */
export function getHouseMaterials(
  appearance?: HouseAppearance,
  styleName?: string
): HouseMaterialSystem {
  const styleDefaults = DEFAULT_APPEARANCE_BY_STYLE[styleName || 'Modern'] || DEFAULT_APPEARANCE_BY_STYLE['Modern'];

  const wallColor = appearance?.wallColor || styleDefaults.wallColor;
  const roofColor = appearance?.roofColor || styleDefaults.roofColor;
  const frameColor = appearance?.frameColor || styleDefaults.frameColor;
  const accentType = appearance?.accentMaterial || styleDefaults.accentMaterial;

  let accentColor = '#8C5A3C'; // Wood default
  if (accentType === 'stone') accentColor = '#605B54';
  else if (accentType === 'concrete') accentColor = '#8A8680';

  const isLuxury = styleName === 'Modern Luxury';
  const isMinimalist = styleName === 'Minimalist';

  return {
    wall: { color: wallColor, roughness: isMinimalist ? 0.35 : 0.58, metalness: 0.02 },
    roof: { color: roofColor, roughness: 0.62, metalness: isLuxury ? 0.18 : 0.06 },
    frame: { color: frameColor, roughness: isLuxury ? 0.22 : 0.32, metalness: isLuxury ? 0.65 : 0.4 },
    glass: { color: '#2B5B84', roughness: 0.08, metalness: 0.85, transmission: 0.88, opacity: 0.82, transparent: true },
    plinth: { color: '#D5D0C7', roughness: 0.82, metalness: 0.04 },
    woodAccent: { color: '#8C5A3C', roughness: 0.72, metalness: 0.04 },
    stoneAccent: { color: accentColor, roughness: 0.85, metalness: 0.05 },
    lawn: { color: '#4A6B5D', roughness: 0.95, metalness: 0.0 },
    driveway: { color: '#A8A297', roughness: 0.85, metalness: 0.05 }
  };
}
