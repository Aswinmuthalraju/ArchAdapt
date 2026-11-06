import { DesignSignature, ProgramRoom, RoomRelationship, RoomType } from '@/types/architectural';
import { Rect } from '@/lib/geometry/planGeometry';

/** A room as the optimiser sees it: how big it wants to be and what it needs around it. */
export interface PRoom {
  id: string;
  name: string;
  type: RoomType;
  floor: number;
  /** Area the room asks for (sq ft). */
  target: number;
  minArea: number;
  minSide: number;
  maxAspect: number;
  attachedTo?: string;
  relationships: RoomRelationship[];
  derived: boolean;
  required: boolean;
  /** Weak position hints taken from the programme (0 = road/left, 1 = rear/right). */
  hintY?: number;
  hintX?: number;
  /** Fixed thickness for passages. */
  strip?: number;
  ref?: ProgramRoom;
}

export type ArchId = 'spine' | 'hub' | 'courtyard' | 'wings' | 'compact';

/** A planning idea: the circulation and zoning strategy that the optimiser is asked to realise. */
export interface Archetype {
  id: ArchId;
  label: string;
  summary: string;
  planningType: DesignSignature['planningType'];
  circulationType: DesignSignature['circulationType'];
  /** Adds a dedicated passage strip on floors that have several bedrooms. */
  passage: boolean;
  /** Bedrooms open from a lounge/landing instead of a passage. */
  hub: boolean;
  /** Public and private rooms are pushed to opposite sides of the plan. */
  wings: boolean;
}

export const ARCHETYPES: Record<ArchId, Archetype> = {
  spine: {
    id: 'spine', label: 'Central spine', planningType: 'linear_circulation', circulationType: 'spine', passage: true, hub: false, wings: false,
    summary: 'A passage runs through the house; public rooms sit at the road, bedrooms open off the passage.'
  },
  hub: {
    id: 'hub', label: 'Family hub', planningType: 'compact_core', circulationType: 'central', passage: false, hub: true, wings: false,
    summary: 'A central family lounge and the stair form the hub; rooms open off it, so no floor area is spent on corridors.'
  },
  wings: {
    id: 'wings', label: 'Split wings', planningType: 'zoned_wings', circulationType: 'peripheral', passage: false, hub: true, wings: true,
    summary: 'Public rooms form one wing and bedrooms another, joined at the stair for privacy and quiet.'
  },
  courtyard: {
    id: 'courtyard', label: 'Courtyard house', planningType: 'courtyard_centered', circulationType: 'peripheral', passage: false, hub: false, wings: false,
    summary: 'Rooms are arranged around an open court that brings light and air into the middle of the plan.'
  },
  compact: {
    id: 'compact', label: 'Compact open plan', planningType: 'compact_core', circulationType: 'central', passage: false, hub: false, wings: false,
    summary: 'Living, dining and kitchen run together as one open space with bedrooms tucked behind; the least circulation area.'
  }
};

export interface PairSpec {
  a: string;
  b: string;
  w: number;
  kind: 'adj' | 'near' | 'avoid';
}

export interface FixedCell { room: PRoom; rect: Rect }

export interface EnergyCtx {
  rooms: PRoom[];
  fixed: FixedCell[];
  /** Bounding box of everything on this floor. */
  footprint: Rect;
  /** y of the road-facing edge of the building. */
  frontY: number;
  floor: number;
  floors: number;
  arch: Archetype;
  pairs: PairSpec[];
  hot: boolean;
  compass: Record<'front' | 'rear' | 'left' | 'right', string>;
  /** Wall lines of the ground floor, for structural stacking on upper floors. */
  groundLines?: { xs: number[]; ys: number[]; wet: Rect[] };
  /** Small plots tolerate rooms opening off the living room. */
  tight: boolean;
  /** Extra per-room-type adjacency weights from the AI brief, keyed "typeA|typeB". */
  typeAffinity?: Record<string, number>;
  /** Multiplies the cost of hard-rule violations (too small, unreachable, not enclosed) during repair passes. */
  hardBoost?: number;
}
