'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, OrthographicCamera, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { roofLiftOffset, ShowcaseSpace, ShowcaseState } from '@/lib/showcase-state';

type V3 = [number, number, number];
type SceneProps = { state: ShowcaseState; reducedMotion: boolean; onSpace: (space: ShowcaseSpace) => void; onReady: () => void };

const C = { plaster: '#e6e2d7', stone: '#b7b3a3', wood: '#8f6443', frame: '#3b4038', leaf: '#667553', grass: '#84906b', fabric: '#e3d5bb' };

const FLOWER_COLORS = ['#E0218A', '#F472B6', '#FBCFE8', '#FDA4AF', '#BE185D', '#EA4FA2'];

/** Sculpted 5-lobed blossom geometry with organic radial petal clefts */
function build5PetalGeometry(radius = 0.16): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const wave = Math.cos(5 * theta);
    const lobe = wave > 0 ? Math.pow(wave, 0.72) : 0;
    const r = radius * (0.28 + 0.72 * lobe);
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function Block({ at, size, color = C.plaster, roughness = .85, ...props }: { at: V3; size: V3; color?: string; roughness?: number } & Partial<JSX.IntrinsicElements['mesh']>) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} /></mesh>;
}

function Glass({ at, size, evening }: { at: V3; size: V3; evening: boolean }) {
  return <mesh position={at}><boxGeometry args={size} /><meshPhysicalMaterial color={evening ? '#c49a60' : '#b6c8bd'} transparent opacity={evening ? .35 : .22} roughness={.12} metalness={.25} depthWrite={false} side={THREE.DoubleSide} /></mesh>;
}

/** Flowering blossom tree with distinct 5-petaled flowers, golden pistils, lush foliage, and fallen petals */
function Tree({ at, scale = 1, seed = 0 }: { at: V3; scale?: number; seed?: number }) {
  const flowerGeo = useMemo(() => build5PetalGeometry(0.18), []);
  useEffect(() => () => flowerGeo.dispose(), [flowerGeo]);

  // Blossoming canopy flowers
  const blossoms = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const a = i * 2.39996 + seed;
    const rad = 0.42 + (i % 6) * 0.16;
    const y = 2.15 + Math.sin(i * 1.5 + seed) * 0.52;
    const pos: V3 = [Math.cos(a) * rad, y, Math.sin(a) * rad];
    const rot: V3 = [
      Math.sin(i * 1.3) * 0.6 + 0.2,
      a + Math.PI / 2,
      Math.cos(i * 1.7) * 0.4
    ];
    const s = 0.85 + (i % 4) * 0.18;
    const color = FLOWER_COLORS[i % FLOWER_COLORS.length];
    return { pos, rot, s, color };
  }), [seed]);

  // Deep foliage accents underneath flowers
  const foliage = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const a = i * 1.8 + seed;
    const rad = 0.35 + (i % 3) * 0.14;
    return {
      pos: [Math.cos(a) * rad, 1.95 + Math.sin(i * 2 + seed) * 0.35, Math.sin(a) * rad] as V3,
      scale: [0.32, 0.22, 0.32] as V3,
      rot: [i * 0.5, i * 0.7, i * 0.3] as V3
    };
  }), [seed]);

  // Fallen petals resting on the planter surface
  const fallenPetals = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = i * 1.9 + seed;
    const dist = 0.25 + (i % 5) * 0.22;
    return {
      pos: [Math.cos(angle) * dist * 1.4, 0.02, Math.sin(angle) * dist] as V3,
      rot: [-Math.PI / 2, 0, i * 0.8] as V3,
      scale: 0.6 + (i % 3) * 0.2,
      color: FLOWER_COLORS[(i + 1) % FLOWER_COLORS.length]
    };
  }), [seed]);

  return <group position={at} scale={scale}>
    {/* Architectural woody trunk */}
    <mesh position={[0, 1.05, 0]} castShadow>
      <cylinderGeometry args={[0.05, 0.11, 2.1, 8]} />
      <meshStandardMaterial color="#5A4632" roughness={0.9} />
    </mesh>

    {/* Primary and secondary branches */}
    {[0, 1, 2, 3].map((i) => {
      const angle = (i * Math.PI) / 2 + 0.3;
      return (
        <mesh
          key={`branch-${i}`}
          position={[Math.cos(angle) * 0.22, 1.72 + (i % 2) * 0.15, Math.sin(angle) * 0.22]}
          rotation={[0.35 * Math.sin(angle), 0, 0.38 * Math.cos(angle)]}
          castShadow
        >
          <cylinderGeometry args={[0.022, 0.045, 1.1, 6]} />
          <meshStandardMaterial color="#5A4632" roughness={0.88} />
        </mesh>
      );
    })}

    {/* Green foliage clusters nestled under blossoms */}
    {foliage.map((leaf, i) => (
      <mesh key={`leaf-${i}`} position={leaf.pos} scale={leaf.scale} rotation={leaf.rot} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={i % 2 ? '#4D5D3B' : '#3B4D2E'} roughness={0.95} />
      </mesh>
    ))}

    {/* Blooming 5-petaled flowers with pistil centers */}
    {blossoms.map((b, i) => (
      <group key={`flower-${i}`} position={b.pos} rotation={b.rot} scale={b.s}>
        <mesh geometry={flowerGeo} castShadow receiveShadow>
          <meshStandardMaterial color={b.color} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.012]} castShadow>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#FDE047" emissive="#F59E0B" emissiveIntensity={0.25} roughness={0.35} />
        </mesh>
      </group>
    ))}

    {/* Fallen petals resting on the surface */}
    {fallenPetals.map((fp, i) => (
      <mesh key={`fallen-${i}`} position={fp.pos} rotation={fp.rot} scale={fp.scale}>
        <circleGeometry args={[0.06, 12]} />
        <meshStandardMaterial color={fp.color} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    ))}
  </group>;
}

