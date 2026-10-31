'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  ConstellationEdge,
  PlanetArchetype,
  SongPlanet,
  UniverseAtmosphere,
} from '@/types/echoverse';
import { sharedAudioAnalyzer } from '@/lib/audio/audio-analyzer';
import {
  createEtherealCoreShaderMaterial,
  createFresnelAtmosphereMaterial,
  getPlanetaryRingTexture,
  getProceduralPlanetTextures,
  getSoftNebulaTexture,
  getSoftStarTexture,
} from '@/components/three/planet-materials';

interface MusicalUniverseProps {
  planets: SongPlanet[];
  constellations: ConstellationEdge[];
  atmosphere: UniverseAtmosphere;
  selectedPlanet: SongPlanet | null;
  playingTrackId: string | null;
  isPlaying: boolean;
  reducedMotion: boolean;
  simplifiedGraphics: boolean;
  viewResetVersion?: number;
  isInspectorOpen?: boolean;
  onSelectPlanet: (planet: SongPlanet) => void;
  onBackgroundClick?: () => void;
}

const REGION_BEACONS: Array<{
  name: string;
  position: [number, number, number];
  color: string;
}> = [
  { name: 'NEON HORIZON', position: [17.5, 6.8, -8.5], color: '#38bdf8' },
  { name: 'VELVET NEBULA', position: [-17.5, 7.2, -10.5], color: '#a78bfa' },
  { name: 'ORGANIC DRIFT', position: [-15.0, -6.2, 7.0], color: '#34d399' },
  { name: 'CINEMATIC CORE', position: [15.0, -5.8, 6.5], color: '#f59e0b' },
];

const OVERVIEW_CAMERA_POS = new THREE.Vector3(0, 5.8, 34.5);
const OVERVIEW_TARGET_POS = new THREE.Vector3(0, -0.4, 0);

/**
 * Creates a ring geometry whose U coordinate maps radially from innerRadius (0) to outerRadius (1)
 * so concentric ring textures and alpha falloffs render accurately around the full 360° circumference.
 */
function createRadialRingGeometry(
  innerRadius: number,
  outerRadius: number,
  thetaSegments = 64
): THREE.RingGeometry {
  const geom = new THREE.RingGeometry(
    innerRadius,
    outerRadius,
    thetaSegments,
    1
  );
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const span = Math.max(0.0001, outerRadius - innerRadius);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const u = Math.max(0, Math.min(1, (r - innerRadius) / span));
    const angle = (Math.atan2(y, x) + Math.PI) / (Math.PI * 2);
    uv.setXY(i, u, angle);
  }
  uv.needsUpdate = true;
  return geom;
}

/**
 * Four-Mode Observatory Camera Rig:
 * 1. Initial Galaxy Overview: Framed at [0, 5.8, 34.5] showing foreground, midground & background worlds.
 * 2. Exploratory Navigation: Yields immediately if the user manually orbits, pans, or zooms.
 * 3. Planet Focus: Smoothly approaches a selected planet at an oblique phase angle to showcase its day/night terminator & Fresnel limb.
 * 4. Journey & Reset View: Smooth flight along journey stops or back to the full galaxy overview.
 */
