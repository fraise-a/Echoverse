'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  ConstellationEdge,
  SongPlanet,
  UniverseAtmosphere,
} from '@/types/echoverse';
import { sharedAudioAnalyzer } from '@/lib/audio/audio-analyzer';

interface MusicalUniverseProps {
  planets: SongPlanet[];
  constellations: ConstellationEdge[];
  atmosphere: UniverseAtmosphere;
  selectedPlanet: SongPlanet | null;
  playingTrackId: string | null;
  isPlaying: boolean;
  reducedMotion: boolean;
  simplifiedGraphics: boolean;
  onSelectPlanet: (planet: SongPlanet) => void;
}

const REGION_BEACONS: Array<{
  name: string;
  position: [number, number, number];
  color: string;
}> = [
  { name: 'NEON HORIZON', position: [16, 7.5, -10], color: '#22d3ee' },
  { name: 'VELVET NEBULA', position: [-16, 8.0, -10], color: '#c4b5fd' },
  { name: 'ORGANIC DRIFT', position: [-14, -6.5, 12], color: '#f472b6' },
  { name: 'CINEMATIC CORE', position: [14, -6.0, 12], color: '#e879f9' },
];

/**
 * Smoothly focuses the camera on the selected planet without locking out manual user orbiting afterward.
 */
function CameraRig({
  selectedPlanet,
  reducedMotion,
  controlsRef,
}: {
  selectedPlanet: SongPlanet | null;
  reducedMotion: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const isTransitioning = useRef(false);
  const transitionProgress = useRef(0);
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));
  const desiredCameraPos = useRef(new THREE.Vector3(0, 8, 32));
  const lastPlanetId = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedPlanet) {
      if (lastPlanetId.current !== null) {
        lastPlanetId.current = null;
        desiredTarget.current.set(0, 0, 0);
        desiredCameraPos.current.set(0, 8, 30);
        isTransitioning.current = true;
        transitionProgress.current = 0;
      }
      return;
    }

    if (selectedPlanet.id !== lastPlanetId.current) {
      lastPlanetId.current = selectedPlanet.id;
      const [px, py, pz] = selectedPlanet.position;
      desiredTarget.current.set(px, py, pz);

      // Compute an offset along the outward radial vector from origin so the planet is framed nicely
      const radial = new THREE.Vector3(px, py * 0.4, pz);
      if (radial.lengthSq() < 0.01) {
        radial.set(0, 0, 1);
      } else {
        radial.normalize();
      }
      const offsetDist = Math.max(6.5, selectedPlanet.planetSize * 5.2);
      desiredCameraPos.current.set(
        px + radial.x * offsetDist + 1.4,
        py + 1.8,
        pz + radial.z * offsetDist + 2.2
      );
      isTransitioning.current = true;
      transitionProgress.current = 0;
    }
  }, [selectedPlanet]);

  useFrame((_, delta) => {
    if (!isTransitioning.current || !controlsRef.current) return;

    const speed = reducedMotion ? 12 : 3.2;
    transitionProgress.current += delta * speed;

    controlsRef.current.target.lerp(
      desiredTarget.current,
      Math.min(1, delta * speed * 1.4)
    );
    camera.position.lerp(
      desiredCameraPos.current,
      Math.min(1, delta * speed)
    );
    controlsRef.current.update();

    if (
      camera.position.distanceTo(desiredCameraPos.current) < 0.18 ||
      transitionProgress.current > 3.2
    ) {
      isTransitioning.current = false;
    }
  });

  return null;
}

/**
 * Volumetric nebula clouds & audio-reactive cosmic particles.
 */
