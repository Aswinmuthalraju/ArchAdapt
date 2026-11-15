'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, ContactShadows, Lightformer, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { FloorPlanRoom, StructuredDesignJSON } from '@/types/architectural';
import { inferRoomType } from '@/lib/design/roomTypes';

export type InteriorFloorFinish = 'oak_parquet' | 'statuario_marble' | 'slate_tile' | 'terrazzo';
export type InteriorLighting = 'daylight' | 'golden_hour' | 'evening_mood';

interface RoomWalkInViewportProps {
  design: StructuredDesignJSON;
  room: FloorPlanRoom;
  floorFinish: InteriorFloorFinish;
  lighting: InteriorLighting;
  onCaptureReady?: (captureFn: () => string) => void;
}

const FLOOR_MATERIALS: Record<InteriorFloorFinish, { color: string; roughness: number; metalness: number; label: string }> = {
  oak_parquet: { color: '#B38B59', roughness: 0.65, metalness: 0.05, label: 'Engineered Oak Parquet' },
  statuario_marble: { color: '#EBEAE6', roughness: 0.15, metalness: 0.1, label: 'Italian Statuario Marble' },
  slate_tile: { color: '#2B2E33', roughness: 0.75, metalness: 0.1, label: 'Matte Charcoal Slate Tile' },
  terrazzo: { color: '#D9D2C7', roughness: 0.45, metalness: 0.08, label: 'Venetian Quartz Terrazzo' }
};

const LIGHT_SETTINGS: Record<InteriorLighting, { bg: string; sunColor: string; sunIntensity: number; sunPos: [number, number, number]; ambient: number }> = {
  daylight: { bg: '#8FA9BF', sunColor: '#FFF8EB', sunIntensity: 2.8, sunPos: [5, 6, 8], ambient: 0.7 },
  golden_hour: { bg: '#4A342B', sunColor: '#FF9E54', sunIntensity: 2.2, sunPos: [9, 2.5, 4], ambient: 0.5 },
  evening_mood: { bg: '#161920', sunColor: '#FFC88A', sunIntensity: 0.8, sunPos: [2, 4, 3], ambient: 0.35 }
};

function CaptureBridge({ onRegister }: { onRegister: (fn: () => string) => void }) {
  const { gl } = useThree();
  React.useEffect(() => {
    onRegister(() => gl.domElement.toDataURL('image/png'));
  }, [gl, onRegister]);
  return null;
}

