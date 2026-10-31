'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Sparkles,
  Mic,
  Square,
  Camera,
  Compass,
  Grid,
  Globe2,
  Volume2,
  VolumeX,
  Send,
  AlertTriangle,
  Eye,
  Zap,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import {
  ConstellationEdge,
  ConversationMessage,
  DiscoveryResponse,
  JamendoSearchParams,
  MusicalJourney,
  SongPlanet,
  UniverseAtmosphere,
} from '@/types/echoverse';
import { DEFAULT_ATMOSPHERE } from '@/lib/jamendo/universe-builder';
import MusicPlayer from '@/components/player/MusicPlayer';
import PlanetInspectorPanel from '@/components/PlanetInspectorPanel';
import ShowMeYourWorldModal from '@/components/ShowMeYourWorldModal';
import {
  JourneyBuilderModal,
  ActiveJourneyNavigator,
} from '@/components/JourneyModalAndNavigator';
import Accessible2DView from '@/components/Accessible2DView';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';

const MusicalUniverse = dynamic(
  () => import('@/components/three/MusicalUniverse'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#030308] text-cyan-300 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span>Initialising 3D Musical Galaxy...</span>
        </div>
      </div>
    ),
  }
);

class ThreeSceneErrorBoundary extends React.Component<
  {
    onSwitchTo2D: () => void;
    children: React.ReactNode;
  },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { onSwitchTo2D: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'WebGL 3D rendering encountered an error in this browser.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#030308] p-6 text-white">
          <div className="max-w-md rounded-2xl bg-[#07091e]/95 border border-rose-400/40 p-5 text-center space-y-3 shadow-2xl">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <h2 className="text-base font-bold">
              3D Galaxy View Unavailable
            </h2>
            <p className="text-xs text-slate-300">
              {this.state.errorMessage}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/20 text-white"
              >
                Retry 3D View
              </button>
              <button
                type="button"
                onClick={this.props.onSwitchTo2D}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
              >
                Switch to 2D Accessible View
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const INITIAL_PROMPTS = [
  'Find me something that feels like walking through Tokyo at midnight',
  'I want something dreamy and nostalgic, but not depressing',
  'Give me music that feels like floating through space',
  'Take me somewhere completely unexpected',
];

const FOLLOWUP_PROMPTS = [
  'Make it more energetic',
  'Something less mainstream',
  'More mysterious',
  'I want something instrumental',
  'Show me something different',
];

export default function EchoverseApp() {
  const [planets, setPlanets] = useState<SongPlanet[]>([]);
  const [constellations, setConstellations] = useState<ConstellationEdge[]>([]);
  const [atmosphere, setAtmosphere] =
    useState<UniverseAtmosphere>(DEFAULT_ATMOSPHERE);
  const [querySummary, setQuerySummary] = useState<string>(
    'Celestial Resonance'
  );
  const [guideMessage, setGuideMessage] = useState<string>(
    'Welcome to Echoverse — A Universe That Listens to You. Describe a feeling, speak to your musical guide, or show me your world.'
  );
  const [visualObservation, setVisualObservation] = useState<
    string | undefined
  >(undefined);
  const [visionPreviewUrl, setVisionPreviewUrl] = useState<string | undefined>(
    undefined
  );
  const [currentCriteria, setCurrentCriteria] = useState<JamendoSearchParams>(
    {}
  );
  const [relaxationExplanation, setRelaxationExplanation] = useState<
    string | undefined
  >(undefined);
  const [warningBanner, setWarningBanner] = useState<string | undefined>(
    undefined
  );
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [selectedPlanet, setSelectedPlanet] = useState<SongPlanet | null>(null);
  const [playingPlanet, setPlayingPlanet] = useState<SongPlanet | null>(null);
  const [viewResetVersion, setViewResetVersion] = useState<number>(0);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false);

  const [promptInput, setPromptInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingLabel, setLoadingLabel] = useState<string>(
    'Summoning real independent tracks from Jamendo...'
  );

  // Conversation history for follow-ups
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);

  // Modals & Journeys
  const [isVisionModalOpen, setIsVisionModalOpen] = useState<boolean>(false);
  const [isJourneyModalOpen, setIsJourneyModalOpen] = useState<boolean>(false);
  const [activeJourney, setActiveJourney] = useState<MusicalJourney | null>(
    null
  );
  const [activeJourneyStepIndex, setActiveJourneyStepIndex] =
    useState<number>(0);
  const [sessionJourneys, setSessionJourneys] = useState<
    Array<{
      journey: MusicalJourney;
      planets: SongPlanet[];
      constellations: ConstellationEdge[];
      atmosphere: UniverseAtmosphere;
    }>
  >([]);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);

  // AI Guide Speech synthesis (muted by default so it never interrupts music unexpectedly)
  const [guideVoiceEnabled, setGuideVoiceEnabled] = useState<boolean>(false);
  const guideVoiceEnabledRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    guideVoiceEnabledRef.current = guideVoiceEnabled;
  }, [guideVoiceEnabled]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Accessibility & Graphics toggles
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [simplifiedGraphics, setSimplifiedGraphics] = useState<boolean>(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);

  // Detect OS prefers-reduced-motion on mount and clean up active voice/speech streams on unmount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.matches) {
        setReducedMotion(true);
      }
    }
    return () => {
      if (voiceStreamRef.current) {
        for (const track of voiceStreamRef.current.getTracks()) {
          track.stop();
        }
        voiceStreamRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Optional AI Guide speech synthesis (never speaks while a song is actively playing)
  const speakGuideResponse = useCallback((text: string) => {
    if (
      !guideVoiceEnabledRef.current ||
      isPlayingRef.current ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors
    }
  }, []);

  // Apply discovery payload to universe state
  const applyDiscoveryResponse = useCallback(
    (data: DiscoveryResponse, userText?: string) => {
      setPlanets(data.planets);
      setConstellations(data.constellations);
      setAtmosphere(data.atmosphere);
      setQuerySummary(data.querySummary);
      setGuideMessage(data.guideMessage);
      setVisualObservation(data.visualObservation);
      setCurrentCriteria(data.interpretedCriteria);
      setRelaxationExplanation(
        data.relaxedSearchUsed ? data.relaxationExplanation : undefined
      );
      setWarningBanner(data.warning);

      if (data.journey) {
        setActiveJourney(data.journey);
        setActiveJourneyStepIndex(0);
        if (data.planets.length > 0) {
          setSelectedPlanet(data.planets[0]);
          setPlayingPlanet(data.planets[0]);
          setShowInspector(true);
        }
      } else {
        setActiveJourney(null);
        // Start in the full 3D Galaxy Overview while priming the bottom player with the lead track
        setSelectedPlanet(null);
        setShowInspector(false);
        setViewResetVersion((v) => v + 1);
        if (data.planets.length > 0) {
          setPlayingPlanet((prev) =>
            isPlayingRef.current && prev ? prev : data.planets[0]
          );
        }
      }

      if (userText) {
        setConversationHistory((prev) => [
          ...prev.slice(-8),
          {
            id: `u-${Date.now()}`,
            role: 'user',
            text: userText,
            timestamp: new Date().toISOString(),
          },
          {
            id: `a-${Date.now() + 1}`,
            role: 'assistant',
            text: data.guideMessage,
            timestamp: new Date().toISOString(),
            visualObservation: data.visualObservation,
            criteriaUsed: data.interpretedCriteria,
          },
        ]);
      }

      speakGuideResponse(data.guideMessage);
    },
    [speakGuideResponse]
  );

  // Load initial Jamendo galaxy (compatible with React 18 Strict Mode & manual retries)
  const loadInitialUniverse = useCallback(
    async (isCancelled?: () => boolean) => {
      setIsLoading(true);
      setLoadingLabel('Summoning real independent tracks from Jamendo...');
      setErrorBanner(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch('/api/universe', {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load initial universe');
        }
        if (
          !data ||
          !Array.isArray(data.planets) ||
          data.planets.length === 0
        ) {
          throw new Error(
            'No playable tracks were returned from Jamendo. Please click Retry to reload the musical galaxy.'
          );
        }
        if (!isCancelled || !isCancelled()) {
          applyDiscoveryResponse(data as DiscoveryResponse);
        }
      } catch (err: unknown) {
        if (!isCancelled || !isCancelled()) {
          const message =
            err instanceof Error && err.name === 'AbortError'
              ? 'Loading the initial musical galaxy timed out. Please click Retry.'
              : err instanceof Error
              ? err.message
              : 'Could not reach Jamendo API.';
          setErrorBanner(message);
        }
      } finally {
        clearTimeout(timeoutId);
        if (!isCancelled || !isCancelled()) {
          setIsLoading(false);
        }
      }
    },
    [applyDiscoveryResponse]
  );

  // Load initial Jamendo galaxy on mount
  useEffect(() => {
    let cancelled = false;
    loadInitialUniverse(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadInitialUniverse]);

  // Submit natural language or follow-up prompt
  const handleDiscoverPrompt = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? promptInput).trim();
    if (!textToSend || isLoading) return;

    setHasUserInteracted(true);
    setIsLoading(true);
    setLoadingLabel(
      `Gemini is interpreting "${textToSend.slice(0, 42)}..." & searching Jamendo...`
    );
    setErrorBanner(null);
    setVisionPreviewUrl(undefined);

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          conversationHistory: conversationHistory.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          currentCriteria,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Discovery request failed');
      }
      applyDiscoveryResponse(data as DiscoveryResponse, textToSend);
      if (!customPrompt) {
        setPromptInput('');
      }
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Discovery request failed.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Submit "Show Me Your World" multimodal vision discovery
  const handleVisionDiscovery = async (payload: {
    imageBase64: string;
    imageMimeType: string;
    prompt?: string;
    audioBase64?: string;
    audioMimeType?: string;
    previewDataUrl: string;
  }) => {
    setHasUserInteracted(true);
    setIsLoading(true);
    setLoadingLabel(
      'Gemini Vision is analysing your image atmosphere & retrieving Jamendo tracks...'
    );
    setErrorBanner(null);

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: payload.prompt,
          imageBase64: payload.imageBase64,
          imageMimeType: payload.imageMimeType,
          audioBase64: payload.audioBase64,
          audioMimeType: payload.audioMimeType,
          conversationHistory: conversationHistory.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          currentCriteria,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Multimodal vision discovery failed');
      }
      setVisionPreviewUrl(payload.previewDataUrl);
      setIsVisionModalOpen(false);
      applyDiscoveryResponse(
        data as DiscoveryResponse,
        payload.prompt || '[Show Me Your World Image]'
      );
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error
          ? err.message
          : 'Failed to analyse image with Gemini.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Spoken voice request via microphone & Gemini native audio understanding
  const handleToggleVoiceRecording = async () => {
    setHasUserInteracted(true);
    setVoiceError(null);

    if (isRecordingVoice && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVoiceError(
          'Microphone recording is not supported in this browser. Please use the text input.'
        );
        return;
      }

      // Pause active music while recording voice so the microphone captures clean speech
      if (isPlaying) {
        setIsPlaying(false);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const preferredMime =
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : typeof MediaRecorder !== 'undefined' &&
            MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      const effectiveMime = recorder.mimeType || preferredMime || 'audio/mp4';
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        for (const track of stream.getTracks()) track.stop();
        voiceStreamRef.current = null;
        const blob = new Blob(chunks, { type: effectiveMime });
        if (blob.size < 200) {
          setVoiceError('Recording was too short. Please try speaking again.');
          return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = String(reader.result || '');
          const commaIdx = dataUrl.indexOf(',');
          if (commaIdx <= 0) return;

          const base64Audio = dataUrl.slice(commaIdx + 1);
          setIsLoading(true);
          setLoadingLabel(
            'Gemini is listening to your spoken request & transforming the galaxy...'
          );
          setErrorBanner(null);

          try {
            const res = await fetch('/api/discover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: promptInput.trim() || undefined,
                audioBase64: base64Audio,
                audioMimeType: effectiveMime,
                conversationHistory: conversationHistory.map((m) => ({
                  role: m.role,
                  text: m.text,
                })),
                currentCriteria,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || 'Voice discovery failed');
            }
            applyDiscoveryResponse(
              data as DiscoveryResponse,
              '[Spoken Voice Request]'
            );
          } catch (err: unknown) {
            setErrorBanner(
              err instanceof Error
                ? err.message
                : 'Failed to process spoken request.'
            );
          } finally {
            setIsLoading(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
    } catch {
      setVoiceError(
        'Microphone permission was denied. You can always type your musical request instead.'
      );
    }
  };

  // Create 5-step AI Musical Journey ("Take Me Somewhere")
  const handleCreateJourney = async (origin: string, destination: string) => {
    setHasUserInteracted(true);
    setIsLoading(true);
    setLoadingLabel(
      `Charting 5-track musical journey from "${origin}" to "${destination}"...`
    );
    setErrorBanner(null);

    try {
      const res = await fetch('/api/journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originPrompt: origin,
          destinationPrompt: destination,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate musical journey');
      }
      const discoveryData = data as DiscoveryResponse;
      setIsJourneyModalOpen(false);
      applyDiscoveryResponse(
        discoveryData,
        `Journey: ${origin} → ${destination}`
      );

      if (discoveryData.journey) {
        setSessionJourneys((prev) => [
          {
            journey: discoveryData.journey!,
            planets: discoveryData.planets,
            constellations: discoveryData.constellations,
            atmosphere: discoveryData.atmosphere,
          },
          ...prev,
        ]);
      }
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error
          ? err.message
          : 'Could not generate musical journey.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplayJourney = (index: number) => {
    const saved = sessionJourneys[index];
    if (!saved) return;
    setPlanets(saved.planets);
    setConstellations(saved.constellations);
    setAtmosphere(saved.atmosphere);
    setActiveJourney(saved.journey);
    setActiveJourneyStepIndex(0);
    setQuerySummary(`Journey: ${saved.journey.title}`);
    setGuideMessage(saved.journey.narrativeOverview);
    if (saved.planets.length > 0) {
      setSelectedPlanet(saved.planets[0]);
      setPlayingPlanet(saved.planets[0]);
      setShowInspector(true);
    }
  };

  const handleSelectJourneyStep = (stepIndex: number) => {
    if (!activeJourney) return;
    const step = activeJourney.steps[stepIndex];
    if (!step) return;
    setActiveJourneyStepIndex(stepIndex);
    const matchingPlanet = planets.find((p) => p.id === step.planetId);
    if (matchingPlanet) {
      setSelectedPlanet(matchingPlanet);
      setPlayingPlanet(matchingPlanet);
      setShowInspector(true);
      setHasUserInteracted(true);
      setIsPlaying(true);
      setAtmosphere((prev) => ({
        ...prev,
        accentColor: step.atmosphereColor || prev.accentColor,
      }));
    }
  };

  const handleSelectPlanet = useCallback((planet: SongPlanet, autoPlay = false) => {
    setHasUserInteracted(true);
    setSelectedPlanet(planet);
    setPlayingPlanet(planet);
    setShowInspector(true);
    if (planet.journeyStepIndex) {
      setActiveJourneyStepIndex(planet.journeyStepIndex - 1);
    }
    if (autoPlay) {
      setIsPlaying(true);
    }
  }, []);

  const handleResetGalaxyView = useCallback(() => {
    setSelectedPlanet(null);
    setShowInspector(false);
    setViewResetVersion((v) => v + 1);
  }, []);

  const handlePlayPause = useCallback((shouldPlay: boolean) => {
    setHasUserInteracted(true);
    setIsPlaying(shouldPlay);
  }, []);

  const handleDiscoverSimilar = (planet: SongPlanet) => {
    const topTags = planet.allTags
      .filter((t) => !t.startsWith('tempo:'))
      .slice(0, 4);
    const desc =
      topTags.length > 0
        ? `Find music with a similar atmosphere to "${planet.track.name}" by ${planet.track.artist_name} (${topTags.join(', ')})`
        : `Find music similar in mood to "${planet.track.name}" by ${planet.track.artist_name}`;
    handleDiscoverPrompt(desc);
  };

  const cyclePlanetSelection = useCallback(
    (direction: -1 | 1) => {
      if (planets.length === 0) return;
      const currentIndex = selectedPlanet
        ? planets.findIndex((p) => p.id === selectedPlanet.id)
        : -1;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + planets.length) % planets.length;
      const nextPlanet = planets[nextIndex];
      setSelectedPlanet(nextPlanet);
      setPlayingPlanet(nextPlanet);
      setShowInspector(true);
    },
    [planets, selectedPlanet]
  );

  useKeyboardNavigation({
    onPrevPlanet: () => cyclePlanetSelection(-1),
    onNextPlanet: () => cyclePlanetSelection(1),
    onToggleViewMode: () =>
      setViewMode((prev) => (prev === '3d' ? '2d' : '3d')),
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#030308] text-white flex flex-col justify-between select-none">
      {/* Top Bar: Branding, Mode Switchers & Multimodal Actions */}
      <header className="relative z-30 w-full px-4 sm:px-6 py-3 bg-gradient-to-b from-[#040512]/95 via-[#040512]/75 to-transparent flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-400 flex items-center justify-center shadow-[0_0_25px_rgba(124,58,237,0.6)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-300 bg-clip-text text-transparent">
                ECHOVERSE
              </h1>
              <span className="hidden md:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-violet-500/20 text-violet-200 border border-violet-400/30">
                A Universe That Listens to You
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Where do you want your music to take you? •{' '}
              <span className="text-cyan-300 font-medium">{querySummary}</span>
            </p>
          </div>
        </div>

        {/* Multimodal Feature Triggers & Accessibility Controls */}
        <nav
          aria-label="Primary discovery modes and accessibility settings"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={() => {
              setHasUserInteracted(true);
              setIsVisionModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600/80 to-cyan-600/80 hover:from-violet-500 hover:to-cyan-500 border border-cyan-300/30 text-white flex items-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.28)] focus:outline-none focus:ring-2 focus:ring-cyan-300 transition"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-200" />
            <span>Show Me Your World</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHasUserInteracted(true);
              setIsJourneyModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-pink-600/75 to-violet-600/75 hover:from-pink-500 hover:to-violet-500 border border-pink-300/30 text-white flex items-center gap-1.5 shadow-[0_0_20px_rgba(236,72,153,0.25)] focus:outline-none focus:ring-2 focus:ring-pink-300 transition"
          >
            <Compass className="w-3.5 h-3.5 text-pink-200" />
            <span>Take Me Somewhere</span>
          </button>

          {/* 3D / 2D Accessible View Toggle */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-cyan-200 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
            aria-label={
              viewMode === '3d'
                ? 'Switch to Accessible 2D Music Discovery Grid'
                : 'Switch to Interactive 3D Musical Universe'
            }
          >
            {viewMode === '3d' ? (
              <>
                <Grid className="w-3.5 h-3.5 text-cyan-300" />
                <span>2D Accessible View</span>
              </>
            ) : (
              <>
                <Globe2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>3D Galaxy View</span>
              </>
            )}
          </button>

          {/* Reset Camera to Full Galaxy Overview */}
          {viewMode === '3d' && (
            <button
              type="button"
              onClick={handleResetGalaxyView}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition ${
                selectedPlanet
                  ? 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/40 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.22)]'
                  : 'bg-white/8 hover:bg-white/15 border-white/15 text-slate-300 hover:text-white'
              }`}
              aria-label="Reset camera to full Galaxy Overview"
              title="Reset camera to full Galaxy Overview"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden lg:inline">Galaxy Overview</span>
            </button>
          )}

          {/* Keyboard / Button Planet Stepper */}
          <div className="hidden sm:flex items-center rounded-xl bg-white/8 border border-white/15 p-0.5">
            <button
              type="button"
              onClick={() => cyclePlanetSelection(-1)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="Focus previous song planet"
              title="Focus previous song planet"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] text-slate-300 font-medium">
              {planets.length} Planets
            </span>
            <button
              type="button"
              onClick={() => cyclePlanetSelection(1)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="Focus next song planet"
              title="Focus next song planet"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Accessibility & Graphics Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="Accessibility and graphics preferences"
              aria-expanded={showSettingsMenu}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#07091e]/95 backdrop-blur-2xl border border-white/20 shadow-2xl p-3.5 space-y-2.5 text-xs z-50">
                <div className="font-bold text-cyan-300 uppercase tracking-wider text-[10px]">
                  Accessibility & Performance
                </div>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span>Reduced Motion</span>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="accent-cyan-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span>Simplified Graphics Mode</span>
                  <input
                    type="checkbox"
                    checked={simplifiedGraphics}
                    onChange={(e) => setSimplifiedGraphics(e.target.checked)}
                    className="accent-cyan-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span>Speak AI Guide Replies</span>
                  <input
                    type="checkbox"
                    checked={guideVoiceEnabled}
                    onChange={(e) => {
                      setGuideVoiceEnabled(e.target.checked);
                      if (
                        !e.target.checked &&
                        typeof window !== 'undefined' &&
                        'speechSynthesis' in window
                      ) {
                        window.speechSynthesis.cancel();
                      }
                    }}
                    className="accent-cyan-400 w-4 h-4"
                  />
                </label>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Main Viewport: 3D Galaxy or 2D Accessible Interface */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {viewMode === '3d' ? (
          <ThreeSceneErrorBoundary onSwitchTo2D={() => setViewMode('2d')}>
            <MusicalUniverse
              planets={planets}
              constellations={constellations}
              atmosphere={atmosphere}
              selectedPlanet={selectedPlanet}
              playingTrackId={
                playingPlanet?.track.id || selectedPlanet?.track.id || null
              }
              isPlaying={isPlaying}
              reducedMotion={reducedMotion}
              simplifiedGraphics={simplifiedGraphics}
              viewResetVersion={viewResetVersion}
              isInspectorOpen={showInspector && Boolean(selectedPlanet)}
              onSelectPlanet={(planet) => handleSelectPlanet(planet, false)}
              onBackgroundClick={handleResetGalaxyView}
            />
          </ThreeSceneErrorBoundary>
        ) : (
          <Accessible2DView
            planets={planets}
            constellations={constellations}
            atmosphere={atmosphere}
            selectedPlanet={selectedPlanet || playingPlanet}
            playingTrackId={
              playingPlanet?.track.id || selectedPlanet?.track.id || null
            }
            isPlaying={isPlaying}
            onSelectPlanet={handleSelectPlanet}
            onTogglePlay={(planet) => {
              setHasUserInteracted(true);
              if (
                (playingPlanet?.id || selectedPlanet?.id) === planet.id &&
                isPlaying
              ) {
                setIsPlaying(false);
              } else {
                setSelectedPlanet(planet);
                setPlayingPlanet(planet);
                setIsPlaying(true);
              }
            }}
            onDiscoverSimilar={handleDiscoverSimilar}
          />
        )}

        {/* Top-Left AI Musical Guide & Multimodal Observation Card */}
        <div className="absolute top-3 left-4 sm:left-6 z-20 max-w-[390px] pointer-events-auto space-y-2">
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl bg-[#050816]/80 backdrop-blur-2xl border border-white/12 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.68)]"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-violet-400" />
                Gemini Musical Guide
              </span>
              <button
                type="button"
                onClick={() => setGuideVoiceEnabled(!guideVoiceEnabled)}
                className="text-[10px] text-slate-400 hover:text-white inline-flex items-center gap-1"
                title={
                  guideVoiceEnabled
                    ? 'Mute AI Guide speech'
                    : 'Enable AI Guide speech when music is paused'
                }
              >
                {guideVoiceEnabled ? (
                  <>
                    <Volume2 className="w-3 h-3 text-cyan-300" /> Voice On
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3 h-3" /> Voice Muted
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-100 leading-relaxed">
              {guideMessage}
            </p>

            {/* Visual Observation from "Show Me Your World" */}
            {visualObservation && (
              <div className="mt-2 pt-2 border-t border-white/10 flex items-start gap-2.5">
                {visionPreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={visionPreviewUrl}
                    alt="Analysed scene thumbnail"
                    className="w-11 h-11 rounded-lg object-cover border border-cyan-400/40 shrink-0"
                  />
                )}
                <div className="text-[11px] text-cyan-200/90 leading-snug">
                  <span className="font-semibold inline-flex items-center gap-1 text-cyan-300">
                    <Eye className="w-3 h-3" /> Observed Scene:
                  </span>{' '}
                  {visualObservation}
                </div>
              </div>
            )}

            {/* Active Jamendo Filter Pills */}
            {currentCriteria.fuzzytags &&
              currentCriteria.fuzzytags.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {currentCriteria.fuzzytags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full text-[10px] bg-violet-500/20 text-violet-200 border border-violet-400/25"
                    >
                      #{t}
                    </span>
                  ))}
                  {currentCriteria.speed && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-200 border border-cyan-400/25">
                      tempo:{currentCriteria.speed}
                    </span>
                  )}
                  {currentCriteria.vocalinstrumental && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-pink-500/20 text-pink-200 border border-pink-400/25">
                      {currentCriteria.vocalinstrumental}
                    </span>
                  )}
                </div>
              )}

            {relaxationExplanation && (
              <p className="mt-1.5 text-[10px] text-amber-300/90">
                Note: {relaxationExplanation}
              </p>
            )}
          </div>

          {(errorBanner || warningBanner || voiceError) && (
            <div
              role="alert"
              className="rounded-xl bg-rose-950/90 border border-rose-400/40 px-3 py-2 text-xs text-rose-200 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorBanner || voiceError || warningBanner}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => loadInitialUniverse()}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 border border-rose-300/40 text-[11px] font-semibold text-white inline-flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorBanner(null);
                    setVoiceError(null);
                    setWarningBanner(undefined);
                  }}
                  className="text-[10px] underline shrink-0"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Empty Universe Fallback & Retry Card */}
        {!isLoading && planets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none z-20">
            <div className="max-w-md rounded-2xl bg-[#07091e]/95 border border-cyan-400/40 p-5 text-center space-y-3 shadow-[0_0_45px_rgba(34,211,238,0.28)] pointer-events-auto">
              <AlertTriangle className="w-7 h-7 text-amber-400 mx-auto" />
              <h2 className="text-sm font-bold text-white">
                No Song Planets Loaded Yet
              </h2>
              <p className="text-xs text-slate-300">
                {errorBanner ||
                  'The musical universe could not finish loading initial tracks from Jamendo.'}
              </p>
              <button
                type="button"
                onClick={() => loadInitialUniverse()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white inline-flex items-center gap-1.5 shadow-lg transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Loading Galaxy
              </button>
            </div>
          </div>
        )}

        {/* Right-Side Floating Song Planet Inspector */}
        {showInspector && selectedPlanet && (
          <div className="absolute top-3 right-4 sm:right-6 z-20 pointer-events-auto">
            <PlanetInspectorPanel
              planet={selectedPlanet}
              allPlanets={planets}
              constellations={constellations}
              isPlayingThis={
                isPlaying &&
                (!playingPlanet || playingPlanet.id === selectedPlanet.id)
              }
              onClose={() => setShowInspector(false)}
              onResetView={handleResetGalaxyView}
              onTogglePlay={() => {
                setHasUserInteracted(true);
                if (playingPlanet && playingPlanet.id !== selectedPlanet.id) {
                  setPlayingPlanet(selectedPlanet);
                  setIsPlaying(true);
                } else {
                  setPlayingPlanet(selectedPlanet);
                  setIsPlaying(!isPlaying);
                }
              }}
              onSelectPlanet={handleSelectPlanet}
              onDiscoverSimilar={handleDiscoverSimilar}
            />
          </div>
        )}

        {/* Loading Overlay Indicator */}
        {isLoading && (
          <div
            role="status"
            aria-live="assertive"
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-fit max-w-md px-5 py-3 rounded-2xl bg-[#050816]/95 border border-cyan-400/40 shadow-[0_0_40px_rgba(34,211,238,0.35)] flex items-center gap-3 z-30"
          >
            <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
            <span className="text-xs font-medium text-cyan-100">
              {loadingLabel}
            </span>
          </div>
        )}

        {/* Bottom Floating Command Dock: Journey Stepper + Natural Language + Voice Input */}
        <div className="absolute bottom-3 inset-x-4 sm:inset-x-6 z-20 flex flex-col items-center gap-2 pointer-events-none">
          {activeJourney && (
            <div className="w-full pointer-events-auto">
              <ActiveJourneyNavigator
                journey={activeJourney}
                planets={planets}
                activeStepIndex={activeJourneyStepIndex}
                onSelectStep={handleSelectJourneyStep}
                onExitJourney={() => setActiveJourney(null)}
              />
            </div>
          )}

          {/* Main Natural-Language & Voice Discovery Bar */}
          <div className="w-full max-w-2xl rounded-2xl bg-[#050816]/82 backdrop-blur-2xl border border-white/12 shadow-[0_14px_45px_rgba(0,0,0,0.72)] p-2.5 pointer-events-auto">
            {/* Quick Suggestion & Follow-up Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-300 shrink-0 px-1 inline-flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                {conversationHistory.length > 0 ? 'Refine:' : 'Try:'}
              </span>
              {(conversationHistory.length > 0
                ? FOLLOWUP_PROMPTS
                : INITIAL_PROMPTS
              ).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleDiscoverPrompt(chip)}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white/8 hover:bg-violet-500/30 border border-white/10 hover:border-violet-400/40 text-slate-200 whitespace-nowrap transition focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input Form & Microphone Control */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDiscoverPrompt();
              }}
              className="flex items-center gap-2"
            >
              <label htmlFor="echoverse-prompt-input" className="sr-only">
                Where do you want your music to take you?
              </label>
              <input
                id="echoverse-prompt-input"
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder='Where do you want your music to take you? (e.g., "Walking through Tokyo at midnight")'
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/8 border border-white/15 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />

              {/* Explicit Voice Microphone Button */}
              <button
                type="button"
                onClick={handleToggleVoiceRecording}
                disabled={isLoading}
                aria-label={
                  isRecordingVoice
                    ? 'Stop voice recording and send to Gemini'
                    : 'Speak your musical request using microphone'
                }
                title={
                  isRecordingVoice
                    ? 'Click to finish speaking and send audio to Gemini'
                    : 'Speak to your AI Musical Guide (Gemini Audio Understanding)'
                }
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                  isRecordingVoice
                    ? 'bg-rose-600 border-rose-400 text-white animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                    : 'bg-white/10 hover:bg-white/15 border-white/15 text-cyan-200'
                }`}
              >
                {isRecordingVoice ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span className="hidden sm:inline">Stop & Send</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-cyan-300" />
                    <span className="hidden sm:inline">Speak</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isLoading || !promptInput.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-45 text-white flex items-center gap-1.5 shadow-[0_0_20px_rgba(34,211,238,0.35)] focus:outline-none focus:ring-2 focus:ring-cyan-300 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Explore</span>
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Persistent Music Player Footer */}
      <MusicPlayer
        activePlanet={playingPlanet || selectedPlanet || planets[0] || null}
        planets={planets}
        isPlaying={isPlaying}
        hasUserInteracted={hasUserInteracted}
        onPlayPause={handlePlayPause}
        onSelectPlanet={handleSelectPlanet}
        onDiscoverSimilar={handleDiscoverSimilar}
      />

      {/* "Show Me Your World" Multimodal Vision Modal */}
      <ShowMeYourWorldModal
        isOpen={isVisionModalOpen}
        isLoading={isLoading}
        onClose={() => setIsVisionModalOpen(false)}
        onSubmitVisionDiscovery={handleVisionDiscovery}
      />

      {/* "Take Me Somewhere" AI Musical Journey Modal */}
      <JourneyBuilderModal
        isOpen={isJourneyModalOpen}
        isLoading={isLoading}
        sessionJourneys={sessionJourneys}
        onClose={() => setIsJourneyModalOpen(false)}
        onCreateJourney={handleCreateJourney}
        onReplayJourney={handleReplayJourney}
      />
    </div>
  );
}
