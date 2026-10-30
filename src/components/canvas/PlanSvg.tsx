'use client';

import React, { useId, useMemo } from 'react';
import { FloorPlanOpening, FloorPlanRoom, RoomType, StructuredDesignJSON } from '@/types/architectural';
import { inferRoomType } from '@/lib/design/roomTypes';
import { planStair, stairY } from '@/lib/geometry/stairGeometry';

export const PLAN_CANVAS = 800;
const MARGIN = 64;
const OPEN_AIR: RoomType[] = ['courtyard', 'terrace', 'balcony', 'parking'];
const COMPASS_RING = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export type PlanTheme = 'paper' | 'plum';

interface Palette {
  plot: string;
  plotLine: string;
  envelope: string;
  wall: string;
  gap: string;
  text: string;
  muted: string;
  glass: string;
  glassLine: string;
  swing: string;
  select: string;
  road: string;
  roadText: string;
  stair: string;
  dim: string;
  furniture: string;
  fills: Record<'public' | 'kitchen' | 'sleep' | 'wet' | 'service' | 'entry' | 'circulation' | 'parking' | 'outdoor', string>;
}

const PALETTES: Record<PlanTheme, Palette> = {
  paper: {
    plot: '#EFF1EB',
    plotLine: '#7C896A',
    envelope: '#66764F',
    wall: '#232822',
    gap: '#FAFAF8',
    text: '#232822',
    muted: '#70766C',
    glass: '#CFE0E6',
    glassLine: '#5B7C8C',
    swing: '#66764F',
    select: '#66764F',
    road: '#E4D9C8',
    roadText: '#575D53',
    stair: '#70766C',
    dim: '#626F51',
    furniture: '#838D7C',
    fills: {
      public: '#F5F6F1', kitchen: '#ECEFE7', sleep: '#EBEEE8', wet: '#E4EBE9', service: '#EDEFE8',
      entry: '#E4E9DD', circulation: '#E4E8DF', parking: '#E4E7E1', outdoor: '#E3EAD9'
    }
  },
  plum: {
    plot: 'rgba(177,188,160,0.04)',
    plotLine: '#B1BCA0',
    envelope: '#98A67E',
    wall: '#E1E6D6',
    gap: '#28302A',
    text: '#F0F2E9',
    muted: '#A7B09F',
    glass: '#53664F',
    glassLine: '#CBD2BC',
    swing: '#98A67E',
    select: '#98A67E',
    road: 'rgba(177,188,160,0.08)',
    roadText: '#B1BCA0',
    stair: '#B1BCA0',
    dim: '#B1BCA0',
    furniture: '#A7B09F',
    fills: {
      public: 'rgba(177,188,160,0.09)', kitchen: 'rgba(152,166,126,0.09)', sleep: 'rgba(152,166,126,0.14)', wet: 'rgba(167,139,250,0.12)',
      service: 'rgba(255,255,255,0.05)', entry: 'rgba(177,188,160,0.12)', circulation: 'rgba(255,255,255,0.07)', parking: 'rgba(255,255,255,0.04)', outdoor: 'rgba(120,170,130,0.1)'
    }
  }
};

function fillFor(type: RoomType, palette: Palette): string {
  switch (type) {
    case 'living': case 'lounge': case 'dining': return palette.fills.public;
    case 'kitchen': return palette.fills.kitchen;
    case 'master_bedroom': case 'bedroom': case 'guest_room': return palette.fills.sleep;
    case 'bathroom': case 'dressing': return palette.fills.wet;
    case 'study': case 'utility': case 'store': case 'puja': return palette.fills.service;
    case 'entrance': return palette.fills.entry;
    case 'passage': case 'stair': return palette.fills.circulation;
    case 'parking': return palette.fills.parking;
    case 'courtyard': case 'terrace': case 'balcony': return palette.fills.outdoor;
    default: return 'none';
  }
}

const ftLabel = (value: number) => {
  const rounded = Math.round(value * 2) / 2;
  return `${rounded}'`;
};