function CosmicAtmosphereField({
  atmosphere,
  reducedMotion,
  simplifiedGraphics,
}: {
  atmosphere: UniverseAtmosphere;
  reducedMotion: boolean;
  simplifiedGraphics: boolean;
}) {
  const particleRef = useRef<THREE.Points>(null);
  const nebulaGroupRef = useRef<THREE.Group>(null);
  const primaryLightRef = useRef<THREE.PointLight>(null);
  const secondaryLightRef = useRef<THREE.PointLight>(null);

  const particleCount = simplifiedGraphics ? 180 : 650;

  const { positions, scales } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const sc = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const r = 10 + Math.random() * 38;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;
      pos[i * 3 + 2] = r * Math.cos(phi);
      sc[i] = 0.5 + Math.random() * 1.5;
    }
    return { positions: pos, scales: sc };
  }, [particleCount]);

  useFrame(({ clock }, delta) => {
    const reactive = sharedAudioAnalyzer.sampleFrame(clock.elapsedTime);

    if (particleRef.current && !reducedMotion) {
      const rotSpeed =
        0.015 *
        atmosphere.particleSpeed *
        (1 + (reactive.isPlaying ? reactive.intensity * 1.4 : 0));
      particleRef.current.rotation.y += delta * rotSpeed;
      particleRef.current.rotation.x =
        Math.sin(clock.elapsedTime * 0.08) * 0.04;
    }

    if (nebulaGroupRef.current && !reducedMotion) {
      nebulaGroupRef.current.rotation.y -= delta * 0.008;
      const scalePulse =
        1 + (reactive.isPlaying ? reactive.bass * 0.08 : 0);
      nebulaGroupRef.current.scale.setScalar(scalePulse);
    }

    if (primaryLightRef.current) {
      primaryLightRef.current.intensity =
        2.2 + (reactive.isPlaying ? reactive.bass * 2.4 : 0);
    }
    if (secondaryLightRef.current) {
      secondaryLightRef.current.intensity =
        1.8 + (reactive.isPlaying ? reactive.treble * 2.0 : 0);
    }
  });

  return (
    <group>
      <ambientLight intensity={0.45} />
      <pointLight
        ref={primaryLightRef}
        position={[18, 14, 12]}
        color={atmosphere.primaryColor}
        intensity={2.4}
        distance={95}
      />
      <pointLight
        ref={secondaryLightRef}
        position={[-18, -12, -14]}
        color={atmosphere.secondaryColor}
        intensity={2.0}
        distance={95}
      />
      <pointLight
        position={[0, 20, -18]}
        color={atmosphere.accentColor}
        intensity={1.5}
        distance={80}
      />

      {/* Atmospheric Dust Particles */}
      <points ref={particleRef}>
        <bufferGeometry key={particleCount}>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-scale"
            count={particleCount}
            array={scales}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.22}
          color={atmosphere.secondaryColor}
          transparent
          opacity={0.65}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Soft Volumetric Nebula Spheres */}
      {!simplifiedGraphics && (
        <group ref={nebulaGroupRef}>
          <mesh position={[-14, 4, -18]}>
            <sphereGeometry args={[14, 24, 24]} />
            <meshBasicMaterial
              color={atmosphere.primaryColor}
              transparent
              opacity={0.055 * atmosphere.nebulaIntensity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.BackSide}
            />
          </mesh>
          <mesh position={[16, -3, -15]}>
            <sphereGeometry args={[16, 24, 24]} />
            <meshBasicMaterial
              color={atmosphere.secondaryColor}
              transparent
              opacity={0.05 * atmosphere.nebulaIntensity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.BackSide}
            />
          </mesh>
          <mesh position={[0, -6, 14]}>
            <sphereGeometry args={[12, 24, 24]} />
            <meshBasicMaterial
              color={atmosphere.accentColor}
              transparent
              opacity={0.045 * atmosphere.nebulaIntensity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.BackSide}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * Constellation edges and glowing journey routes between song planets.
 */
function ConstellationNetwork({
  planets,
  constellations,
  atmosphere,
  selectedPlanetId,
  reducedMotion,
}: {
  planets: SongPlanet[];
  constellations: ConstellationEdge[];
  atmosphere: UniverseAtmosphere;
  selectedPlanetId: string | null;
  reducedMotion: boolean;
}) {
  const planetMap = useMemo(() => {
    const map = new Map<string, SongPlanet>();
    for (const p of planets) map.set(p.id, p);
    return map;
  }, [planets]);

  const pulseRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!pulseRef.current || reducedMotion) return;
    const reactive = sharedAudioAnalyzer.sampleFrame(clock.elapsedTime);
    const s = 1 + (reactive.isPlaying ? reactive.mid * 0.015 : 0);
    pulseRef.current.scale.setScalar(s);
  });

  return (
    <group ref={pulseRef}>
      {constellations.map((edge) => {
        const from = planetMap.get(edge.fromTrackId);
        const to = planetMap.get(edge.toTrackId);
        if (!from || !to) return null;

        const isConnectedToSelected =
          selectedPlanetId === from.id || selectedPlanetId === to.id;
        const isJourney = Boolean(edge.isJourneyRoute);

        const lineColor = isJourney
          ? atmosphere.accentColor
          : isConnectedToSelected
          ? '#22d3ee'
          : atmosphere.secondaryColor;

        const opacity = isJourney
          ? 0.9
          : isConnectedToSelected
          ? 0.78
          : 0.24 * edge.strength + 0.1;

        const lineWidth = isJourney ? 3.2 : isConnectedToSelected ? 2.0 : 1.0;

        // Slight midpoint curve for journey routes
        const points: Array<[number, number, number]> = isJourney
          ? [
              from.position,
              [
                (from.position[0] + to.position[0]) * 0.5,
                (from.position[1] + to.position[1]) * 0.5 + 1.3,
                (from.position[2] + to.position[2]) * 0.5,
              ],
              to.position,
            ]
          : [from.position, to.position];

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
 * Individual Glowing Song Planet Node
 */
function SongPlanetNode({
  planet,
  isSelected,
  isPlayingThis,
  reducedMotion,
  simplifiedGraphics,
  onSelect,
}: {
  planet: SongPlanet;
  isSelected: boolean;
  isPlayingThis: boolean;
  reducedMotion: boolean;
  simplifiedGraphics: boolean;
  onSelect: (planet: SongPlanet) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const haloMeshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const targetScaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const [hovered, setHovered] = useState(false);

  const segments = simplifiedGraphics ? 20 : 36;

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered]);

  useFrame(({ clock }, delta) => {
    const reactive = sharedAudioAnalyzer.sampleFrame(clock.elapsedTime);

    if (coreMeshRef.current && !reducedMotion) {
      coreMeshRef.current.rotation.y += delta * (0.28 + planet.orbitSpeed);
    }

    if (ringRef.current && !reducedMotion) {
      ringRef.current.rotation.z += delta * 0.35;
    }

    if (groupRef.current && !reducedMotion) {
      // Gentle vertical bobbing + audio-reactive pulsing
      const bob =
        Math.sin(clock.elapsedTime * 1.2 + planet.orbitRadius) * 0.14;
      groupRef.current.position.y = planet.position[1] + bob;

      let scaleBoost = 1;
      if (isPlayingThis && reactive.isPlaying) {
        scaleBoost = 1.18 + reactive.bass * 0.32;
      } else if (isSelected || hovered) {
        scaleBoost = 1.14 + (reactive.isPlaying ? reactive.intensity * 0.12 : 0);
      } else if (reactive.isPlaying) {
        scaleBoost = 1 + reactive.bass * 0.08;
      }
      targetScaleRef.current.setScalar(scaleBoost);
      groupRef.current.scale.lerp(targetScaleRef.current, 0.15);
    }

    if (haloMeshRef.current) {
      const mat = haloMeshRef.current.material as THREE.MeshBasicMaterial;
      if (isPlayingThis && reactive.isPlaying) {
        mat.opacity = 0.38 + reactive.intensity * 0.35;
      } else if (isSelected || hovered) {
        mat.opacity = 0.35;
      } else {
        mat.opacity = 0.16;
      }
    }
  });

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
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Core Glowing Planet Sphere */}
      <mesh ref={coreMeshRef}>
        <sphereGeometry args={[planet.planetSize, segments, segments]} />
        <meshStandardMaterial
          color={planet.primaryColor}
          emissive={planet.primaryColor}
          emissiveIntensity={
            isPlayingThis ? 1.45 : isSelected || hovered ? 1.1 : 0.65
          }
          roughness={0.25}
          metalness={0.35}
        />
      </mesh>

      {/* Outer Luminous Atmosphere Halo */}
      <mesh ref={haloMeshRef} scale={1.32}>
        <sphereGeometry args={[planet.planetSize, 20, 20]} />
        <meshBasicMaterial
          color={planet.secondaryColor}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Optional Planetary Rings */}
      {planet.ringStyle !== 'none' && (
        <mesh ref={ringRef} rotation={[Math.PI * 0.42, 0.2, 0]}>
          <ringGeometry
            args={[
              planet.planetSize * 1.42,
              planet.planetSize *
                (planet.ringStyle === 'double' ? 1.95 : 1.72),
              48,
            ]}
          />
          <meshBasicMaterial
            color={
              isPlayingThis || isSelected
                ? '#22d3ee'
                : planet.secondaryColor
            }
            transparent
            opacity={isSelected || isPlayingThis ? 0.75 : 0.42}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Selected / Playing Selection Orbit Ring */}
      {(isSelected || isPlayingThis) && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[planet.planetSize * 1.95, planet.planetSize * 2.08, 48]}
          />
          <meshBasicMaterial
            color={isPlayingThis ? '#ec4899' : '#22d3ee'}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Floating Label & Artwork Preview in 3D Space */}
      {(hovered || isSelected || isPlayingThis || planet.journeyStepIndex) && (
        <Html
          position={[0, planet.planetSize + 1.15, 0]}
          center
          distanceFactor={18}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#070816]/90 border border-white/20 backdrop-blur-md shadow-[0_0_25px_rgba(124,58,237,0.45)] whitespace-nowrap text-white">
            {planet.journeyStepIndex && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-cyan-500/30 text-cyan-200 border border-cyan-400/40">
                Step {planet.journeyStepIndex}
              </span>
            )}
            {planet.track.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={planet.track.image}
                alt={planet.track.name}
                className="w-6 h-6 rounded-full object-cover border border-white/30"
              />
            )}
            <div className="text-left">
              <div className="text-xs font-semibold leading-tight text-white max-w-[160px] truncate">
                {planet.track.name}
              </div>
              <div className="text-[10px] text-purple-200/80 max-w-[160px] truncate">
                {planet.track.artist_name}
              </div>
            </div>
            {isPlayingThis && (
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
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
  onSelectPlanet,
}: MusicalUniverseProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <div
      className="relative w-full h-full select-none"
      role="region"
      aria-label="Interactive 3D Musical Universe. Use mouse, trackpad, or the planet selector controls to explore songs."
    >
      <Canvas
        camera={{ position: [0, 8, 30], fov: 52, near: 0.1, far: 250 }}
        dpr={simplifiedGraphics ? [1, 1] : [1, 1.75]}
        gl={{ antialias: !simplifiedGraphics, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[atmosphere.fogColor || '#030308']} />
        <fog
          attach="fog"
          args={[atmosphere.fogColor || '#030308', 28, 95]}
        />

        <Stars
          radius={80}
          depth={45}
          count={simplifiedGraphics ? 1400 : 4200}
          factor={4}
          saturation={0.6}
          fade
          speed={reducedMotion ? 0 : 0.8}
        />

        <CosmicAtmosphereField
          atmosphere={atmosphere}
          reducedMotion={reducedMotion}
          simplifiedGraphics={simplifiedGraphics}
        />

        {/* Region Beacons */}
        {REGION_BEACONS.map((beacon) => (
          <Html
            key={beacon.name}
            position={beacon.position}
            center
            distanceFactor={26}
            zIndexRange={[1, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="px-2.5 py-0.5 rounded-full text-[9px] tracking-[0.22em] font-semibold uppercase border backdrop-blur-sm opacity-55"
              style={{
                color: beacon.color,
                borderColor: `${beacon.color}44`,
                backgroundColor: 'rgba(5, 6, 20, 0.55)',
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
          reducedMotion={reducedMotion}
        />

        {/* Song Planets */}
        {planets.map((planet) => (
          <SongPlanetNode
            key={planet.id}
            planet={planet}
            isSelected={selectedPlanet?.id === planet.id}
            isPlayingThis={playingTrackId === planet.track.id}
            reducedMotion={reducedMotion}
            simplifiedGraphics={simplifiedGraphics}
            onSelect={onSelectPlanet}
          />
        ))}

        <CameraRig
          selectedPlanet={selectedPlanet}
          reducedMotion={reducedMotion}
          controlsRef={controlsRef}
        />

        <OrbitControls
          ref={controlsRef}
          enableDamping={!reducedMotion}
          dampingFactor={0.06}
          rotateSpeed={0.65}
          zoomSpeed={0.85}
          panSpeed={0.65}
          minDistance={4.5}
          maxDistance={62}
        />
      </Canvas>
    </div>
  );
}
