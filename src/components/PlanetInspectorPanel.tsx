'use client';

import React from 'react';
import {
  Play,
  Pause,
  Sparkles,
  ExternalLink,
  X,
  Compass,
  Clock,
  Tag,
  GitBranch,
  Globe2,
} from 'lucide-react';
import { ConstellationEdge, SongPlanet } from '@/types/echoverse';

interface PlanetInspectorPanelProps {
  planet: SongPlanet | null;
  allPlanets: SongPlanet[];
  constellations: ConstellationEdge[];
  isPlayingThis: boolean;
  onClose: () => void;
  onResetView?: () => void;
  onTogglePlay: () => void;
  onSelectPlanet: (planet: SongPlanet, autoPlay?: boolean) => void;
  onDiscoverSimilar: (planet: SongPlanet) => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function PlanetInspectorPanel({
  planet,
  allPlanets,
  constellations,
  isPlayingThis,
  onClose,
  onResetView,
  onTogglePlay,
  onSelectPlanet,
  onDiscoverSimilar,
}: PlanetInspectorPanelProps) {
  if (!planet) return null;

  const { track } = planet;

  // Find connected constellation neighbors
  const connectedNeighbors = constellations
    .filter(
      (c) => c.fromTrackId === planet.id || c.toTrackId === planet.id
    )
    .map((edge) => {
      const targetId =
        edge.fromTrackId === planet.id ? edge.toTrackId : edge.fromTrackId;
      const neighbor = allPlanets.find((p) => p.id === targetId);
      return neighbor
        ? {
            planet: neighbor,
            sharedAttributes: edge.sharedAttributes,
            isJourneyRoute: edge.isJourneyRoute,
          }
        : null;
    })
    .filter(Boolean) as Array<{
    planet: SongPlanet;
    sharedAttributes: string[];
    isJourneyRoute?: boolean;
  }>;

  return (
    <aside
      aria-label={`Song planet details for ${track.name}`}
      className="w-full sm:w-[360px] max-h-[calc(100vh-195px)] overflow-y-auto rounded-2xl bg-[#050716]/84 backdrop-blur-2xl border border-white/14 shadow-[0_16px_55px_rgba(0,0,0,0.8)] p-4 text-white z-20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border"
            style={{
              backgroundColor: `${planet.primaryColor}20`,
              borderColor: `${planet.primaryColor}55`,
              color: '#e2e8f0',
            }}
          >
            {planet.region}
          </span>
          {planet.archetypeLabel && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/8 text-slate-300 border border-white/12">
              {planet.archetypeLabel}
            </span>
          )}
          {planet.journeyStepIndex && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/25 text-cyan-200 border border-cyan-400/40">
              Step {planet.journeyStepIndex}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onResetView && (
            <button
              type="button"
              onClick={onResetView}
              className="px-2 py-1 rounded-lg text-[10px] font-medium text-cyan-300 hover:text-white bg-white/6 hover:bg-white/12 border border-white/10 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
              title="Return camera to full galaxy overview"
              aria-label="Return camera to full galaxy overview"
            >
              <Globe2 className="w-3 h-3" />
              <span>Overview</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            aria-label="Close song planet details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Artwork & Main Track Info */}
      <div className="flex items-center gap-3.5 mb-4">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/20 shrink-0 shadow-[0_0_25px_rgba(124,58,237,0.4)] bg-violet-950/50">
          {track.image || track.album_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.image || track.album_image}
              alt={`Cover artwork for ${track.name}`}
              className="w-full h-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-white leading-snug break-words">
            {track.name}
          </h2>
          <p className="text-sm text-cyan-300 font-medium truncate mt-0.5">
            {track.artist_name}
          </p>
          {track.album_name && (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              Album: {track.album_name}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-300" />
              {formatDuration(track.duration)}
            </span>
            {track.releasedate && (
              <span className="text-slate-400">{track.releasedate}</span>
            )}
          </div>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={onTogglePlay}
          className="px-3 py-2.5 rounded-xl font-semibold text-xs bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.35)] focus:outline-none focus:ring-2 focus:ring-cyan-300 transition"
        >
          {isPlayingThis ? (
            <>
              <Pause className="w-4 h-4" />
              Pause Track
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Listen Now
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onDiscoverSimilar(planet)}
          className="px-3 py-2.5 rounded-xl font-semibold text-xs bg-white/10 hover:bg-white/15 border border-white/15 text-cyan-200 flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          Similar Planets
        </button>
      </div>

      {/* AI Musical Guide Explanation */}
      <div className="p-3 rounded-xl bg-violet-950/35 border border-violet-400/25 mb-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-300 mb-1">
          <Compass className="w-3.5 h-3.5 text-cyan-300" />
          {planet.journeyStageTitle || 'Why This Planet Resonates'}
        </div>
        <p className="text-xs text-slate-200 leading-relaxed">
          {planet.aiReason}
        </p>
      </div>

      {/* Real Jamendo Musical Metadata & Tags */}
      {planet.allTags.length > 0 && (
        <div className="mb-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            <Tag className="w-3 h-3 text-cyan-400" />
            Jamendo Catalogue Metadata
          </div>
          <div className="flex flex-wrap gap-1.5">
            {planet.allTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-[11px] bg-white/8 border border-white/10 text-purple-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Connected Constellation Planets */}
      {connectedNeighbors.length > 0 && (
        <div className="mb-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            <GitBranch className="w-3 h-3 text-pink-400" />
            Connected Constellation Tracks
          </div>
          <div className="space-y-1.5">
            {connectedNeighbors.map(
              ({ planet: neighbor, sharedAttributes, isJourneyRoute }) => (
                <button
                  key={neighbor.id}
                  type="button"
                  onClick={() => onSelectPlanet(neighbor, false)}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between gap-2 transition focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {neighbor.track.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {neighbor.track.artist_name} • Shared:{' '}
                      {sharedAttributes.join(', ')}
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 shrink-0">
                    {isJourneyRoute ? 'Route' : 'Orbit'}
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Attribution & Licensing Footer */}
      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
        <a
          href={track.shareurl || `https://www.jamendo.com/track/${track.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 underline underline-offset-2"
        >
          View on Jamendo <ExternalLink className="w-3 h-3" />
        </a>
        {track.license_ccurl && (
          <a
            href={track.license_ccurl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white inline-flex items-center gap-1 underline underline-offset-2"
          >
            Creative Commons License <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </aside>
  );
}
