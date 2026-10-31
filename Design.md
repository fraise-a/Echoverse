# Echoverse — Architecture & Design Document

## 1. Architectural Overview

Echoverse is structured around a modular separation of concerns within Next.js App Router (`src/`):

- **`src/types/echoverse.ts`**: Strict TypeScript interfaces for Jamendo API v3.0 responses, validated search parameters, 3D `SongPlanet` nodes, `ConstellationEdge` links, `UniverseAtmosphere` palettes, and 5-stage `MusicalJourney` blueprints.
- **`src/lib/jamendo/client.ts`**: Server-side Jamendo API v3.0 client with parameter whitelisting, tag slug normalisation, in-memory TTL caching, artist diversification, and multi-stage search relaxation when strict filters yield too few results.
- **`src/lib/jamendo/universe-builder.ts`**: Deterministic spatial layout engine that assigns tracks to four thematic cosmic regions and computes constellation edges from shared Jamendo metadata attributes.
- **`src/lib/gemini/config.ts`**: Single source of truth for Gemini model selection (`gemini-3.8-flash` primary, `gemini-flash-latest` fallback) and bounded exponential backoff retry logic.
- **`src/lib/gemini/service.ts`**: Server-side multimodal Gemini workflows using `@google/genai` structured JSON schemas (`DISCOVERY_SCHEMA`, `RANKING_SCHEMA`, `JOURNEY_PLAN_SCHEMA`).
- **`src/app/api/*`**: Server-side API routes (`/api/universe`, `/api/discover`, `/api/journey`) that keep `GEMINI_API_KEY` strictly on the server and provide graceful fallback to Jamendo catalogue browsing if AI services are unavailable.
- **`src/lib/audio/audio-analyzer.ts`**: Audio reactivity controller that probes stream CORS headers before connecting Web Audio API nodes, preventing cross-origin stream muting.
- **`src/components/three/MusicalUniverse.tsx`**: Interactive 3D universe built with React Three Fiber and Drei (`Stars`, `Line`, `Html`, `OrbitControls`, custom camera rig, and audio-reactive lighting/nebulae).
- **`src/components/Accessible2DView.tsx`**: Full-featured 2D accessible discovery interface exposing identical data, region filtering, and playback controls.

---

## 2. Key Engineering Decisions

### 2.1 Server-Side Secret Isolation
`GEMINI_API_KEY` is read exclusively inside server-side route handlers (`src/lib/gemini/config.ts`). Client components never access environment credentials directly and communicate only with `/api/universe`, `/api/discover`, and `/api/journey`. `next.config.mjs` also disables production browser source maps (`productionBrowserSourceMaps: false`).

### 2.2 Jamendo v3.0 Parameter Validation & Quirk Handling
Live testing against `https://api.jamendo.com/v3.0/tracks/` revealed two important API behaviours:
1. Unencoded `+` characters in `include=musicinfo+licenses` are decoded as spaces by Jamendo's backend and cause empty results unless percent-encoded (`%2B`) via `URLSearchParams`.
2. Combining `groupby=artist_id` with `fuzzytags` on Jamendo v3.0 returns `0` results. Echoverse resolves this by omitting `groupby` when `fuzzytags` is active, requesting a larger candidate pool, and diversifying by `artist_id` in memory so every constellation features varied independent artists.

### 2.3 Metadata-Grounded Clustering & Constellations
Rather than claiming black-box acoustic waveform similarity, Echoverse computes planet positions and constellation connections transparently from Jamendo's `musicinfo` metadata:
- **Regions:** Each track is scored against four regions (*Neon Horizon*, *Velvet Nebula*, *Organic Drift*, *Cinematic Core*) using its genres, instruments, mood tags (`vartags`), tempo (`speed`), and `acousticelectric` classification.
- **Collision-Free Golden-Angle Layout:** Within each region, planets are distributed along a golden-angle spiral with minimum-distance repulsion (`MIN_DISTANCE = 5.2`) so planets never overlap.
- **Constellations:** Edges connect pairs of planets sharing at least two metadata tags, displaying the exact shared attributes in the Planet Inspector panel.

### 2.4 Cross-Origin Stream Protection for Audio Reactivity
Live inspection of Jamendo's audio CDN (`https://prod-1.storage.jamendo.com`) confirmed that audio streams return `Access-Control-Allow-Origin: null`. In Chromium and WebKit browsers, calling `audioContext.createMediaElementSource(audioElement)` on a cross-origin `<audio>` element without CORS headers taints the media element and outputs silence.
- `EchoverseAudioAnalyzer` performs a `HEAD` CORS preflight check on the stream URL.
- When CORS is permitted, it connects `AnalyserNode` for real-time FFT frequency analysis (`web-audio-fft`).
- When CORS is restricted by the CDN, it leaves `<audio>` untainted so streaming playback works reliably, drives smooth tempo-aware animations (`playback-state`), and explicitly labels the mode in the UI.
