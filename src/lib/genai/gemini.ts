/**
 * Server-only Gemini client. The API key is read from server environment variables and sent in a
 * request header; it is never part of a URL, a response body or the browser bundle.
 */

export type GeminiCallResult =
  | { ok: true; json: unknown; modelId: string }
  | { ok: false; kind: 'NO_KEY' | 'UNAVAILABLE' | 'BAD_RESPONSE'; detail: string; modelId?: string };

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];
const PER_CALL_TIMEOUT_MS = 90_000;

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
const keysToTry = (): string[] => {
  const keys = geminiApiKeys();
  const now = Date.now();
  const ready = keys.filter((key) => (coolingUntil.get(key) || 0) <= now);
  return ready.length ? ready : keys;
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
 * One generation call. Tries each configured model in turn only when the previous one could not be
 * reached (HTTP error, timeout, network failure). A model that answers with unusable content is
 * returned as BAD_RESPONSE so the caller can count it as a failed attempt instead of hiding it.
 *
 * @param deadline epoch ms after which no further network call is started
 */
export async function callGeminiJson(systemPrompt: string, userPrompt: string, deadline: number): Promise<GeminiCallResult> {
  const allKeys = geminiApiKeys();
  if (!allKeys.length) return { ok: false, kind: 'NO_KEY', detail: 'No Gemini API key is configured on the server (GENAI_API_KEY).' };

  const failures: string[] = [];
  for (const modelId of geminiModels()) {
    // Keys are tried in order for each model; the next key is used when one is rate limited, rejected or unreachable.
    for (const apiKey of keysToTry()) {
      const remaining = deadline - Date.now();
      if (remaining < 15_000) {
        failures.push(`${modelId}: skipped, time budget exhausted`);
        return { ok: false, kind: 'UNAVAILABLE', detail: failures.join('; ') };
      }
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
            generationConfig: { responseMimeType: 'application/json', temperature: 0.35, thinkingConfig: { thinkingBudget: 1024 } }
          })
        });
        if (!res.ok) {
          let message = '';
          try { message = (await res.json())?.error?.message || ''; } catch { /* body not JSON */ }
          failures.push(`${modelId} ${keyLabel(apiKey, allKeys)}: HTTP ${res.status}${message ? ` ${message.slice(0, 120)}` : ''}`);
          // Quota, auth and server errors belong to the key or service; 404 and 400 belong to the model, so move on to the next model.
          if ([401, 403, 429].includes(res.status) || res.status >= 500) coolingUntil.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
          if (res.status === 404 || res.status === 400) break;
          continue;
        }
        coolingUntil.delete(apiKey);
        let data: any;
        try {
          data = await res.json();
        } catch {
          return { ok: false, kind: 'BAD_RESPONSE', detail: `${modelId} returned a body that is not JSON.`, modelId };
        }
        const candidate = data?.candidates?.[0];
        const text = (candidate?.content?.parts || []).map((part: any) => part?.text || '').join('');
        if (!text) {
          const why = candidate?.finishReason || data?.promptFeedback?.blockReason || 'empty response';
          return { ok: false, kind: 'BAD_RESPONSE', detail: `${modelId} returned no content (${why}).`, modelId };
        }
        try {
          return { ok: true, json: extractJson(text), modelId };
        } catch {
          return { ok: false, kind: 'BAD_RESPONSE', detail: `${modelId} returned malformed JSON${candidate?.finishReason === 'MAX_TOKENS' ? ' (output was cut off)' : ''}.`, modelId };
        }
      } catch (err: any) {
        failures.push(`${modelId} ${keyLabel(apiKey, allKeys)}: ${err?.name === 'AbortError' ? 'timed out' : err?.message || 'network error'}`);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { ok: false, kind: 'UNAVAILABLE', detail: failures.join('; ') || 'No Gemini model could be reached.' };
}
