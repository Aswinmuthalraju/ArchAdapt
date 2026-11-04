# ArchadaptAI

ArchadaptAI is a residential architectural generation engine built on Next.js 16, React 19, TypeScript, Tailwind CSS, Three.js, Supabase, and Gemini.

It turns family requirements, site dimensions, and cultural design preferences into verified, buildable architectural floor plans and 3D massing models.

---

## Key Features

- **Hybrid Generation Engine:** Combines high-level generative reasoning (spatial programming, orientation strategy, relationship graph) with a pure deterministic 2D layout and 3D geometry engine.
- **Architectural Styles & Regional Adaptations:** 8 distinct traditions (Kerala Traditional, Traditional Indian, Colonial, Tropical, Modern, Minimalist, Contemporary, Modern Luxury) with isolated RAG knowledge bases, Vastu Shastra principles, and climate-adaptive zonation.
- **Strict Quality Guarantees:** 100% of generated plans pass structural alignment, statutory setbacks, road-facing main entry door, unblocked vertical stair landings on every floor, and zero bedrooms crossed for circulation.
- **What-If Natural Language Iteration:** Apply iterative changes ("add a bedroom upstairs", "make the kitchen larger", "move the study") as chained version deltas without losing previous customizations.
- **Professional Exports:** Download AutoCAD-compatible DXF drawings, 3D OBJ models with material groups, and CSV area/opening schedules.

---

## API Keys & Generation Engines

ArchadaptAI can generate plans via Google Gemini or entirely offline using its built-in deterministic rule engine.

### Gemini API Key Configuration
Create `.env.local` based on `.env.example`:
```env
# Up to 3 Gemini API keys for seamless automatic failover:
GENAI_API_KEY=your-first-gemini-key
GENAI_API_KEY_2=your-second-gemini-key
GENAI_API_KEY_3=your-third-gemini-key

# Optional: comma-separated list of keys
# GENAI_API_KEYS=key1,key2,key3

# Optional: override model waterfall (default: gemini-2.5-flash,gemini-2.5-pro)
# GEMINI_MODELS=gemini-2.5-flash,gemini-2.5-pro
```

### Multi-Key & Multi-Model Failover
The AI pipeline (`src/lib/genai/gemini.ts`) includes zero-downtime failover:
1. Fast model first (`gemini-2.5-flash`), with fallback to strong reasoning (`gemini-2.5-pro`).
2. Automatic handover across keys if one encounters HTTP 429 quota limits, timeouts, or network interruptions.
3. Keys that hit rate limits enter a temporary 60-second cooldown so subsequent requests are not stalled.
4. Keys are securely read on the server and sent via request headers; keys are never logged or leaked to the client bundle.

### Built-in Local Rule Engine
If no Gemini API key is configured or if the external AI service is unreachable, the system automatically hands over to the built-in deterministic rule engine (`engine: 'local'`). The rule engine executes in under $5\text{ ms}$ and is fully accessible via the UI for instant, offline generation.

---

## Developer Commands

```bash
# Install the locked dependencies (Node.js 22 or newer)
npm ci

# Run unit test suite (93 automated tests)
npm test

# Run 224-combination architectural quality sweep (with thresholds)
npm run sweep

# Run Playwright end-to-end integration tests
npm run test:e2e

# Run ESLint
npm run lint

# Type check
npx tsc --noEmit

# Production build
npm run build

# Start production server
npm run start
```
