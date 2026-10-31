# Echoverse — A Universe That Listens to You

**Echoverse** is an interactive, multimodal AI-powered 3D music discovery platform built for the **Google DeepMind Buildathon**.

> **Buildathon Submission Track:**
> **Track 2 — Multimodal & Human-Centric AI:** Live voice and camera vision, expressive speech, interactive 3D worlds, accessibility, and everyday utility powered by the Gemini model family.

Instead of requiring users to search by genre, artist, or technical musical terminology, Echoverse asks a single human question:

> **"Where do you want your music to take you?"**

Users can describe an atmosphere in natural language, speak to their AI musical guide, upload a photograph or capture a camera frame via **"Show Me Your World"**, or chart a five-destination musical odyssey via **"Take Me Somewhere"**. Every glowing planet in the 3D galaxy represents a real independent song streamed from the official Jamendo catalogue.

---

## Core Features

1. **Interactive 3D Musical Universe (`React Three Fiber` + `Three.js`)**
   - Every planet represents a real independent track retrieved from the Jamendo API v3.0.
   - Planets are clustered into four cosmic regions (*Neon Horizon*, *Velvet Nebula*, *Organic Drift*, *Cinematic Core*) based on real Jamendo musical metadata (`genres`, `instruments`, `vartags`, `speed`, `acousticelectric`, `vocalinstrumental`).
   - Constellation lines connect tracks that share genuine musical metadata attributes.
   - Selecting any planet smoothly focuses the camera, opens the floating Planet Inspector panel, displays real album artwork and licensing metadata, and enables streaming playback.

2. **Natural-Language & Conversational Music Discovery (`@google/genai`)**
   - Expressive prompts such as *"Find me something that feels like walking through Tokyo at midnight"* or *"I want something dreamy and nostalgic, but not depressing"* are interpreted using structured Gemini JSON output.
   - Gemini maps user intent onto validated Jamendo API v3.0 parameters (`fuzzytags`, `tags`, `speed`, `vocalinstrumental`, `acousticelectric`, `boost`).
   - Conversational follow-ups (*"Make it more energetic"*, *"Something less mainstream"*, *"I want something instrumental"*) refine the active search criteria and transform the 3D universe in real time.
   - Transparent search relaxation: if strict filter combinations return too few tracks, Echoverse automatically relaxes constraints step-by-step and explains how the search was broadened.

3. **"Show Me Your World" — Multimodal Image & Camera Vision**
   - Upload any photograph, capture a live frame from a device camera (optional, permission-based, disabled by default), or test with built-in canvas-generated photographic scenes.
   - Optionally combine the visual scene with a written or spoken direction (e.g., *"Make this feel like a mysterious night in Tokyo"*).
   - Gemini analyses observable visual features (setting, lighting, colours, weather, objects, and atmosphere) to curate matching Jamendo tracks and shift the galaxy's lighting and nebula palette.
   - Strictly privacy-preserving: images are processed transiently in memory, never stored on disk, and never used to infer personal identity or facial emotions.

4. **Spoken Voice Interaction & Musical Guide**
   - Explicitly controlled microphone recording sends spoken requests directly to Gemini's native multimodal audio understanding.
   - Optional spoken AI Guide responses with a visible mute toggle (muted by default and automatically suppressed while a song is playing so speech never interferes with music playback) alongside full text transcripts.

5. **"Take Me Somewhere" — AI-Curated 5-Stop Musical Journeys**
   - Describe a starting mood and a destination (e.g., *"From a peaceful rainy afternoon in Tokyo to an electrifying night out in London"*).
   - Gemini designs a coherent 5-stage musical progression; Echoverse retrieves 5 distinct real Jamendo tracks across independent artists and connects them with a glowing route in 3D space.
   - Includes step-by-step camera and player navigation plus session history replay.

