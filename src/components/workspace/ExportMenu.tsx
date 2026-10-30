'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, FileCode2, Box, Table2, Printer, Braces, ImageIcon, ChevronDown } from 'lucide-react';
import { StructuredDesignJSON } from '@/types/architectural';
import { floorName } from '@/lib/design/roomTypes';
import { DesignAnalysis } from '@/lib/pro/analysis';
import { designJson, downloadFile, modelObj, planDxf, schedulesCsv } from '@/lib/pro/exporters';
import { drawingSheetHtml, openDrawingSheet, planSvgFile } from '@/lib/pro/sheet';

interface ExportMenuProps {
  design: StructuredDesignJSON;
  analysis: DesignAnalysis;
  title: string;
  version: number;
  location: string;
  style: string;
  engine: string;
}

/** Hands the design to the tools architects already use: CAD, 3D, spreadsheets, PDF. */
export default function ExportMenu({ design, analysis, title, version, location, style, engine }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const run = (label: string, action: () => void) => {
    try {
      action();
      setMessage(label);
    } catch (err) {
      setMessage(`Could not export: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    setOpen(false);
    setTimeout(() => setMessage(''), 4000);
  };

  const levels = Array.from(new Set(design.rooms.map((r) => r.position.floorLevel || 0))).sort((a, b) => a - b);
  const items: { icon: typeof Download; label: string; hint: string; action: () => void; done: string }[] = [
    { icon: Printer, label: 'Drawing sheet (PDF)', hint: 'Plans, schedules, checks. Print → Save as PDF', done: 'Drawing sheet opened', action: () => {
      const ok = openDrawingSheet(drawingSheetHtml(design, analysis, { title, location, style, version, engine }));
      if (!ok) throw new Error('the browser blocked the new tab; allow pop-ups for this site');
    } },
    { icon: FileCode2, label: 'CAD plan (.dxf)', hint: 'Layers for walls, doors, glazing, stairs', done: 'DXF downloaded', action: () => downloadFile(planDxf(design, title)) },
    { icon: Box, label: '3D model (.obj)', hint: 'Opens in Blender, SketchUp, Rhino', done: 'OBJ downloaded', action: () => downloadFile(modelObj(design, title)) },
    ...levels.map((level) => ({ icon: ImageIcon, label: `${floorName(level)} drawing (.svg)`, hint: 'Vector, scalable', done: 'SVG downloaded', action: () => downloadFile(planSvgFile(design, level, title)) })),
    { icon: Table2, label: 'Schedules (.csv)', hint: 'Areas, rooms, openings, checks', done: 'CSV downloaded', action: () => downloadFile(schedulesCsv(analysis, title)) },
    { icon: Braces, label: 'Design data (.json)', hint: 'The full structured design', done: 'JSON downloaded', action: () => downloadFile(designJson(design, title, version)) }
  ];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 border border-plum-600 px-3.5 text-sm text-stone-200 transition-colors hover:border-gold-400 hover:text-gold-200"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-72 border border-plum-600 bg-plum-850 py-1 shadow-xl">
          {items.map((item) => (
            <button key={item.label} role="menuitem" type="button" onClick={() => run(item.done, item.action)} className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-plum-800">
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
              <span>
                <span className="block text-sm text-stone-100">{item.label}</span>
                <span className="block text-xs text-stone-400">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p role="status" aria-live="polite" className={`absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap border border-gold-400/50 bg-plum-850 px-3 py-1.5 text-xs text-gold-200 ${message && !open ? '' : 'hidden'}`}>{message}</p>
    </div>
  );
}