function CameraRig({
  selectedPlanet,
  reducedMotion,
  viewResetVersion = 0,
  isInspectorOpen = false,
  controlsRef,
}: {
  selectedPlanet: SongPlanet | null;
  reducedMotion: boolean;
  viewResetVersion?: number;
  isInspectorOpen?: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const isTransitioning = useRef(false);
  const transitionProgress = useRef(0);
  const desiredTarget = useRef(OVERVIEW_TARGET_POS.clone());
  const desiredCameraPos = useRef(OVERVIEW_CAMERA_POS.clone());
  const lastPlanetId = useRef<string | null>(null);
  const lastResetVersion = useRef<number>(viewResetVersion);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const stopAutoTransition = () => {
      isTransitioning.current = false;
    };
    controls.addEventListener('start', stopAutoTransition);
    return () => {
      controls.removeEventListener('start', stopAutoTransition);
    };
  }, [controlsRef]);

  useEffect(() => {
    const resetTriggered = viewResetVersion !== lastResetVersion.current;
    lastResetVersion.current = viewResetVersion;

    if (!selectedPlanet) {
      if (lastPlanetId.current !== null || resetTriggered) {
        lastPlanetId.current = null;
        desiredTarget.current.copy(OVERVIEW_TARGET_POS);
        desiredCameraPos.current.copy(OVERVIEW_CAMERA_POS);
        isTransitioning.current = true;
        transitionProgress.current = 0;
      }
      return;
    }

    if (selectedPlanet.id !== lastPlanetId.current || resetTriggered) {
      lastPlanetId.current = selectedPlanet.id;
      const [px, py, pz] = selectedPlanet.position;

      // Offset target slightly right when the right-side Inspector Panel is open so the planet sits in the open viewport
      const inspectorOffset = isInspectorOpen ? 0.65 : 0;
      desiredTarget.current.set(px + inspectorOffset, py, pz);

      // Approach at a 3/4 astronomical angle so the sunlit hemisphere, terminator shadow & Fresnel rim are all visible
      const offsetDist = Math.max(4.4, selectedPlanet.planetSize * 6.4);
      const viewDir = new THREE.Vector3(px * 0.12 + 0.36, 0.24, 0.9).normalize();

      desiredCameraPos.current.set(
        px + viewDir.x * offsetDist + inspectorOffset * 0.5,
        py + viewDir.y * offsetDist,
        pz + viewDir.z * offsetDist
      );
      isTransitioning.current = true;
      transitionProgress.current = 0;
    }
  }, [selectedPlanet, viewResetVersion, isInspectorOpen]);

  useFrame((_, delta) => {
    if (!isTransitioning.current || !controlsRef.current) return;

    const speed = reducedMotion ? 12 : 2.8;
    transitionProgress.current += delta * speed;

    controlsRef.current.target.lerp(
      desiredTarget.current,
      Math.min(1, delta * speed * 1.35)
    );
    camera.position.lerp(
      desiredCameraPos.current,
      Math.min(1, delta * speed)
    );
    controlsRef.current.update();

    if (
      (camera.position.distanceTo(desiredCameraPos.current) < 0.12 &&
        controlsRef.current.target.distanceTo(desiredTarget.current) < 0.08) ||
      transitionProgress.current > 3.4
    ) {
      isTransitioning.current = false;
    }
  });

  return null;
}

/**
 * Deep-Space Observatory Environment:
 * - Coherent directional sunlight + mood-responsive rim light + low ambient sky
 * - Multi-layered parallax starfields with soft circular sprites
 * - Distant background procedural nebula clouds (z in [-58, -38]) that never wash out foreground planets
 */
