import { NextResponse } from 'next/server';
import type { StructuredDesignJSON } from '@/types/architectural';
import type { MediaResult } from '@/lib/genai/media';

const hits = new Map<string, number[]>();

/** Sliding-window limiter per client (in-memory: protects paid image quota on a single instance). */
export function rateLimited(req: Request, bucket: string, max: number, windowMs = 60_000): boolean {
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}

export const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });

/** Minimal shape check; the client sends the design it is looking at. */
export function asDesign(value: unknown): StructuredDesignJSON | null {
  const d = value as StructuredDesignJSON | undefined;
  if (!d || typeof d !== 'object' || !Array.isArray(d.rooms) || !Array.isArray(d.openings) || !d.plot || typeof d.plot.width !== 'number') return null;
  if (d.rooms.length > 200 || d.openings.length > 2000) return null;
  return d;
}

/** Maps a failed media call to an honest HTTP error. */
export function mediaFailure(r: Extract<MediaResult<unknown>, { ok: false }>) {
  if (r.kind === 'NO_KEY') return fail(503, 'AI rendering is not configured on this server (no Gemini API key).');
  if (r.kind === 'QUOTA') return fail(503, 'The Gemini API quota is used up or image generation is not enabled for this key. Enable billing for the Google AI project (image generation is not on the free tier), or try again after the quota resets.');
  if (r.kind === 'INPUT_REJECTED') return fail(422, `The AI service rejected this request: ${r.detail}`);
  if (r.kind === 'NO_OUTPUT') return fail(502, r.detail);
  return fail(502, 'The AI service is unavailable right now. Please try again in a minute.');
}
