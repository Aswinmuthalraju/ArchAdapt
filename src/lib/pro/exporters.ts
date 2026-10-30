import { FloorPlanOpening, FloorPlanWall, StructuredDesignJSON } from '@/types/architectural';
import { buildHouseGeometry, Box3D } from '@/lib/geometry/buildHouseGeometry';
import { roomRectFt } from '@/lib/geometry/planGeometry';
import { floorName, inferRoomType } from '@/lib/design/roomTypes';
import { DesignAnalysis } from './analysis';

/** File exporters. All of them read the canonical design, so a drawing, a model and a schedule always agree. */

export interface ExportFile {
  filename: string;
  mime: string;
  content: string;
}

export const slug = (value: string) => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'archadapt';

// ---------------------------------------------------------------- CSV

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

export function schedulesCsv(analysis: DesignAnalysis, title: string): ExportFile {
  const { areas } = analysis;
  const blocks = [
    csv([['AREA STATEMENT', title], ['Plot area (sq ft)', areas.plotSqFt], ['Ground coverage (sq ft)', areas.groundCoverageSqFt], ['Ground coverage (%)', areas.coveragePct], ['Built-up area (sq ft)', areas.builtUpSqFt], ['FAR', areas.far], ['Carpet area (sq ft)', areas.carpetSqFt], ['Circulation (% of built-up)', areas.circulationPct], ['Open to sky (sq ft)', areas.openToSkySqFt]]),
    csv([['FLOOR', 'BUILT-UP (sq ft)', 'OPEN (sq ft)'], ...areas.floors.map((f) => [f.name, f.builtUpSqFt, f.openSqFt])]),
    csv([['ROOM SCHEDULE'], ['Room', 'Floor', 'Width (ft)', 'Depth (ft)', 'Area (sq ft)', 'Area (sq m)', 'Min area (sq ft)', 'Glazing (sq ft)', 'Glazing (%)', 'Doors', 'Windows'],
      ...analysis.rooms.map((r) => [r.name, r.floorName, r.widthFt, r.depthFt, r.areaSqFt, r.areaSqM, r.minAreaSqFt, r.glazingSqFt, r.glazingPct, r.doors, r.windows])]),
    csv([['DOOR AND WINDOW SCHEDULE'], ['Mark', 'Type', 'Floor', 'Location', 'Width (ft)', 'Height (ft)', 'Swing', 'External'],
      ...analysis.openings.map((o) => [o.mark, o.kind, o.floorName, o.location, o.widthFt, o.heightFt, o.swing, o.exterior ? 'Yes' : 'No'])]),
    csv([['COMPLIANCE CHECKS'], ['Group', 'Check', 'Result', 'Detail'], ...analysis.checks.map((c) => [c.group, c.title, c.status.toUpperCase(), c.detail])])
  ];
  return { filename: `${slug(title)}-schedules.csv`, mime: 'text/csv;charset=utf-8', content: `﻿${blocks.join('\r\n\r\n')}\r\n` };
}

// ---------------------------------------------------------------- DXF (AutoCAD R12 ASCII, units: feet)

type Pt = [number, number];