function CosmicObservatoryEnvironment({
  atmosphere,
  reducedMotion,
  simplifiedGraphics,
}: {
  atmosphere: UniverseAtmosphere;
  reducedMotion: boolean;
  simplifiedGraphics: boolean;
}) {
  const midStarsRef = useRef<THREE.Points>(null);
  const dustRef = useRef<THREE.Points>(null);
  const nebulaGroupRef = useRef<THREE.Group>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);

  const starTexture = useMemo(() => getSoftStarTexture(), []);

  const nebulaTex0 = useMemo(
    () =>
      getSoftNebulaTexture(
        atmosphere.primaryColor,
        atmosphere.secondaryColor,
        0
      ),
    [atmosphere.primaryColor, atmosphere.secondaryColor]
  );
  const nebulaTex1 = useMemo(
    () =>
      getSoftNebulaTexture(
        atmosphere.secondaryColor,
        atmosphere.accentColor,
        1
      ),
    [atmosphere.secondaryColor, atmosphere.accentColor]
  );
  const nebulaTex2 = useMemo(
    () =>
      getSoftNebulaTexture(
        atmosphere.accentColor,
        atmosphere.primaryColor,
        2
      ),
    [atmosphere.accentColor, atmosphere.primaryColor]
  );

  const midStarCount = simplifiedGraphics ? 140 : 360;
  const dustCount = simplifiedGraphics ? 90 : 240;

  // Mid-field coloured astronomical stars
  const { midPositions, midColors } = useMemo(() => {
    const pos = new Float32Array(midStarCount * 3);
    const col = new Float32Array(midStarCount * 3);
    const starPalette = [
      new THREE.Color('#e0f2fe'),
      new THREE.Color('#fef3c7'),
      new THREE.Color('#ddd6fe'),
      new THREE.Color('#bae6fd'),
      new THREE.Color('#fecdd3'),
    ];

    for (let i = 0; i < midStarCount; i++) {
      const r = 34 + ((i * 73) % 58);
      const theta = i * 2.399963229728653;
      const u = ((i * 47) % 100) / 100 * 2 - 1;
      const phi = Math.acos(Math.max(-1, Math.min(1, u)));

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.65;
      pos[i * 3 + 2] = r * Math.cos(phi) - 10;

      const c = starPalette[i % starPalette.length];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { midPositions: pos, midColors: col };
  }, [midStarCount]);

  // Subtle cosmic dust motes drifting across the observatory volume
  const dustPositions = useMemo(() => {
    const pos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = 12 + ((i * 59) % 34);
      const theta = i * 1.91;
      const y = (((i * 31) % 100) / 100 - 0.5) * 20;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r - 4;
    }
    return pos;
  }, [dustCount]);

  useFrame(({ clock }, delta) => {
    const reactive = sharedAudioAnalyzer.sampleFrame(clock.elapsedTime);

    if (midStarsRef.current && !reducedMotion) {
      midStarsRef.current.rotation.y += delta * 0.0035;
    }

    if (dustRef.current && !reducedMotion) {
      const speed =
        0.008 *
        atmosphere.particleSpeed *
        (1 + (reactive.isPlaying ? reactive.intensity * 0.9 : 0));
      dustRef.current.rotation.y += delta * speed;
    }

    if (nebulaGroupRef.current && !reducedMotion) {
      nebulaGroupRef.current.rotation.z =
        Math.sin(clock.elapsedTime * 0.04) * 0.03;
    }

    if (rimLightRef.current) {
      rimLightRef.current.intensity =
        1.15 + (reactive.isPlaying ? reactive.bass * 0.55 : 0);
    }
  });

  return (
    <group>
      {/* Low ambient & hemisphere fill so planet shadow hemispheres look truly 3D */}
      <ambientLight intensity={0.13} color="#0f172a" />
      <hemisphereLight args={['#1e293b', '#020308', 0.32]} />

      {/* Primary Celestial Key Light (creates crisp day/night terminator on every planet) */}
      <directionalLight
        position={[38, 24, 32]}
        intensity={2.85}
        color="#f8fafc"
      />

      {/* Secondary Rim / Back Light tinted by current mood atmosphere */}
      <directionalLight
        ref={rimLightRef}
        position={[-32, -16, -26]}
        intensity={1.15}
        color={atmosphere.primaryColor}
      />

      {/* Subtle Deep-Space Accent Fill */}
      <pointLight
        position={[0, 20, -24]}
        color={atmosphere.secondaryColor}
        intensity={1.1}
        distance={95}
      />

      {/* Mid-Field Coloured Astronomical Star Layer */}
      <points ref={midStarsRef}>
        <bufferGeometry key={midStarCount}>
          <bufferAttribute
            attach="attributes-position"
            count={midStarCount}
            array={midPositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={midStarCount}
            array={midColors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={starTexture}
          size={0.55}
          vertexColors
          transparent
          opacity={0.82}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Delicate Cosmic Dust Motes */}
      <points ref={dustRef}>
        <bufferGeometry key={dustCount}>
          <bufferAttribute
            attach="attributes-position"
            count={dustCount}
            array={dustPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={starTexture}
          size={0.26}
          color={atmosphere.secondaryColor}
          transparent
          opacity={0.38}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Distant Background Procedural Nebula Clouds (strictly behind the planet volume at z = -42..-58) */}
      {!simplifiedGraphics && (
        <group ref={nebulaGroupRef}>
          <mesh position={[-24, 9, -46]} rotation={[0, 0.18, 0.12]}>
            <planeGeometry args={[54, 36]} />
            <meshBasicMaterial
              map={nebulaTex0}
              transparent
              opacity={0.22 * atmosphere.nebulaIntensity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          <mesh position={[25, -6, -50]} rotation={[0, -0.2, -0.15]}>
            <planeGeometry args={[58, 38]} />
            <meshBasicMaterial
              map={nebulaTex1}
              transparent
              opacity={0.2 * atmosphere.nebulaIntensity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          <mesh position={[2, 2, -56]} rotation={[0, 0, 0.35]}>
            <planeGeometry args={[68, 42]} />
            <meshBasicMaterial
              map={nebulaTex2}
              transparent
              opacity={0.16 * atmosphere.nebulaIntensity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * Delicate Constellation Filaments & Smooth Curved Journey Routes
 */
function ConstellationNetwork({
  planets,
  constellations,
  atmosphere,
  selectedPlanetId,
  hoveredPlanetId,
}: {
  planets: SongPlanet[];
  constellations: ConstellationEdge[];
  atmosphere: UniverseAtmosphere;
  selectedPlanetId: string | null;
  hoveredPlanetId: string | null;
}) {
  const planetMap = useMemo(() => {
    const map = new Map<string, SongPlanet>();
    for (const p of planets) map.set(p.id, p);
    return map;
  }, [planets]);

  const edgePointsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        straight: Array<[number, number, number]>;
        curved: Array<[number, number, number]>;
      }
    >();
    for (const edge of constellations) {
      const from = planetMap.get(edge.fromTrackId);
      const to = planetMap.get(edge.toTrackId);
      if (!from || !to) continue;
      const start = new THREE.Vector3(...from.position);
      const end = new THREE.Vector3(...to.position);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y += edge.isJourneyRoute ? 1.4 : 0.55;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      map.set(edge.id, {
        straight: [from.position, to.position],
        curved: curve
          .getPoints(16)
          .map((pt) => [pt.x, pt.y, pt.z] as [number, number, number]),
      });
    }
    return map;
  }, [constellations, planetMap]);

  const activeFocusId = hoveredPlanetId || selectedPlanetId;

  return (
    <group>
      {constellations.map((edge) => {
        const from = planetMap.get(edge.fromTrackId);
        const to = planetMap.get(edge.toTrackId);
        const geomPts = edgePointsMap.get(edge.id);
        if (!from || !to || !geomPts) return null;

        const isConnectedToFocus =
          activeFocusId === from.id || activeFocusId === to.id;
        const isJourney = Boolean(edge.isJourneyRoute);

        const lineColor = isJourney
          ? atmosphere.accentColor
          : isConnectedToFocus
          ? '#38bdf8'
          : atmosphere.secondaryColor;

        // Keep idle constellation filaments delicate so they never clutter the galaxy
        const opacity = isJourney
          ? 0.82
          : isConnectedToFocus
          ? 0.62
          : activeFocusId
          ? 0.06
          : 0.13 * edge.strength + 0.05;

        const lineWidth = isJourney ? 2.2 : isConnectedToFocus ? 1.5 : 0.85;
        const points =
          isJourney || isConnectedToFocus ? geomPts.curved : geomPts.straight;

        return (
          <Line
            key={edge.id}
            points={points}
            color={lineColor}
            lineWidth={lineWidth}
            transparent
            opacity={opacity}
          />
        );
      })}
    </group>
  );
}

/**
 * Individual Procedurally Shaded 3D Song Planet Node
 */
function SongPlanetNode({
  planet,
  isSelected,
  isPlayingThis,
  reducedMotion,
  simplifiedGraphics,
  onSelect,
  onHoverChange,
}: {
  planet: SongPlanet;
  isSelected: boolean;
  isPlayingThis: boolean;
  reducedMotion: boolean;
  simplifiedGraphics: boolean;
  onSelect: (planet: SongPlanet) => void;
  onHoverChange: (planetId: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const moonOrbitRef = useRef<THREE.Group>(null);
  const selectionRingRef = useRef<THREE.Mesh>(null);
  const targetScaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const [hovered, setHovered] = useState(false);

  const archetype: PlanetArchetype = planet.archetype || 'gas-giant';
  const variant = planet.textureVariant ?? 0;
  const surfaceColor = planet.surfaceColor || planet.primaryColor;
  const atmosphereColor = planet.atmosphereColor || planet.secondaryColor;
  const axialTilt = planet.axialTilt || [0.18, 0, 0.14];

  const segments = simplifiedGraphics ? 28 : 48;

  // Retrieve cached procedural surface, bump, and roughness maps
  const textures = useMemo(
    () =>
      getProceduralPlanetTextures(
        archetype,
        variant,
        planet.primaryColor,
        planet.secondaryColor,
        surfaceColor
      ),
    [
      archetype,
      variant,
      planet.primaryColor,
      planet.secondaryColor,
      surfaceColor,
    ]
  );

  // Ethereal core shader material (used when archetype === 'ethereal')
  const etherealCoreMaterial = useMemo(() => {
    if (archetype !== 'ethereal') return null;
    return createEtherealCoreShaderMaterial({
      primaryColor: planet.primaryColor,
      secondaryColor: planet.secondaryColor,
      surfaceColor,
    });
  }, [archetype, planet.primaryColor, planet.secondaryColor, surfaceColor]);

  // True Fresnel Atmospheric Limb Shader Material
  const atmosphereMaterial = useMemo(() => {
    const fresnelPower =
      archetype === 'terrestrial'
        ? 3.7
        : archetype === 'crystalline'
        ? 3.4
        : archetype === 'gas-giant'
        ? 2.9
        : 2.3;
    const baseIntensity =
      archetype === 'ethereal'
        ? 1.05
        : archetype === 'gas-giant'
        ? 0.85
        : 0.72;
    return createFresnelAtmosphereMaterial({
      color: atmosphereColor,
      secondaryColor: planet.primaryColor,
      fresnelPower,
      intensity: baseIntensity,
    });
  }, [archetype, atmosphereColor, planet.primaryColor]);

  // Dispose per-instance ShaderMaterials on unmount
  useEffect(() => {
    return () => {
      atmosphereMaterial.dispose();
      etherealCoreMaterial?.dispose();
    };
  }, [atmosphereMaterial, etherealCoreMaterial]);

  // Radial UV ring geometry & procedural ring texture
  const ringGeometry = useMemo(() => {
    if (planet.ringStyle === 'none') return null;
    const inner = planet.planetSize * 1.28;
    const outer =
      planet.planetSize *
      (planet.ringStyle === 'double'
        ? 1.66
        : planet.ringStyle === 'halo'
        ? 1.56
        : 1.48);
    return createRadialRingGeometry(inner, outer, simplifiedGraphics ? 36 : 64);
  }, [planet.planetSize, planet.ringStyle, simplifiedGraphics]);

  useEffect(() => {
    return () => {
      ringGeometry?.dispose();
    };
  }, [ringGeometry]);

  const ringTexture = useMemo(() => {
    if (planet.ringStyle === 'none') return null;
    return getPlanetaryRingTexture(
      planet.ringStyle,
      planet.primaryColor,
      planet.secondaryColor
    );
  }, [planet.ringStyle, planet.primaryColor, planet.secondaryColor]);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered]);

  useFrame(({ clock }, delta) => {
    const reactive = sharedAudioAnalyzer.sampleFrame(clock.elapsedTime);

    if (coreMeshRef.current && !reducedMotion) {
      coreMeshRef.current.rotation.y += delta * (0.18 + planet.orbitSpeed);
    }

    if (etherealCoreMaterial && !reducedMotion) {
      etherealCoreMaterial.uniforms.uTime.value = clock.elapsedTime;
      etherealCoreMaterial.uniforms.uPulse.value =
        isPlayingThis && reactive.isPlaying ? reactive.bass * 0.8 : 0;
    }

    if (ringRef.current && !reducedMotion) {
      ringRef.current.rotation.z += delta * 0.14;
    }

    if (moonOrbitRef.current && !reducedMotion) {
      moonOrbitRef.current.rotation.y += delta * (0.45 + planet.orbitSpeed * 2);
    }

    if (selectionRingRef.current && !reducedMotion) {
      selectionRingRef.current.rotation.z -= delta * 0.4;
    }

    // Update Fresnel atmosphere intensity smoothly on hover / selection / playback
    const targetAtmo =
      isPlayingThis && reactive.isPlaying
        ? 1.18 + reactive.intensity * 0.45
        : isSelected || hovered
        ? 1.08
        : archetype === 'ethereal'
        ? 0.95
        : 0.72;
    atmosphereMaterial.uniforms.uIntensity.value = THREE.MathUtils.lerp(
      atmosphereMaterial.uniforms.uIntensity.value,
      targetAtmo,
      0.12
    );

    if (groupRef.current && !reducedMotion) {
      const bob =
        Math.sin(clock.elapsedTime * 0.95 + planet.orbitRadius) * 0.08;
      groupRef.current.position.y = planet.position[1] + bob;

      // Controlled, subtle scale response so planets never balloon or overlap
      let scaleBoost = 1;
      if (isPlayingThis && reactive.isPlaying) {
        scaleBoost = 1.08 + reactive.bass * 0.12;
      } else if (isSelected || hovered) {
        scaleBoost = 1.06;
      } else if (reactive.isPlaying) {
        scaleBoost = 1 + reactive.bass * 0.03;
      }
      targetScaleRef.current.setScalar(scaleBoost);
      groupRef.current.scale.lerp(targetScaleRef.current, 0.14);
    }
  });

  const atmoScale =
    archetype === 'ethereal'
      ? 1.13
      : archetype === 'gas-giant'
      ? 1.09
      : 1.06;

  return (
    <group
      ref={groupRef}
      position={planet.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(planet);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHoverChange(planet.id);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHoverChange(null);
      }}
    >
      {/* Axial Tilt Group for Planet Body & Rings */}
      <group rotation={axialTilt}>
        {/* Core 3D Planet Sphere with Archetype-Specific Material */}
        <mesh ref={coreMeshRef}>
          <sphereGeometry args={[planet.planetSize, segments, segments]} />
          {archetype === 'ethereal' && etherealCoreMaterial ? (
            <primitive object={etherealCoreMaterial} attach="material" />
          ) : archetype === 'crystalline' ? (
            <meshPhysicalMaterial
              map={textures.colorMap}
              bumpMap={textures.bumpMap}
              bumpScale={0.075}
              roughnessMap={textures.roughnessMap}
              roughness={0.24}
              metalness={0.72}
              clearcoat={0.9}
              clearcoatRoughness={0.14}
              reflectivity={0.95}
              emissive={planet.primaryColor}
              emissiveIntensity={
                isPlayingThis ? 0.24 : isSelected || hovered ? 0.16 : 0.08
              }
            />
          ) : archetype === 'terrestrial' ? (
            <meshStandardMaterial
              map={textures.colorMap}
              bumpMap={textures.bumpMap}
              bumpScale={0.06}
              roughnessMap={textures.roughnessMap}
              roughness={0.68}
              metalness={0.14}
              emissive={planet.secondaryColor}
              emissiveIntensity={
                isPlayingThis ? 0.16 : isSelected || hovered ? 0.1 : 0.04
              }
            />
          ) : (
            <meshStandardMaterial
              map={textures.colorMap}
              bumpMap={textures.bumpMap}
              bumpScale={0.028}
              roughnessMap={textures.roughnessMap}
              roughness={0.56}
              metalness={0.06}
              emissive={planet.primaryColor}
              emissiveIntensity={
                isPlayingThis ? 0.18 : isSelected || hovered ? 0.11 : 0.05
              }
            />
          )}
        </mesh>

        {/* True Fresnel Atmospheric Limb Shell */}
        <mesh scale={atmoScale}>
          <sphereGeometry
            args={[
              planet.planetSize,
              simplifiedGraphics ? 24 : 36,
              simplifiedGraphics ? 24 : 36,
            ]}
          />
          <primitive object={atmosphereMaterial} attach="material" />
        </mesh>

        {/* Delicate Concentric Planetary Ring System */}
        {planet.ringStyle !== 'none' && ringGeometry && ringTexture && (
          <mesh
            ref={ringRef}
            geometry={ringGeometry}
            rotation={[Math.PI * 0.46, 0, 0]}
          >
            <meshStandardMaterial
              map={ringTexture}
              alphaMap={ringTexture}
              color={
                isPlayingThis || isSelected
                  ? '#bae6fd'
                  : planet.atmosphereColor || planet.secondaryColor
              }
              emissive={planet.primaryColor}
              emissiveIntensity={isSelected || isPlayingThis ? 0.35 : 0.14}
              roughness={0.6}
              metalness={0.15}
              transparent
              opacity={isSelected || isPlayingThis ? 0.78 : 0.52}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>

      {/* Optional Orbiting Micro-Moon for Spatial Scale */}
      {planet.hasMoon && !simplifiedGraphics && (
        <group ref={moonOrbitRef} rotation={[0.25, 0, -0.18]}>
          <mesh position={[planet.planetSize * 1.88, 0, 0]}>
            <sphereGeometry args={[planet.planetSize * 0.11, 14, 14]} />
            <meshStandardMaterial
              color="#cbd5e1"
              roughness={0.82}
              metalness={0.12}
            />
          </mesh>
        </group>
      )}

      {/* Subtle Orbital Telemetry Reticle & Local Illumination when Selected / Playing */}
      {(isSelected || isPlayingThis || hovered) && (
        <>
          <mesh
            ref={selectionRingRef}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <ringGeometry
              args={[
                planet.planetSize * 1.72,
                planet.planetSize * 1.755,
                64,
              ]}
            />
            <meshBasicMaterial
              color={
                isPlayingThis
                  ? '#f472b6'
                  : isSelected
                  ? '#38bdf8'
                  : '#94a3b8'
              }
              transparent
              opacity={isSelected || isPlayingThis ? 0.72 : 0.38}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {(isSelected || isPlayingThis) && (
            <pointLight
              color={planet.atmosphereColor || planet.primaryColor}
              intensity={1.35}
              distance={planet.planetSize * 7}
            />
          )}
        </>
      )}

      {/* Contextual Floating Label in 3D Space (only for hovered, selected, playing, or journey steps) */}
      {(hovered || isSelected || isPlayingThis || planet.journeyStepIndex) && (
        <Html
          position={[0, planet.planetSize + 0.72, 0]}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[#050716]/90 border border-white/20 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.75)] whitespace-nowrap text-white">
            {planet.journeyStepIndex && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-cyan-500/25 text-cyan-200 border border-cyan-400/40">
                Step {planet.journeyStepIndex}
              </span>
            )}
            {planet.track.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={planet.track.image}
                alt={planet.track.name}
                className="w-5 h-5 rounded-full object-cover border border-white/25"
              />
            )}
            <div className="text-left">
              <div className="text-[11px] font-semibold leading-tight text-white max-w-[155px] truncate">
                {planet.track.name}
              </div>
              <div className="text-[9px] text-slate-300 max-w-[155px] truncate">
                {planet.track.artist_name}
                {planet.archetypeLabel ? ` • ${planet.archetypeLabel}` : ''}
              </div>
            </div>
            {isPlayingThis && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function MusicalUniverse({
  planets,
  constellations,
  atmosphere,
  selectedPlanet,
  playingTrackId,
  reducedMotion,
  simplifiedGraphics,
  viewResetVersion = 0,
  isInspectorOpen = false,
  onSelectPlanet,
  onBackgroundClick,
}: MusicalUniverseProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [hoveredPlanetId, setHoveredPlanetId] = useState<string | null>(null);

  return (
    <div
      className="relative w-full h-full select-none"
      role="region"
      aria-label="Interactive 3D Musical Universe. Use mouse, trackpad, or the planet selector controls to explore songs."
    >
      <Canvas
        camera={{ position: [0, 5.8, 34.5], fov: 45, near: 0.1, far: 260 }}
        dpr={simplifiedGraphics ? [1, 1] : [1, 1.75]}
        gl={{
          antialias: !simplifiedGraphics,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        onPointerMissed={() => {
          onBackgroundClick?.();
        }}
      >
        <color attach="background" args={[atmosphere.fogColor || '#020309']} />
        <fog
          attach="fog"
          args={[atmosphere.fogColor || '#020309', 38, 130]}
        />

        {/* Deep-Field Background Star Layer */}
        <Stars
          radius={95}
          depth={55}
          count={simplifiedGraphics ? 1400 : 3800}
          factor={3.2}
          saturation={0.45}
          fade
          speed={reducedMotion ? 0 : 0.35}
        />

        {/* Lighting, Mid-Field Stars, Cosmic Dust & Distant Nebula Clouds */}
        <CosmicObservatoryEnvironment
          atmosphere={atmosphere}
          reducedMotion={reducedMotion}
          simplifiedGraphics={simplifiedGraphics}
        />

        {/* Subtle Sector Telemetry Beacons */}
        {REGION_BEACONS.map((beacon) => (
          <Html
            key={beacon.name}
            position={beacon.position}
            center
            distanceFactor={28}
            zIndexRange={[1, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="px-2.5 py-0.5 rounded-full text-[8px] tracking-[0.26em] font-semibold uppercase border backdrop-blur-sm opacity-40"
              style={{
                color: beacon.color,
                borderColor: `${beacon.color}33`,
                backgroundColor: 'rgba(3, 5, 16, 0.5)',
              }}
            >
              {beacon.name}
            </div>
          </Html>
        ))}

        {/* Constellations & Journey Routes */}
        <ConstellationNetwork
          planets={planets}
          constellations={constellations}
          atmosphere={atmosphere}
          selectedPlanetId={selectedPlanet?.id || null}
          hoveredPlanetId={hoveredPlanetId}
        />

        {/* Procedurally Shaded 3D Song Planets */}
        {planets.map((planet) => (
          <SongPlanetNode
            key={planet.id}
            planet={planet}
            isSelected={selectedPlanet?.id === planet.id}
            isPlayingThis={playingTrackId === planet.track.id}
            reducedMotion={reducedMotion}
            simplifiedGraphics={simplifiedGraphics}
            onSelect={onSelectPlanet}
            onHoverChange={setHoveredPlanetId}
          />
        ))}

        <CameraRig
          selectedPlanet={selectedPlanet}
          reducedMotion={reducedMotion}
          viewResetVersion={viewResetVersion}
          isInspectorOpen={isInspectorOpen}
          controlsRef={controlsRef}
        />

        <OrbitControls
          ref={controlsRef}
          enableDamping={!reducedMotion}
          dampingFactor={0.055}
          rotateSpeed={0.6}
          zoomSpeed={0.85}
          panSpeed={0.65}
          minDistance={2.8}
          maxDistance={68}
        />
      </Canvas>
    </div>
  );
}
