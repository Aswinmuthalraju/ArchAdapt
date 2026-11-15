'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, ContactShadows, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { StructuredDesignJSON, HouseAppearance } from '@/types/architectural';
import { buildHouseGeometry, Box3D, HouseGeometry3D, RoofMesh3D } from '@/lib/geometry/buildHouseGeometry';
import { getHouseMaterials, HouseMaterialSystem } from '@/lib/geometry/materials';

export type ExteriorViewAngle = 'front_elevation' | 'isometric_3d' | 'street_view' | 'twilight_sunset';
export type ExteriorLighting = 'daylight' | 'golden_hour' | 'evening';

interface Exterior3DViewportProps {
  design: StructuredDesignJSON;
  appearance: HouseAppearance;
  viewAngle: ExteriorViewAngle;
  lighting: ExteriorLighting;
  onCaptureReady?: (captureFn: () => string) => void;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);

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
  parts.forEach((p) => p.dispose());
  return merged;
}

function MergedMesh({ boxes, children, castShadow = true, receiveShadow = true }: { boxes: Box3D[]; children: React.ReactNode; castShadow?: boolean; receiveShadow?: boolean }) {
  const geometry = useMemo(() => mergeBoxes(boxes), [boxes]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow}>
      {children}
    </mesh>
  );
}

function FacadeRoof({ roof, materials }: { roof: RoofMesh3D; materials: HouseMaterialSystem }) {
  const [width, height, depth] = roof.size;
  const roofMat = (
    <meshStandardMaterial
      color={materials.roof.color}
      roughness={materials.roof.roughness}
      metalness={materials.roof.metalness}
    />
  );

  if (roof.type === 'sloped_hipped_gable') {
    return (
      <group position={roof.position}>
        <group scale={[width / Math.SQRT2, 1, depth / Math.SQRT2]}>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <coneGeometry args={[1, height, 4]} />
            {roofMat}
          </mesh>
        </group>
        <mesh position={[0, -height / 2 + 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.1, depth]} />
          <meshStandardMaterial color="#8C5A3C" roughness={0.7} />
        </mesh>
      </group>
    );
  }

  if (roof.type === 'traditional_indian_gable') {
    return (
      <group position={roof.position}>
        <group scale={[width / Math.SQRT2, 1, depth / Math.SQRT2]}>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <coneGeometry args={[1, height * 0.9, 4]} />
            {roofMat}
          </mesh>
        </group>
        <mesh position={[0, -height / 2 + 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[width + 0.4, 0.16, depth + 0.4]} />
          <meshStandardMaterial color="#DDD5C7" roughness={0.8} />
        </mesh>
      </group>
    );
  }

  // Flat parapet or minimal slab
  return (
    <group position={roof.position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, Math.max(0.2, height), depth]} />
        {roofMat}
      </mesh>
    </group>
  );
}

function CaptureBridge({ onRegister }: { onRegister: (fn: () => string) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    onRegister(() => gl.domElement.toDataURL('image/png'));
  }, [gl, onRegister]);
  return null;
}

function CameraController({ viewAngle, maxDim, bldgH }: { viewAngle: ExteriorViewAngle; maxDim: number; bldgH: number }) {
  const { camera } = useThree();

  useEffect(() => {
    if (viewAngle === 'front_elevation') {
      camera.position.set(0, Math.max(2, bldgH * 0.5), maxDim * 1.35);
      camera.lookAt(0, bldgH * 0.45, 0);
    } else if (viewAngle === 'isometric_3d') {
      camera.position.set(maxDim * 0.95, maxDim * 0.8, maxDim * 0.95);
      camera.lookAt(0, bldgH * 0.35, 0);
    } else if (viewAngle === 'street_view') {
      camera.position.set(0, 1.6, maxDim * 0.9);
      camera.lookAt(0, bldgH * 0.4, 0);
    } else if (viewAngle === 'twilight_sunset') {
      camera.position.set(maxDim * 0.8, maxDim * 0.35, maxDim * 0.75);
      camera.lookAt(0, bldgH * 0.35, 0);
    }
  }, [camera, viewAngle, maxDim, bldgH]);

  return null;
}

const LIGHTING_CONFIG: Record<ExteriorLighting, { bg: string; sunColor: string; sunPos: [number, number, number]; sunIntensity: number; ambient: number; glow: number }> = {
  daylight: {
    bg: '#CBD8E2',
    sunColor: '#FFFDF5',
    sunPos: [18, 28, 16],
    sunIntensity: 2.6,
    ambient: 0.65,
    glow: 0
  },
  golden_hour: {
    bg: '#3F3532',
    sunColor: '#FFA35C',
    sunPos: [24, 8, 12],
    sunIntensity: 2.2,
    ambient: 0.45,
    glow: 0.3
  },
  evening: {
    bg: '#171B21',
    sunColor: '#FFBF80',
    sunPos: [-12, 14, 18],
    sunIntensity: 0.8,
    ambient: 0.25,
    glow: 0.85
  }
};

