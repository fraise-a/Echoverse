'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Disc3,
  Radio,
} from 'lucide-react';
import { SongPlanet } from '@/types/echoverse';
import {
  ReactivityMode,
  sharedAudioAnalyzer,
} from '@/lib/audio/audio-analyzer';

interface MusicPlayerProps {
  activePlanet: SongPlanet | null;
  planets: SongPlanet[];
  isPlaying: boolean;
  hasUserInteracted: boolean;
  onPlayPause: (shouldPlay: boolean) => void;
  onSelectPlanet: (planet: SongPlanet, autoPlay?: boolean) => void;
  onDiscoverSimilar: (planet: SongPlanet) => void;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function MusicPlayer({
  activePlanet,
  planets,
  isPlaying,
  hasUserInteracted,
  onPlayPause,
  onSelectPlanet,
  onDiscoverSimilar,
}: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [reactivityMode, setReactivityMode] =
    useState<ReactivityMode>('idle');
  const [isBuffering, setIsBuffering] = useState(false);

  const track = activePlanet?.track || null;

  // Handle track change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    setPlaybackError(null);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    if (audio.src !== track.audio) {
      audio.pause();
      audio.src = track.audio;
      audio.load();
    }

    sharedAudioAnalyzer.evaluateAndConnect(audio, track).then((mode) => {
      setReactivityMode(mode);
    });

