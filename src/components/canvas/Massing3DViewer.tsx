'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Lightformer, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { StructuredDesignJSON, HouseAppearance } from '@/types/architectural';
import { buildHouseGeometry, Box3D, HouseGeometry3D } from '@/lib/geometry/buildHouseGeometry';
import { getHouseMaterials, HouseMaterialSystem } from '@/lib/geometry/materials';
import { floorName } from '@/lib/design/roomTypes';
import AppearancePanel from '@/components/workspace/AppearancePanel';
import { Palette, Home, LocateFixed } from 'lucide-react';

interface Massing3DViewerProps {
  design: StructuredDesignJSON;
  onAppearanceChange?: (updatedAppearance: HouseAppearance) => void;
}

type LightingMode = 'day' | 'evening' | 'night';

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

function RoofMesh({ roof, materials }: { roof: HouseGeometry3D['roofs'][0]; materials: HouseMaterialSystem }) {
  const roofMaterial = <meshStandardMaterial color={materials.roof.color} roughness={materials.roof.roughness} metalness={materials.roof.metalness} />;
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
        {/* Timber eave fascia plate */}
        <mesh position={[0, -height / 2 + 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.1, depth]} />
          <meshStandardMaterial color="#8C5A3C" roughness={0.7} />
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
        {/* Stepped stone cornice chhajja */}
        <mesh position={[0, -height / 2 + 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.08, depth]} />
          <meshStandardMaterial color="#CBB996" roughness={0.85} />
        </mesh>
        <mesh position={[0, -height / 2 - 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.2, 0.08, depth - 0.2]} />
          <meshStandardMaterial color="#B0A080" roughness={0.88} />
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
        {/* Deep timber under-eave rafter plate */}
        <mesh position={[0, -height / 2 + 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[width * 0.96, 0.08, depth * 0.96]} />
          <meshStandardMaterial color="#4A3728" roughness={0.8} />
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
        {/* Classical white cornice mouldings */}
        <mesh position={[0, -height / 2 + 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.12, depth]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
        </mesh>
        <mesh position={[0, -height / 2 - 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.15, 0.08, depth - 0.15]} />
          <meshStandardMaterial color="#FAF8F5" roughness={0.45} />
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
        {/* Recessed dark bronze reveal strip */}
        <mesh position={[0, -roof.size[1] / 2 + 0.04, 0]} castShadow>
          <boxGeometry args={[roof.size[0] - 0.2, 0.08, roof.size[2] - 0.2]} />
          <meshStandardMaterial color="#3A3025" roughness={0.3} metalness={0.7} />
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
          <meshStandardMaterial color="#475569" roughness={0.45} metalness={0.15} />
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
        <meshStandardMaterial color="#9C8F86" roughness={0.5} />
      </mesh>
    </group>
  );
}

function BuildingModel({ geometry, materials, mode, visibleUpTo, showRoof }: { geometry: HouseGeometry3D; materials: HouseMaterialSystem; mode: LightingMode; visibleUpTo: number; showRoof: boolean }) {
  const scene = SCENES[mode];

  const parts = useMemo(() => {
    const shown = <T extends { floorLevel: number }>(items: T[]) => items.filter((item) => item.floorLevel <= visibleUpTo);
    // Floors grouped by colour, then merged: one draw call per room colour instead of one per room.
    const groups = new Map<string, Box3D[]>();
    for (const room of shown(geometry.rooms)) groups.set(room.color, [...(groups.get(room.color) || []), room]);
    return {
      floors: Array.from(groups.entries()),
      // The ceiling of the highest visible floor is lifted off with the roof so the rooms can be seen.
      ceilings: shown(geometry.ceilings).filter((ceiling) => showRoof || ceiling.floorLevel < visibleUpTo),
      walls: shown(geometry.walls),
      frames: shown(geometry.frames),
      doors: shown(geometry.openings).filter((o) => o.kind === 'door'),
      glass: shown(geometry.openings).filter((o) => o.kind !== 'door'),
      steps: shown(geometry.stairSteps),
      railings: shown(geometry.railings),
      pillars: shown(geometry.pillars)
    };
  }, [geometry, visibleUpTo, showRoof]);

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

      {parts.floors.map(([color, boxes]) => (
        <Merged key={color} boxes={boxes} castShadow={false}>
          <meshStandardMaterial color={color} roughness={0.7} />
        </Merged>
      ))}

      <Merged boxes={parts.ceilings}>
        <meshStandardMaterial color="#D9D0C4" roughness={0.75} />
      </Merged>

      <Merged boxes={parts.walls}>
        <meshStandardMaterial color={materials.wall.color} roughness={materials.wall.roughness} metalness={materials.wall.metalness} />
      </Merged>

      <Merged boxes={parts.frames}>
        <meshStandardMaterial color={materials.frame.color} roughness={materials.frame.roughness} metalness={materials.frame.metalness} />
      </Merged>

      <Merged boxes={parts.doors}>
        <meshStandardMaterial color={materials.woodAccent.color} roughness={materials.woodAccent.roughness} />
      </Merged>

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
        />
      </Merged>

      <Merged boxes={parts.steps}>
        <meshStandardMaterial color="#B9AEA2" roughness={0.65} />
      </Merged>

      <Merged boxes={parts.railings} castShadow={false}>
        <meshPhysicalMaterial color="#B1BCA0" transparent opacity={0.55} roughness={0.2} metalness={0.4} />
      </Merged>

      {parts.pillars.map((pillar, index) => (
        <mesh key={`pillar-${index}`} position={pillar.position} castShadow receiveShadow>
          <cylinderGeometry args={[pillar.radius, pillar.radius, pillar.height, 20]} />
          <meshStandardMaterial color={materials.woodAccent.color} roughness={materials.woodAccent.roughness} />
        </mesh>
      ))}

      {showRoof && visibleUpTo >= geometry.totalFloors - 1 && geometry.roofs.map((roof, index) => <RoofMesh key={index} roof={roof} materials={materials} />)}
    </group>
  );
}