interface PlanSvgProps {
  design: StructuredDesignJSON;
  floor: number;
  theme?: PlanTheme;
  selectedRoomId?: string;
  onRoomSelect?: (room: FloorPlanRoom) => void;
  showAnnotations?: boolean;
  /** Draw the road, plot boundary, setbacks and compass. Off for a clean artwork crop. */
  showSite?: boolean;
  /** Frame the viewBox tightly around the building instead of the whole plot. */
  crop?: boolean;
  className?: string;
}

/**
 * Pure drawing of one floor of the canonical design. Every mark comes from design.rooms, design.walls,
 * design.openings and design.stairs; nothing here invents or adjusts geometry.
 */
export default function PlanSvg({ design, floor, theme = 'paper', selectedRoomId, onRoomSelect, showAnnotations = true, showSite = true, crop = false, className }: PlanSvgProps) {
  const palette = PALETTES[theme];
  const uid = useId().replace(/:/g, '');
  const plotWidth = design.plot?.width || 40;
  const plotDepth = design.plot?.depth || 60;
  const scale = (PLAN_CANVAS - MARGIN * 2) / Math.max(plotWidth, plotDepth);
  const offsetX = (PLAN_CANVAS - plotWidth * scale) / 2;
  const offsetY = (PLAN_CANVAS - plotDepth * scale) / 2;
  const fx = (ft: number) => offsetX + ft * scale;
  const fy = (ft: number) => offsetY + ft * scale;
  const px = (pct: number) => fx((pct / 100) * plotWidth);
  const py = (pct: number) => fy((pct / 100) * plotDepth);
  const pw = (pct: number) => (pct / 100) * plotWidth * scale;
  const ph = (pct: number) => (pct / 100) * plotDepth * scale;

  const isCanonical = (design.schemaVersion || 1) >= 2;
  const rooms = useMemo(() => design.rooms.filter((r) => (r.position.floorLevel || 0) === floor), [design.rooms, floor]);
  const walls = useMemo(() => (design.walls || []).filter((w) => (w.floorLevel ?? 0) === floor), [design.walls, floor]);
  const openings = useMemo(
    () => (design.openings || []).filter((op) => (typeof op.floorLevel === 'number' ? op.floorLevel === floor : floor === 0)),
    [design.openings, floor]
  );
  const topFloor = Math.max(0, ...design.rooms.map((r) => r.position.floorLevel || 0));
  const footSide = design.stairs?.[0]?.footSide || 'rear';
  const setbacks = design.plot?.setbacks;
  const orientation = design.plot?.orientation || 'N';

  const solidRooms = rooms.filter((room) => inferRoomType(room) !== 'void');
  const bounds = solidRooms.length
    ? {
        x0: Math.min(...solidRooms.map((r) => r.position.x)),
        x1: Math.max(...solidRooms.map((r) => r.position.x + r.position.width)),
        y0: Math.min(...solidRooms.map((r) => r.position.y)),
        y1: Math.max(...solidRooms.map((r) => r.position.y + r.position.height))
      }
    : null;

  let viewBox = `0 0 ${PLAN_CANVAS} ${PLAN_CANVAS}`;
  if (crop) {
    const all = design.rooms.filter((r) => inferRoomType(r) !== 'void');
    if (all.length) {
      const x0 = Math.min(...all.map((r) => px(r.position.x)));
      const x1 = Math.max(...all.map((r) => px(r.position.x + r.position.width)));
      const y0 = Math.min(...all.map((r) => py(r.position.y)));
      const y1 = Math.max(...all.map((r) => py(r.position.y + r.position.height)));
      const pad = 26;
      viewBox = `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
    }
  }

  const wallThickness = (exterior: boolean) => (exterior ? 0.75 : 0.4) * scale;

  const renderOpening = (op: FloorPlanOpening) => {
    const cx = px(op.x);
    const cy = py(op.y);
    const horizontal = (op.orientation || 'horizontal') === 'horizontal';
    const length = Math.max(8, (isCanonical ? op.width : 3) * scale);
    const t = wallThickness(!!op.isExterior);
    const half = length / 2;
    // Work in a frame where the wall runs along +u and the swing side is +v, then rotate into place.
    const u0 = -half;
    const u1 = half;
    const hingeAtStart = (op.hinge || 'start') === 'start';
    const side = op.swingSide || 1;
    const rotate = horizontal ? 0 : 90;
    // For a vertical wall, rotating by 90° maps +u to +y and +v to -x, so the swing side flips.
    const v = horizontal ? side : -side;
    const hingeU = hingeAtStart ? u0 : u1;
    const freeU = hingeAtStart ? u1 : u0;
    const gap = <rect x={u0} y={-t / 2 - 0.6} width={length} height={t + 1.2} fill={palette.gap} />;

    return (
      <g key={op.id} transform={`translate(${cx} ${cy}) rotate(${rotate})`} pointerEvents="none">
        <title>{op.label}</title>
        {op.type === 'door' && (
          <>
            {gap}
            <line x1={hingeU} y1={0} x2={hingeU} y2={v * length} stroke={palette.wall} strokeWidth={1.8} strokeLinecap="round" />
            <path
              d={`M ${hingeU} ${v * length} A ${length} ${length} 0 0 ${v * (hingeAtStart ? 1 : -1) < 0 ? 1 : 0} ${freeU} 0`}
              fill="none"
              stroke={palette.swing}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.9}
            />
          </>
        )}
        {op.type === 'archway' && (
          <>
            {gap}
            <line x1={u0} y1={-t / 2} x2={u0} y2={t / 2} stroke={palette.wall} strokeWidth={1.4} />
            <line x1={u1} y1={-t / 2} x2={u1} y2={t / 2} stroke={palette.wall} strokeWidth={1.4} />
            <line x1={u0} y1={0} x2={u1} y2={0} stroke={palette.muted} strokeWidth={1} strokeDasharray="2 3" />
          </>
        )}
        {op.type === 'sliding_glass' && (
          <>
            {gap}
            <line x1={u0} y1={-t * 0.22} x2={half * 0.15} y2={-t * 0.22} stroke={palette.glassLine} strokeWidth={1.6} />
            <line x1={-half * 0.15} y1={t * 0.22} x2={u1} y2={t * 0.22} stroke={palette.glassLine} strokeWidth={1.6} />
          </>
        )}
        {op.type === 'window' && (
          <>
            {gap}
            <rect x={u0} y={-t * 0.32} width={length} height={t * 0.64} fill={palette.glass} stroke={palette.glassLine} strokeWidth={1} />
            <line x1={u0} y1={0} x2={u1} y2={0} stroke={palette.glassLine} strokeWidth={0.8} />
          </>
        )}
      </g>
    );
  };

  const mainDoor = floor === 0 ? openings.find((op) => op.id === 'op-main') : undefined;
  const northAngle = -Math.max(0, COMPASS_RING.indexOf(orientation)) * 45;

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={`Floor plan, ${floor === 0 ? 'ground floor' : `floor ${floor}`}`}>
      <defs>
        <pattern id={`${uid}-hatch`} width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="9" stroke={theme === 'paper' ? '#4A6B5D' : '#7FB38F'} strokeWidth="1" opacity="0.32" />
        </pattern>
      </defs>

      {showSite && (
        <>
          {/* Road at the plan front */}
          <rect x={offsetX - 28} y={offsetY - 40} width={plotWidth * scale + 56} height="28" fill={palette.road} />
          <text x={PLAN_CANVAS / 2} y={offsetY - 22} textAnchor="middle" fill={palette.roadText} fontSize="11.5" fontWeight="600" fontFamily="var(--font-sans), sans-serif" letterSpacing="0.4">
            Road · plot faces {orientation}
          </text>
          <rect x={offsetX} y={offsetY} width={plotWidth * scale} height={plotDepth * scale} fill={palette.plot} stroke={palette.plotLine} strokeWidth="1.4" strokeDasharray="9 5" />
          {setbacks && (
            <rect
              x={fx(setbacks.left)}
              y={fy(setbacks.front)}
              width={(plotWidth - setbacks.left - setbacks.right) * scale}
              height={(plotDepth - setbacks.front - setbacks.rear) * scale}
              fill="none"
              stroke={palette.envelope}
              strokeWidth="1"
              strokeDasharray="2 5"
              opacity="0.7"
            />
          )}
        </>
      )}

      {/* Room fills, hatching for open-air spaces, stairs and furniture */}
      {rooms.map((room) => {
        const type = inferRoomType(room);
        const rx = px(room.position.x);
        const ry = py(room.position.y);
        const rw = pw(room.position.width);
        const rh = ph(room.position.height);
        const isSelected = room.id === selectedRoomId;
        const isVoid = type === 'void';
        const openAir = OPEN_AIR.includes(type);

        let stair: React.ReactNode = null;
        if (type === 'stair') {
          const rect = { x: (room.position.x / 100) * plotWidth, y: (room.position.y / 100) * plotDepth, w: (room.position.width / 100) * plotWidth, d: (room.position.height / 100) * plotDepth };
          const plan = planStair(rect, footSide);
          const yAt = (s: number) => fy(stairY(rect, footSide, s));
          const half = rw / 2;
          const lines: React.ReactNode[] = [];
          for (let i = 0; i <= plan.perFlight; i++) {
            const y = yAt(plan.footDepth + i * plan.tread);
            lines.push(<line key={i} x1={rx} y1={y} x2={rx + rw} y2={y} stroke={palette.stair} strokeWidth={i === 0 ? 1.4 : 0.9} />);
          }
          const landingY = yAt(rect.d - plan.landingDepth);
          const arrow = (xc: number, away: boolean) => {
            const y0 = yAt(plan.footDepth + 0.5);
            const y1 = yAt(rect.d - plan.landingDepth - 0.5);
            const [from, to] = away ? [y0, y1] : [y1, y0];
            const dir = Math.sign(to - from) || 1;
            return (
              <g key={`${xc}-${away}`} stroke={palette.stair} fill={palette.stair} strokeWidth="1.1">
                <line x1={xc} y1={from} x2={xc} y2={to - dir * 4} />
                <path d={`M ${xc} ${to} l -3.2 ${-dir * 6} l 6.4 0 z`} stroke="none" />
              </g>
            );
          };
          stair = (
            <g pointerEvents="none">
              {lines}
              <line x1={rx + half} y1={yAt(plan.footDepth)} x2={rx + half} y2={landingY} stroke={palette.stair} strokeWidth="1.2" />
              <line x1={rx} y1={landingY} x2={rx + rw} y2={landingY} stroke={palette.stair} strokeWidth="1.4" />
              {floor < topFloor && arrow(rx + half / 2, true)}
              {floor > 0 && arrow(rx + half + half / 2, true)}
              {rw > 36 && (
                <g fontSize="9" fontWeight="700" fill={palette.text} fontFamily="var(--font-sans), sans-serif" textAnchor="middle">
                  {floor < topFloor && <text x={rx + half / 2} y={yAt(plan.footDepth / 2) + 3}>UP</text>}
                  {floor > 0 && <text x={rx + half + half / 2} y={yAt(plan.footDepth / 2) + 3}>DN</text>}
                </g>
              )}
            </g>
          );
        }

        return (
          <g key={room.id} onClick={() => onRoomSelect && onRoomSelect(room)} className={onRoomSelect ? 'cursor-pointer' : undefined}>
            {!isVoid && <rect x={rx} y={ry} width={rw} height={rh} fill={isSelected ? (theme === 'paper' ? '#FBE3EF' : 'rgba(152,166,126,0.28)') : fillFor(type, palette)} />}
            {(openAir || isVoid) && <rect x={rx} y={ry} width={rw} height={rh} fill={`url(#${uid}-hatch)`} pointerEvents="none" />}
            {(openAir || isVoid) && <rect x={rx} y={ry} width={rw} height={rh} fill="none" stroke={palette.muted} strokeWidth="1" strokeDasharray="5 4" pointerEvents="none" />}
            {isVoid && (
              <>
                <line x1={rx} y1={ry} x2={rx + rw} y2={ry + rh} stroke={palette.muted} strokeWidth="0.9" />
                <line x1={rx + rw} y1={ry} x2={rx} y2={ry + rh} stroke={palette.muted} strokeWidth="0.9" />
              </>
            )}
            {stair}
            {(design.furniture || []).filter((f) => f.roomId === room.id).map((f) => {
              const fx0 = px(f.x);
              const fy0 = py(f.y);
              const fw = pw(f.width);
              const fh = ph(f.height);
              if (fw < 14 || fh < 8) return null;
              return (
                <g key={f.id} pointerEvents="none" opacity="0.55" stroke={palette.furniture} fill="none" strokeWidth="0.9">
                  <rect x={fx0} y={fy0} width={fw} height={fh} rx="2" />
                  {f.type === 'bed' && (
                    <>
                      <rect x={fx0 + 3} y={fy0 + 3} width={fw / 2 - 5} height={Math.min(fh / 4, 9)} rx="1.5" />
                      <rect x={fx0 + fw / 2 + 2} y={fy0 + 3} width={fw / 2 - 5} height={Math.min(fh / 4, 9)} rx="1.5" />
                    </>
                  )}
                  {f.type === 'sofa' && <rect x={fx0 + 2} y={fy0 + fh * 0.5} width={fw - 4} height={fh * 0.5 - 2} rx="2" />}
                  {f.type === 'dining_table' && <ellipse cx={fx0 + fw / 2} cy={fy0 + fh / 2} rx={fw / 3} ry={fh / 3} />}
                  {f.type === 'kitchen_counter' && (
                    <>
                      <circle cx={fx0 + fw * 0.25} cy={fy0 + fh / 2} r={Math.min(4, fh / 3)} />
                      <circle cx={fx0 + fw * 0.42} cy={fy0 + fh / 2} r={Math.min(4, fh / 3)} />
                    </>
                  )}
                  {f.type === 'bath_fixture' && <circle cx={fx0 + fw * 0.75} cy={fy0 + fh / 2} r={Math.min(5, fh / 3)} />}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Walls as filled poché: a stroke as thick as the wall with square caps closes every corner */}
      <g strokeLinecap="square" pointerEvents="none">
        {walls.map((wall) => (
          <line key={wall.id} x1={px(wall.x1)} y1={py(wall.y1)} x2={px(wall.x2)} y2={py(wall.y2)} stroke={palette.wall} strokeWidth={wallThickness(wall.isExterior)} />
        ))}
        {!walls.length && !isCanonical && rooms.map((room) => (
          <rect key={room.id} x={px(room.position.x)} y={py(room.position.y)} width={pw(room.position.width)} height={ph(room.position.height)} fill="none" stroke={palette.wall} strokeWidth="2" />
        ))}
      </g>

      {openings.map(renderOpening)}

      {/* Selection outline above the walls */}
      {rooms.filter((room) => room.id === selectedRoomId).map((room) => (
        <rect key={room.id} x={px(room.position.x) + 1.5} y={py(room.position.y) + 1.5} width={pw(room.position.width) - 3} height={ph(room.position.height) - 3} fill="none" stroke={palette.select} strokeWidth="2.2" pointerEvents="none" />
      ))}

      {/* Room labels */}
      {rooms.map((room) => {
        const type = inferRoomType(room);
        if (type === 'void') return null;
        const rx = px(room.position.x);
        const ry = py(room.position.y);
        const rw = pw(room.position.width);
        const rh = ph(room.position.height);
        const small = rw < 78 || rh < 48;
        const tiny = rw < 48 || rh < 28;
        const stair = type === 'stair';
        const maxChars = Math.max(4, Math.floor(rw / (small ? 5.2 : 6.4)));
        const lines: string[] = [];
        for (const word of room.name.split(' ')) {
          if (lines.length && (lines[lines.length - 1] + ' ' + word).length <= maxChars) lines[lines.length - 1] += ' ' + word;
          else lines.push(word);
        }
        const shown = lines.slice(0, tiny ? 1 : small ? 2 : 3);
        const fontSize = tiny ? 8 : small ? 9.5 : 11.5;
        const withDims = showAnnotations && !small && !stair;
        const top = ry + rh / 2 - ((shown.length - 1) * fontSize * 1.15) / 2 - (withDims ? 6 : 0) + (stair ? rh * 0.18 : 0);
        return (
          <g key={`label-${room.id}`} pointerEvents="none" fontFamily="var(--font-sans), sans-serif" textAnchor="middle">
            <text fill={palette.text} fontSize={fontSize} fontWeight="650" stroke={palette.gap} strokeWidth="3.2" strokeLinejoin="round" paintOrder="stroke" strokeOpacity="0.9">
              {shown.map((line, index) => (
                <tspan key={index} x={rx + rw / 2} y={top + index * fontSize * 1.15}>{line}</tspan>
              ))}
            </text>
            {withDims && (
              <text x={rx + rw / 2} y={top + shown.length * fontSize * 1.15 + 2} fill={palette.muted} fontSize="9.5" stroke={palette.gap} strokeWidth="3" strokeLinejoin="round" paintOrder="stroke" strokeOpacity="0.9">
                {room.dimensions}
              </text>
            )}
          </g>
        );
      })}

      {/* Where you walk in */}
      {mainDoor && (() => {
        const horizontal = (mainDoor.orientation || 'horizontal') === 'horizontal';
        const inward = mainDoor.swingSide || 1;
        const cx = px(mainDoor.x);
        const cy = py(mainDoor.y);
        const tipX = horizontal ? cx : cx - inward * 4;
        const tipY = horizontal ? cy - inward * 4 : cy;
        const tailX = horizontal ? cx : cx - inward * 30;
        const tailY = horizontal ? cy - inward * 30 : cy;
        const dx = horizontal ? 0 : inward;
        const dy = horizontal ? inward : 0;
        return (
          <g pointerEvents="none" stroke={palette.select} fill={palette.select} strokeWidth="1.8">
            <line x1={tailX} y1={tailY} x2={tipX - dx * 5} y2={tipY - dy * 5} />
            <path d={`M ${tipX} ${tipY} L ${tipX - dx * 8 - dy * 4.5} ${tipY - dy * 8 + dx * 4.5} L ${tipX - dx * 8 + dy * 4.5} ${tipY - dy * 8 - dx * 4.5} Z`} stroke="none" />
          </g>
        );
      })()}

      {/* Overall dimensions and scale */}
      {showAnnotations && bounds && showSite && (
        <g pointerEvents="none" stroke={palette.dim} fill={palette.dim} strokeWidth="0.9" fontFamily="var(--font-sans), sans-serif" fontSize="10.5" fontWeight="600">
          {(() => {
            const x0 = px(bounds.x0);
            const x1 = px(bounds.x1);
            const y1 = py(bounds.y1) + 20;
            const widthFt = ((bounds.x1 - bounds.x0) / 100) * plotWidth;
            const y0b = py(bounds.y0);
            const y1b = py(bounds.y1);
            const xr = px(bounds.x1) + 20;
            const depthFt = ((bounds.y1 - bounds.y0) / 100) * plotDepth;
            return (
              <>
                <line x1={x0} y1={y1} x2={x1} y2={y1} />
                <line x1={x0} y1={y1 - 4} x2={x0} y2={y1 + 4} />
                <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} />
                <text x={(x0 + x1) / 2} y={y1 + 14} textAnchor="middle" stroke="none">{ftLabel(widthFt)}</text>
                <line x1={xr} y1={y0b} x2={xr} y2={y1b} />
                <line x1={xr - 4} y1={y0b} x2={xr + 4} y2={y0b} />
                <line x1={xr - 4} y1={y1b} x2={xr + 4} y2={y1b} />
                <text transform={`translate(${xr + 14} ${(y0b + y1b) / 2}) rotate(90)`} textAnchor="middle" stroke="none">{ftLabel(depthFt)}</text>
              </>
            );
          })()}
          <g transform={`translate(${offsetX} ${PLAN_CANVAS - 22})`}>
            <line x1="0" y1="0" x2={10 * scale} y2="0" strokeWidth="2" />
            <line x1="0" y1="-4" x2="0" y2="4" />
            <line x1={5 * scale} y1="-3" x2={5 * scale} y2="3" />
            <line x1={10 * scale} y1="-4" x2={10 * scale} y2="4" />
            <text x={10 * scale + 8} y="3.5" stroke="none">10 ft</text>
          </g>
        </g>
      )}

      {showSite && (
        <g transform={`translate(${PLAN_CANVAS - 56} 58)`} pointerEvents="none">
          <g transform={`rotate(${northAngle})`}>
            <circle r="22" fill="none" stroke={palette.plotLine} strokeWidth="1" />
            <path d="M 0 -19 L 6.5 6 L 0 2 L -6.5 6 Z" fill={palette.select} />
          </g>
          <text y="39" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={palette.roadText} fontFamily="var(--font-sans), sans-serif">N</text>
        </g>
      )}
    </svg>
  );
}
