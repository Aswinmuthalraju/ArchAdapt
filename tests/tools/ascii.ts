import type { StructuredDesignJSON } from '../../src/types/architectural';

const LETTER: Record<string, string> = {
  living: 'L', dining: 'D', kitchen: 'K', master_bedroom: 'M', bedroom: 'B', guest_room: 'G', bathroom: 'b', study: 'S', store: 's', puja: 'p',
  parking: 'P', balcony: 'c', courtyard: 'Y', lounge: 'l', stair: '^', passage: '.', dressing: 'd', terrace: 't', void: 'v', entrance: 'E', utility: 'u'
};

/** Renders one floor as text: 1 column = 1 ft, 1 row = 2 ft. Rooms are filled with their letter. */
export function asciiFloor(design: StructuredDesignJSON, floor: number): string {
  const W = design.plot.width, D = design.plot.depth;
  const cols = Math.ceil(W), rows = Math.ceil(D / 2);
  const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '));
  for (const room of design.rooms.filter((r) => r.position.floorLevel === floor)) {
    const x0 = Math.round((room.position.x / 100) * W), x1 = Math.round(((room.position.x + room.position.width) / 100) * W);
    const y0 = Math.round((room.position.y / 100) * D / 2), y1 = Math.round(((room.position.y + room.position.height) / 100) * D / 2);
    const ch = LETTER[room.roomType || ''] || '?';
    for (let y = y0; y < y1 && y < rows; y++) for (let x = x0; x < x1 && x < cols; x++) {
      const edge = y === y0 || y === y1 - 1 || x === x0 || x === x1 - 1;
      grid[y][x] = edge ? (y === y0 || y === y1 - 1 ? '-' : '|') : ch;
    }
  }
  return grid.map((r) => r.join('')).join('\n');
}

export function describe(design: StructuredDesignJSON): string {
  const lines: string[] = [];
  for (let f = 0; f < design.floorsCount; f++) {
    lines.push(`--- floor ${f} ---`);
    lines.push(asciiFloor(design, f));
    lines.push(design.rooms.filter((r) => r.position.floorLevel === f).map((r) => `${r.name}[${r.roomType}] ${r.dimensions} ${r.areaSqFt}sf`).join(' | '));
  }
  return lines.join('\n');
}
