'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { StructuredDesignJSON, FloorPlanRoom } from '@/types/architectural';
import { ZoomIn, ZoomOut, Maximize2, Ruler, X, Armchair } from 'lucide-react';
import { floorName, inferRoomType } from '@/lib/design/roomTypes';
import PlanSvg, { PLAN_CANVAS } from './PlanSvg';

interface FloorPlan2DRendererProps {
  design: StructuredDesignJSON;
  selectedRoomId?: string;
  onRoomSelect?: (room: FloorPlanRoom | null) => void;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 4;

/** The 2D view of the canonical design: toolbar, floor tabs, pan and zoom around the shared plan drawing. */
export default function FloorPlan2DRenderer({ design, selectedRoomId, onRoomSelect }: FloorPlan2DRendererProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showFurniture, setShowFurniture] = useState(true);
  const [floor, setFloor] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  const floors = useMemo(() => {
    const levels = Array.from(new Set(design.rooms.map((r) => r.position.floorLevel || 0))).sort((a, b) => a - b);
    return levels.map((level) => {
      const declared = design.floors?.find((f) => f.level === level);
      return {
        level,
        name: declared?.name || floorName(level),
        area: declared?.builtUpAreaSqFt ?? design.rooms.filter((r) => (r.position.floorLevel || 0) === level).reduce((sum, r) => sum + r.areaSqFt, 0)
      };
    });
  }, [design]);

  // A new design or version may have fewer floors than the one being viewed.
  useEffect(() => {
    if (!floors.some((f) => f.level === floor)) setFloor(floors[0]?.level ?? 0);
  }, [floors, floor]);

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  /** Zoom and pan that frame the building (with a little of its plot) in the stage, whatever the plot size. */
  const houseFit = useCallback(() => {
    const solidRooms = design.rooms.filter((r) => inferRoomType(r) !== 'void');
    if (!solidRooms.length) return null;
    const plotW = design.plot?.width || 40;
    const plotD = design.plot?.depth || 60;
    const canvasFraction = (PLAN_CANVAS - 128) / PLAN_CANVAS / Math.max(plotW, plotD); // canvas share of one foot
    const x0 = (Math.min(...solidRooms.map((r) => r.position.x)) / 100) * plotW;
    const x1 = (Math.max(...solidRooms.map((r) => r.position.x + r.position.width)) / 100) * plotW;
    const y0 = (Math.min(...solidRooms.map((r) => r.position.y)) / 100) * plotD;
    const y1 = (Math.max(...solidRooms.map((r) => r.position.y + r.position.height)) / 100) * plotD;
    const span = Math.max(x1 - x0, y1 - y0) * canvasFraction;
    const zoomTo = clampZoom(Math.min(2.6, Math.max(1, 0.78 / span)));
    const stage = stageRef.current;
    const size = Math.min(stage?.clientWidth || 800, stage?.clientHeight || 800, 860);
    // Centre of the building relative to the centre of the canvas, as a share of the canvas.
    const dx = ((x0 + x1) / 2 - plotW / 2) * canvasFraction;
    const dy = ((y0 + y1) / 2 - plotD / 2) * canvasFraction;
    return { zoom: zoomTo, pan: { x: -dx * size * zoomTo, y: -dy * size * zoomTo } };
  }, [design.rooms, design.plot?.width, design.plot?.depth]);

