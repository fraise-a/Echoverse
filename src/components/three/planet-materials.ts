'use client';

import * as THREE from 'three';
import { PlanetArchetype } from '@/types/echoverse';

export interface ProceduralPlanetTextureSet {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const planetTextureCache = new Map<string, ProceduralPlanetTextureSet>();
const ringTextureCache = new Map<string, THREE.CanvasTexture>();
const nebulaTextureCache = new Map<string, THREE.CanvasTexture>();
let cachedStarSpriteTexture: THREE.CanvasTexture | null = null;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [100, 160, 240];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
  ];
}

/**
 * Fast, deterministic 2D periodic value noise + FBM for seamless equirectangular planet maps.
 */
function hash2D(ix: number, iy: number, seed: number): number {
  let n = ix * 374761393 + iy * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function periodicNoise2D(
  u: number,
  v: number,
  freqX: number,
  freqY: number,
  seed: number
): number {
  const x = u * freqX;
  const y = v * freqY;
  const ix0 = Math.floor(x);
  const iy0 = Math.floor(y);
  const fx = x - ix0;
  const fy = y - iy0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const px0 = ((ix0 % freqX) + freqX) % freqX;
  const px1 = (px0 + 1) % freqX;
  const py0 = Math.max(0, Math.min(freqY, iy0));
  const py1 = Math.max(0, Math.min(freqY, iy0 + 1));

  const n00 = hash2D(px0, py0, seed);
  const n10 = hash2D(px1, py0, seed);
  const n01 = hash2D(px0, py1, seed);
  const n11 = hash2D(px1, py1, seed);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbmPeriodic(u: number, v: number, seed: number): number {
  let value = 0;
  let amp = 0.52;
  let fx = 6;
  let fy = 3;
  for (let o = 0; o < 4; o++) {
    value += periodicNoise2D(u, v, fx, fy, seed + o * 31) * amp;
    fx *= 2;
    fy *= 2;
    amp *= 0.5;
  }
  return value;
}

/**
 * Generates or retrieves cached procedural colour, bump, and roughness textures
 * tailored to each of the 4 planetary archetypes.
 */
export function getProceduralPlanetTextures(
  archetype: PlanetArchetype,
  variant: number,
  primaryColor: string,
  secondaryColor: string,
  surfaceColor = '#38bdf8'
): ProceduralPlanetTextureSet {
  const key = `${archetype}:${variant}:${primaryColor}:${secondaryColor}:${surfaceColor}`;
  const existing = planetTextureCache.get(key);
  if (existing) return existing;

  const width = 256;
  const height = 128;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const colorCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d')!;

  const colorData = colorCtx.createImageData(width, height);
  const bumpData = bumpCtx.createImageData(width, height);
  const roughData = roughCtx.createImageData(width, height);

  const cPrimary = hexToRgb(primaryColor);
  const cSecondary = hexToRgb(secondaryColor);
  const cSurface = hexToRgb(surfaceColor);
  const cDark: [number, number, number] = [
    Math.round(cSecondary[0] * 0.28),
    Math.round(cSecondary[1] * 0.28),
    Math.round(cSecondary[2] * 0.34),
  ];
  const cHighlight: [number, number, number] = mixRgb(
    cPrimary,
    [248, 250, 252],
    0.58
  );

  const seed = (variant + 1) * 97 + cPrimary[0] * 7 + cSecondary[1] * 13;

  // Pre-generate Voronoi feature points for crystalline worlds
  const voronoiPoints: Array<{ u: number; v: number; shade: number }> = [];
  if (archetype === 'crystalline') {
    const count = 28;
    for (let i = 0; i < count; i++) {
      voronoiPoints.push({
        u: hash2D(i, 1, seed),
        v: hash2D(i, 2, seed),
        shade: hash2D(i, 3, seed),
      });
    }
  }

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1); // 0 (north pole) .. 1 (south pole)
    const lat = (v - 0.5) * Math.PI;
    const polarFactor = Math.abs(v - 0.5) * 2; // 0 at equator, 1 at poles

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = (y * width + x) * 4;

      let rgb: [number, number, number] = cPrimary;
      let bumpVal = 128;
      let roughVal = 150;

      if (archetype === 'gas-giant') {
        // Multi-band zonal jet streams + Kelvin-Helmholtz eddies + storm oval
        const turb = fbmPeriodic(u, v, seed) - 0.5;
        const shearU = u + Math.sin(v * Math.PI * 7) * 0.08 + turb * 0.14;
        const eddy =
          Math.sin(shearU * Math.PI * 6 + v * 18) * 0.035 + turb * 0.09;
        const latBand = v + eddy;

        const bandWave1 = Math.sin(latBand * Math.PI * (9 + variant * 2));
        const bandWave2 = Math.cos(latBand * Math.PI * (17 + variant * 3));
        const bandMix = (bandWave1 * 0.62 + bandWave2 * 0.38 + 1) * 0.5;

        // Great storm vortex near southern temperate belt
        const stormU = 0.38 + (variant % 3) * 0.2;
        const stormV = 0.64;
        const du = Math.min(
          Math.abs(u - stormU),
          1 - Math.abs(u - stormU)
        );
        const dv = (v - stormV) * 1.8;
        const stormDist = Math.sqrt(du * du + dv * dv);
        const stormSwirl = Math.max(0, 1 - stormDist / 0.14);

        if (bandMix > 0.68) {
          rgb = mixRgb(cPrimary, cHighlight, (bandMix - 0.68) / 0.32);
        } else if (bandMix > 0.34) {
          rgb = mixRgb(cSecondary, cPrimary, (bandMix - 0.34) / 0.34);
        } else {
          rgb = mixRgb(cDark, cSecondary, bandMix / 0.34);
        }

        if (stormSwirl > 0) {
          const vortexRing = Math.sin(stormSwirl * Math.PI * 3) * 0.5 + 0.5;
          rgb = mixRgb(rgb, cHighlight, stormSwirl * 0.65 * vortexRing);
        }

        // Subtle polar darkening
        rgb = mixRgb(rgb, cDark, Math.pow(polarFactor, 2.4) * 0.45);
        bumpVal = Math.round(128 + (bandMix - 0.5) * 65 + stormSwirl * 40);
        roughVal = Math.round(135 - bandMix * 35);
      } else if (archetype === 'terrestrial') {
        // Fractal continents, deep specular oceans, mountain ridges, cloud swirls & polar ice caps
        const n1 = fbmPeriodic(u, v, seed);
        const n2 = fbmPeriodic(u + 0.37, v + 0.19, seed + 101);
        const rawElev = n1 * 0.68 + n2 * 0.32;
        // Contrast-stretch FBM output across full [0, 1] elevation range
        const elevation = Math.max(0, Math.min(1, (rawElev - 0.34) * 3.1));
        const seaLevel = 0.46;

        // Atmospheric cloud wisps
        const cloudNoise = fbmPeriodic(
          u + Math.sin(v * Math.PI * 3) * 0.12,
          v,
          seed + 303
        );
        const cloudMask = Math.max(0, (cloudNoise - 0.54) * 3.4);

        // Polar ice cap threshold
        const iceThreshold = 0.82 - (n2 - 0.35) * 0.25;
        if (polarFactor > iceThreshold) {
          rgb = mixRgb([241, 245, 249], cHighlight, 0.35);
          bumpVal = 165;
          roughVal = 85;
        } else if (elevation < seaLevel) {
          // Ocean basin with bright turquoise coastal shelves & deep abyssal trenches
          const depth = (seaLevel - elevation) / seaLevel;
          const shallowCoast = Math.pow(1 - Math.min(1, depth * 2.2), 1.8);
          const deepOcean = mixRgb(cDark, cPrimary, 0.28);
          rgb = mixRgb(deepOcean, cHighlight, shallowCoast * 0.68);
          bumpVal = Math.round(105 - depth * 30);
          // Oceans have low roughness so directional sunlight creates a realistic specular glint
          roughVal = 44;
        } else {
          // Continental landmass with distinct biome bands and highland ridges
          const landHeight = Math.min(1, (elevation - seaLevel) / (1 - seaLevel));
          const ridge = Math.max(0, 1 - Math.abs(n2 - 0.5) * 4.5);
          const highland = ridge * landHeight;

          const coastalBiome = mixRgb(cPrimary, cSecondary, 0.65);
          rgb = mixRgb(coastalBiome, cSurface, Math.pow(landHeight, 0.8));
          if (highland > 0.25) {
            rgb = mixRgb(rgb, [248, 250, 252], Math.min(1, (highland - 0.25) * 1.3));
          }
          bumpVal = Math.round(140 + landHeight * 95 + highland * 40);
          roughVal = Math.round(190 + landHeight * 45);
        }

        if (cloudMask > 0.08 && polarFactor <= iceThreshold) {
          rgb = mixRgb(rgb, [248, 250, 252], Math.min(0.72, cloudMask * 0.65));
          bumpVal = Math.min(255, bumpVal + Math.round(cloudMask * 25));
        }
      } else if (archetype === 'crystalline') {
        // Voronoi faceted mineral plates + glowing crystal fracture veins
        let minDist1 = 999;
        let minDist2 = 999;
        let cellShade = 0.5;

        for (const pt of voronoiPoints) {
          const du = Math.min(Math.abs(u - pt.u), 1 - Math.abs(u - pt.u));
          const dv = v - pt.v;
          const d = Math.sqrt(du * du + dv * dv);
          if (d < minDist1) {
            minDist2 = minDist1;
            minDist1 = d;
            cellShade = pt.shade;
          } else if (d < minDist2) {
            minDist2 = d;
          }
        }

        const edgeDist = minDist2 - minDist1;
        const isPrimaryVein = edgeDist < 0.026;
        const isSecondaryVein = edgeDist >= 0.026 && edgeDist < 0.045;
        const facetNoise = periodicNoise2D(u, v, 16, 8, seed);

        if (isPrimaryVein) {
          rgb = [248, 250, 252];
          bumpVal = 75;
          roughVal = 18;
        } else if (isSecondaryVein) {
          rgb = cHighlight;
          bumpVal = 95;
          roughVal = 32;
        } else {
          const facetMix = cellShade * 0.8 + facetNoise * 0.2;
          rgb =
            facetMix > 0.62
              ? mixRgb(cSecondary, cHighlight, (facetMix - 0.62) / 0.38)
              : facetMix > 0.32
              ? mixRgb(cPrimary, cSecondary, (facetMix - 0.32) / 0.3)
              : mixRgb(cDark, cPrimary, facetMix / 0.32);
          bumpVal = Math.round(110 + cellShade * 130);
          // Alternating mirror-smooth and brushed metallic crystal facets
          roughVal = cellShade > 0.5 ? 28 : 110;
        }
      } else {
        // Ethereal worlds: swirling auroral currents & soft bioluminescent clouds
        const n1 = fbmPeriodic(u, v, seed);
        const swirl =
          Math.sin(u * Math.PI * 4 + n1 * 5.5 + Math.cos(lat * 3)) * 0.5 + 0.5;
        rgb = mixRgb(cSecondary, cPrimary, swirl);
        rgb = mixRgb(rgb, cHighlight, Math.pow(swirl, 3) * 0.55);
        bumpVal = Math.round(120 + swirl * 40);
        roughVal = 90;
      }

      colorData.data[idx] = rgb[0];
      colorData.data[idx + 1] = rgb[1];
      colorData.data[idx + 2] = rgb[2];
      colorData.data[idx + 3] = 255;

      const bClamped = Math.max(0, Math.min(255, bumpVal));
      bumpData.data[idx] = bClamped;
      bumpData.data[idx + 1] = bClamped;
      bumpData.data[idx + 2] = bClamped;
      bumpData.data[idx + 3] = 255;

      const rClamped = Math.max(0, Math.min(255, roughVal));
      roughData.data[idx] = rClamped;
      roughData.data[idx + 1] = rClamped;
      roughData.data[idx + 2] = rClamped;
      roughData.data[idx + 3] = 255;
    }
  }

  colorCtx.putImageData(colorData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
  roughnessMap.needsUpdate = true;

  const result = { colorMap, bumpMap, roughnessMap };
  planetTextureCache.set(key, result);
  return result;
}

