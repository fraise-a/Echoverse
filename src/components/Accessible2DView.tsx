'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  ExternalLink,
  Clock,
  Disc3,
  Tag,
} from 'lucide-react';
import {
  ConstellationEdge,
  SongPlanet,
  UniverseAtmosphere,
} from '@/types/echoverse';

interface Accessible2DViewProps {
  planets: SongPlanet[];
  constellations: ConstellationEdge[];
  atmosphere: UniverseAtmosphere;
  selectedPlanet: SongPlanet | null;
  playingTrackId: string | null;
  isPlaying: boolean;
  onSelectPlanet: (planet: SongPlanet, autoPlay?: boolean) => void;
  onTogglePlay: (planet: SongPlanet) => void;
  onDiscoverSimilar: (planet: SongPlanet) => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function Accessible2DView({
  planets,
  constellations,
  atmosphere,
  selectedPlanet,
  playingTrackId,
  isPlaying,
  onSelectPlanet,
  onTogglePlay,
  onDiscoverSimilar,
}: Accessible2DViewProps) {
  const [regionFilter, setRegionFilter] = useState<string>('ALL');

  const regions = Array.from(new Set(planets.map((p) => p.region)));
  const filteredPlanets =
    regionFilter === 'ALL'
      ? planets
      : planets.filter((p) => p.region === regionFilter);

  return (
    <section
      aria-label="Accessible 2D Musical Galaxy View"
      className="w-full h-full overflow-y-auto px-4 sm:px-8 pt-28 pb-36 bg-gradient-to-b from-[#040511] via-[#090d24] to-[#040510] text-white"
    >
      <div className="max-w-7xl mx-auto">
        {/* Accessible Atmosphere Header */}
        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              Accessible 2D Constellation Grid • {planets.length} Real Jamendo Tracks
            </div>
            <h2 className="text-xl font-bold text-white mt-0.5">
              {atmosphere.name}
            </h2>
            <p className="text-sm text-slate-300 mt-0.5">
              {atmosphere.description}
            </p>
          </div>

          {/* Region Filter Tabs */}
          <div
            role="tablist"
            aria-label="Filter song planets by musical region"
            className="flex flex-wrap gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={regionFilter === 'ALL'}
              onClick={() => setRegionFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                regionFilter === 'ALL'
                  ? 'bg-cyan-500/25 border-cyan-400 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              All Regions ({planets.length})
            </button>
            {regions.map((reg) => (
              <button
                key={reg}
                type="button"
                role="tab"
                aria-selected={regionFilter === reg}
                onClick={() => setRegionFilter(reg)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                  regionFilter === reg
                    ? 'bg-violet-500/30 border-violet-400 text-white'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {reg}
              </button>
            ))}
          </div>
        </div>

        {/* 2D Cards Grid */}
        <div
          role="list"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredPlanets.map((planet) => {
            const { track } = planet;
            const isSelected = selectedPlanet?.id === planet.id;
            const isPlayingThis =
              playingTrackId === track.id && isPlaying;

            const connectedCount = constellations.filter(
              (c) =>
                c.fromTrackId === planet.id || c.toTrackId === planet.id
            ).length;

            return (
              <article
                key={planet.id}
                role="listitem"
                className={`rounded-2xl p-4 border transition flex flex-col justify-between ${
                  isSelected || isPlayingThis
                    ? 'bg-violet-950/50 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.2)]'
                    : 'bg-[#080b1f]/90 border-white/15 hover:border-white/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-cyan-200 border border-white/15">
                      {planet.region}
                    </span>
                    {planet.journeyStepIndex && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/25 text-pink-200 border border-pink-400/40">
                        Journey Step {planet.journeyStepIndex}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3.5 mb-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-violet-950/60 flex items-center justify-center">
                      {track.image || track.album_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={track.image || track.album_image}
                          alt={`Album cover for ${track.name} by ${track.artist_name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Disc3 className="w-7 h-7 text-cyan-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-white truncate">
                        {track.name}
                      </h3>
                      <p className="text-sm text-cyan-300 font-medium truncate">
                        {track.artist_name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-300 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-purple-300" />
                          {formatDuration(track.duration)}
                        </span>
                        <span>{connectedCount} Constellation Links</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed mb-3 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    {planet.aiReason}
                  </p>

                  {planet.allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {planet.allTags.slice(0, 6).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-white/8 text-purple-200 border border-white/10"
                        >
                          <Tag className="w-2.5 h-2.5 text-cyan-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onTogglePlay(planet)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                      aria-label={
                        isPlayingThis
                          ? `Pause ${track.name} by ${track.artist_name}`
                          : `Play ${track.name} by ${track.artist_name}`
                      }
                    >
                      {isPlayingThis ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Play
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDiscoverSimilar(planet)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-cyan-200 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Similar
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectPlanet(planet, false)}
                      className="px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      Inspect
                    </button>
                  </div>

                  <a
                    href={
                      track.shareurl ||
                      `https://www.jamendo.com/track/${track.id}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-300 hover:text-cyan-200 underline inline-flex items-center gap-1"
                  >
                    Jamendo <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
