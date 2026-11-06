'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Lightformer, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { StructuredDesignJSON, HouseAppearance } from '@/types/architectural';
import { buildHouseGeometry, Box3D, HouseGeometry3D, RoomMesh3D } from '@/lib/geometry/buildHouseGeometry';
import { getHouseMaterials, HouseMaterialSystem } from '@/lib/geometry/materials';
import { floorName } from '@/lib/design/roomTypes';
import AppearancePanel from '@/components/workspace/AppearancePanel';
import { Palette, Home, LocateFixed, Eye, Scissors, Layers, Compass, Check, X } from 'lucide-react';

export interface Massing3DViewerProps {
  design: StructuredDesignJSON;
  onAppearanceChange?: (updatedAppearance: HouseAppearance) => void;
  selectedRoomId?: string;
  onRoomSelect?: (roomId: string | null) => void;
}

type LightingMode = 'day' | 'evening' | 'night';
type ViewPreset = 'orbit' | 'walk' | 'front' | 'rear' | 'left' | 'right' | 'top' | 'iso';

const DEFAULT_APPEARANCE: HouseAppearance = { wallColor: '#F4F1EA', roofColor: '#66764F', frameColor: '#232822', accentMaterial: 'wood' };

const SCENES: Record<LightingMode, { background: string; ground: string; hemi: [string, string, number]; sun: { position: [number, number, number]; color: string; intensity: number }; exposure: number; glow: number }> = {
  day: { background: '#EDE6DC', ground: '#E3DACD', hemi: ['#FFF7EA', '#CDBFAF', 0.75], sun: { position: [16, 26, -14], color: '#FFF4E0', intensity: 2.4 }, exposure: 1, glow: 0 },
  evening: { background: '#394338', ground: '#2B332B', hemi: ['#FFB38A', '#3E4B3B', 0.5], sun: { position: [26, 10, -6], color: '#FF9A63', intensity: 2 }, exposure: 1.05, glow: 0.35 },
  night: { background: '#171C19', ground: '#1C231D', hemi: ['#6B4C8F', '#171C19', 0.28], sun: { position: [-12, 22, 10], color: '#B9A6FF', intensity: 0.5 }, exposure: 1.1, glow: 0.85 }
};