function RoomFurniture({ type, width, depth }: { type: string; width: number; depth: number }) {
  if (type === 'master_bedroom' || type === 'bedroom' || type === 'guest_room') {
    const bedW = Math.min(2.0, width * 0.55);
    const bedL = Math.min(2.2, depth * 0.65);
    return (
      <group position={[0, 0, -depth * 0.15]}>
        {/* Bed Base Plinth */}
        <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[bedW, 0.36, bedL]} />
          <meshStandardMaterial color="#2B2118" roughness={0.7} />
        </mesh>
        {/* Mattress with white luxury bedding */}
        <mesh position={[0, 0.46, 0.05]} castShadow receiveShadow>
          <boxGeometry args={[bedW - 0.1, 0.3, bedL - 0.15]} />
          <meshStandardMaterial color="#F5F3EF" roughness={0.9} />
        </mesh>
        {/* Soft Duvet Fold */}
        <mesh position={[0, 0.56, 0.3]} castShadow>
          <boxGeometry args={[bedW - 0.08, 0.12, bedL * 0.55]} />
          <meshStandardMaterial color="#D8CFC4" roughness={0.95} />
        </mesh>
        {/* Pillows */}
        <mesh position={[-bedW * 0.25, 0.65, -bedL * 0.35]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.15, 0.4]} />
          <meshStandardMaterial color="#FFF" roughness={0.8} />
        </mesh>
        <mesh position={[bedW * 0.25, 0.65, -bedL * 0.35]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.15, 0.4]} />
          <meshStandardMaterial color="#FFF" roughness={0.8} />
        </mesh>
        {/* Headboard */}
        <mesh position={[0, 0.85, -bedL / 2 + 0.04]} castShadow>
          <boxGeometry args={[bedW + 0.4, 1.2, 0.12]} />
          <meshStandardMaterial color="#3D3025" roughness={0.6} />
        </mesh>
        {/* Nightstands with lamps */}
        <mesh position={[-bedW / 2 - 0.38, 0.25, -bedL / 2 + 0.3]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.45]} />
          <meshStandardMaterial color="#2B2118" roughness={0.65} />
        </mesh>
        <mesh position={[bedW / 2 + 0.38, 0.25, -bedL / 2 + 0.3]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.45]} />
          <meshStandardMaterial color="#2B2118" roughness={0.65} />
        </mesh>
      </group>
    );
  }

  if (type === 'living' || type === 'lounge') {
    const sofaW = Math.min(2.6, width * 0.7);
    const sofaD = Math.min(1.0, depth * 0.38);
    return (
      <group position={[0, 0, -depth * 0.1]}>
        {/* Area Rug */}
        <mesh position={[0, 0.01, 0.3]} receiveShadow>
          <boxGeometry args={[sofaW + 0.8, 0.02, 2.2]} />
          <meshStandardMaterial color="#C5BEB3" roughness={0.95} />
        </mesh>
        {/* Modern Sectional Sofa Base */}
        <mesh position={[0, 0.24, -sofaD / 2]} castShadow receiveShadow>
          <boxGeometry args={[sofaW, 0.48, sofaD]} />
          <meshStandardMaterial color="#383D42" roughness={0.85} />
        </mesh>
        {/* Backrest */}
        <mesh position={[0, 0.55, -sofaD + 0.1]} castShadow>
          <boxGeometry args={[sofaW, 0.55, 0.2]} />
          <meshStandardMaterial color="#2E3338" roughness={0.8} />
        </mesh>
        {/* Coffee Table with marble top and brass base */}
        <mesh position={[0, 0.22, 0.45]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.4, 0.65]} />
          <meshStandardMaterial color="#EAE8E3" roughness={0.2} metalness={0.1} />
        </mesh>
      </group>
    );
  }

  if (type === 'dining') {
    return (
      <group position={[0, 0, 0]}>
        {/* Dining Table */}
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.06, 0.95]} />
          <meshStandardMaterial color="#4A3425" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.37, 0]} castShadow>
          <boxGeometry args={[1.2, 0.72, 0.5]} />
          <meshStandardMaterial color="#1A1817" roughness={0.6} metalness={0.6} />
        </mesh>
        {/* Pendant Light above table */}
        <mesh position={[0, 2.3, 0]}>
          <cylinderGeometry args={[0.25, 0.35, 0.25, 24]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.2} />
        </mesh>
        <pointLight position={[0, 2.1, 0]} intensity={1.8} color="#FFE6BA" distance={4} />
      </group>
    );
  }

  if (type === 'kitchen') {
    return (
      <group position={[0, 0, 0]}>
        {/* Waterfall Island Counter */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[Math.min(2.2, width * 0.65), 0.9, Math.min(0.85, depth * 0.45)]} />
          <meshStandardMaterial color="#E8ECEF" roughness={0.15} metalness={0.1} />
        </mesh>
        {/* Sink Basin in Counter */}
        <mesh position={[-0.3, 0.91, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.4]} />
          <meshStandardMaterial color="#555" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  if (type === 'bathroom') {
    return (
      <group position={[0, 0, 0]}>
        {/* Floating Vanity */}
        <mesh position={[-width * 0.22, 0.45, 0]} castShadow>
          <boxGeometry args={[Math.min(1.0, width * 0.4), 0.85, Math.min(0.55, depth * 0.5)]} />
          <meshStandardMaterial color="#1E232A" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* Glass Shower Screen */}
        <mesh position={[width * 0.22, 1.05, 0]}>
          <boxGeometry args={[0.04, 2.1, Math.min(1.1, depth * 0.7)]} />
          <meshPhysicalMaterial color="#CFE0E6" transparent opacity={0.3} roughness={0.05} metalness={0.1} transmission={0.9} />
        </mesh>
      </group>
    );
  }

  return null;
}