class Dxf {
  private body: string[] = [];
  private layers = new Map<string, number>();
  /** Plan y grows toward the rear; the drawing mirrors the on-screen plan (road at the top), so y is flipped about this value. */
  flip = 0;
  layer(name: string, color: number) { this.layers.set(name, color); return name; }
  private g(code: number, value: string | number) { this.body.push(String(code), String(typeof value === 'number' ? Number(value.toFixed(4)) : value)); }
  line(layer: string, a: Pt, b: Pt) {
    this.g(0, 'LINE'); this.g(8, layer);
    this.g(10, a[0]); this.g(20, this.flip - a[1]); this.g(30, 0); this.g(11, b[0]); this.g(21, this.flip - b[1]); this.g(31, 0);
  }
  rect(layer: string, x0: number, y0: number, x1: number, y1: number) {
    this.line(layer, [x0, y0], [x1, y0]); this.line(layer, [x1, y0], [x1, y1]); this.line(layer, [x1, y1], [x0, y1]); this.line(layer, [x0, y1], [x0, y0]);
  }
  arc(layer: string, c: Pt, r: number, a1: number, a2: number) {
    this.g(0, 'ARC'); this.g(8, layer); this.g(10, c[0]); this.g(20, this.flip - c[1]); this.g(30, 0); this.g(40, r); this.g(50, a1); this.g(51, a2);
  }
  text(layer: string, at: Pt, height: number, value: string) {
    this.g(0, 'TEXT'); this.g(8, layer); this.g(10, at[0]); this.g(20, this.flip - at[1]); this.g(30, 0); this.g(40, height); this.g(1, value.replace(/[^\x20-\x7E]/g, ''));
  }
  toString() {
    const head = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC'];
    const layerTable = Array.from(this.layers).flatMap(([name, color]) => ['0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', 'CONTINUOUS']);
    const tables = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(this.layers.size), ...layerTable, '0', 'ENDTAB', '0', 'ENDSEC'];
    return [...head, ...tables, '0', 'SECTION', '2', 'ENTITIES', ...this.body, '0', 'ENDSEC', '0', 'EOF'].join('\r\n') + '\r\n';
  }
}

/** Wall centre-line as a thick rectangle, split where openings cut through it. */
function wallPieces(wall: FloorPlanWall, plot: { width: number; depth: number }, openings: FloorPlanOpening[]) {
  const x1 = (wall.x1 / 100) * plot.width, y1 = (wall.y1 / 100) * plot.depth;
  const x2 = (wall.x2 / 100) * plot.width, y2 = (wall.y2 / 100) * plot.depth;
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const at = horizontal ? (y1 + y2) / 2 : (x1 + x2) / 2;
  const from = horizontal ? Math.min(x1, x2) : Math.min(y1, y2);
  const to = horizontal ? Math.max(x1, x2) : Math.max(y1, y2);
  const cuts = openings
    .filter((op) => op.orientation === (horizontal ? 'horizontal' : 'vertical') && (op.floorLevel || 0) === (wall.floorLevel || 0))
    .map((op) => ({ along: horizontal ? (op.x / 100) * plot.width : (op.y / 100) * plot.depth, across: horizontal ? (op.y / 100) * plot.depth : (op.x / 100) * plot.width, width: op.width }))
    .filter((c) => Math.abs(c.across - at) < 0.15 && c.along > from - 0.05 && c.along < to + 0.05)
    .sort((a, b) => a.along - b.along);
  const pieces: [number, number][] = [];
  let cursor = from;
  for (const cut of cuts) {
    const s = Math.max(cursor, cut.along - cut.width / 2);
    if (s > cursor + 0.01) pieces.push([cursor, s]);
    cursor = Math.max(cursor, cut.along + cut.width / 2);
  }
  if (to > cursor + 0.01) pieces.push([cursor, to]);
  return { horizontal, at, pieces, half: Math.max(0.2, wall.thickness) / 2 };
}