/**
 * True Fresnel Atmospheric Limb Shader:
 * Transparent across the planet center, glowing softly along the sunlit atmospheric limb
 * and fading smoothly to 0 at the outer sphere boundary so there is never a hard circular edge.
 */
export function createFresnelAtmosphereMaterial(params: {
  color: string;
  secondaryColor: string;
  fresnelPower?: number;
  intensity?: number;
}): THREE.ShaderMaterial {
  const {
    color,
    secondaryColor,
    fresnelPower = 3.1,
    intensity = 0.85,
  } = params;

  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uSunDir: { value: new THREE.Vector3(38, 24, 32).normalize() },
      uFresnelPower: { value: fresnelPower },
      uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uSecondaryColor;
      uniform vec3 uSunDir;
      uniform float uFresnelPower;
      uniform float uIntensity;

      varying vec3 vWorldNormal;
      varying vec3 vViewDir;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vViewDir);

        // View alignment: 1.0 at center of sphere, 0.0 at outer grazing edge
        float viewDot = clamp(dot(N, V), 0.0, 1.0);

        // Limb glow that peaks near the planet edge and tapers smoothly to 0 at the outer shell boundary
        float rim = pow(1.0 - viewDot, uFresnelPower);
        float outerSoftFade = smoothstep(0.0, 0.36, viewDot);
        float limb = rim * outerSoftFade;

        // Directional sun scattering: brighter on sunlit crescent, subtle rim on night side
        float sunAlignment = dot(N, normalize(uSunDir));
        float dayScattering = smoothstep(-0.45, 0.75, sunAlignment) * 0.78 + 0.22;

        vec3 finalColor = mix(uSecondaryColor, uColor, clamp(sunAlignment * 0.5 + 0.5, 0.0, 1.0));
        float alpha = clamp(limb * dayScattering * uIntensity * 2.1, 0.0, 0.88);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/**
 * Custom GLSL shader for Ethereal & Luminous Worlds:
 * Combines 3D animated plasma/aurora currents, directional hemisphere lighting,
 * and translucent internal core scattering.
 */