    if (isPlaying && hasUserInteracted) {
      setIsBuffering(true);
      audio
        .play()
        .then(() => {
          setIsBuffering(false);
          sharedAudioAnalyzer.setPlayingState(true);
        })
        .catch((err: unknown) => {
          setIsBuffering(false);
          sharedAudioAnalyzer.setPlayingState(false);
          onPlayPause(false);
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.toLowerCase().includes('notallowed') || msg.toLowerCase().includes('gesture')) {
            setPlaybackError(
              'Browser blocked automatic playback. Press Play to start streaming this track.'
            );
          } else {
            setPlaybackError(
              'Unable to start streaming this track. Try pressing Play or skipping to the next planet.'
            );
          }
        });
    } else {
      sharedAudioAnalyzer.setPlayingState(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  // Handle play/pause state toggles
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    if (isPlaying) {
      if (!hasUserInteracted) {
        onPlayPause(false);
        setPlaybackError(
          'Press Play to begin streaming music (browser requires user interaction).'
        );
        return;
      }
      setPlaybackError(null);
      if (audio.paused) {
        setIsBuffering(true);
        audio
          .play()
          .then(() => {
            setIsBuffering(false);
            sharedAudioAnalyzer.setPlayingState(true);
          })
          .catch(() => {
            setIsBuffering(false);
            sharedAudioAnalyzer.setPlayingState(false);
            onPlayPause(false);
            setPlaybackError(
              'Browser blocked playback or the Jamendo stream is temporarily unavailable. Click Play to retry.'
            );
          });
      } else {
        sharedAudioAnalyzer.setPlayingState(true);
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
      setIsBuffering(false);
      sharedAudioAnalyzer.setPlayingState(false);
    }
  }, [isPlaying, hasUserInteracted, track, onPlayPause]);

  // Clean up audio element on unmount
  useEffect(() => {
    const audioEl = audioRef.current;
    return () => {
      if (audioEl) {
        audioEl.pause();
      }
      sharedAudioAnalyzer.setPlayingState(false);
    };
  }, []);

  // Sync volume & mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  const handlePrev = () => {
    if (!activePlanet || planets.length === 0) return;
    const idx = planets.findIndex((p) => p.id === activePlanet.id);
    const prevIdx = idx <= 0 ? planets.length - 1 : idx - 1;
    onSelectPlanet(planets[prevIdx], true);
  };

  const handleNext = () => {
    if (!activePlanet || planets.length === 0) return;
    const idx = planets.findIndex((p) => p.id === activePlanet.id);
    const nextIdx = idx >= planets.length - 1 ? 0 : idx + 1;
    onSelectPlanet(planets[nextIdx], true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  if (!activePlanet || !track) {
    return (
      <footer
        className="w-full px-4 py-3 bg-[#060713]/85 backdrop-blur-xl border-t border-white/10 text-slate-300 flex items-center justify-between text-xs z-30"
        aria-label="Music Player"
      >
        <div className="flex items-center gap-2.5">
          <Disc3 className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>
            Select any glowing song planet in the universe to inspect metadata and start streaming real independent music from Jamendo.
          </span>
        </div>
        <a
          href="https://www.jamendo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2 flex items-center gap-1 shrink-0"
        >
          Music powered by Jamendo <ExternalLink className="w-3 h-3" />
        </a>
      </footer>
    );
  }

  const effectiveDuration = duration > 0 ? duration : track.duration || 180;
  const licenseShort = track.license_ccurl
    ? track.license_ccurl
        .replace(/^https?:\/\/creativecommons\.org\/licenses\//i, 'CC ')
        .replace(/\/$/, '')
        .toUpperCase()
    : 'CC License';

  return (
    <footer
      className="w-full px-4 py-3 bg-[#050614]/90 backdrop-blur-2xl border-t border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.75)] z-30 transition-all"
      aria-label="Echoverse Persistent Music Player"
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={handleNext}
        onError={() => {
          setIsBuffering(false);
          sharedAudioAnalyzer.setPlayingState(false);
          onPlayPause(false);
          setPlaybackError(
            `Stream error for "${track.name}". You can retry playback or skip to the next song planet.`
          );
        }}
      />

      {playbackError && (
        <div
          role="alert"
          className="mb-2 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{playbackError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPlaybackError(null)}
            className="text-[11px] text-rose-300 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 items-center gap-3">
        {/* Track Artwork & Attribution */}
        <div className="md:col-span-4 flex items-center gap-3 min-w-0">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-purple-950/50 shadow-[0_0_20px_rgba(124,58,237,0.35)]">
            {track.image || track.album_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.image || track.album_image}
                alt={`Artwork for ${track.name} by ${track.artist_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-cyan-300">
                <Disc3 className="w-6 h-6" />
              </div>
            )}
            {isPlaying && (
              <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white truncate">
                {track.name}
              </h3>
              {activePlanet.journeyStepIndex && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shrink-0">
                  Step {activePlanet.journeyStepIndex}
                </span>
              )}
            </div>
            <p className="text-xs text-purple-200/80 truncate">
              {track.artist_name}{' '}
              {track.album_name ? `• ${track.album_name}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-400">
              <a
                href={
                  track.shareurl ||
                  `https://www.jamendo.com/track/${track.id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 underline underline-offset-2"
                aria-label={`Open ${track.name} by ${track.artist_name} on Jamendo`}
              >
                Jamendo Track <ExternalLink className="w-2.5 h-2.5" />
              </a>
              {track.license_ccurl && (
                <a
                  href={track.license_ccurl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-200 underline underline-offset-2"
                >
                  {licenseShort}
                </a>
              )}
              <span className="inline-flex items-center gap-1 text-purple-300/90">
                <Radio className="w-2.5 h-2.5" />
                {isPlaying
                  ? reactivityMode === 'web-audio-fft'
                    ? 'Web Audio FFT Reactive'
                    : 'Playback-State Reactive (Cross-Origin Protected)'
                  : 'Ready to Stream'}
              </span>
            </div>
          </div>
        </div>

        {/* Transport Controls & Seek Bar */}
        <div className="md:col-span-5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrev}
              className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
              aria-label="Previous song planet"
              title="Previous song planet"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onPlayPause(!isPlaying)}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.45)] focus:outline-none focus:ring-2 focus:ring-cyan-300 transition"
              aria-label={isPlaying ? `Pause ${track.name}` : `Play ${track.name}`}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
              aria-label="Next song planet"
              title="Next song planet"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onDiscoverSimilar(activePlanet)}
              className="ml-2 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-500/20 hover:bg-violet-500/35 text-violet-200 border border-violet-400/30 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
              title="Transform universe around songs with similar characteristics"
            >
              <Sparkles className="w-3 h-3 text-cyan-300" />
              Discover Similar
            </button>
          </div>

          <div className="w-full flex items-center gap-2.5 text-[11px] text-slate-300">
            <span className="w-9 text-right tabular-nums">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.5}
              value={Math.min(currentTime, effectiveDuration)}
              onChange={handleSeek}
              aria-label="Seek track playback position"
              className="flex-1 h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="w-9 tabular-nums">
              {isBuffering ? '...' : formatDuration(effectiveDuration)}
            </span>
          </div>
        </div>

        {/* Volume & Region Info */}
        <div className="md:col-span-3 flex items-center justify-end gap-3">
          <span className="hidden lg:inline-block px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-white/5 border border-white/10 text-cyan-200">
            {activePlanet.region}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-300" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                setVolume(Number(e.target.value));
              }}
              aria-label="Audio volume"
              className="w-20 h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-violet-400"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