export function planDxf(design: StructuredDesignJSON, title: string): ExportFile {
  const plot = { width: design.plot?.width || 40, depth: design.plot?.depth || 60 };
  const dxf = new Dxf();
  dxf.flip = plot.depth;
  const L = {
    plot: dxf.layer('A-SITE-BOUNDARY', 8), wall: dxf.layer('A-WALL', 7), door: dxf.layer('A-DOOR', 3), window: dxf.layer('A-GLAZ', 5),
    stair: dxf.layer('A-STAIR', 2), room: dxf.layer('A-ROOM-NAME', 1), dim: dxf.layer('A-ANNO-NOTE', 6)
  };
  const levels = Array.from(new Set(design.rooms.map((r) => r.position.floorLevel || 0))).sort((a, b) => a - b);
  const gap = 25;

  levels.forEach((level, index) => {
    const ox = index * (plot.width + gap);
        const P = (x: number, y: number): Pt => [ox + x, y];
    const here = (design.openings || []).filter((op) => (op.floorLevel || 0) === level);

    dxf.rect(L.plot, ox, 0, ox + plot.width, plot.depth);
    dxf.text(L.dim, [ox, plot.depth + 3], 1.2, `${title} - ${floorName(level)} (units: feet, road at top)`);

    for (const wall of (design.walls || []).filter((w) => (w.floorLevel || 0) === level)) {
      const { horizontal, at, pieces, half } = wallPieces(wall, plot, here);
      for (const [s, e] of pieces) {
        if (horizontal) dxf.rect(L.wall, ox + s, at - half, ox + e, at + half);
        else dxf.rect(L.wall, ox + at - half, s, ox + at + half, e);
      }
    }

    for (const op of here) {
      const cx = (op.x / 100) * plot.width, cy = (op.y / 100) * plot.depth;
      const w = op.width;
      const horizontal = op.orientation === 'horizontal';
      const [a, b]: [Pt, Pt] = horizontal ? [P(cx - w / 2, cy), P(cx + w / 2, cy)] : [P(cx, cy - w / 2), P(cx, cy + w / 2)];
      if (op.type === 'window' || op.type === 'sliding_glass') {
        for (const off of [-0.25, 0, 0.25]) {
          dxf.line(L.window, horizontal ? [a[0], a[1] + off] : [a[0] + off, a[1]], horizontal ? [b[0], b[1] + off] : [b[0] + off, b[1]]);
        }
      } else if (op.type === 'archway') {
        dxf.line(L.door, a, b);
      } else if (op.type === 'door') {
        const hingeAtStart = op.hinge !== 'end';
        const hinge = hingeAtStart ? a : b;
        const closed = hingeAtStart ? b : a;
        const side = (op.swingSide || 1);
        const open: Pt = horizontal ? [hinge[0], hinge[1] + side * w] : [hinge[0] + side * w, hinge[1]];
        dxf.line(L.door, hinge, open);
        const ang = (p: Pt) => (Math.atan2(-(p[1] - hinge[1]), p[0] - hinge[0]) * 180 / Math.PI + 360) % 360; // y is mirrored in the file
        const a1 = ang(closed), a2 = ang(open);
        const sweep = (a2 - a1 + 360) % 360;
        if (Math.abs(sweep - 90) < 1) dxf.arc(L.door, hinge, w, a1, a2); else dxf.arc(L.door, hinge, w, a2, a1);
      }
    }

    for (const room of design.rooms.filter((r) => (r.position.floorLevel || 0) === level)) {
      const rect = roomRectFt(room, plot);
      const type = inferRoomType(room);
      if (type === 'void') continue;
      const h = Math.max(0.5, Math.min(0.9, rect.w / 12));
      dxf.text(L.room, P(rect.x + 0.6, rect.y + rect.d / 2 + h * 0.6), h, room.name);
      dxf.text(L.room, P(rect.x + 0.6, rect.y + rect.d / 2 - h * 0.8), h * 0.8, `${Math.round(rect.w * 10) / 10}' x ${Math.round(rect.d * 10) / 10}' = ${Math.round(rect.w * rect.d)} sq ft`);
      if (type === 'stair') {
        dxf.rect(L.stair, ox + rect.x, rect.y, ox + rect.x + rect.w, rect.y + rect.d);
        const along = rect.d >= rect.w;
        const steps = Math.max(6, Math.round((along ? rect.d : rect.w) / 0.9));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          if (along) dxf.line(L.stair, P(rect.x, rect.y + rect.d * t), P(rect.x + rect.w, rect.y + rect.d * t));
          else dxf.line(L.stair, P(rect.x + rect.w * t, rect.y), P(rect.x + rect.w * t, rect.y + rect.d));
        }
      }
    }
  });
  return { filename: `${slug(title)}-plan.dxf`, mime: 'application/dxf', content: dxf.toString() };
}

// ---------------------------------------------------------------- OBJ (metres, Y up)