const toolbarButton = (active: boolean) =>
  `flex h-9 items-center gap-1.5 border px-3 text-sm transition-colors ${active ? 'border-gold-400 bg-gold-400/15 font-medium text-gold-200' : 'border-plum-600 bg-plum-800 text-stone-300 hover:border-gold-500 hover:text-gold-200'}`;

export default function Massing3DViewer({ design, onAppearanceChange }: Massing3DViewerProps) {
  const [lightingMode, setLightingMode] = useState<LightingMode>('day');
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [showRoof, setShowRoof] = useState(true);
  const [viewKey, setViewKey] = useState(0);
  const [localAppearance, setLocalAppearance] = useState<HouseAppearance>(design.appearance || DEFAULT_APPEARANCE);

  // The model always follows the design it is given: no stale copy, no manual "regenerate".
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
  // The road is at -Z, so the default view looks at the front of the house from the road side.
  const camPos: [number, number, number] = [houseGeometry.cameraTarget[0] + distance * 0.62, distance * 0.58, houseGeometry.cameraTarget[2] - distance * 0.78];
  const floorLevels = Array.from({ length: houseGeometry.totalFloors }, (_, level) => level);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-plum-950 select-none">
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-plum-700 bg-plum-850/95 px-5 py-3 backdrop-blur">
        <div>
          <p className="font-serif text-lg leading-none text-stone-50">3D model</p>
          <p className="mt-1 text-xs text-stone-400">
            {houseGeometry.totalFloors} {houseGeometry.totalFloors === 1 ? 'storey' : 'storeys'} · {houseGeometry.rooms.length} rooms · <span className="text-gold-300">{houseGeometry.styleName}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <button onClick={() => setShowRoof((v) => !v)} aria-pressed={showRoof} className={toolbarButton(showRoof)} title="Lift the roof off to see the rooms">
            <Home className="h-4 w-4" />
            Roof {showRoof ? 'on' : 'off'}
          </button>

          <button onClick={() => setIsAppearanceOpen((v) => !v)} aria-expanded={isAppearanceOpen} className={toolbarButton(isAppearanceOpen)}>
            <Palette className="h-4 w-4" />
            Appearance
          </button>

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

          <button onClick={() => setViewKey((k) => k + 1)} className={toolbarButton(false)} title="Return to the starting view" aria-label="Reset view">
            <LocateFixed className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isAppearanceOpen && <AppearancePanel appearance={localAppearance} onChange={handleAppearanceUpdate} onClose={() => setIsAppearanceOpen(false)} />}

      <div className="relative min-h-0 w-full flex-1">
        <Canvas
          key={viewKey}
          shadows="soft"
          frameloop="demand"
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: scene.exposure }}
        >
          <color attach="background" args={[scene.background]} />
          <fog attach="fog" args={[scene.background, distance * 1.8, distance * 5]} />
          <PerspectiveCamera makeDefault position={camPos} fov={38} near={0.5} far={distance * 12} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.09}
            rotateSpeed={0.7}
            zoomSpeed={0.8}
            target={houseGeometry.cameraTarget}
            minDistance={4}
            maxDistance={distance * 2.6}
            minPolarAngle={0.15}
            maxPolarAngle={Math.PI / 2.03}
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

          {/* Procedural studio reflections: no network fetch, so the model never waits on a remote file */}
          <Environment resolution={128} frames={1}>
            <Lightformer form="rect" intensity={2.2} position={[0, 6, -6]} scale={[14, 4, 1]} color="#FFF3DC" />
            <Lightformer form="rect" intensity={1.2} position={[-8, 3, 4]} scale={[6, 6, 1]} color="#98A67E" />
            <Lightformer form="rect" intensity={1.2} position={[8, 3, 4]} scale={[6, 6, 1]} color="#B1BCA0" />
          </Environment>

          {/* Studio floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.07, 0]} receiveShadow>
            <circleGeometry args={[distance * 4, 64]} />
            <meshStandardMaterial color={scene.ground} roughness={1} />
          </mesh>

          <BuildingModel geometry={houseGeometry} materials={materials} mode={lightingMode} visibleUpTo={visibleUpTo} showRoof={showRoof} />

          <ContactShadows position={[0, 0.02, 0]} opacity={lightingMode === 'night' ? 0.25 : 0.4} scale={distance * 2} blur={2.6} far={7} resolution={512} frames={1} />
        </Canvas>

        <div className="pointer-events-none absolute bottom-4 left-4 border border-plum-600 bg-plum-850/90 px-3.5 py-2 text-xs text-stone-300 backdrop-blur">
          Same plan as the 2D view, seen from the road · drag to orbit · scroll to zoom · roof off to look inside
        </div>
      </div>
    </div>
  );
}
