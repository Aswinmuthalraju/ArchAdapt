'use client';

import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  RefreshCw, 
} from 'lucide-react';

const MAX_BYTES = 10_000_000;

interface BlueprintIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BlueprintIngestionModal({
  isOpen,
  onClose
}: BlueprintIngestionModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setResult(null);
    if (f.size > MAX_BYTES) { setError('File is larger than 10 MB.'); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };

  const toDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.readAsDataURL(f);
    });

  const handleIngest = async () => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/ingest/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: await toDataUrl(file) })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || `Could not read the plan (HTTP ${res.status}).`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Could not read the plan.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl overflow-hidden rounded-xl border border-stone-800 bg-stone-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-amber-400" />
            <h2 className="font-serif text-lg font-semibold text-stone-100">Read a Plan or Sketch</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-stone-400 hover:text-stone-100 hover:bg-stone-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-stone-700 hover:border-amber-500/60 rounded-xl p-8 bg-stone-900/40 cursor-pointer transition-colors group">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {preview ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={preview} alt="Blueprint" className="max-h-48 rounded object-contain border border-stone-700" />
                  <span className="text-xs font-mono text-amber-400">{file?.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-stone-400 group-hover:text-stone-200">
                  <FileText className="h-10 w-10 text-amber-500/60 mb-1" />
                  <span className="text-sm font-medium">Click to select a plan PDF or sketch image</span>
                  <span className="text-xs text-stone-500">PDF, PNG, JPG or WebP, up to 10 MB</span>
                </div>
              )}
            </label>

            {file && !preview && <p className="text-xs font-mono text-amber-400">{file.name}</p>}
            {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">{error}</p>}

            <button
              type="button"
              disabled={!file || isProcessing}
              onClick={handleIngest}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-2.5 font-semibold text-white shadow-lg text-xs transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Reading the plan…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Read rooms and sizes</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs text-stone-300">
            <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-4 space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400 block font-bold">
                Read from the document{result.plot?.widthFt && result.plot?.depthFt ? ` · plot ${result.plot.widthFt} × ${result.plot.depthFt} ft` : ''}{result.floors ? ` · ${result.floors} floor(s)` : ''}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-stone-200">
                {result.rooms.map((r: any, i: number) => (
                  <div key={i} className="flex justify-between gap-2 border-b border-stone-800 py-1">
                    <span>{r.name}{r.floor ? ` (F${r.floor})` : ''}</span>
                    <span className="font-mono text-stone-400">{r.areaSqFt ? `${r.areaSqFt} sq ft` : 'size not legible'}</span>
                  </div>
                ))}
              </div>
              {result.notes?.length > 0 && (
                <ul className="list-disc pl-4 text-[11px] text-stone-400 space-y-0.5">
                  {result.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
                </ul>
              )}
              <p className="text-[11px] text-stone-500">Read by AI from your file. Verify against the original before relying on any value. This is a read-out; it does not change your current design.</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-stone-800 hover:bg-stone-700 px-4 py-2.5 font-semibold text-stone-100 text-xs transition-colors"
            >
              <span>Done</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