function Planting({ at, length, axis = 'x' }: { at: V3; length: number; axis?: 'x' | 'z' }) {
  return <group position={at}>
    <Block at={[0, .13, 0]} size={axis === 'x' ? [length, .26, .55] : [.55, .26, length]} color="#9c9d88" />
    {Array.from({ length: Math.ceil(length * 4) }, (_, i) => {
      const p = -length / 2 + .15 + i * .25;
      return <mesh key={i} position={[axis === 'x' ? p : Math.sin(i * 3) * .1, .43 + (i % 3) * .045, axis === 'z' ? p : Math.sin(i * 3) * .1]} scale={[.23, .32 + (i % 4) * .05, .23]} castShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={i % 2 ? '#687552' : '#84906b'} roughness={1} /></mesh>;
    })}
  </group>;
}

function Sofa({ at, rotation = 0 }: { at: V3; rotation?: number }) {
  return <group position={at} rotation={[0, rotation, 0]}>
    <Block at={[0, .18, 0]} size={[2.5, .18, .9]} color={C.wood} />
    <RoundedBox args={[2.45, .3, .87]} radius={.08} position={[0, .41, 0]} castShadow><meshStandardMaterial color={C.fabric} roughness={1} /></RoundedBox>
    <RoundedBox args={[2.45, .55, .2]} radius={.06} position={[0, .67, -.37]} castShadow><meshStandardMaterial color={C.fabric} /></RoundedBox>
    {[-1.1, 1.1].map(x => <Block key={x} at={[x, .59, 0]} size={[.22, .35, .95]} color={C.fabric} />)}
    {[-.7, .1, .75].map((x, i) => <RoundedBox key={x} args={[.5, .42, .16]} radius={.055} position={[x, .67, -.2]} rotation={[.15, 0, .1 * (i - 1)]}><meshStandardMaterial color={i === 1 ? '#9b7855' : '#c4bea6'} /></RoundedBox>)}
  </group>;
}