  const toggleFit = useCallback(() => {
    if (Math.abs(zoom - 1) > 0.08 || Math.abs(pan.x) > 8 || Math.abs(pan.y) > 8) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const fit = houseFit();
    if (!fit) return;
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, [zoom, pan, houseFit]);

  // A new design opens already framed on the house, so a large plot never shows a tiny plan.
  const framedFor = useRef<unknown>(null);
  useEffect(() => {
    if (framedFor.current === design) return;
    framedFor.current = design;
    const fit = houseFit();
    if (!fit) return;
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, [design, houseFit]);

  // Wheel zoom needs a non-passive listener so the page does not scroll underneath.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((z) => clampZoom(z * Math.exp(-event.deltaY * 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const visible = useMemo(() => design.rooms.filter((r) => (r.position.floorLevel || 0) === floor), [design.rooms, floor]);
  const active = floors.find((f) => f.level === floor);
  const selected = visible.find((r) => r.id === selectedRoomId);
  const roomCount = visible.filter((r) => inferRoomType(r) !== 'void').length;

  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y, moved: false };
    setDragging(true);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    d.moved = true;
    setPan({ x: d.px + dx, y: d.py + dy });
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const button =
    'flex h-9 w-9 items-center justify-center border border-stone-300 bg-white/90 text-stone-700 transition-colors hover:border-magenta-500 hover:text-magenta-600 active:bg-magenta-50';

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-stone-100 select-none">
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="font-serif text-lg leading-none text-stone-900">Floor plan</p>
            <p className="mt-1 text-xs text-stone-500">
              {design.plot?.width}′ × {design.plot?.depth}′ plot · {roomCount} {roomCount === 1 ? 'room' : 'rooms'} on this floor
            </p>
          </div>
          {floors.length > 1 && (
            <div role="tablist" aria-label="Floor" className="flex border border-stone-300 bg-white p-0.5">
              {floors.map((f) => (
                <button
                  key={f.level}
                  role="tab"
                  aria-selected={f.level === floor}
                  onClick={() => setFloor(f.level)}
                  className={`px-3.5 py-1.5 text-sm transition-colors ${f.level === floor ? 'bg-stone-900 font-semibold text-gold-200' : 'text-stone-600 hover:text-stone-900'}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnnotations((v) => !v)}
            aria-pressed={showAnnotations}
            className={`flex h-9 items-center gap-1.5 border px-3 text-sm transition-colors ${showAnnotations ? 'border-magenta-500 bg-magenta-50 font-medium text-magenta-700' : 'border-stone-300 bg-white/90 text-stone-700 hover:border-magenta-500'}`}
          >
            <Ruler className="h-4 w-4" />
            Dimensions
          </button>
          <button
            onClick={() => setShowFurniture((v) => !v)}
            aria-pressed={showFurniture}
            className={`flex h-9 items-center gap-1.5 border px-3 text-sm transition-colors ${showFurniture ? 'border-magenta-500 bg-magenta-50 font-medium text-magenta-700' : 'border-stone-300 bg-white/90 text-stone-700 hover:border-magenta-500'}`}
          >
            <Armchair className="h-4 w-4" />
            Furniture
          </button>
          <button className={button} onClick={() => setZoom((z) => clampZoom(z * 1.2))} title="Zoom in" aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button className={button} onClick={() => setZoom((z) => clampZoom(z / 1.2))} title="Zoom out" aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button className={button} onClick={toggleFit} title="Fit to view (click again to toggle house/plot)" aria-label="Fit to view">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={reset}
        className={`bg-arch-grid relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden p-4 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {selected && (
          <div className="absolute bottom-4 left-4 z-10 w-72 border border-stone-300 bg-white/95 p-4 shadow-plate backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-serif text-lg leading-tight text-stone-900">{selected.name}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {selected.dimensions} · {selected.areaSqFt} sq ft · {(selected.roomType || selected.category).replace(/_/g, ' ')}
                </p>
              </div>
              {onRoomSelect && (
                <button onClick={() => onRoomSelect(null)} className="p-1 text-stone-400 hover:text-stone-900" aria-label="Close room details">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {selected.features.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-gold-200 pt-2 text-xs leading-snug text-stone-600">
                {selected.features.slice(0, 4).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: dragging ? 'none' : 'transform 0.12s ease-out' }}
          className="aspect-square h-full max-h-[860px] max-w-full will-change-transform"
        >
          <PlanSvg
            design={design}
            floor={floor}
            theme="paper"
            selectedRoomId={selectedRoomId}
            showAnnotations={showAnnotations}
            showFurniture={showFurniture}
            onRoomSelect={(room) => {
              if (drag.current?.moved) return;
              onRoomSelect?.(room);
            }}
            className="h-full w-full drop-shadow-[0_18px_28px_rgba(27,15,26,0.12)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-stone-200 bg-stone-50 px-5 py-2.5 text-xs text-stone-600">
        <span>
          {active?.name}: <b className="font-semibold text-stone-900">{active?.area || 0} sq ft</b>
        </span>
        <span>
          Total built-up: <b className="font-semibold text-stone-900">{design.totalBuiltUpAreaSqFt} sq ft</b>
        </span>
        {design.buildableAreaSqFt ? (
          <span>
            Buildable per floor: <b className="font-semibold text-stone-900">{design.buildableAreaSqFt} sq ft</b>
          </span>
        ) : null}
        <span className="hidden text-stone-500 xl:inline">Scroll to zoom · drag to pan · double-click to fit</span>
      </div>
    </div>
  );
}