export default function RoomWalkInViewport({
  design,
  room,
  floorFinish,
  lighting,
  onCaptureReady
}: RoomWalkInViewportProps) {
  const plotW = design.plot?.width || 40;
  const plotD = design.plot?.depth || 60;
  const FT = 0.3048; // metres per foot

  // Convert room dimensions to metres
  const roomW_m = Math.max(3.0, (room.position.width / 100) * plotW * FT);
  const roomD_m = Math.max(3.0, (room.position.height / 100) * plotD * FT);
  const ceilingHeight = 3.05; // 10 feet clear height
  const wallThick = 0.2;

  const type = inferRoomType(room);
  const floorMat = FLOOR_MATERIALS[floorFinish] || FLOOR_MATERIALS.oak_parquet;
  const lightCfg = LIGHT_SETTINGS[lighting] || LIGHT_SETTINGS.daylight;

  return (
    <div className="relative w-full h-full bg-stone-950 overflow-hidden select-none">
      <Canvas
        shadows="soft"
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping
        }}
      >
        {onCaptureReady && <CaptureBridge onRegister={onCaptureReady} />}
        <color attach="background" args={[lightCfg.bg]} />

        {/* Eye-level camera placed inside the room */}
        <PerspectiveCamera
          makeDefault
          position={[0, 1.55, roomD_m * 0.35]}
          fov={68}
          near={0.1}
          far={40}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.65}
          zoomSpeed={0.7}
          target={[0, 1.4, 0]}
          minDistance={0.5}
          maxDistance={Math.max(roomW_m, roomD_m) * 0.9}
          maxPolarAngle={Math.PI / 2 + 0.05}
          minPolarAngle={0.2}
        />

        {/* Ambient & Directional Sun Lighting */}
        <ambientLight intensity={lightCfg.ambient} />
        <directionalLight
          position={lightCfg.sunPos}
          color={lightCfg.sunColor}
          intensity={lightCfg.sunIntensity}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
        />

        {/* Environment fill */}
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={1.8} position={[0, 4, 3]} scale={[8, 3, 1]} color="#FFF5E5" />
          <Lightformer form="rect" intensity={0.9} position={[-4, 2, -3]} scale={[4, 4, 1]} color="#A4BBD2" />
        </Environment>

        {/* Room Floor Slab */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[roomW_m, 0.04, roomD_m]} />
          <meshStandardMaterial
            color={floorMat.color}
            roughness={floorMat.roughness}
            metalness={floorMat.metalness}
          />
        </mesh>

        {/* Room Ceiling with Recessed Warm LED Cove */}
        <mesh position={[0, ceilingHeight, 0]}>
          <boxGeometry args={[roomW_m, 0.04, roomD_m]} />
          <meshStandardMaterial color="#FAF9F6" roughness={0.8} />
        </mesh>
        {/* Cove light glow */}
        <pointLight position={[0, ceilingHeight - 0.2, 0]} intensity={1.2} color="#FFF2DB" distance={6} />

        {/* Four Surrounding Enclosing Walls */}
        {/* Back Wall */}
        <mesh position={[0, ceilingHeight / 2, -roomD_m / 2 - wallThick / 2]} receiveShadow>
          <boxGeometry args={[roomW_m + wallThick * 2, ceilingHeight, wallThick]} />
          <meshStandardMaterial color="#EAE7E1" roughness={0.7} />
        </mesh>
        {/* Front Wall */}
        <mesh position={[0, ceilingHeight / 2, roomD_m / 2 + wallThick / 2]} receiveShadow>
          <boxGeometry args={[roomW_m + wallThick * 2, ceilingHeight, wallThick]} />
          <meshStandardMaterial color="#EAE7E1" roughness={0.7} />
        </mesh>
        {/* Left Wall (with Window cutout representation) */}
        <group position={[-roomW_m / 2 - wallThick / 2, ceilingHeight / 2, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[wallThick, ceilingHeight, roomD_m]} />
            <meshStandardMaterial color="#E6E3DC" roughness={0.7} />
          </mesh>
          {/* Large Architectural Window Panes */}
          <mesh position={[wallThick / 2 + 0.01, 0, 0]}>
            <boxGeometry args={[0.02, 1.8, Math.min(2.4, roomD_m * 0.6)]} />
            <meshPhysicalMaterial color="#CFE5F2" transparent opacity={0.3} roughness={0.05} metalness={0.1} transmission={0.9} />
          </mesh>
        </group>
        {/* Right Wall */}
        <mesh position={[roomW_m / 2 + wallThick / 2, ceilingHeight / 2, 0]} receiveShadow>
          <boxGeometry args={[wallThick, ceilingHeight, roomD_m]} />
          <meshStandardMaterial color="#E6E3DC" roughness={0.7} />
        </mesh>

        {/* Staged 3D Furniture */}
        <RoomFurniture type={type} width={roomW_m} depth={roomD_m} />

        <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={Math.max(roomW_m, roomD_m) * 1.5} blur={1.8} far={4} />
      </Canvas>

      {/* Floating HUD Camera Instruction Overlay */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-md bg-stone-950/80 px-3 py-1.5 border border-stone-800 text-[11px] text-stone-300 backdrop-blur">
        <span>Drag to look around in 360° · Scroll to adjust camera distance</span>
      </div>
    </div>
  );
}
