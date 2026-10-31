'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  Sparkles,
  Mic,
  Square,
  ShieldCheck,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';

interface ShowMeYourWorldModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmitVisionDiscovery: (payload: {
    imageBase64: string;
    imageMimeType: string;
    prompt?: string;
    audioBase64?: string;
    audioMimeType?: string;
    previewDataUrl: string;
  }) => void;
}

/**
 * Generates a rich, genuine PNG image on an HTML5 canvas for quick demonstration
 * (e.g. Rainy City Street at Night, Sunset Beach, Snowy Mountain) so Gemini Vision
 * inspects real pixel data even on devices without a camera or local test photo.
 */
function renderDemoSceneDataUrl(
  scene: 'rainy-tokyo' | 'sunset-beach' | 'snowy-peaks'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (scene === 'rainy-tokyo') {
    // Deep midnight sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 260);
    sky.addColorStop(0, '#040515');
    sky.addColorStop(0.6, '#101438');
    sky.addColorStop(1, '#261447');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 640, 400);

    // City skyscrapers & glowing neon signs
    const buildings = [
      { x: 20, w: 75, h: 220, c: '#0a0d24', neon: '#06b6d4' },
      { x: 105, w: 90, h: 250, c: '#080b1f', neon: '#ec4899' },
      { x: 210, w: 70, h: 190, c: '#0c102b', neon: '#8b5cf6' },
      { x: 360, w: 85, h: 240, c: '#090c22', neon: '#22d3ee' },
      { x: 455, w: 95, h: 260, c: '#070a1c', neon: '#f43f5e' },
      { x: 560, w: 65, h: 210, c: '#0b0e26', neon: '#a855f7' },
    ];
    for (const b of buildings) {
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, 270 - b.h, b.w, b.h);
      // Glowing vertical neon billboard
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 18;
      ctx.fillStyle = b.neon;
      ctx.fillRect(b.x + 12, 270 - b.h + 30, 14, 65);
      ctx.shadowBlur = 0;
      // Lit windows
      ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
      for (let wy = 270 - b.h + 20; wy < 255; wy += 18) {
        for (let wx = b.x + 34; wx < b.x + b.w - 10; wx += 14) {
          if ((wx + wy) % 3 !== 0) ctx.fillRect(wx, wy, 6, 9);
        }
      }
    }

    // Wet rain-slicked street pavement with neon reflections
    const street = ctx.createLinearGradient(0, 270, 0, 400);
    street.addColorStop(0, '#090919');
    street.addColorStop(1, '#04040c');
    ctx.fillStyle = street;
    ctx.fillRect(0, 270, 640, 130);

    // Neon puddles on wet asphalt
    const puddles = [
      { x: 140, y: 315, w: 120, h: 14, c: 'rgba(236, 72, 153, 0.45)' },
      { x: 310, y: 340, w: 150, h: 18, c: 'rgba(34, 211, 238, 0.45)' },
      { x: 460, y: 305, w: 110, h: 12, c: 'rgba(168, 85, 247, 0.45)' },
    ];
    for (const p of puddles) {
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Diagonal rain streaks
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.32)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 160; i++) {
      const rx = (i * 37) % 640;
      const ry = (i * 53) % 380;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8, ry + 22);
      ctx.stroke();
    }
  } else if (scene === 'sunset-beach') {
    const sky = ctx.createLinearGradient(0, 0, 0, 240);
    sky.addColorStop(0, '#1e1b4b');
    sky.addColorStop(0.45, '#be185d');
    sky.addColorStop(0.8, '#f97316');
    sky.addColorStop(1, '#fde047');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 640, 240);

    // Setting sun
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(320, 215, 48, 0, Math.PI * 2);
    ctx.fill();

    // Ocean waves
    const sea = ctx.createLinearGradient(0, 240, 0, 400);
    sea.addColorStop(0, '#7c2d12');
    sea.addColorStop(0.4, '#311042');
    sea.addColorStop(1, '#090d26');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 240, 640, 160);

    // Sun shimmer on water
    ctx.fillStyle = 'rgba(253, 224, 71, 0.55)';
    for (let y = 248; y < 380; y += 10) {
      const w = 90 - (y - 240) * 0.4;
      ctx.fillRect(320 - w / 2, y, w, 4);
    }
  } else {
    // Snowy alpine peaks under aurora sky
    const sky = ctx.createLinearGradient(0, 0, 0, 280);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(0.5, '#0f172a');
    sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 640, 400);

    // Aurora ribbon
    const aurora = ctx.createLinearGradient(80, 40, 560, 140);
    aurora.addColorStop(0, 'rgba(34, 211, 238, 0.35)');
    aurora.addColorStop(0.5, 'rgba(168, 85, 247, 0.35)');
    aurora.addColorStop(1, 'rgba(16, 185, 129, 0.35)');
    ctx.fillStyle = aurora;
    ctx.fillRect(0, 30, 640, 95);

    // Snow-capped mountain triangles
    const drawPeak = (x1: number, x2: number, peakY: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1, 320);
      ctx.lineTo((x1 + x2) / 2, peakY);
      ctx.lineTo(x2, 320);
      ctx.closePath();
      ctx.fill();
    };
    drawPeak(20, 320, 115, '#cbd5e1');
    drawPeak(210, 520, 85, '#f1f5f9');
    drawPeak(380, 630, 130, '#94a3b8');

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 320, 640, 80);
  }

  return canvas.toDataURL('image/png');
}