const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** Merges many boxes into one geometry so a whole class of parts is a single draw call. */
function mergeBoxes(boxes: Box3D[]): THREE.BufferGeometry | null {
  if (!boxes.length) return null;
  const matrix = new THREE.Matrix4();
  const parts = boxes.map((box) => {
    const geometry = unitBox.clone();
    matrix.compose(new THREE.Vector3(...box.position), new THREE.Quaternion(), new THREE.Vector3(...box.size));
    geometry.applyMatrix4(matrix);
    return geometry;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

/** Builds a mesh from merged boxes and disposes the geometry when the parts change. */
function Merged({ boxes, children, castShadow = true, receiveShadow = true }: { boxes: Box3D[]; children: React.ReactNode; castShadow?: boolean; receiveShadow?: boolean }) {
  const geometry = useMemo(() => mergeBoxes(boxes), [boxes]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow}>
      {children}
    </mesh>
  );
}

function RoofMesh({ roof, materials, clipPlane }: { roof: HouseGeometry3D['roofs'][0]; materials: HouseMaterialSystem; clipPlane?: THREE.Plane | null }) {
  const planes = clipPlane ? [clipPlane] : [];
  const roofMaterial = <meshStandardMaterial color={materials.roof.color} roughness={materials.roof.roughness} metalness={materials.roof.metalness} clippingPlanes={planes} clipShadows />;
  const [width, height, depth] = roof.size;

  // Kerala Traditional: steep terracotta hip with timber eave soffits
  if (roof.type === 'sloped_hipped_gable') {
    return (
      <group position={roof.position}>
        <group scale={[width / Math.SQRT2, 1, depth / Math.SQRT2]}>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <coneGeometry args={[1, height, 4]} />
            {roofMaterial}
          </mesh>
        </group>
        <mesh position={[0, -height / 2 + 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.1, depth]} />
          <meshStandardMaterial color="#8C5A3C" roughness={0.7} clippingPlanes={planes} clipShadows />
        </mesh>
      </group>
    );
  }

  // Traditional Indian: terracotta hip with stepped stone cornice base
  if (roof.type === 'traditional_indian_gable') {
    return (
      <group position={roof.position}>
        <group scale={[width / Math.SQRT2, 1, depth / Math.SQRT2]}>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <coneGeometry args={[1, height, 4]} />
            {roofMaterial}
          </mesh>
        </group>
        <mesh position={[0, -height / 2 + 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.08, depth]} />
          <meshStandardMaterial color="#CBB996" roughness={0.85} clippingPlanes={planes} clipShadows />
        </mesh>
        <mesh position={[0, -height / 2 - 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.2, 0.08, depth - 0.2]} />
          <meshStandardMaterial color="#B0A080" roughness={0.88} clippingPlanes={planes} clipShadows />
        </mesh>
      </group>
    );
  }

  // Tropical: low-pitch wide floating pavilion canopy with timber rafter reveal
  if (roof.type === 'tropical_pitched_canopy') {
    return (
      <group position={roof.position}>
        <group scale={[width / Math.SQRT2, 1, depth / Math.SQRT2]}>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <coneGeometry args={[1, height, 4]} />
            {roofMaterial}
          </mesh>
        </group>
        <mesh position={[0, -height / 2 + 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[width * 0.96, 0.08, depth * 0.96]} />
          <meshStandardMaterial color="#4A3728" roughness={0.8} clippingPlanes={planes} clipShadows />
        </mesh>
      </group>
    );
  }

  // Colonial: colonial hip with classical white stepped cornice
  if (roof.type === 'colonial_hipped') {
    return (
      <group position={roof.position}>
        <group scale={[width / Math.SQRT2, 1, depth / Math.SQRT2]}>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <coneGeometry args={[1, height, 4]} />
            {roofMaterial}
          </mesh>
        </group>
        <mesh position={[0, -height / 2 + 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.12, depth]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} clippingPlanes={planes} clipShadows />
        </mesh>
        <mesh position={[0, -height / 2 - 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.15, 0.08, depth - 0.15]} />
          <meshStandardMaterial color="#FAF8F5" roughness={0.45} clippingPlanes={planes} clipShadows />
        </mesh>
      </group>
    );
  }

  // Minimalist: razor-thin flush monolithic slab
  if (roof.type === 'minimal_slab') {
    return (
      <mesh position={roof.position} castShadow receiveShadow>
        <boxGeometry args={roof.size} />
        {roofMaterial}
      </mesh>
    );
  }

  // Modern Luxury: floating cantilever double-slab with recessed dark bronze reveal
  if (roof.type === 'floating_cantilever_slab') {
    return (
      <group position={roof.position}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={roof.size} />
          {roofMaterial}
        </mesh>
        <mesh position={[0, -roof.size[1] / 2 + 0.04, 0]} castShadow>
          <boxGeometry args={[roof.size[0] - 0.2, 0.08, roof.size[2] - 0.2]} />
          <meshStandardMaterial color="#3A3025" roughness={0.3} metalness={0.7} clippingPlanes={planes} clipShadows />
        </mesh>
      </group>
    );
  }

  // Contemporary: asymmetrical stepped split parapet
  if (roof.type === 'contemporary_split_parapet') {
    return (
      <group position={roof.position}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={roof.size} />
          {roofMaterial}
        </mesh>
        <mesh position={[roof.size[0] * 0.1, roof.size[1] / 2 + 0.08, 0]} castShadow>
          <boxGeometry args={[roof.size[0] * 0.7, 0.16, roof.size[2] + 0.06]} />
          <meshStandardMaterial color="#475569" roughness={0.45} metalness={0.15} clippingPlanes={planes} clipShadows />
        </mesh>
      </group>
    );
  }

  // Default Modern: flat roof with parapet rim
  return (
    <group position={roof.position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={roof.size} />
        {roofMaterial}
      </mesh>
      <mesh position={[0, roof.size[1] / 2 + 0.05, 0]} castShadow>
        <boxGeometry args={[roof.size[0] + 0.08, 0.1, roof.size[2] + 0.08]} />
        <meshStandardMaterial color="#9C8F86" roughness={0.5} clippingPlanes={planes} clipShadows />
      </mesh>
    </group>
  );
}

function BuildingModel({
  geometry,
  materials,
  mode,
  visibleUpTo,
  showRoof,
  selectedRoomId,
  hoveredRoomId,
  onRoomSelect,
  setHoveredRoomId,
  clipPlane
}: {
  geometry: HouseGeometry3D;
  materials: HouseMaterialSystem;
  mode: LightingMode;
  visibleUpTo: number;
  showRoof: boolean;
  selectedRoomId?: string;
  hoveredRoomId?: string | null;
  onRoomSelect?: (id: string | null) => void;
  setHoveredRoomId: (id: string | null) => void;
  clipPlane?: THREE.Plane | null;
}) {
  const scene = SCENES[mode];
  const planes = clipPlane ? [clipPlane] : [];

  const parts = useMemo(() => {
    const shown = <T extends { floorLevel: number }>(items: T[]) => items.filter((item) => item.floorLevel <= visibleUpTo);
    const groups = new Map<string, Box3D[]>();
    for (const room of shown(geometry.rooms)) groups.set(room.color, [...(groups.get(room.color) || []), room]);
    return {
      floors: Array.from(groups.entries()),
      ceilings: shown(geometry.ceilings).filter((ceiling) => (showRoof && !clipPlane) || ceiling.floorLevel < visibleUpTo),
      walls: shown(geometry.walls),
      frames: shown(geometry.frames),
      doors: shown(geometry.openings).filter((o) => o.kind === 'door'),
      glass: shown(geometry.openings).filter((o) => o.kind !== 'door'),
      steps: shown(geometry.stairSteps),
      railings: shown(geometry.railings),
      pillars: shown(geometry.pillars),
      interactiveRooms: shown(geometry.rooms)
    };
  }, [geometry, visibleUpTo, showRoof, clipPlane]);

  return (
    <group>
      {/* Plot and driveway */}
      <mesh position={geometry.plotPosition} receiveShadow>
        <boxGeometry args={geometry.plotSize} />
        <meshStandardMaterial color={materials.lawn.color} roughness={materials.lawn.roughness} />
      </mesh>
      <mesh position={geometry.drivewayPosition} receiveShadow>
        <boxGeometry args={geometry.drivewaySize} />
        <meshStandardMaterial color={materials.driveway.color} roughness={materials.driveway.roughness} />
      </mesh>

      {/* Merged Floor Plates */}
      {parts.floors.map(([color, boxes]) => (
        <Merged key={color} boxes={boxes} castShadow={false}>
          <meshStandardMaterial color={color} roughness={0.7} clippingPlanes={planes} clipShadows />
        </Merged>
      ))}

      {/* Merged Ceilings */}
      <Merged boxes={parts.ceilings}>
        <meshStandardMaterial color="#D9D0C4" roughness={0.75} clippingPlanes={planes} clipShadows />
      </Merged>

      {/* Merged Walls */}
      <Merged boxes={parts.walls}>
        <meshStandardMaterial color={materials.wall.color} roughness={materials.wall.roughness} metalness={materials.wall.metalness} clippingPlanes={planes} clipShadows />
      </Merged>

      {/* Merged Door/Window Frames */}
      <Merged boxes={parts.frames}>
        <meshStandardMaterial color={materials.frame.color} roughness={materials.frame.roughness} metalness={materials.frame.metalness} clippingPlanes={planes} clipShadows />
      </Merged>

      {/* Merged Doors */}
      <Merged boxes={parts.doors}>
        <meshStandardMaterial color={materials.woodAccent.color} roughness={materials.woodAccent.roughness} clippingPlanes={planes} clipShadows />
      </Merged>

      {/* Merged Glass Panes */}
      <Merged boxes={parts.glass} castShadow={false}>
        <meshPhysicalMaterial
          color={mode === 'day' ? '#9DB7C4' : '#FCE9B0'}
          transparent
          opacity={mode === 'day' ? 0.5 : 0.8}
          roughness={0.05}
          metalness={0.15}
          clearcoat={1}
          emissive={mode === 'day' ? '#000000' : '#FFC773'}
          emissiveIntensity={scene.glow}
          clippingPlanes={planes}
          clipShadows
        />
      </Merged>

      {/* Merged Stair Steps */}
      <Merged boxes={parts.steps}>
        <meshStandardMaterial color="#B9AEA2" roughness={0.65} clippingPlanes={planes} clipShadows />
      </Merged>

      {/* Merged Railings */}
      <Merged boxes={parts.railings} castShadow={false}>
        <meshPhysicalMaterial color="#B1BCA0" transparent opacity={0.55} roughness={0.2} metalness={0.4} clippingPlanes={planes} clipShadows />
      </Merged>

      {/* Pillars */}
      {parts.pillars.map((pillar, index) => (
        <mesh key={`pillar-${index}`} position={pillar.position} castShadow receiveShadow>
          <cylinderGeometry args={[pillar.radius, pillar.radius, pillar.height, 20]} />
          <meshStandardMaterial color={materials.woodAccent.color} roughness={materials.woodAccent.roughness} clippingPlanes={planes} clipShadows />
        </mesh>
      ))}

      {/* Roof */}
      {showRoof && !clipPlane && visibleUpTo >= geometry.totalFloors - 1 && geometry.roofs.map((roof, index) => (
        <RoofMesh key={index} roof={roof} materials={materials} clipPlane={clipPlane} />
      ))}

      {/* Interactive Room Picking Volumes & Selection Highlight Overlays */}
      {parts.interactiveRooms.map((room) => {
        const isSelected = room.id === selectedRoomId;
        const isHovered = room.id === hoveredRoomId;
        return (
          <group key={`room-interact-${room.id}`} position={room.position}>
            {/* Raycast Target Box */}
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredRoomId(room.id);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                if (hoveredRoomId === room.id) setHoveredRoomId(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRoomSelect?.(room.id === selectedRoomId ? null : room.id);
              }}
            >
              <boxGeometry args={[room.size[0] * 0.99, room.size[1] + 0.1, room.size[2] * 0.99]} />
              {isSelected ? (
                <meshStandardMaterial
                  color="#D4AF37"
                  transparent
                  opacity={0.34}
                  emissive="#D4AF37"
                  emissiveIntensity={0.4}
                  roughness={0.2}
                  clippingPlanes={planes}
                  clipShadows
                />
              ) : isHovered ? (
                <meshStandardMaterial
                  color="#EAB308"
                  transparent
                  opacity={0.18}
                  roughness={0.3}
                  clippingPlanes={planes}
                  clipShadows
                />
              ) : (
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              )}
            </mesh>

            {/* Architectural Outline when Selected */}
            {isSelected && (
              <lineSegments position={[0, 0.04, 0]}>
                <edgesGeometry args={[new THREE.BoxGeometry(room.size[0] * 0.99, room.size[1] + 0.08, room.size[2] * 0.99)]} />
                <lineBasicMaterial color="#FFD700" linewidth={2.5} />
              </lineSegments>
            )}

            {/* Floating 3D HUD Badge */}
            {isSelected && (
              <Html position={[0, room.size[1] / 2 + 0.45, 0]} center pointerEvents="none">
                <div className="rounded border border-gold-400 bg-plum-950/95 px-3 py-1.5 text-xs font-sans font-medium text-stone-100 shadow-2xl backdrop-blur whitespace-nowrap pointer-events-none flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gold-400 animate-ping" />
                  <span className="font-semibold text-gold-300">{room.name}</span>
                  <span className="text-stone-500">|</span>
                  <span className="text-stone-300">{room.widthFt.toFixed(1)}′ × {room.depthFt.toFixed(1)}′</span>
                  <span className="text-stone-400 font-mono text-[11px]">({Math.round(room.widthFt * room.depthFt)} sq ft)</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

const toolbarButton = (active: boolean) =>
  `flex h-9 items-center gap-1.5 border px-3 text-sm transition-colors ${active ? 'border-gold-400 bg-gold-400/15 font-medium text-gold-200' : 'border-plum-600 bg-plum-800 text-stone-300 hover:border-gold-500 hover:text-gold-200'}`;

export default function Massing3DViewer({ design, onAppearanceChange, selectedRoomId, onRoomSelect }: Massing3DViewerProps) {
  const [lightingMode, setLightingMode] = useState<LightingMode>('day');
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [showRoof, setShowRoof] = useState(true);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('orbit');
  const [viewKey, setViewKey] = useState(0);
  const [localAppearance, setLocalAppearance] = useState<HouseAppearance>(design.appearance || DEFAULT_APPEARANCE);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // Section Cutaway State
  const [isCutaway, setIsCutaway] = useState(false);
  const [cutHeight, setCutHeight] = useState(2.2);

  const houseGeometry = useMemo(() => buildHouseGeometry(design), [design]);
  const [visibleUpTo, setVisibleUpTo] = useState(houseGeometry.totalFloors - 1);

  useEffect(() => {
    setLocalAppearance(design.appearance || DEFAULT_APPEARANCE);
    setVisibleUpTo(houseGeometry.totalFloors - 1);
  }, [design, houseGeometry.totalFloors]);

  const handleAppearanceUpdate = (updated: HouseAppearance) => {
    setLocalAppearance(updated);
    if (onAppearanceChange) onAppearanceChange(updated);
  };

  const materials = useMemo(() => getHouseMaterials(localAppearance, design.constraints?.style), [localAppearance, design.constraints?.style]);
  const scene = SCENES[lightingMode];
  const distance = houseGeometry.recommendedCameraDistance;
  const reach = Math.max(houseGeometry.plotSize[0], houseGeometry.plotSize[2]);
  const target = houseGeometry.cameraTarget;

  // Camera presets
  const camConfigs = useMemo(() => {
    const orbitPos: [number, number, number] = [target[0] + distance * 0.62, distance * 0.58, target[2] - distance * 0.78];
    const walkPos: [number, number, number] = [target[0], 1.7, target[2] - reach * 0.4];
    const frontPos: [number, number, number] = [target[0], target[1] + 1.8, target[2] - distance * 1.15];
    const rearPos: [number, number, number] = [target[0], target[1] + 1.8, target[2] + distance * 1.15];
    const leftPos: [number, number, number] = [target[0] - distance * 1.15, target[1] + 1.8, target[2]];
    const rightPos: [number, number, number] = [target[0] + distance * 1.15, target[1] + 1.8, target[2]];
    const topPos: [number, number, number] = [target[0], target[1] + distance * 1.6, target[2] + 0.001];
    const isoPos: [number, number, number] = [target[0] + distance * 0.75, distance * 0.75, target[2] - distance * 0.75];

    return {
      orbit: { pos: orbitPos, target, fov: 38 },
      walk: { pos: walkPos, target: [target[0], 2.2, target[2]] as [number, number, number], fov: 50 },
      front: { pos: frontPos, target, fov: 34 },
      rear: { pos: rearPos, target, fov: 34 },
      left: { pos: leftPos, target, fov: 34 },
      right: { pos: rightPos, target, fov: 34 },
      top: { pos: topPos, target, fov: 32 },
      iso: { pos: isoPos, target, fov: 36 }
    };
  }, [distance, reach, target]);

  const currentCam = camConfigs[viewPreset] || camConfigs.orbit;
  const floorLevels = Array.from({ length: houseGeometry.totalFloors }, (_, level) => level);

  // Hardware clipping plane for section cutaway
  const clipPlane = useMemo(() => (isCutaway ? new THREE.Plane(new THREE.Vector3(0, -1, 0), cutHeight) : null), [isCutaway, cutHeight]);

  const selectedRoom = useMemo(() => {
    return houseGeometry.rooms.find((r) => r.id === selectedRoomId);
  }, [houseGeometry.rooms, selectedRoomId]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-plum-950 select-none">
      {/* Top Toolbar */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-plum-700 bg-plum-850/95 px-5 py-3 backdrop-blur">
        <div>
          <p className="font-serif text-lg leading-none text-stone-50">3D model</p>
          <p className="mt-1 text-xs text-stone-400">
            {houseGeometry.totalFloors} {houseGeometry.totalFloors === 1 ? 'storey' : 'storeys'} · {houseGeometry.rooms.length} rooms · <span className="text-gold-300">{houseGeometry.styleName}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Floor isolation */}
          {floorLevels.length > 1 && (
            <div role="group" aria-label="Floors shown" className="flex border border-plum-600 bg-plum-800 p-0.5">
              {floorLevels.map((level) => (
                <button
                  key={level}
                  onClick={() => setVisibleUpTo(level)}
                  aria-pressed={visibleUpTo === level}
                  title={`Show the model up to the ${floorName(level).toLowerCase()}`}
                  className={`px-3 py-1.5 text-sm transition-colors ${visibleUpTo === level ? 'bg-gold-400 font-semibold text-plum-950' : 'text-stone-300 hover:text-gold-200'}`}
                >
                  {level === houseGeometry.totalFloors - 1 ? 'All floors' : floorName(level)}
                </button>
              ))}
            </div>
          )}

          {/* Roof Lift */}
          <button onClick={() => setShowRoof((v) => !v)} aria-pressed={showRoof} className={toolbarButton(showRoof)} title="Lift the roof off to see the rooms">
            <Home className="h-4 w-4" />
            Roof {showRoof ? 'on' : 'off'}
          </button>

          {/* Section Cutaway Button */}
          <button
            onClick={() => setIsCutaway((v) => !v)}
            aria-pressed={isCutaway}
            className={toolbarButton(isCutaway)}
            title="Slice the building horizontally to view interior rooms"
          >
            <Scissors className="h-4 w-4" />
            Cutaway {isCutaway ? 'on' : 'off'}
          </button>

          {/* Camera View Presets */}
          <div role="group" aria-label="Elevation & Camera Views" className="flex border border-plum-600 bg-plum-800 p-0.5">
            {([
              ['orbit', 'Orbit'],
              ['front', 'Front'],
              ['rear', 'Rear'],
              ['left', 'Left'],
              ['right', 'Right'],
              ['top', 'Top'],
              ['iso', 'Iso']
            ] as const).map(([preset, label]) => (
              <button
                key={preset}
                onClick={() => {
                  setViewPreset(preset);
                  setViewKey((k) => k + 1);
                }}
                aria-pressed={viewPreset === preset}
                className={`px-2.5 py-1.5 text-xs transition-colors ${viewPreset === preset ? 'bg-gold-400 font-semibold text-plum-950' : 'text-stone-300 hover:text-gold-200'}`}
                title={`Switch to ${label} view`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Appearance Panel Toggle */}
          <button onClick={() => setIsAppearanceOpen((v) => !v)} aria-expanded={isAppearanceOpen} className={toolbarButton(isAppearanceOpen)}>
            <Palette className="h-4 w-4" />
            Appearance
          </button>

          {/* Lighting Mode */}
          <div role="group" aria-label="Lighting" className="flex border border-plum-600 bg-plum-800 p-0.5">
            {(['day', 'evening', 'night'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLightingMode(mode)}
                aria-pressed={lightingMode === mode}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${lightingMode === mode ? 'bg-gold-400 font-semibold text-plum-950' : 'text-stone-300 hover:text-gold-200'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Reset Camera */}
          <button
            onClick={() => {
              setViewPreset('orbit');
              setViewKey((k) => k + 1);
            }}
            className={toolbarButton(false)}
            title="Return to the starting perspective view"
            aria-label="Reset view"
          >
            <LocateFixed className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Section Cutaway Height Slider when active */}
      {isCutaway && (
        <div className="z-10 flex items-center gap-3 border-b border-plum-700 bg-plum-900/90 px-5 py-2 text-xs text-stone-200 backdrop-blur">
          <Scissors className="h-3.5 w-3.5 text-gold-300" />
          <span className="font-medium text-gold-200">Cut Plane Height:</span>
          <input
            type="range"
            min={0.8}
            max={houseGeometry.totalFloors * 3.2}
            step={0.1}
            value={cutHeight}
            onChange={(e) => setCutHeight(parseFloat(e.target.value))}
            className="w-48 accent-gold-400 cursor-pointer"
          />
          <span className="font-mono text-stone-300">{(cutHeight / 0.3048).toFixed(1)} ft ({cutHeight.toFixed(2)} m)</span>
        </div>
      )}

      {isAppearanceOpen && <AppearancePanel appearance={localAppearance} onChange={handleAppearanceUpdate} onClose={() => setIsAppearanceOpen(false)} />}

      {/* 3D Canvas Viewport */}
      <div className="relative min-h-0 w-full flex-1">
        <Canvas
          key={viewKey}
          shadows="soft"
          frameloop="demand"
          dpr={[1, 1.75]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: scene.exposure,
            localClippingEnabled: true
          }}
        >
          <color attach="background" args={[scene.background]} />
          <fog attach="fog" args={[scene.background, distance * 1.8, distance * 5]} />
          <PerspectiveCamera makeDefault position={currentCam.pos} fov={currentCam.fov} near={0.5} far={distance * 12} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.09}
            rotateSpeed={0.7}
            zoomSpeed={0.8}
            target={currentCam.target}
            minDistance={viewPreset === 'walk' ? 1.5 : 4}
            maxDistance={distance * 2.6}
            minPolarAngle={viewPreset === 'top' ? 0.001 : viewPreset === 'walk' ? 0.3 : 0.05}
            maxPolarAngle={viewPreset === 'top' ? 0.01 : Math.PI / 2.03}
          />

          <hemisphereLight args={[scene.hemi[0], scene.hemi[1], scene.hemi[2]]} />
          <directionalLight
            position={scene.sun.position}
            color={scene.sun.color}
            intensity={scene.sun.intensity}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.04}
            shadow-camera-left={-reach * 0.9}
            shadow-camera-right={reach * 0.9}
            shadow-camera-top={reach * 0.9}
            shadow-camera-bottom={-reach * 0.9}
            shadow-camera-near={1}
            shadow-camera-far={120}
          />

          <Environment resolution={128} frames={1}>
            <Lightformer form="rect" intensity={2.2} position={[0, 6, -6]} scale={[14, 4, 1]} color="#FFF3DC" />
            <Lightformer form="rect" intensity={1.2} position={[-8, 3, 4]} scale={[6, 6, 1]} color="#98A67E" />
            <Lightformer form="rect" intensity={1.2} position={[8, 3, 4]} scale={[6, 6, 1]} color="#B1BCA0" />
          </Environment>

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.07, 0]} receiveShadow>
            <circleGeometry args={[distance * 4, 64]} />
            <meshStandardMaterial color={scene.ground} roughness={1} />
          </mesh>

          <BuildingModel
            geometry={houseGeometry}
            materials={materials}
            mode={lightingMode}
            visibleUpTo={visibleUpTo}
            showRoof={showRoof}
            selectedRoomId={selectedRoomId}
            hoveredRoomId={hoveredRoomId}
            onRoomSelect={onRoomSelect}
            setHoveredRoomId={setHoveredRoomId}
            clipPlane={clipPlane}
          />

          <ContactShadows position={[0, 0.02, 0]} opacity={lightingMode === 'night' ? 0.25 : 0.4} scale={distance * 2} blur={2.6} far={7} resolution={512} frames={1} />
        </Canvas>

        {/* Floating Selected Room Property Inspector Card */}
        {selectedRoom && (
          <div className="absolute top-4 right-4 z-20 flex w-72 flex-col gap-2.5 rounded-lg border border-gold-400/60 bg-plum-900/95 p-4 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between border-b border-plum-700/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-gold-400" />
                <h3 className="font-serif text-base font-medium text-stone-100">{selectedRoom.name}</h3>
              </div>
              <button
                onClick={() => onRoomSelect?.(null)}
                className="rounded p-1 text-stone-400 hover:bg-plum-800 hover:text-stone-100 transition-colors"
                title="Deselect room"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-stone-300">
              <div className="border border-plum-800 bg-plum-950/50 p-2 rounded">
                <span className="text-[10px] uppercase font-mono text-stone-400 block">Level</span>
                <span className="font-semibold text-stone-100">{floorName(selectedRoom.floorLevel)}</span>
              </div>
              <div className="border border-plum-800 bg-plum-950/50 p-2 rounded">
                <span className="text-[10px] uppercase font-mono text-stone-400 block">Category</span>
                <span className="font-semibold capitalize text-stone-100">{selectedRoom.category || 'Space'}</span>
              </div>
              <div className="border border-plum-800 bg-plum-950/50 p-2 rounded">
                <span className="text-[10px] uppercase font-mono text-stone-400 block">Dimensions</span>
                <span className="font-semibold text-gold-300">{selectedRoom.widthFt.toFixed(1)}′ × {selectedRoom.depthFt.toFixed(1)}′</span>
              </div>
              <div className="border border-plum-800 bg-plum-950/50 p-2 rounded">
                <span className="text-[10px] uppercase font-mono text-stone-400 block">Floor Area</span>
                <span className="font-semibold text-stone-100">{Math.round(selectedRoom.widthFt * selectedRoom.depthFt)} sq ft</span>
                <span className="text-[10px] text-stone-400 block">{(selectedRoom.widthFt * selectedRoom.depthFt * 0.0929).toFixed(1)} m²</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-plum-700/80 pt-2 text-[11px] text-stone-400">
              <span>Synchronized with 2D floor plan</span>
              <span className="text-gold-400 font-medium">Selected</span>
            </div>
          </div>
        )}

        {/* Bottom Help Tooltip */}
        <div className="pointer-events-none absolute bottom-4 left-4 border border-plum-600 bg-plum-850/90 px-3.5 py-2 text-xs text-stone-300 backdrop-blur">
          Click any room in 3D to inspect · drag to orbit · scroll to zoom · use Cutaway or Elevation views above
        </div>
      </div>
    </div>
  );
}