6. **Persistent Music Player & Honest Audio-Reactive Visuals**
   - Streams real audio using Jamendo's returned `audio` streaming URLs.
   - Probes stream CORS headers before attaching `AudioContext` / `AnalyserNode`. When cross-origin streams restrict CORS inspection, Echoverse protects uninterrupted playback and uses tempo-synchronised playback-state animations clearly labelled in the player UI.

7. **Accessibility & Inclusive Design**
   - **2D Accessible Discovery View:** Exposes all songs, regions, metadata tags, constellation relationships, and playback controls in a keyboard-friendly, screen-reader-accessible grid without requiring 3D navigation.
   - **Keyboard Shortcuts:** Use `[` and `]` to cycle between song planets and `V` to toggle between the 3D Galaxy and 2D Accessible views.
   - **Reduced Motion & Simplified Graphics Modes:** Respects `prefers-reduced-motion` and provides explicit toggles for reduced motion and lower GPU complexity.

---

## Technology Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **3D Engine:** Three.js, React Three Fiber (`@react-three/fiber`), Drei (`@react-three/drei`)
- **Artificial Intelligence:** Google Gemini via official `@google/genai` SDK (centralised model configuration in `src/lib/gemini/config.ts`)
- **Music Catalogue & Streaming:** Jamendo API v3.0 (`https://api.jamendo.com/v3.0/tracks/`), HTML5 Audio, Web Audio API
- **Icons:** Lucide React (`lucide-react`)

---

## Setup & Local Development

### 1. Prerequisites
- Node.js 18.18+ (tested with Node.js v24)
- npm 9+

### 2. Environment Variables
Create or verify `.env.local` in the project root (see `.env.example` for template placeholders):

```env
JAMENDO_CLIENT_ID=YOUR_JAMENDO_CLIENT_ID
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

- `JAMENDO_CLIENT_ID`: Public application client ID registered in the [Jamendo Developer Portal](https://developer.jamendo.com/).
- `GEMINI_API_KEY`: Server-side Google Gemini API key. **Never** prefix this with `NEXT_PUBLIC_` or expose it in client-side code.

### 3. Install Dependencies & Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in Chrome or Safari.

### 4. Type Check, Build & Security Verification

```bash
npm run typecheck
npm run security-check
npm run build
```

---

## Jamendo Attribution & Licensing

All music in Echoverse is streamed directly from [Jamendo Music](https://www.jamendo.com) via the official Jamendo API v3.0. Every song planet and player state displays:
- Track title and independent artist name
- Direct link to the original track page on Jamendo (`shareurl`)
- Creative Commons licence link (`license_ccurl`)

Echoverse uses Jamendo's streaming `audio` endpoint exclusively for real-time listening and does not redistribute, modify, or download recordings.

---

## GitHub Security Guidance

Before staging or committing any files to Git, run the automated repository security check:

```bash
npm run security-check
```

This script verifies that:
1. `.gitignore` excludes `.env.local` and all secret `.env*` files while allowing `.env.example`.
2. Git confirms `.env.local` is ignored and untracked (`git check-ignore` and `git ls-files`).
3. `.env.example` contains only safe placeholder strings.
4. No client-exposed `NEXT_PUBLIC_` secret variables or real API key patterns appear anywhere in source code or documentation.

---

## Known Limitations

- **Cross-Origin Audio Streams & Web Audio FFT:** Jamendo's audio storage CDN (`prod-1.storage.jamendo.com`) serves streams without `Access-Control-Allow-Origin` headers. Attaching `createMediaElementSource` to a non-CORS `<audio>` element silences playback in modern browsers. Echoverse detects this automatically via a CORS preflight probe and switches to tempo-informed playback-state animations so audio streaming always works reliably.
- **Voice Interaction Mode:** Voice requests use explicit push-to-talk recording transmitted to Gemini's native multimodal audio understanding API (`inlineData` audio) rather than a persistent WebSocket stream, ensuring reliable turn-based voice discovery without exposing the Gemini API key in the browser.