function Roof({ open, reducedMotion }: { open: boolean; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => { invalidate(); }, [open, invalidate]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = roofLiftOffset(open ? 1 : 0);
    const next = reducedMotion ? target : THREE.MathUtils.damp(ref.current.position.y, target, 5, Math.min(dt, .05));
    ref.current.position.y = Math.abs(next - target) < .003 ? target : next;
    if (ref.current.position.y !== target) invalidate();
  });
  return <group ref={ref}>
    <Block at={[-2.15, 3.12, .15]} size={[4.7, .23, 6.8]} />
    <Block at={[2.15, 3.12, -2.05]} size={[4.15, .23, 2.4]} />
    <Block at={[-2.15, 3.26, .15]} size={[4.4, .08, 6.5]} color="#c1c1ad" />
    <Block at={[2.15, 3.26, -2.05]} size={[3.85, .08, 2.1]} color="#c1c1ad" />
    {/* A timber pergola spans the veranda, attached to the roof assembly. */}
    {Array.from({ length: 19 }, (_, i) => <Block key={i} at={[.37 + i * .2, 2.94, .7]} size={[.075, .13, 3.25]} color={C.wood} />)}
    <Block at={[2.17, 2.87, 2.25]} size={[4, .2, .14]} color={C.wood} />
  </group>;
}

function Marker({ at, selected, onClick }: { at: V3; selected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  return <group position={at}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onClick} onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <ringGeometry args={[.15, .23, 40]} /><meshBasicMaterial color={selected ? '#d3a25f' : '#fff9e8'} side={THREE.DoubleSide} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onClick}><circleGeometry args={[.3, 32]} /><meshBasicMaterial transparent opacity={.03} depthWrite={false} /></mesh>
    <mesh position={[0, -.1, 0]}><cylinderGeometry args={[.014, .014, .2, 8]} /><meshBasicMaterial color="#f9f5e9" /></mesh>
  </group>;
}

