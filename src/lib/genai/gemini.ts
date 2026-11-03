/**
 * Server-only Gemini client. The API key is read from server environment variables and sent in a
 * request header; it is never part of a URL, a response body or the browser bundle.
 */

export type GeminiCallResult =
  | { ok: true; json: unknown; modelId: string }
  | { ok: false; kind: 'NO_KEY' | 'UNAVAILABLE' | 'BAD_RESPONSE' | 'INPUT_REJECTED'; detail: string; modelId?: string };

const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
const PER_CALL_TIMEOUT_MS = 28_000;
/** After this many timeouts or 503s on one model, the model itself is overloaded: move on instead of trying every key. */
const OVERLOAD_LIMIT = 2;

const KEY_ENV_NAMES = ['GENAI_API_KEY', 'GENAI_API_KEY_2', 'GENAI_API_KEY_3', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];
const KEY_COOLDOWN_MS = 60_000;
const isPlaceholder = (key: string) => !key || /^your-|-here$/i.test(key);

/** Every configured key, in priority order, de-duplicated. GENAI_API_KEYS may also hold a comma-separated list. */
export function geminiApiKeys(): string[] {
  const listed = (process.env.GENAI_API_KEYS || '').split(',');
  const all = [...KEY_ENV_NAMES.map((name) => process.env[name] || ''), ...listed].map((k) => k.trim()).filter((k) => !isPlaceholder(k));
  return Array.from(new Set(all));
}

export function geminiApiKey(): string | null {
  return geminiApiKeys()[0] || null;
}

// A key that just failed (quota, revoked, outage) is skipped for a minute so every request is not slowed by it.
const coolingUntil = new Map<string, number>();
/** Forgets which keys are cooling down (used by tests and after the configuration changes). */
export const resetGeminiKeyState = () => coolingUntil.clear();
const keysToTry = (): string[] => {
  const keys = geminiApiKeys();
  const now = Date.now();
  const ready = keys.filter((key) => (coolingUntil.get(key) || 0) <= now);
  // Keys that are cooling down are still tried last, so a request never fails while an untried key exists.
  return [...ready, ...keys.filter((key) => !ready.includes(key))];
};
const keyLabel = (key: string, all: string[]) => `key ${all.indexOf(key) + 1}`;

export function geminiModels(): string[] {
  const configured = (process.env.GEMINI_MODELS || '').split(',').map((id) => id.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_MODELS;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('Response is not valid JSON.');
  }
}

/**
 * One generation call with full failover. Every configured key is tried on every configured model, in order,
 * and the next key (then the next model) is used whenever a call fails for ANY provider-side reason:
 * quota / rate limit, revoked key, outage, timeout, network error, empty or blocked answer, cut-off or malformed JSON.
 *
 * Only two outcomes stop early:
 *  - HTTP 400 "INVALID_ARGUMENT" means the request itself was rejected, so another key cannot help: it is returned as
 *    INPUT_REJECTED so the caller can tell the user the input caused it (not the provider).
 *  - the time budget is exhausted.
 * Which key and model finally answered, and what failed before that, is reported so nothing is hidden.
 *
 * @param deadline epoch ms after which no further network call is started
 */
export async function callGeminiJson(systemPrompt: string, userPrompt: string, deadline: number): Promise<GeminiCallResult> {
  const allKeys = geminiApiKeys();
  if (!allKeys.length) return { ok: false, kind: 'NO_KEY', detail: 'No Gemini API key is configured on the server (GENAI_API_KEY).' };

  const failures: string[] = [];
  let sawBadResponse: string | null = null;
  for (const modelId of geminiModels()) {
    let overloaded = 0;
    for (const apiKey of keysToTry()) {
      if (overloaded >= OVERLOAD_LIMIT) {
        failures.push(`${modelId}: overloaded, skipping its remaining keys`);
        break;
      }
      const remaining = deadline - Date.now();
      if (remaining < 12_000) {
        failures.push(`${modelId}: skipped, time budget exhausted`);
        return sawBadResponse
          ? { ok: false, kind: 'BAD_RESPONSE', detail: `${sawBadResponse} (other keys and models ran out of time)` }
          : { ok: false, kind: 'UNAVAILABLE', detail: failures.join('; ') };
      }
      const label = `${modelId} ${keyLabel(apiKey, allKeys)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(PER_CALL_TIMEOUT_MS, remaining));
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.35, maxOutputTokens: 24576, thinkingConfig: { thinkingBudget: 1024 } }
          })
        });
        if (!res.ok) {
          let message = '';
          let status = '';
          try { const body = await res.json(); message = body?.error?.message || ''; status = body?.error?.status || ''; } catch { /* body not JSON */ }
          failures.push(`${label}: HTTP ${res.status}${message ? ` ${message.slice(0, 120)}` : ''}`);
          if (res.status === 503 || res.status === 504) overloaded++;
          if ([401, 403, 429].includes(res.status) || res.status >= 500) coolingUntil.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
          // A malformed request is the same for every key: stop and say the input was the problem.
          // (A bad key also answers 400 "API key not valid"; that one is the key's fault, so it moves on.)
          if (res.status === 400 && !/api key/i.test(message) && !/FAILED_PRECONDITION/.test(status)) {
            return { ok: false, kind: 'INPUT_REJECTED', detail: `The AI service rejected the request: ${message.slice(0, 200) || 'invalid argument'}`, modelId };
          }
          if (res.status === 400) coolingUntil.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
          continue; // next key, then next model
        }
        let data: any;
        try {
          data = await res.json();
        } catch {
          sawBadResponse = `${label} returned a body that is not JSON.`;
          failures.push(sawBadResponse);
          continue;
        }
        const candidate = data?.candidates?.[0];
        const text = (candidate?.content?.parts || []).map((part: any) => part?.text || '').join('');
        if (!text) {
          const why = candidate?.finishReason || data?.promptFeedback?.blockReason || 'empty response';
          sawBadResponse = `${label} returned no content (${why}).`;
          failures.push(sawBadResponse);
          continue;
        }
        try {
          const json = extractJson(text);
          coolingUntil.delete(apiKey);
          if (failures.length) console.warn(`[ARCHADAPT] Gemini failover: answered by ${label} after ${failures.length} failed call(s): ${failures.join(' | ')}`);
          return { ok: true, json, modelId };
        } catch {
          sawBadResponse = `${label} returned malformed JSON${candidate?.finishReason === 'MAX_TOKENS' ? ' (output was cut off)' : ''}.`;
          failures.push(sawBadResponse);
          continue;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') overloaded++;
        failures.push(`${label}: ${err?.name === 'AbortError' ? 'timed out' : err?.message || 'network error'}`);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  // Every key on every model failed. If at least one answered with unusable content, the planner is reachable
  // but could not produce valid JSON, which the caller counts as a failed attempt and may retry with feedback.
  if (sawBadResponse) return { ok: false, kind: 'BAD_RESPONSE', detail: failures.join('; ') };
  return { ok: false, kind: 'UNAVAILABLE', detail: failures.join('; ') || 'No Gemini model could be reached.' };
}