export default function Exterior3DViewport({
  design,
  appearance,
  viewAngle,
  lighting,
  onCaptureReady
}: Exterior3DViewportProps) {
  const geometry = useMemo(() => buildHouseGeometry(design), [design]);
  const materials = useMemo(() => getHouseMaterials(appearance), [appearance]);

  const plotW = design.plot?.width || 40;
  const plotD = design.plot?.depth || 60;
  const maxDim = Math.max(plotW, plotD) * 0.3048;
  const bldgH = (geometry.totalFloors * 3.05) + 1.2;

  const light = LIGHTING_CONFIG[lighting] || LIGHTING_CONFIG.daylight;

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
        <color attach="background" args={[light.bg]} />

        <PerspectiveCamera makeDefault fov={45} near={0.1} far={200} position={[maxDim * 0.95, maxDim * 0.8, maxDim * 0.95]} />
        <CameraController viewAngle={viewAngle} maxDim={maxDim} bldgH={bldgH} />

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[0, bldgH * 0.35, 0]}
          minDistance={maxDim * 0.3}
          maxDistance={maxDim * 3.5}
          maxPolarAngle={Math.PI / 2 + 0.05}
        />

        <ambientLight intensity={light.ambient} />
        <directionalLight
          position={light.sunPos}
          color={light.sunColor}
          intensity={light.sunIntensity}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
        />

        <Environment resolution={128}>
          <Lightformer form="rect" intensity={1.5} position={[0, 10, 0]} scale={[20, 20, 1]} color="#FFF8ED" />
          <Lightformer form="rect" intensity={0.7} position={[-10, 5, -10]} scale={[15, 10, 1]} color="#98AFC7" />
        </Environment>

        {/* Plot lawn & driveway base */}
        <mesh position={geometry.plotPosition} receiveShadow>
          <boxGeometry args={geometry.plotSize} />
          <meshStandardMaterial color={materials.lawn.color} roughness={materials.lawn.roughness} />
        </mesh>
        <mesh position={geometry.drivewayPosition} receiveShadow>
          <boxGeometry args={geometry.drivewaySize} />
          <meshStandardMaterial color={materials.driveway.color} roughness={materials.driveway.roughness} />
        </mesh>

        {/* Walls */}
        <MergedMesh boxes={geometry.walls}>
          <meshStandardMaterial
            color={materials.wall.color}
            roughness={materials.wall.roughness}
            metalness={materials.wall.metalness}
          />
        </MergedMesh>

        {/* Door & Window Frames */}
        <MergedMesh boxes={geometry.frames}>
          <meshStandardMaterial
            color={materials.frame.color}
            roughness={materials.frame.roughness}
            metalness={materials.frame.metalness}
          />
        </MergedMesh>

        {/* Doors */}
        <MergedMesh boxes={geometry.openings.filter((o) => o.kind === 'door')}>
          <meshStandardMaterial
            color={materials.woodAccent.color}
            roughness={materials.woodAccent.roughness}
          />
        </MergedMesh>

        {/* Glass Panes */}
        <MergedMesh boxes={geometry.openings.filter((o) => o.kind !== 'door')} castShadow={false}>
          <meshPhysicalMaterial
            color={lighting === 'daylight' ? '#A3BDCC' : '#FFE29A'}
            transparent
            opacity={0.65}
            roughness={0.05}
            metalness={0.2}
            clearcoat={1}
            emissive={lighting === 'daylight' ? '#000000' : '#FFAE42'}
            emissiveIntensity={light.glow}
          />
        </MergedMesh>

        {/* Pillars */}
        {geometry.pillars.map((pillar, idx) => (
          <mesh key={`p-${idx}`} position={pillar.position} castShadow receiveShadow>
            <cylinderGeometry args={[pillar.radius, pillar.radius, pillar.height, 20]} />
            <meshStandardMaterial color={materials.woodAccent.color} roughness={materials.woodAccent.roughness} />
          </mesh>
        ))}

        {/* Railings */}
        <MergedMesh boxes={geometry.railings} castShadow={false}>
          <meshPhysicalMaterial
            color="#A8B498"
            transparent
            opacity={0.6}
            roughness={0.2}
            metalness={0.3}
          />
        </MergedMesh>

        {/* Roof Structures */}
        {geometry.roofs.map((roof, idx) => (
          <FacadeRoof key={`roof-${idx}`} roof={roof} materials={materials} />
        ))}

        {/* Ground Contact Shadows */}
        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={lighting === 'evening' ? 0.3 : 0.55}
          scale={maxDim * 2.2}
          blur={2.4}
          far={10}
          resolution={512}
          frames={1}
        />
      </Canvas>

      {/* Floating Instruction HUD */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-md bg-stone-950/80 px-3 py-1.5 border border-stone-800 text-[11px] text-stone-300 backdrop-blur">
        <span>Drag to orbit in 360° · Scroll to zoom · Real-time client-side WebGL Facade</span>
      </div>
    </div>
  );
}