function House({ state, reducedMotion, onSpace }: Omit<SceneProps, 'onReady'>) {
  const evening = state.lighting === 'evening';
  const select = (space: ShowcaseSpace) => (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSpace(space); };
  return <group position={[0, .18, 0]}>
    {/* Mineral plinth, supported terrace and solid stepped entry. */}
    <Block at={[0, -.15, 0]} size={[12.4, .3, 10.4]} color="#b8b6a7" />
    <Block at={[0, .04, 0]} size={[12, .1, 10]} color="#d3d0bf" />
    <Block at={[-2, .16, .1]} size={[4.7, .2, 6.7]} color="#c8c4b2" />
    <Block at={[2.15, .16, -2.05]} size={[4.1, .2, 2.35]} color="#c8c4b2" />
    <Block at={[2.15, .11, .75]} size={[4.1, .12, 3.35]} color="#b7a387" />
    {Array.from({ length: 17 }, (_, i) => <Block key={i} at={[2.15, .178, -.83 + i * .195]} size={[4.05, .012, .012]} color="#948268" />)}
    {[0, 1, 2].map(i => <Block key={i} at={[-2, .05 - i * .065, 3.6 + i * .32]} size={[2.2, .14, .35]} color="#bcb8a9" />)}
    {/* Walls stop at actual glazed openings; interior furniture remains visible. */}
    <Block at={[-4.25, 1.61, .1]} size={[.2, 2.7, 6.5]} />
    <Block at={[-.1, 1.61, -3.1]} size={[8.4, 2.7, .2]} />
    <Block at={[-2.2, 1.61, 3.3]} size={[4.3, 2.7, .2]} />
    <Block at={[-2.2, 1.61, -3.1]} size={[4.3, 2.7, .2]} />
    <Block at={[4.12, 1.61, -2.1]} size={[.18, 2.7, 2.1]} />
    <Block at={[-2.2, 1.61, -.9]} size={[3.9, 2.7, .12]} />
    {/* Low perimeter, roof-supporting piers, sliding glass and bronze frames. */}
    {[.0, -2.05, 3.25].map(z => <Block key={z} at={[.05, 1.62, z]} size={[.15, 2.75, .15]} color={C.frame} />)}
    {[.05, 2.05, 4.05].map(x => <Block key={x} at={[x, 1.62, -.97]} size={[.065, 2.75, .07]} color={C.frame} />)}
    <Glass at={[.07, 1.63, 1.15]} size={[.035, 2.6, 4.15]} evening={evening} />
    <Glass at={[2.05, 1.63, -.97]} size={[4, 2.6, .035]} evening={evening} />
    <Block at={[.07, .3, 1.15]} size={[.085, .055, 4.15]} color={C.frame} />
    <Block at={[2.05, .3, -.97]} size={[4, .055, .08]} color={C.frame} />
    {/* Tall external timber screen, true slats with visible depth and spacing. */}
    {Array.from({ length: 14 }, (_, i) => <Block key={i} at={[-3.96 + i * .3, 1.65, 3.42]} size={[.1, 2.7, .23]} color={i % 3 ? C.wood : '#a77d52'} />)}
    <Block at={[-2, 2.98, 3.42]} size={[4.25, .12, .25]} color={C.wood} />
    <Roof open={state.roofOpen} reducedMotion={reducedMotion} />
    {/* Interior: lounge, rug, low table, quiet rear studio. */}
    <Block at={[-2.1, .275, 1.05]} size={[3.3, .02, 2.9]} color="#d6cfb9" />
    <Sofa at={[-3.35, .27, 1]} rotation={Math.PI / 2} />
    <Block at={[-1.9, .57, 1.1]} size={[1, .45, .9]} color="#9e8e70" />
    <Block at={[-1.95, .81, 1.15]} size={[.35, .025, .25]} color="#e9e1cc" />
    <mesh position={[-1.7, .83, .9]}><cylinderGeometry args={[.13, .09, .06, 20]} /><meshStandardMaterial color="#6c7558" /></mesh>
    <Block at={[-2.3, 1.02, -2.2]} size={[2.9, .12, .7]} color={C.wood} />
    {[-3.45, -1.15].map(x => <Block key={x} at={[x, .65, -2.2]} size={[.07, .65, .65]} color={C.frame} />)}
    <Block at={[-2.3, 1.35, -2.36]} size={[.8, .5, .055]} color={C.frame} />
    <Block at={[-2.3, 1.04, -1.9]} size={[.8, .025, .22]} color="#a9aaa1" />
    {/* Courtyard seating, tree island and planted perimeter. */}
    <Sofa at={[2.25, .18, -.15]} />
    <mesh position={[2.25, .62, 1.05]} castShadow receiveShadow><cylinderGeometry args={[.58, .58, .16, 40]} /><meshStandardMaterial color="#c6bea7" roughness={.9} /></mesh>
    <Block at={[2.25, .37, 1.05]} size={[.3, .35, .3]} color={C.wood} />
    <Block at={[2.2, .22, 3.55]} size={[2.6, .28, 1.7]} color="#b4b19c" />
    <Block at={[2.2, .37, 3.55]} size={[2.4, .03, 1.5]} color="#8f9575" />
    <Tree at={[2.2, .4, 3.55]} scale={.95} />
    <Tree at={[-5.05, .1, -3.8]} scale={1.3} seed={5} />
    <Planting at={[-5.1, .1, .7]} length={4.8} axis="z" />
    <Planting at={[.5, .1, -4.25]} length={7.7} />
    <Planting at={[5.3, .1, -.5]} length={6.9} axis="z" />
    {/* Quiet reflecting basin; the surface sits inside a stone rim. */}
    <Block at={[-2.1, .13, 4.43]} size={[4.2, .15, .6]} color="#8d9481" />
    <mesh position={[-2.1, .22, 4.43]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4, .42]} /><meshStandardMaterial color="#657e72" metalness={.48} roughness={.16} /></mesh>
    {/* Visible under-eave emitters share locations with evening practical lights. */}
    {[-2.5, 1.8].map((x, i) => <group key={x} position={[x, 2.78, i ? -1.5 : 1]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[.065, 16]} /><meshStandardMaterial color="#ebd2a1" emissive="#ffbe6b" emissiveIntensity={evening ? 3 : 0} /></mesh>
      <pointLight color="#ffc27c" intensity={evening ? 19 : 0} distance={6} decay={2} />
    </group>)}
    <Marker at={[-1.2, 1.2, 1.85]} selected={state.space === 'living'} onClick={select('living')} />
    <Marker at={[3.6, .65, 2.5]} selected={state.space === 'courtyard'} onClick={select('courtyard')} />
    <Marker at={[-1.35, 1.45, -1.6]} selected={state.space === 'studio'} onClick={select('studio')} />
  </group>;
}

