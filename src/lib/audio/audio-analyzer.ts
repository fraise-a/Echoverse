import { JamendoTrack } from '@/types/echoverse';

export type ReactivityMode = 'idle' | 'web-audio-fft' | 'playback-state';

export interface AudioReactiveFrame {
  mode: ReactivityMode;
  isPlaying: boolean;
  bass: number; // 0 .. 1
  mid: number; // 0 .. 1
  treble: number; // 0 .. 1
  intensity: number; // 0 .. 1
}

/**
 * Manages Web Audio API frequency analysis when permitted by stream CORS headers,
 * and gracefully falls back to honest, non-intrusive playback-state animation
 * when cross-origin streams disallow CORS inspection (protecting audio playback).
 */
export class EchoverseAudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private connectedElement: HTMLAudioElement | null = null;
  private mode: ReactivityMode = 'idle';
  private isPlaying = false;
  private activeTrack: JamendoTrack | null = null;

  public async evaluateAndConnect(
    audioElement: HTMLAudioElement,
    track: JamendoTrack
  ): Promise<ReactivityMode> {
    this.activeTrack = track;

    // Probe whether the audio stream permits CORS reading before attaching createMediaElementSource.
    // Note: Attaching createMediaElementSource to a non-CORS cross-origin stream silences playback in browsers.
    let corsSupported = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(track.audio, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok && res.type === 'cors') {
        corsSupported = true;
      }
    } catch {
      corsSupported = false;
    }

    if (corsSupported) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!this.audioContext) {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        if (!this.analyser) {
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 128;
          this.analyser.smoothingTimeConstant = 0.8;
          this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        }
        if (this.connectedElement !== audioElement) {
          audioElement.crossOrigin = 'anonymous';
          this.sourceNode =
            this.audioContext.createMediaElementSource(audioElement);
          this.sourceNode.connect(this.analyser);
          this.analyser.connect(this.audioContext.destination);
          this.connectedElement = audioElement;
        }
        this.mode = 'web-audio-fft';
        return this.mode;
      } catch {
        // If Web Audio graph setup fails, fall back cleanly to playback-state mode
        this.mode = 'playback-state';
        return this.mode;
      }
    }

    // Stream is cross-origin without CORS headers; preserve direct playback and use playback-state reactivity
    this.mode = 'playback-state';
    return this.mode;
  }

  public setPlayingState(playing: boolean): void {
    this.isPlaying = playing;
    if (!playing && this.mode === 'idle') {
      return;
    }
  }

  public getMode(): ReactivityMode {
    if (!this.isPlaying) return 'idle';
    return this.mode === 'idle' ? 'playback-state' : this.mode;
  }

  public sampleFrame(elapsedSeconds: number): AudioReactiveFrame {
    if (!this.isPlaying) {
      return {
        mode: 'idle',
        isPlaying: false,
        bass: 0.05,
        mid: 0.05,
        treble: 0.05,
        intensity: 0.05,
      };
    }

    // 1. Real Web Audio API FFT analysis if connected and producing non-zero bins
    if (
      this.mode === 'web-audio-fft' &&
      this.analyser &&
      this.frequencyData
    ) {
      this.analyser.getByteFrequencyData(this.frequencyData as Uint8Array<ArrayBuffer>);
      const len = this.frequencyData.length;
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;

      const bassEnd = Math.floor(len * 0.2);
      const midEnd = Math.floor(len * 0.6);

      for (let i = 0; i < len; i++) {
        const val = this.frequencyData[i] / 255;
        if (i < bassEnd) bassSum += val;
        else if (i < midEnd) midSum += val;
        else trebleSum += val;
      }

      const bass = bassEnd > 0 ? bassSum / bassEnd : 0;
      const mid = midEnd - bassEnd > 0 ? midSum / (midEnd - bassEnd) : 0;
      const treble = len - midEnd > 0 ? trebleSum / (len - midEnd) : 0;
      const intensity = bass * 0.45 + mid * 0.35 + treble * 0.2;

      if (intensity > 0.01) {
        return {
          mode: 'web-audio-fft',
          isPlaying: true,
          bass,
          mid,
          treble,
          intensity,
        };
      }
    }

    // 2. Honest playback-state animation modulated by Jamendo tempo metadata
    const speedTag = this.activeTrack?.musicinfo?.speed || 'medium';
    const bpmFreq =
      speedTag === 'veryhigh'
        ? 2.4
        : speedTag === 'high'
        ? 2.0
        : speedTag === 'low'
        ? 1.15
        : speedTag === 'verylow'
        ? 0.85
        : 1.55;

    const t = elapsedSeconds * Math.PI * bpmFreq;
    const bass = 0.38 + 0.28 * Math.sin(t) + 0.12 * Math.sin(t * 0.5);
    const mid = 0.32 + 0.22 * Math.sin(t * 1.3 + 1.1);
    const treble = 0.26 + 0.18 * Math.cos(t * 2.1 + 0.6);
    const intensity = Math.min(
      1,
      Math.max(0.15, bass * 0.45 + mid * 0.35 + treble * 0.2)
    );

    return {
      mode: 'playback-state',
      isPlaying: true,
      bass,
      mid,
      treble,
      intensity,
    };
  }
}

export const sharedAudioAnalyzer = new EchoverseAudioAnalyzer();
