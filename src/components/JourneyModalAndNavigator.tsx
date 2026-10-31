'use client';

import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  X,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History,
  MapPin,
} from 'lucide-react';
import { MusicalJourney, SongPlanet } from '@/types/echoverse';

interface JourneyBuilderModalProps {
  isOpen: boolean;
  isLoading: boolean;
  sessionJourneys: Array<{
    journey: MusicalJourney;
    planets: SongPlanet[];
  }>;
  onClose: () => void;
  onCreateJourney: (origin: string, destination: string) => void;
  onReplayJourney: (index: number) => void;
}

const JOURNEY_PRESETS = [
  {
    origin: 'A peaceful rainy afternoon in Tokyo',
    destination: 'An electrifying neon night out in London',
  },
  {
    origin: 'Quiet acoustic dawn in a misty forest',
    destination: 'Soaring cinematic orbital spaceflight',
  },
  {
    origin: 'Nostalgic midnight lo-fi study session',
    destination: 'Euphoric sunrise synthwave horizon',
  },
];

export function JourneyBuilderModal({
  isOpen,
  isLoading,
  sessionJourneys,
  onClose,
  onCreateJourney,
  onReplayJourney,
}: JourneyBuilderModalProps) {
  const [origin, setOrigin] = useState(
    'A peaceful rainy afternoon in Tokyo'
  );
  const [destination, setDestination] = useState(
    'An electrifying night out in London'
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim()) return;
    onCreateJourney(origin.trim(), destination.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journey-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl bg-[#07091c]/95 border border-white/15 shadow-[0_0_60px_rgba(6,182,212,0.3)] p-5 text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-400">
              AI-Curated 5-Destination Odyssey
            </span>
            <h2
              id="journey-modal-title"
              className="text-xl font-bold text-white flex items-center gap-2"
            >
              <Compass className="w-5 h-5 text-cyan-400" />
              Take Me Somewhere
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Describe a starting feeling and a destination. Gemini will chart a five-step sonic progression across real Jamendo tracks connected by a glowing route in 3D space.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Close Take Me Somewhere modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
          <div>
            <label
              htmlFor="journey-origin"
              className="block text-xs font-medium text-cyan-200 mb-1"
            >
              Starting Atmosphere (Origin)
            </label>
            <input
              id="journey-origin"
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g., A peaceful rainy afternoon in Tokyo"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/8 border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div>
            <label
              htmlFor="journey-destination"
              className="block text-xs font-medium text-pink-200 mb-1"
            >
              Destination Atmosphere
            </label>
            <input
              id="journey-destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., An electrifying night out in London"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/8 border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          <div>
            <span className="block text-[11px] text-slate-400 mb-1.5">
              Quick Journey Inspirations:
            </span>
            <div className="space-y-1.5">
              {JOURNEY_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setOrigin(preset.origin);
                    setDestination(preset.destination);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs flex items-center justify-between gap-2 transition"
                >
                  <span className="text-cyan-200 truncate">{preset.origin}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-pink-200 truncate">
                    {preset.destination}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 via-violet-600 to-pink-500 hover:from-cyan-400 hover:to-pink-400 disabled:opacity-50 text-white flex items-center gap-2 shadow-[0_0_25px_rgba(236,72,153,0.4)] transition"
            >
              <Sparkles className="w-4 h-4" />
              {isLoading ? 'Charting 5-Track Route...' : 'Chart Musical Journey'}
            </button>
          </div>
        </form>

        {/* Session Journey History */}
        {sessionJourneys.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-200 mb-2">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              Replay Previous Journeys from This Session
            </div>
            <div className="space-y-1.5">
              {sessionJourneys.map((item, idx) => (
                <button
                  key={item.journey.id}
                  type="button"
                  onClick={() => {
                    onReplayJourney(idx);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-violet-950/40 hover:bg-violet-900/50 border border-violet-400/30 flex items-center justify-between gap-2 text-xs transition"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {item.journey.title}
                    </div>
                    <div className="text-[10px] text-slate-300 truncate">
                      {item.journey.originDescription} →{' '}
                      {item.journey.destinationDescription}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 text-[10px] font-semibold shrink-0">
                    Replay ({item.journey.steps.length} stops)
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ActiveJourneyNavigatorProps {
  journey: MusicalJourney;
  planets: SongPlanet[];
  activeStepIndex: number;
  onSelectStep: (stepIndex: number) => void;
  onExitJourney: () => void;
}

export function ActiveJourneyNavigator({
  journey,
  planets,
  activeStepIndex,
  onSelectStep,
  onExitJourney,
}: ActiveJourneyNavigatorProps) {
  const currentStep =
    journey.steps[activeStepIndex] || journey.steps[0];

  return (
    <section
      aria-label={`Active Musical Journey: ${journey.title}`}
      className="w-full max-w-3xl mx-auto rounded-2xl bg-[#07091d]/90 backdrop-blur-2xl border border-cyan-400/30 shadow-[0_0_35px_rgba(6,182,212,0.22)] px-4 py-3 text-white z-20"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-500/25 text-pink-200 border border-pink-400/40 shrink-0">
            Take Me Somewhere
          </span>
          <h3 className="text-sm font-bold text-white truncate">
            {journey.title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={activeStepIndex <= 0}
            onClick={() => onSelectStep(Math.max(0, activeStepIndex - 1))}
            className="px-2 py-1 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-40 text-xs flex items-center gap-1"
            aria-label="Previous journey destination"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev Stop
          </button>
          <button
            type="button"
            disabled={activeStepIndex >= journey.steps.length - 1}
            onClick={() =>
              onSelectStep(
                Math.min(journey.steps.length - 1, activeStepIndex + 1)
              )
            }
            className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/30 disabled:opacity-40 text-cyan-200 text-xs flex items-center gap-1"
            aria-label="Next journey destination"
          >
            Next Stop
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onExitJourney}
            className="ml-1 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            title="Exit journey mode"
            aria-label="Exit journey mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5-Stop Route Stepper */}
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {journey.steps.map((step, idx) => {
          const isCurrent = idx === activeStepIndex;
          const planetExists = planets.some((p) => p.id === step.planetId);
          return (
            <button
              key={step.stepNumber}
              type="button"
              disabled={!planetExists}
              onClick={() => onSelectStep(idx)}
              className={`px-2 py-1.5 rounded-xl border text-left transition ${
                isCurrent
                  ? 'bg-gradient-to-r from-violet-600/50 to-cyan-500/40 border-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.35)]'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300">
                <span>STOP {step.stepNumber}</span>
                <MapPin className="w-2.5 h-2.5" />
              </div>
              <div className="text-[11px] font-semibold text-white truncate">
                {step.track.name}
              </div>
              <div className="text-[9px] text-slate-300 truncate">
                {step.stageTitle}
              </div>
            </button>
          );
        })}
      </div>

      {currentStep && (
        <div className="text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
          <div>
            <strong className="text-cyan-300">
              Destination {currentStep.stepNumber} ({currentStep.stageTitle}):
            </strong>{' '}
            {currentStep.stageDescription}
          </div>
        </div>
      )}
    </section>
  );
}