class Obj {
  private lines: string[] = [];
  private count = 0;
  group(name: string) { this.lines.push(`g ${name}`); }
  box(box: Box3D) {
    const [cx, cy, cz] = box.position;
    const [sx, sy, sz] = box.size;
    this.hexahedron([
      [cx - sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy - sy / 2, cz + sz / 2], [cx - sx / 2, cy - sy / 2, cz + sz / 2],
      [cx - sx / 2, cy + sy / 2, cz - sz / 2], [cx + sx / 2, cy + sy / 2, cz - sz / 2], [cx + sx / 2, cy + sy / 2, cz + sz / 2], [cx - sx / 2, cy + sy / 2, cz + sz / 2]
    ]);
  }
  /** Four-sided pyramid whose base is `size` wide and deep and whose apex is `size[1]` above it. */
  pyramid(position: number[], size: number[]) {
    const [cx, cy, cz] = position;
    const [sx, sy, sz] = size;
    const v: number[][] = [
      [cx - sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy - sy / 2, cz + sz / 2], [cx - sx / 2, cy - sy / 2, cz + sz / 2], [cx, cy + sy / 2, cz]
    ];
    const base = this.count;
    v.forEach((p) => this.lines.push(`v ${p.map((n) => n.toFixed(4)).join(' ')}`));
    this.count += v.length;
    const f = (...i: number[]) => this.lines.push(`f ${i.map((n) => base + n + 1).join(' ')}`);
    f(0, 3, 2, 1); f(0, 1, 4); f(1, 2, 4); f(2, 3, 4); f(3, 0, 4);
  }
  private hexahedron(v: number[][]) {
    const base = this.count;
    v.forEach((p) => this.lines.push(`v ${p.map((n) => n.toFixed(4)).join(' ')}`));
    this.count += 8;
    const f = (...i: number[]) => this.lines.push(`f ${i.map((n) => base + n + 1).join(' ')}`);
    f(0, 1, 2, 3); f(4, 7, 6, 5); f(0, 4, 5, 1); f(1, 5, 6, 2); f(2, 6, 7, 3); f(3, 7, 4, 0);
  }
  toString() { return this.lines.join('\n') + '\n'; }
}

export function modelObj(design: StructuredDesignJSON, title: string): ExportFile {
  const geometry = buildHouseGeometry(design);
  const obj = new Obj();
  const header = `# ${title}\n# Exported from ArchAdapt AI. Units: metres, Y up, road on the -Z side.\n`;
  obj.group('Floor_plates'); geometry.rooms.forEach((r) => obj.box(r));
  obj.group('Ceilings'); geometry.ceilings.forEach((c) => obj.box(c));
  obj.group('Walls'); geometry.walls.forEach((w) => obj.box(w));
  obj.group('Glazing'); geometry.openings.forEach((o) => obj.box(o));
  obj.group('Frames'); geometry.frames.forEach((f) => obj.box(f));
  obj.group('Stairs'); geometry.stairSteps.forEach((s) => obj.box(s));
  obj.group('Railings'); geometry.railings.forEach((r) => obj.box(r));
  obj.group('Roof');
  const isPitchedRoof = (type: string) => ['sloped_hipped_gable', 'traditional_indian_gable', 'tropical_pitched_canopy', 'colonial_hipped'].includes(type);
  geometry.roofs.forEach((roof) => (isPitchedRoof(roof.type) ? obj.pyramid(roof.position, roof.size) : obj.box({ position: roof.position, size: roof.size, floorLevel: geometry.totalFloors - 1 })));
  return { filename: `${slug(title)}-model.obj`, mime: 'model/obj', content: header + obj.toString() };
}

// ---------------------------------------------------------------- JSON

export function designJson(design: StructuredDesignJSON, title: string, version: number): ExportFile {
  return { filename: `${slug(title)}-v${version}.json`, mime: 'application/json', content: JSON.stringify({ project: title, version, design }, null, 2) };
}

// ---------------------------------------------------------------- Browser download

export function downloadFile(file: ExportFile) {
  const blob = new Blob([file.content], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
