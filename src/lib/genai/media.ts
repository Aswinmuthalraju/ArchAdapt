/**
 * Server-only Gemini calls that take or return media: image generation (renders) and vision-to-JSON (blueprint
 * reading). Uses the same keys as gemini.ts and the same failover idea: every key is tried on every model, a
 * rejected request (HTTP 400, not a key problem) stops early because another key cannot fix it.
 */
import { geminiApiKeys } from './gemini';

export interface InlineMedia { mimeType: string; data: string } // data = base64, no data: prefix

export type MediaResult<T> =
  | { ok: true; value: T; modelId: string }
  | { ok: false; kind: 'NO_KEY' | 'QUOTA' | 'UNAVAILABLE' | 'INPUT_REJECTED' | 'NO_OUTPUT'; detail: string };

const csv = (value: string | undefined, fallback: string[]) => {
  const list = (value || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
};
export const imageModels = () => csv(process.env.GEMINI_IMAGE_MODELS, ['gemini-2.5-flash-image', 'gemini-3.1-flash-image']);
export const visionModels = () => csv(process.env.GEMINI_VISION_MODELS, ['gemini-3.5-flash', 'gemini-3.1-flash-lite']);

const CALL_TIMEOUT_MS = 55_000;

async function generate(models: string[], body: unknown, deadline: number, callTimeoutMs = CALL_TIMEOUT_MS): Promise<MediaResult<any>> {
  const keys = geminiApiKeys();
  if (!keys.length) return { ok: false, kind: 'NO_KEY', detail: 'No Gemini API key is configured on the server (GENAI_API_KEY).' };
  const failures: string[] = [];
  let onlyQuota = true; // every failure so far was HTTP 429
  for (const modelId of models) {
    for (let i = 0; i < keys.length; i++) {
      const remaining = deadline - Date.now();
      if (remaining < 5_000) return { ok: false, kind: 'UNAVAILABLE', detail: `Out of time. ${failures.join('; ')}` };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(callTimeoutMs, remaining));
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keys[i] },
          signal: controller.signal,
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          let message = '';
          try { message = (await res.json())?.error?.message || ''; } catch { /* not JSON */ }
          failures.push(`${modelId} key ${i + 1}: HTTP ${res.status}`);
          if (res.status !== 429) onlyQuota = false;
          if (res.status === 400 && !/api key/i.test(message)) {
            return { ok: false, kind: 'INPUT_REJECTED', detail: message.slice(0, 200) || 'The AI service rejected the request.' };
          }
          continue;
        }
        return { ok: true, value: await res.json(), modelId };
      } catch (err: any) {
        onlyQuota = false;
        failures.push(`${modelId} key ${i + 1}: ${err?.name === 'AbortError' ? 'timed out' : err?.message || 'network error'}`);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  if (failures.length && onlyQuota) return { ok: false, kind: 'QUOTA', detail: failures.join('; ') };
  return { ok: false, kind: 'UNAVAILABLE', detail: failures.join('; ') || 'No model could be reached.' };
}

/** Generates one image from a prompt, optionally conditioned on reference images (e.g. a capture of the 3D model). */
export async function generateImage(prompt: string, references: InlineMedia[], deadline: number): Promise<MediaResult<InlineMedia>> {
  const parts: any[] = [{ text: prompt }, ...references.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } }))];
  const res = await generate(imageModels(), { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'] } }, deadline);
  if (!res.ok) return res;
  const out = (res.value?.candidates?.[0]?.content?.parts || []).find((p: any) => p?.inlineData?.data)?.inlineData;
  if (!out) {
    const why = res.value?.candidates?.[0]?.finishReason || res.value?.promptFeedback?.blockReason || 'no image returned';
    return { ok: false, kind: 'NO_OUTPUT', detail: `The model returned no image (${why}).` };
  }
  return { ok: true, value: { mimeType: out.mimeType || 'image/png', data: out.data }, modelId: res.modelId };
}

/** Reads an image or PDF and returns the JSON the model extracted from it. */
export async function readDocumentAsJson(system: string, instruction: string, file: InlineMedia, deadline: number): Promise<MediaResult<unknown>> {
  const res = await generate(visionModels(), {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: instruction }, { inlineData: { mimeType: file.mimeType, data: file.data } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 8192 }
  }, deadline, 25_000); // a stuck vision model must fail over quickly
  if (!res.ok) return res;
  const text = (res.value?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return { ok: true, value: JSON.parse(text), modelId: res.modelId };
  } catch {
    return { ok: false, kind: 'NO_OUTPUT', detail: 'The model did not return valid JSON for this document.' };
  }
}

/** Parses `data:<mime>;base64,<payload>`; returns null for anything else or an oversized payload. */
export function parseDataUrl(value: unknown, allowed: RegExp, maxBytes: number): InlineMedia | null {
  if (typeof value !== 'string') return null;
  const m = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!m || !allowed.test(m[1])) return null;
  if (m[2].length * 0.75 > maxBytes) return null;
  return { mimeType: m[1], data: m[2] };
}