function CameraRig({ view, resetKey, reducedMotion, roofOpen }: { view: number; resetKey: number; reducedMotion: boolean; roofOpen: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const moving = useRef(false);
  const target = useRef(new THREE.Vector3());
  useEffect(() => {
    const a = Math.PI / 4 + view * Math.PI / 2;
    target.current.set(Math.cos(a) * 17, 14.5, Math.sin(a) * 17);
    moving.current = true;
    invalidate();
  }, [view, resetKey, invalidate]);
  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(size.width / 18.8, size.height / 14.2) * (roofOpen ? .88 : 1);
      camera.updateProjectionMatrix();
      controls.current?.target.set(0, roofOpen ? 1.75 : 1, 0);
      controls.current?.update();
      invalidate();
    }
  }, [camera, size.width, size.height, invalidate, roofOpen]);
  useFrame((_, dt) => {
    if (!moving.current) return;
    if (reducedMotion || camera.position.distanceTo(target.current) < .025) { camera.position.copy(target.current); moving.current = false; }
    else camera.position.lerp(target.current, 1 - Math.exp(-5 * Math.min(dt, .05)));
    controls.current?.update();
    invalidate();
  });
  return <OrbitControls ref={controls} target={[0, 1, 0]} enablePan={false} enableZoom={false} enableDamping={!reducedMotion} dampingFactor={.12} rotateSpeed={.6} minPolarAngle={.3} maxPolarAngle={1.3} onStart={() => { moving.current = false; }} />;
}

function Scene({ state, reducedMotion, onSpace, onReady }: SceneProps) {
  const evening = state.lighting === 'evening';
  useEffect(() => { onReady(); }, [onReady]);
  return <>
    <OrthographicCamera makeDefault position={[17, 14.5, 17]} zoom={40} near={.1} far={120} />
    <CameraRig view={state.view} resetKey={state.resetKey} reducedMotion={reducedMotion} roofOpen={state.roofOpen} />
    <hemisphereLight args={[evening ? '#a7b1cb' : '#fff7e6', '#83876c', evening ? .6 : 1.5]} />
    <directionalLight position={evening ? [-8, 5, 5] : [-7, 12, 7]} intensity={evening ? .8 : 3.2} color={evening ? '#ecc3a0' : '#fff0d6'} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-camera-near={1} shadow-camera-far={45} shadow-normalBias={.025} shadow-bias={-.0001} />
    <Environment resolution={64} frames={1}>
      <Lightformer position={[0, 8, -8]} scale={[18, 8, 1]} intensity={1.5} color="#fff6e5" />
      <Lightformer position={[8, 5, 4]} scale={[12, 6, 1]} intensity={.7} color="#dce5d6" />
    </Environment>
    <House state={state} reducedMotion={reducedMotion} onSpace={onSpace} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.23, 0]} receiveShadow><planeGeometry args={[200, 200]} /><shadowMaterial transparent opacity={evening ? .19 : .12} /></mesh>
    <ContactShadows position={[0, -.215, 0]} opacity={.35} scale={24} blur={2.8} far={5} resolution={512} frames={1} />
  </>;
}

export default function CourtyardScene(props: SceneProps) {
  return <Canvas shadows frameloop="demand" dpr={[1, 1.65]} gl={{ antialias: true, alpha: true, powerPreference: 'low-power', toneMapping: THREE.ACESFilmicToneMapping }} onPointerMissed={() => { document.body.style.cursor = ''; }}>
    <Scene {...props} />
  </Canvas>;
}
