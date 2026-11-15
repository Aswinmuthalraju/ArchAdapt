'use client';

import React, { useId, useMemo } from 'react';
import { StructuredDesignJSON, RoomType } from '@/types/architectural';
import { normalizeStyleName } from '@/lib/design/styleNormalizer';

export type ElevationSide = 'front' | 'rear' | 'left' | 'right';

interface ElevationSvgProps {
  design: StructuredDesignJSON;
  side: ElevationSide;
  className?: string;
}

export default function ElevationSvg({ design, side, className = '' }: ElevationSvgProps) {
  const uid = useId();
  const plotW = design.plot?.width || 40;
  const plotD = design.plot?.depth || 60;
  const floorsCount = Math.max(1, design.floorsCount || 1);
  const normStyle = normalizeStyleName(
    design.constraints?.style || design.designSignature?.styleStrategy?.[0],
    design.styleFeatures,
    design.rationale
  );

  // Facade width in feet based on side
  const facadeWidthFt = side === 'front' || side === 'rear' ? plotW : plotD;
  const isHorizontal = side === 'front' || side === 'rear';

  // Find min and max bounding extents of actual rooms
  const roomsOnSide = useMemo(() => {
    return design.rooms.map((r) => {
      const rx = (r.position.x / 100) * plotW;
      const ry = (r.position.y / 100) * plotD;
      const rw = (r.position.width / 100) * plotW;
      const rd = (r.position.height / 100) * plotD;
      return {
        ...r,
        rect: { x: rx, y: ry, w: rw, d: rd },
        floor: r.position.floorLevel || 0
      };
    });
  }, [design.rooms, plotW, plotD]);

  const buildingX0 = Math.min(...roomsOnSide.map((r) => isHorizontal ? r.rect.x : r.rect.y));
  const buildingX1 = Math.max(...roomsOnSide.map((r) => isHorizontal ? r.rect.x + r.rect.w : r.rect.y + r.rect.d));
  const buildingWidthFt = Math.max(12, buildingX1 - buildingX0);

  // Vertical dimensions in feet
  const STORY_FT = 10;
  const PLINTH_FT = 1.5;
  const PARAPET_FT = normStyle === 'kerala_traditional' || normStyle === 'traditional_indian' || normStyle === 'tropical' ? 5.5 : 3.0;
  const totalHeightFt = PLINTH_FT + floorsCount * STORY_FT + PARAPET_FT;

  // SVG viewBox coordinate mapping
  // Leave margins for architectural datum level markers on the left and dimension strings at the bottom
  const MARGIN_LEFT = 140;
  const MARGIN_RIGHT = 60;
  const MARGIN_TOP = 80;
  const MARGIN_BOTTOM = 80;
  const SVG_SCALE = 16; // pixels per foot

  const canvasW = MARGIN_LEFT + buildingWidthFt * SVG_SCALE + MARGIN_RIGHT;
  const canvasH = MARGIN_TOP + totalHeightFt * SVG_SCALE + MARGIN_BOTTOM;

  // Conversion: feet to SVG Y (ground level is at Y = MARGIN_TOP + totalHeightFt * SVG_SCALE - PLINTH_FT * SVG_SCALE)
  const groundY = MARGIN_TOP + (totalHeightFt - PLINTH_FT) * SVG_SCALE;
  const plinthY = groundY - PLINTH_FT * SVG_SCALE;
  const floorY = (level: number) => plinthY - level * STORY_FT * SVG_SCALE;
  const roofTopY = floorY(floorsCount) - PARAPET_FT * SVG_SCALE;

  // X mapping: center the building facade in the stage
  const bldgLeftX = MARGIN_LEFT;
  const bldgRightX = bldgLeftX + buildingWidthFt * SVG_SCALE;
  const bldgWidthPx = bldgRightX - bldgLeftX;

  // Filter openings that face this facade
  const facadeOpenings = useMemo(() => {
    return (design.openings || []).filter((op) => {
      if (isHorizontal) {
        if (op.orientation !== 'horizontal') return false;
        const opY = (op.y / 100) * plotD;
        if (side === 'front') return opY <= plotD * 0.45;
        if (side === 'rear') return opY >= plotD * 0.55;
      } else {
        if (op.orientation !== 'vertical') return false;
        const opX = (op.x / 100) * plotW;
        if (side === 'left') return opX <= plotW * 0.45;
        if (side === 'right') return opX >= plotW * 0.55;
      }
      return true;
    });
  }, [design.openings, side, isHorizontal, plotW, plotD]);

  // Architectural style finishes
  const isTraditional = normStyle === 'kerala_traditional' || normStyle === 'traditional_indian';
  const isMinimal = normStyle === 'minimalist';
  const wallFill = isTraditional ? '#F7F3EC' : isMinimal ? '#F0F2F5' : '#FAF8F5';
  const wallStroke = '#2A303A';
  const roofColor = isTraditional ? '#C85A32' : '#333842';

  return (
    <svg
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className={`w-full h-full select-none ${className}`}
      role="img"
      aria-label={`${side.toUpperCase()} Architectural Elevation`}
    >
      <defs>
        {/* Louver pattern */}
        <pattern id={`${uid}-louvers`} width="10" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="2" x2="10" y2="2" stroke="#6E5642" strokeWidth="1.2" />
        </pattern>
        {/* Concrete hatch */}
        <pattern id={`${uid}-concrete`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r="0.6" fill="#888" opacity="0.4" />
          <circle cx="8" cy="9" r="0.6" fill="#888" opacity="0.4" />
        </pattern>
      </defs>

      {/* Ground Line (Thick Architectural Grade) */}
      <line
        x1={20}
        y1={groundY}
        x2={canvasW - 20}
        y2={groundY}
        stroke="#1E232A"
        strokeWidth="3"
        strokeLinecap="square"
      />
      {/* Subgrade ground hatch */}
      <line
        x1={bldgLeftX - 30}
        y1={groundY + 4}
        x2={bldgRightX + 30}
        y2={groundY + 4}
        stroke="#666"
        strokeWidth="1"
        strokeDasharray="4 4"
      />

      {/* Plinth Base */}
      <rect
        x={bldgLeftX - 6}
        y={plinthY}
        width={bldgWidthPx + 12}
        height={PLINTH_FT * SVG_SCALE}
        fill="#DDD8CE"
        stroke={wallStroke}
        strokeWidth="1.6"
      />
      <text
        x={bldgLeftX + bldgWidthPx / 2}
        y={plinthY + (PLINTH_FT * SVG_SCALE) / 2 + 3}
        textAnchor="middle"
        fontSize="9"
        fill="#666"
        fontFamily="monospace"
        letterSpacing="0.8"
      >
        PLINTH (+0.45m)
      </text>

      {/* Main Building Floors */}
      {Array.from({ length: floorsCount }, (_, i) => {
        const yTop = floorY(i + 1);
        const yBot = floorY(i);
        const height = yBot - yTop;
        return (
          <g key={`floor-mass-${i}`}>
            <rect
              x={bldgLeftX}
              y={yTop}
              width={bldgWidthPx}
              height={height}
              fill={wallFill}
              stroke={wallStroke}
              strokeWidth="2"
            />
            {/* Floor division slab shadow line */}
            {i > 0 && (
              <line
                x1={bldgLeftX}
                y1={yBot}
                x2={bldgRightX}
                y2={yBot}
                stroke="#1B2028"
                strokeWidth="2.5"
              />
            )}
          </g>
        );
      })}

      {/* Windows and Doors mapped along the facade */}
      {facadeOpenings.map((op, idx) => {
        const floorIdx = Math.min(floorsCount - 1, op.floorLevel || 0);
        const levelY = floorY(floorIdx);
        // Distribute or place proportionally along facade width
        const relPos = ((idx + 1) / (facadeOpenings.length + 1)) * bldgWidthPx;
        const opWidthPx = Math.max(30, (op.width || 4) * SVG_SCALE * 0.7);
        const opX = bldgLeftX + relPos - opWidthPx / 2;

        if (op.type === 'door' && floorIdx === 0) {
          const doorHeight = 7.0 * SVG_SCALE;
          const doorY = plinthY - doorHeight;
          return (
            <g key={op.id || idx}>
              {/* Door Frame */}
              <rect
                x={opX}
                y={doorY}
                width={opWidthPx}
                height={doorHeight}
                fill="#4A3425"
                stroke="#1E232A"
                strokeWidth="1.8"
              />
              {/* Door Leaf Insets */}
              <rect
                x={opX + 3}
                y={doorY + 3}
                width={opWidthPx / 2 - 4}
                height={doorHeight - 6}
                fill="#5E4230"
                stroke="#3E2B1E"
                strokeWidth="1"
              />
              <rect
                x={opX + opWidthPx / 2 + 1}
                y={doorY + 3}
                width={opWidthPx / 2 - 4}
                height={doorHeight - 6}
                fill="#5E4230"
                stroke="#3E2B1E"
                strokeWidth="1"
              />
              {/* Handle */}
              <circle cx={opX + opWidthPx / 2 - 6} cy={doorY + doorHeight * 0.55} r="2" fill="#D4AF37" />
            </g>
          );
        }

        // Window opening
        const winHeight = 4.5 * SVG_SCALE;
        const winY = levelY - 7.5 * SVG_SCALE; // lintel at 7.5ft above floor
        return (
          <g key={op.id || idx}>
            {/* Window Lintel Architrave */}
            <line x1={opX - 4} y1={winY} x2={opX + opWidthPx + 4} y2={winY} stroke="#1A202C" strokeWidth="2.5" />
            {/* Window Sill */}
            <line x1={opX - 3} y1={winY + winHeight} x2={opX + opWidthPx + 3} y2={winY + winHeight} stroke="#1A202C" strokeWidth="2" />
            {/* Glazing Frame */}
            <rect
              x={opX}
              y={winY}
              width={opWidthPx}
              height={winHeight}
              fill="#D4E5EE"
              stroke="#202632"
              strokeWidth="1.6"
            />
            {/* Transom / Mullion division */}
            <line x1={opX + opWidthPx / 2} y1={winY} x2={opX + opWidthPx / 2} y2={winY + winHeight} stroke="#202632" strokeWidth="1.2" />
            {/* Diagonal glass reflection strokes */}
            <line x1={opX + 6} y1={winY + winHeight - 6} x2={opX + 16} y2={winY + 6} stroke="#FFF" strokeWidth="1.2" opacity="0.75" />
            <line x1={opX + 14} y1={winY + winHeight - 6} x2={opX + 24} y2={winY + 6} stroke="#FFF" strokeWidth="1.2" opacity="0.75" />
          </g>
        );
      })}

      {/* Roof System */}
      {isTraditional ? (
        // Pitched terracotta roof
        <g>
          <polygon
            points={`
              ${bldgLeftX - 16},${floorY(floorsCount)} 
              ${bldgLeftX + bldgWidthPx / 2},${roofTopY} 
              ${bldgRightX + 16},${floorY(floorsCount)}
            `}
            fill={roofColor}
            stroke="#1B2028"
            strokeWidth="2"
          />
          {/* Timber eaves beam */}
          <rect
            x={bldgLeftX - 20}
            y={floorY(floorsCount) - 3}
            width={bldgWidthPx + 40}
            height={6}
            fill="#5A3E2A"
            stroke="#1B2028"
            strokeWidth="1.4"
          />
        </g>
      ) : (
        // Parapet / Slab roof
        <g>
          <rect
            x={bldgLeftX - 4}
            y={floorY(floorsCount) - PARAPET_FT * SVG_SCALE}
            width={bldgWidthPx + 8}
            height={PARAPET_FT * SVG_SCALE}
            fill="#2D323B"
            stroke={wallStroke}
            strokeWidth="2"
          />
          {/* Coping stone cap */}
          <rect
            x={bldgLeftX - 8}
            y={floorY(floorsCount) - PARAPET_FT * SVG_SCALE - 3}
            width={bldgWidthPx + 16}
            height={4}
            fill="#DDD8CE"
            stroke={wallStroke}
            strokeWidth="1.2"
          />
        </g>
      )}

      {/* Architectural Level Datum Markers (Left Margin) */}
      <g fontFamily="monospace" fontSize="9.5" fill="#333">
        {/* Natural Ground Level */}
        <g transform={`translate(${MARGIN_LEFT - 12}, ${groundY})`}>
          <line x1={-80} y1={0} x2={0} y2={0} stroke="#444" strokeWidth="0.9" strokeDasharray="2 2" />
          <circle cx={-6} cy={0} r="3" fill="none" stroke="#222" strokeWidth="1" />
          <text x={-14} y={3} textAnchor="end" fontWeight="bold">±0.00m</text>
          <text x={-14} y={13} textAnchor="end" fill="#777" fontSize="8">GL (GROUND)</text>
        </g>

        {/* Plinth Level */}
        <g transform={`translate(${MARGIN_LEFT - 12}, ${plinthY})`}>
          <line x1={-80} y1={0} x2={0} y2={0} stroke="#444" strokeWidth="0.9" strokeDasharray="2 2" />
          <circle cx={-6} cy={0} r="3" fill="none" stroke="#222" strokeWidth="1" />
          <text x={-14} y={3} textAnchor="end" fontWeight="bold">+0.45m</text>
          <text x={-14} y={13} textAnchor="end" fill="#777" fontSize="8">FFL (GROUND FLOOR)</text>
        </g>

        {/* Upper Floors */}
        {Array.from({ length: floorsCount }, (_, i) => {
          if (i === 0 && floorsCount === 1) return null;
          const yPos = floorY(i + 1);
          const mLevel = (0.45 + (i + 1) * 3.05).toFixed(2);
          const label = i + 1 === floorsCount ? 'ROOF SLAB' : `FFL (FLOOR ${i + 1})`;
          return (
            <g key={`datum-${i}`} transform={`translate(${MARGIN_LEFT - 12}, ${yPos})`}>
              <line x1={-80} y1={0} x2={0} y2={0} stroke="#444" strokeWidth="0.9" strokeDasharray="2 2" />
              <circle cx={-6} cy={0} r="3" fill="none" stroke="#222" strokeWidth="1" />
              <text x={-14} y={3} textAnchor="end" fontWeight="bold">+{mLevel}m</text>
              <text x={-14} y={13} textAnchor="end" fill="#777" fontSize="8">{label}</text>
            </g>
          );
        })}
      </g>

      {/* Building Width Dimension Line (Bottom Margin) */}
      <g transform={`translate(0, ${groundY + 36})`}>
        <line x1={bldgLeftX} y1={0} x2={bldgRightX} y2={0} stroke="#1A202C" strokeWidth="1" />
        {/* End ticks */}
        <line x1={bldgLeftX} y1={-6} x2={bldgLeftX} y2={6} stroke="#1A202C" strokeWidth="1.5" />
        <line x1={bldgRightX} y1={-6} x2={bldgRightX} y2={6} stroke="#1A202C" strokeWidth="1.5" />
        {/* Dimension text */}
        <text
          x={bldgLeftX + bldgWidthPx / 2}
          y={-8}
          textAnchor="middle"
          fontSize="11"
          fontWeight="bold"
          fontFamily="monospace"
          fill="#1A202C"
        >
          {buildingWidthFt.toFixed(1)}&apos; ({(buildingWidthFt * 0.3048).toFixed(2)} m)
        </text>
      </g>

      {/* Title Block Header */}
      <text
        x={canvasW / 2}
        y={35}
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
        fontFamily="sans-serif"
        letterSpacing="1.2"
        fill="#111827"
      >
        {side.toUpperCase()} ARCHITECTURAL ELEVATION
      </text>
      <text
        x={canvasW / 2}
        y={50}
        textAnchor="middle"
        fontSize="10"
        fontFamily="monospace"
        fill="#6B7280"
      >
        SCALE 1:50 · {floorsCount} STOREY · {design.constraints?.style || 'MODERN'} SPECIFICATION
      </text>
    </svg>
  );
}
