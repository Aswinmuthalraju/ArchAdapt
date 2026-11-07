import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { StructuredDesignJSON } from '../../src/types/architectural';

/** Developer-only renderer: draws each floor of a design as SVG and screenshots it with Chromium. */
export function floorSvg(design: StructuredDesignJSON, floor: number, scale = 9): string {
  const W = design.plot.width, D = design.plot.depth;
  const px = (v: number) => (v / 100) * W * scale;
  const py = (v: number) => (v / 100) * D * scale;
  const rooms = design.rooms.filter((r) => (r.position.floorLevel || 0) === floor);
  const parts: string[] = [];
  const poly = design.plot.polygon;
  if (poly) parts.push(`<polygon points="${poly.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')}" fill="#f6f3ea" stroke="#999" stroke-dasharray="6 4"/>`);
  else parts.push(`<rect x="0" y="0" width="${W * scale}" height="${D * scale}" fill="#f6f3ea" stroke="#999" stroke-dasharray="6 4"/>`);
  for (const r of rooms) {
    const { x, y, width, height } = r.position;
    parts.push(`<rect x="${px(x)}" y="${py(y)}" width="${px(width)}" height="${py(height)}" fill="${r.color || '#eee'}" opacity="0.9"/>`);
  }
  for (const w of (design.walls || []).filter((wl) => (wl.floorLevel || 0) === floor)) {
    parts.push(`<line x1="${px(w.x1)}" y1="${py(w.y1)}" x2="${px(w.x2)}" y2="${py(w.y2)}" stroke="#222" stroke-width="${w.isExterior ? 4 : 2}"/>`);
  }
  for (const op of (design.openings || []).filter((o) => (o.floorLevel || 0) === floor)) {
    const cx = px(op.x), cy = py(op.y), half = (op.width * scale) / 2;
    const horizontal = op.orientation === 'horizontal';
    const [x1, y1, x2, y2] = horizontal ? [cx - half, cy, cx + half, cy] : [cx, cy - half, cx, cy + half];
    const color = op.type === 'window' || op.type === 'sliding_glass' ? '#2a7fd6' : '#d6552a';
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="5"/>`);
  }
  for (const r of rooms) {
    const { x, y, width, height } = r.position;
    parts.push(`<text x="${px(x + width / 2)}" y="${py(y + height / 2)}" font-size="10" font-family="Arial" text-anchor="middle" fill="#111">${r.name.replace(/&/g, '&amp;').slice(0, 22)}<tspan x="${px(x + width / 2)}" dy="11" fill="#555">${r.dimensions}</tspan></text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${D * scale}" viewBox="0 0 ${W * scale} ${D * scale}" style="background:#fff;border:1px solid #ccc">${parts.join('')}</svg>`;
}

export async function renderDesigns(items: { title: string; design: StructuredDesignJSON }[], file: string, scale = 9) {
  const html = `<html><body style="font-family:Arial;margin:12px;background:#fafafa">${items.map(({ title, design }) => `
    <h3 style="margin:14px 0 4px">${title}</h3><div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:nowrap">
    ${Array.from({ length: design.floorsCount }, (_, f) => `<div><div style="font-size:12px;color:#666">Floor ${f}</div>${floorSvg(design, f, scale)}</div>`).join('')}</div>`).join('')}</body></html>`;
  mkdirSync(dirname(file), { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.setContent(html);
  await page.screenshot({ path: file, fullPage: true });
  await browser.close();
  writeFileSync(file.replace(/\.png$/, '.html'), html);
}