export function createEtherealCoreShaderMaterial(params: {
  primaryColor: string;
  secondaryColor: string;
  surfaceColor: string;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPrimary: { value: new THREE.Color(params.primaryColor) },
      uSecondary: { value: new THREE.Color(params.secondaryColor) },
      uSurface: { value: new THREE.Color(params.surfaceColor) },
      uSunDir: { value: new THREE.Vector3(38, 24, 32).normalize() },
      uTime: { value: 0 },
      uPulse: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform vec3 uSurface;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uPulse;

      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vViewDir);
        vec3 p = normalize(vLocalPos);

        // Animated 3D harmonic plasma currents
        float w1 = sin(p.x * 5.5 + uTime * 0.55 + cos(p.y * 4.2));
        float w2 = cos(p.y * 6.5 - uTime * 0.42 + sin(p.z * 5.0));
        float w3 = sin((p.x + p.z) * 4.8 + w1 * 1.4);
        float pattern = (w1 + w2 + w3) * 0.166 + 0.5;

        // Directional illumination with soft subsurface wrap lighting
        float sunDot = dot(N, normalize(uSunDir));
        float wrapLight = smoothstep(-0.55, 0.85, sunDot) * 0.78 + 0.22;

        // Core depth luminescence & Fresnel rim
        float viewDot = clamp(dot(N, V), 0.0, 1.0);
        float coreDepth = pow(viewDot, 1.6);
        float rimGlow = pow(1.0 - viewDot, 2.4);

        vec3 baseCol = mix(uSecondary * 0.42, uPrimary, pattern);
        vec3 coreCol = mix(baseCol, uSurface, coreDepth * 0.52 + uPulse * 0.18);
        vec3 shaded = coreCol * wrapLight + uSurface * rimGlow * (0.45 + uPulse * 0.25);

        gl_FragColor = vec4(shaded, 0.96);
      }
    `,
    transparent: true,
  });
}

/**
 * Generates a delicate concentric planetary ring texture with soft inner/outer alpha falloff
 * and fine Cassini-like ringlets.
 */
export function getPlanetaryRingTexture(
  ringStyle: 'thin' | 'double' | 'halo',
  primaryColor: string,
  secondaryColor: string
): THREE.CanvasTexture {
  const key = `${ringStyle}:${primaryColor}:${secondaryColor}`;
  const existing = ringTextureCache.get(key);
  if (existing) return existing;

  const width = 256;
  const height = 4;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);

  const c1 = hexToRgb(primaryColor);
  const c2 = hexToRgb(secondaryColor);
  const cIce: [number, number, number] = [226, 232, 240];

  for (let x = 0; x < width; x++) {
    const u = x / (width - 1); // 0 = inner ring radius, 1 = outer ring radius

    // Smooth radial fade at inner and outer edges
    const innerFade = Math.min(1, u / 0.14);
    const outerFade = Math.min(1, (1 - u) / 0.18);
    let envelope = innerFade * outerFade;

    if (ringStyle === 'double') {
      // Distinct Cassini division gap around u = 0.58
      const gapDist = Math.abs(u - 0.58);
      if (gapDist < 0.08) {
        envelope *= Math.pow(gapDist / 0.08, 2) * 0.15;
      }
    } else if (ringStyle === 'halo') {
      envelope *= Math.exp(-Math.pow((u - 0.45) / 0.28, 2));
    }

    // Fine concentric micro-ringlets
    const ringlet1 = Math.sin(u * Math.PI * 28) * 0.22 + 0.78;
    const ringlet2 = Math.cos(u * Math.PI * 64) * 0.14 + 0.86;
    const density = Math.max(0, Math.min(1, envelope * ringlet1 * ringlet2));

    const rgb = mixRgb(mixRgb(c2, c1, u), cIce, 0.32);
    const alpha = Math.round(density * 215);

    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      imgData.data[idx] = rgb[0];
      imgData.data[idx + 1] = rgb[1];
      imgData.data[idx + 2] = rgb[2];
      imgData.data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  ringTextureCache.set(key, tex);
  return tex;
}

/**
 * Soft circular radial point-sprite texture so stars and cosmic dust motes never render as square pixels.
 */
export function getSoftStarTexture(): THREE.CanvasTexture {
  if (cachedStarSpriteTexture) return cachedStarSpriteTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.22, 'rgba(240, 249, 255, 0.85)');
  grad.addColorStop(0.55, 'rgba(186, 230, 253, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedStarSpriteTexture = tex;
  return tex;
}

/**
 * Soft organic nebula cloud texture with zero hard edges for deep-background cosmic clouds.
 */
export function getSoftNebulaTexture(
  primaryColor: string,
  secondaryColor: string,
  variant: number
): THREE.CanvasTexture {
  const key = `${primaryColor}:${secondaryColor}:${variant}`;
  const existing = nebulaTextureCache.get(key);
  if (existing) return existing;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);

  const c1 = hexToRgb(primaryColor);
  const c2 = hexToRgb(secondaryColor);
  const seed = (variant + 1) * 173;

  for (let y = 0; y < size; y++) {
    const ny = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const r2 = nx * nx + ny * ny;
      const idx = (y * size + x) * 4;

      if (r2 >= 1) {
        imgData.data[idx + 3] = 0;
        continue;
      }

      // Smooth radial Gaussian falloff so quad boundaries are 100% invisible
      const radialFalloff = Math.pow(1 - r2, 2.4);
      const u = (nx + 1) * 0.5;
      const v = (ny + 1) * 0.5;
      const cloudNoise = fbmPeriodic(u, v, seed);
      const wispy = Math.max(0, cloudNoise - 0.28) / 0.72;
      const alpha = radialFalloff * wispy;

      const rgb = mixRgb(c2, c1, cloudNoise);
      imgData.data[idx] = rgb[0];
      imgData.data[idx + 1] = rgb[1];
      imgData.data[idx + 2] = rgb[2];
      imgData.data[idx + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  nebulaTextureCache.set(key, tex);
  return tex;
}