export default function ShowMeYourWorldModal({
  isOpen,
  isLoading,
  onClose,
  onSubmitVisionDiscovery,
}: ShowMeYourWorldModalProps) {
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMimeType, setImageMimeType] = useState<string>('image/png');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [promptText, setPromptText] = useState<string>(
    'Make this feel like a mysterious night in Tokyo.'
  );
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Optional spoken prompt inside the vision modal
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | undefined>(undefined);
  const [audioMimeType, setAudioMimeType] = useState<string | undefined>(
    undefined
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const stopVoiceStream = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors if already stopping
      }
    }
    if (voiceStreamRef.current) {
      for (const track of voiceStreamRef.current.getTracks()) {
        track.stop();
      }
      voiceStreamRef.current = null;
    }
    setIsRecordingVoice(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopVoiceStream();
    }
    return () => {
      stopCamera();
      stopVoiceStream();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPEG, or WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Image file must be under 8 MB.');
      return;
    }

    stopCamera();
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      if (commaIdx > 0) {
        setPreviewUrl(result);
        setImageBase64(result.slice(commaIdx + 1));
        setImageMimeType(file.type || 'image/jpeg');
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleStartCamera = async () => {
    setCameraError(null);
    setUploadError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Camera capture is not supported in this browser. You can upload an image or select a scene preset below.'
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 400 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setCameraError(
        'Camera permission was denied or no camera was found. You can still upload any image file or select a preset scene below.'
      );
    }
  };

  const handleCaptureCameraFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx > 0) {
      setPreviewUrl(dataUrl);
      setImageBase64(dataUrl.slice(commaIdx + 1));
      setImageMimeType('image/jpeg');
    }
    stopCamera();
  };

  const handleSelectScenePreset = (
    scene: 'rainy-tokyo' | 'sunset-beach' | 'snowy-peaks',
    defaultPrompt: string
  ) => {
    stopCamera();
    setUploadError(null);
    const dataUrl = renderDemoSceneDataUrl(scene);
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx > 0) {
      setPreviewUrl(dataUrl);
      setImageBase64(dataUrl.slice(commaIdx + 1));
      setImageMimeType('image/png');
      setPromptText(defaultPrompt);
    }
  };

  const toggleVoiceRecording = async () => {
    if (isRecordingVoice && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      return;
    }

    try {
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

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        for (const t of stream.getTracks()) t.stop();
        voiceStreamRef.current = null;
        const blob = new Blob(chunks, { type: effectiveMime });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const comma = dataUrl.indexOf(',');
          if (comma > 0) {
            setAudioBase64(dataUrl.slice(comma + 1));
            setAudioMimeType(effectiveMime);
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
    } catch {
      setUploadError(
        'Microphone permission denied. Please type your accompaniment request below.'
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageBase64) {
      setUploadError(
        'Please upload an image, capture a camera frame, or choose a visual scene first.'
      );
      return;
    }
    onSubmitVisionDiscovery({
      imageBase64,
      imageMimeType,
      prompt: promptText.trim() || undefined,
      audioBase64,
      audioMimeType,
      previewDataUrl: previewUrl,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="show-world-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#07091c]/95 border border-white/15 shadow-[0_0_60px_rgba(124,58,237,0.35)] p-5 text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              Multimodal Vision Discovery
            </span>
            <h2 id="show-world-title" className="text-xl font-bold text-white">
              Show Me Your World
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Upload a photograph, capture a frame from your camera, or pick a visual scene. Gemini analyses observable lighting, colours, setting, and atmosphere to transform your musical galaxy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Close Show Me Your World modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(cameraError || uploadError) && (
          <div
            role="alert"
            className="mb-3 p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{cameraError || uploadError}</span>
          </div>
        )}

        {/* Image Source Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
          <label className="cursor-pointer px-4 py-3 rounded-xl bg-white/8 hover:bg-white/12 border border-white/15 flex items-center justify-center gap-2 text-xs font-semibold text-cyan-200 transition">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Upload Photograph</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>

          {!cameraActive ? (
            <button
              type="button"
              onClick={handleStartCamera}
              className="px-4 py-3 rounded-xl bg-white/8 hover:bg-white/12 border border-white/15 flex items-center justify-center gap-2 text-xs font-semibold text-violet-200 transition"
            >
              <Camera className="w-4 h-4 text-violet-400" />
              <span>Use Device Camera (Optional)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCaptureCameraFrame}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 flex items-center justify-center gap-2 text-xs font-bold text-white shadow-lg transition"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Frame Now</span>
            </button>
          )}
        </div>

        {/* Instant Demo Scene Presets (for devices without camera or ready test files) */}
        <div className="mb-3">
          <div className="text-[11px] font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
            Or test immediately with a generated photographic scene:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                handleSelectScenePreset(
                  'rainy-tokyo',
                  'Make this feel like a mysterious night in Tokyo.'
                )
              }
              className="px-3 py-2 rounded-lg bg-violet-950/40 hover:bg-violet-900/50 border border-violet-400/30 text-left transition"
            >
              <div className="text-xs font-semibold text-cyan-200">
                Rainy City Street
              </div>
              <div className="text-[10px] text-slate-400">
                Neon reflections at midnight
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                handleSelectScenePreset(
                  'sunset-beach',
                  'Warm, dreamy golden-hour horizon by the ocean.'
                )
              }
              className="px-3 py-2 rounded-lg bg-violet-950/40 hover:bg-violet-900/50 border border-violet-400/30 text-left transition"
            >
              <div className="text-xs font-semibold text-pink-200">
                Sunset Beach Horizon
              </div>
              <div className="text-[10px] text-slate-400">
                Warm twilight ocean glow
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                handleSelectScenePreset(
                  'snowy-peaks',
                  'Crystalline ambient solitude under northern lights.'
                )
              }
              className="px-3 py-2 rounded-lg bg-violet-950/40 hover:bg-violet-900/50 border border-violet-400/30 text-left transition"
            >
              <div className="text-xs font-semibold text-purple-200">
                Snowy Alpine Peaks
              </div>
              <div className="text-[10px] text-slate-400">
                Starlit aurora mountains
              </div>
            </button>
          </div>
        </div>

        {/* Live Camera View or Image Preview */}
        {cameraActive && (
          <div className="mb-3 rounded-xl overflow-hidden border border-cyan-400/40 bg-black relative">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-56 object-cover"
            />
            <div className="absolute bottom-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={handleCaptureCameraFrame}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 text-black font-bold text-xs"
              >
                Snap Frame
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs border border-white/20"
              >
                Cancel Camera
              </button>
            </div>
          </div>
        )}

        {previewUrl && !cameraActive && (
          <div className="mb-3 rounded-xl overflow-hidden border border-white/20 bg-black/50 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected visual scene for Gemini multimodal analysis"
              className="w-full h-52 object-cover"
            />
            <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-black/75 text-cyan-300 border border-cyan-400/30">
              Ready for Gemini Vision Analysis
            </span>
          </div>
        )}

        {/* Optional Written or Spoken Accompaniment Request */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="vision-prompt-input"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Combine with a written or spoken direction (optional):
            </label>
            <div className="flex gap-2">
              <input
                id="vision-prompt-input"
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="e.g., Make this feel like a mysterious night in Tokyo..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/8 border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
              <button
                type="button"
                onClick={toggleVoiceRecording}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                  isRecordingVoice
                    ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                    : audioBase64
                    ? 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                    : 'bg-white/8 border-white/15 text-slate-200 hover:bg-white/12'
                }`}
                title="Optionally record a spoken request alongside your image"
              >
                {isRecordingVoice ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-cyan-300" />
                    {audioBase64 ? 'Voice Attached' : 'Speak'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Privacy & Responsible AI Notice */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2 text-[11px] text-slate-300">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>Privacy & Responsible Vision:</strong> Images are never stored on disk or databases. Your selected frame is transmitted securely to the server-side Gemini multimodal API solely to interpret observable scenery, lighting, colours, and atmosphere—never personal identity or facial emotions.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !imageBase64}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-50 text-white flex items-center gap-2 shadow-[0_0_25px_rgba(34,211,238,0.4)] transition"
            >
              <Sparkles className="w-4 h-4" />
              {isLoading
                ? 'Transforming Universe...'
                : 'Transform into Musical Experience'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
