import {
  ConstellationEdge,
  JamendoTrack,
  PlanetArchetype,
  SongPlanet,
  UniverseAtmosphere,
} from '@/types/echoverse';

export const DEFAULT_ATMOSPHERE: UniverseAtmosphere = {
  name: 'Celestial Resonance',
  description:
    'An expansive deep-space observatory of independent electronic, ambient, acoustic, and cinematic worlds.',
  primaryColor: '#6366f1',
  secondaryColor: '#22d3ee',
  accentColor: '#e879f9',
  fogColor: '#020309',
  nebulaIntensity: 0.65,
  particleSpeed: 0.35,
  energyLevel: 0.55,
};

interface RegionDefinition {
  name: string;
  center: [number, number, number];
  primaryColor: string;
  secondaryColor: string;
  keywords: string[];
}

const REGIONS: RegionDefinition[] = [
  {
    name: 'Neon Horizon',
    center: [14.5, 3.6, -6.5],
    primaryColor: '#38bdf8',
    secondaryColor: '#818cf8',
    keywords: [
      'electronic',
      'synthwave',
      'electro',
      'house',
      'techno',
      'dance',
      'pop',
      'energetic',
      'club',
      'hiphop',
    ],
  },
  {
    name: 'Velvet Nebula',
    center: [-14.5, 4.0, -8.5],
    primaryColor: '#a78bfa',
    secondaryColor: '#5eead4',
    keywords: [
      'ambient',
      'chillout',
      'downtempo',
      'dreamy',
      'space',
      'relaxing',
      'meditation',
      'lofi',
      'atmospheric',
      'newage',
    ],
  },
  {
    name: 'Organic Drift',
    center: [-12.5, -3.4, 5.5],
    primaryColor: '#34d399',
    secondaryColor: '#38bdf8',
    keywords: [
      'acoustic',
      'folk',
      'indie',
      'piano',
      'guitar',
      'jazz',
      'classical',
      'singer-songwriter',
      'world',
    ],
  },
  {
    name: 'Cinematic Core',
    center: [12.5, -3.0, 5.0],
    primaryColor: '#f59e0b',
    secondaryColor: '#c084fc',
    keywords: [
      'cinematic',
      'soundtrack',
      'orchestral',
      'rock',
      'experimental',
      'dark',
      'metal',
      'instrumental',
      'film',
    ],
  },
];

interface ArchetypePalette {
  primary: string;
  secondary: string;
  surface: string;
  atmosphere: string;
}

const ARCHETYPE_PALETTES: Record<PlanetArchetype, ArchetypePalette[]> = {
  'gas-giant': [
    {
      primary: '#38bdf8',
      secondary: '#1d4ed8',
      surface: '#0284c7',
      atmosphere: '#7dd3fc',
    },
    {
      primary: '#f59e0b',
      secondary: '#b45309',
      surface: '#d97706',
      atmosphere: '#fde68a',
    },
    {
      primary: '#a855f7',
      secondary: '#4c1d95',
      surface: '#7e22ce',
      atmosphere: '#d8b4fe',
    },
  ],
  terrestrial: [
    {
      primary: '#0284c7',
      secondary: '#10b981',
      surface: '#eab308',
      atmosphere: '#38bdf8',
    },
    {
      primary: '#1d4ed8',
      secondary: '#f97316',
      surface: '#34d399',
      atmosphere: '#fdba74',
    },
    {
      primary: '#4338ca',
      secondary: '#06b6d4',
      surface: '#f472b6',
      atmosphere: '#a5b4fc',
    },
  ],
  crystalline: [
    {
      primary: '#67e8f9',
      secondary: '#94a3b8',
      surface: '#cffafe',
      atmosphere: '#22d3ee',
    },
    {
      primary: '#c084fc',
      secondary: '#f472b6',
      surface: '#e9d5ff',
      atmosphere: '#e879f9',
    },
    {
      primary: '#fda4af',
      secondary: '#fde047',
      surface: '#fecdd3',
      atmosphere: '#fb7185',
    },
  ],
  ethereal: [
    {
      primary: '#5eead4',
      secondary: '#38bdf8',
      surface: '#99f6e4',
      atmosphere: '#2dd4bf',
    },
    {
      primary: '#c4b5fd',
      secondary: '#f0abfc',
      surface: '#ddd6fe',
      atmosphere: '#a78bfa',
    },
    {
      primary: '#6ee7b7',
      secondary: '#818cf8',
      surface: '#a7f3d0',
      atmosphere: '#34d399',
    },
  ],
};

const ARCHETYPE_LABELS: Record<PlanetArchetype, string> = {
  'gas-giant': 'Atmospheric Gas Giant',
  terrestrial: 'Rocky Terrestrial World',
  crystalline: 'Crystalline Metallic World',
  ethereal: 'Ethereal Luminous World',
};

function deterministicHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function extractTrackTags(track: JamendoTrack): string[] {
  const tags = new Set<string>();
  const info = track.musicinfo;
  if (info?.tags) {
    for (const g of info.tags.genres || []) tags.add(g.toLowerCase());
    for (const i of info.tags.instruments || []) tags.add(i.toLowerCase());
    for (const v of info.tags.vartags || []) tags.add(v.toLowerCase());
  }
  if (info?.vocalinstrumental) {
    tags.add(info.vocalinstrumental.toLowerCase());
  }
  if (info?.acousticelectric) {
    tags.add(info.acousticelectric.toLowerCase());
  }
  if (info?.speed) {
    tags.add(`tempo:${info.speed.toLowerCase()}`);
  }
  return Array.from(tags);
}

function assignRegion(
  track: JamendoTrack,
  allTags: string[],
  regionCounts: Record<string, number>
): RegionDefinition {
  let bestRegion = REGIONS[0];
  let bestScore = -999;

  for (const region of REGIONS) {
    let score = 0;
    for (const tag of allTags) {
      if (region.keywords.includes(tag)) {
        score += 2;
      }
    }
    if (
      region.name === 'Organic Drift' &&
      track.musicinfo?.acousticelectric === 'acoustic'
    ) {
      score += 3;
    }
    if (
      region.name === 'Neon Horizon' &&
      (track.musicinfo?.speed === 'high' || track.musicinfo?.speed === 'veryhigh')
    ) {
      score += 2;
    }
    if (
      region.name === 'Velvet Nebula' &&
      (track.musicinfo?.speed === 'low' || track.musicinfo?.speed === 'verylow')
    ) {
      score += 2;
    }

    // Cap raw tag score and balance across the 4 quadrants of the 3D observatory
    score = Math.min(score, 5) - (regionCounts[region.name] || 0) * 2.4;

    if (score > bestScore) {
      bestScore = score;
      bestRegion = region;
    }
  }

  regionCounts[bestRegion.name] = (regionCounts[bestRegion.name] || 0) + 1;
  return bestRegion;
}

export function buildDefaultReason(track: JamendoTrack, allTags: string[]): string {
  const genres = track.musicinfo?.tags?.genres?.slice(0, 3) || [];
  const instruments = track.musicinfo?.tags?.instruments?.slice(0, 2) || [];
  const moodTags = track.musicinfo?.tags?.vartags?.slice(0, 2) || [];
  const speed = track.musicinfo?.speed;
  const vocal = track.musicinfo?.vocalinstrumental;

  const parts: string[] = [];
  if (genres.length > 0) {
    parts.push(`${genres.join(' / ')} composition`);
  } else if (allTags.length > 0) {
    parts.push(`${allTags.slice(0, 2).join(' & ')} soundscape`);
  } else {
    parts.push('Independent Jamendo recording');
  }

  if (instruments.length > 0) {
    parts.push(`featuring ${instruments.join(' and ')}`);
  }
  if (moodTags.length > 0) {
    parts.push(`with a ${moodTags.join(', ')} character`);
  }
  if (speed && vocal) {
    parts.push(`(${speed} tempo, ${vocal})`);
  } else if (speed) {
    parts.push(`(${speed} tempo)`);
  }

  return `${parts.join(' ')} by ${track.artist_name}.`;
}

const ARCHETYPE_ORDER: PlanetArchetype[] = [
  'gas-giant',
  'terrestrial',
  'crystalline',
  'ethereal',
];

function assignPlanetArchetype(
  track: JamendoTrack,
  allTags: string[],
  regionName: string,
  idx: number,
  hash: number,
  archetypeCounts: Record<PlanetArchetype, number>
): PlanetArchetype {
  const uniqueTags = Array.from(new Set(allTags));

  let gasScore = 0;
  let terrestrialScore = 0;
  let crystallineScore = 0;
  let etherealScore = 0;

  for (const t of uniqueTags) {
    if (
      [
        'ambient',
        'chillout',
        'dreamy',
        'meditation',
        'newage',
        'space',
        'atmospheric',
        'downtempo',
      ].includes(t)
    ) {
      etherealScore += 2;
    }
    if (
      [
        'electronic',
        'synthwave',
        'electro',
        'techno',
        'house',
        'club',
        'experimental',
        'metal',
      ].includes(t)
    ) {
      crystallineScore += 2;
    }
    if (
      [
        'acoustic',
        'folk',
        'indie',
        'guitar',
        'piano',
        'singer-songwriter',
        'pop',
        'rock',
        'world',
        'jazz',
      ].includes(t)
    ) {
      terrestrialScore += 2;
    }
    if (
      [
        'cinematic',
        'soundtrack',
        'orchestral',
        'classical',
        'film',
        'dark',
        'lofi',
        'hiphop',
        'dance',
      ].includes(t)
    ) {
      gasScore += 2;
    }
  }

  if (regionName === 'Velvet Nebula') etherealScore += 1;
  if (regionName === 'Neon Horizon') crystallineScore += 1;
  if (regionName === 'Organic Drift') terrestrialScore += 1;
  if (regionName === 'Cinematic Core') gasScore += 1;

  // Cap raw tag scores and apply occupancy balancing so all 4 archetypes appear prominently
  gasScore = Math.min(gasScore, 4) - archetypeCounts['gas-giant'] * 3.0;
  terrestrialScore =
    Math.min(terrestrialScore, 4) - archetypeCounts.terrestrial * 3.0;
  crystallineScore =
    Math.min(crystallineScore, 4) - archetypeCounts.crystalline * 3.0;
  etherealScore =
    Math.min(etherealScore, 4) - archetypeCounts.ethereal * 3.0;

  const cycleArchetype = ARCHETYPE_ORDER[(idx + (hash % 2)) % 4];
  if (cycleArchetype === 'gas-giant') gasScore += 2.2;
  if (cycleArchetype === 'terrestrial') terrestrialScore += 2.2;
  if (cycleArchetype === 'crystalline') crystallineScore += 2.2;
  if (cycleArchetype === 'ethereal') etherealScore += 2.2;

  const scores: Array<{ type: PlanetArchetype; score: number }> = [
    { type: 'gas-giant', score: gasScore },
    { type: 'terrestrial', score: terrestrialScore },
    { type: 'crystalline', score: crystallineScore },
    { type: 'ethereal', score: etherealScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  const chosen = scores[0].type;
  archetypeCounts[chosen] = (archetypeCounts[chosen] || 0) + 1;
  return chosen;
}

function chooseRingStyle(
  archetype: PlanetArchetype,
  hash: number,
  isJourney: boolean
): 'none' | 'thin' | 'double' | 'halo' {
  if (isJourney) {
    return hash % 2 === 0 ? 'thin' : 'double';
  }
  const roll = hash % 100;
  if (archetype === 'gas-giant') {
    if (roll < 42) return 'double';
    if (roll < 78) return 'thin';
    return 'none';
  }
  if (archetype === 'crystalline') {
    if (roll < 32) return 'thin';
    if (roll < 48) return 'halo';
    return 'none';
  }
  if (archetype === 'ethereal') {
    if (roll < 36) return 'halo';
    return 'none';
  }
  // Terrestrial worlds only rarely have a thin ring
  return roll < 18 ? 'thin' : 'none';
}

export function buildUniverseFromTracks(
  tracks: JamendoTrack[],
  aiReasonsById: Record<string, string> = {},
  atmosphere: UniverseAtmosphere = DEFAULT_ATMOSPHERE,
  isJourney = false,
  journeyMetaByIndex?: Array<{ stageTitle: string; stageDescription: string; color?: string }>
): {
  planets: SongPlanet[];
  constellations: ConstellationEdge[];
} {
  const placedPositions: Array<[number, number, number]> = [];
  const regionCounts: Record<string, number> = {};
  const archetypeCounts: Record<PlanetArchetype, number> = {
    'gas-giant': 0,
    terrestrial: 0,
    crystalline: 0,
    ethereal: 0,
  };
  const MIN_DISTANCE = 7.8;

  const planets: SongPlanet[] = tracks.map((track, idx) => {
    const allTags = extractTrackTags(track);
    const region = assignRegion(track, allTags, regionCounts);
    const hash = deterministicHash(track.id + ':' + idx);
    const archetype = assignPlanetArchetype(
      track,
      allTags,
      region.name,
      idx,
      hash,
      archetypeCounts
    );
    const textureVariant = hash % 3;
    const paletteList = ARCHETYPE_PALETTES[archetype];
    const palette = paletteList[textureVariant % paletteList.length];

    let pos: [number, number, number];

    if (isJourney) {
      // Arrange journey planets along an elevated 3D cosmic arc with clear depth progression
      const total = Math.max(tracks.length - 1, 1);
      const t = idx / total; // 0 .. 1
      const angle = (t - 0.5) * Math.PI * 0.88;
      const arcRadius = 21;
      const x = Math.sin(angle) * arcRadius;
      const z = -Math.cos(angle) * arcRadius * 0.52 + 2.5;
      const y =
        Math.sin(t * Math.PI) * 4.2 - 0.8 + ((hash % 100) / 100 - 0.5) * 1.4;
      pos = [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))];
    } else {
      // Cluster around the assigned region centroid with wide 3D volume & multi-plane Z depth
      const goldenAngle = idx * 2.399963229728653 + (hash % 17) * 0.15;
      const localRadius = 4.4 + (idx % 5) * 2.15 + ((hash % 100) / 100) * 1.9;
      const depthLayer = ((idx % 6) - 2.5) * 2.6;

      let candidateX =
        region.center[0] * 0.92 + Math.cos(goldenAngle) * localRadius;
      let candidateY =
        region.center[1] * 0.85 +
        (((hash >> 4) % 100) / 100 - 0.5) * 6.8;
      let candidateZ =
        region.center[2] * 0.9 +
        Math.sin(goldenAngle) * localRadius +
        depthLayer;

      // Enforce generous minimum separation so planets and their rings never overlap
      for (let attempt = 0; attempt < 32; attempt++) {
        let collision = false;
        for (const existing of placedPositions) {
          const dx = candidateX - existing[0];
          const dy = candidateY - existing[1];
          const dz = candidateZ - existing[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < MIN_DISTANCE) {
            collision = true;
            break;
          }
        }
        if (!collision) break;
        const stepAngle = goldenAngle + attempt * 1.15;
        candidateX += Math.cos(stepAngle) * 2.6;
        candidateZ += Math.sin(stepAngle) * 2.8;
        candidateY += (attempt % 2 === 0 ? 1 : -1) * 1.15;

        // Keep within a well-composed 3D observatory volume
        candidateX = Math.max(-22.5, Math.min(22.5, candidateX));
        candidateY = Math.max(-7.6, Math.min(7.6, candidateY));
        candidateZ = Math.max(-21.5, Math.min(11.5, candidateZ));
      }

      pos = [
        Number(candidateX.toFixed(2)),
        Number(candidateY.toFixed(2)),
        Number(candidateZ.toFixed(2)),
      ];
    }

    placedPositions.push(pos);

    const orbitRadius = Math.sqrt(
      pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]
    );
    // Physically balanced planet radii (0.52 - 0.82 units) so planets feel like celestial bodies in vast space
    const baseSize =
      archetype === 'gas-giant'
        ? 0.68 + ((hash % 15) / 100)
        : archetype === 'terrestrial'
        ? 0.54 + ((hash % 16) / 100)
        : archetype === 'crystalline'
        ? 0.52 + ((hash % 15) / 100)
        : 0.58 + ((hash % 16) / 100);
    const planetSize = Number(
      (isJourney ? Math.min(0.86, baseSize + 0.12) : baseSize).toFixed(2)
    );
    const orbitSpeed = Number((0.06 + ((hash % 24) / 1000)).toFixed(3));
    const ringStyle = chooseRingStyle(archetype, hash, isJourney);

    const tiltX = Number((((hash % 40) - 20) * 0.018).toFixed(3));
    const tiltZ = Number(((((hash >> 5) % 40) - 20) * 0.02).toFixed(3));

    const journeyStepMeta =
      isJourney && journeyMetaByIndex ? journeyMetaByIndex[idx] : undefined;

    return {
      id: track.id,
      track,
      position: pos,
      orbitRadius: Number(orbitRadius.toFixed(2)),
      orbitSpeed,
      planetSize,
      primaryColor: journeyStepMeta?.color || palette.primary,
      secondaryColor: palette.secondary,
      surfaceColor: palette.surface,
      atmosphereColor: palette.atmosphere,
      archetype,
      archetypeLabel: ARCHETYPE_LABELS[archetype],
      textureVariant,
      axialTilt: [tiltX, 0, tiltZ],
      hasMoon: archetype === 'gas-giant' || (hash % 5 === 0 && !isJourney),
      ringStyle,
      region: region.name,
      similarityScore: Number((0.96 - idx * 0.025).toFixed(2)),
      aiReason:
        aiReasonsById[track.id] ||
        journeyStepMeta?.stageDescription ||
        buildDefaultReason(track, allTags),
      allTags,
      journeyStepIndex: isJourney ? idx + 1 : undefined,
      journeyStageTitle: journeyStepMeta?.stageTitle,
      journeyStageDescription: journeyStepMeta?.stageDescription,
    };
  });

  // Multi-pass force-directed 3D & screen-space repulsion so no two planets ever crowd or overlap
  if (!isJourney && planets.length > 1) {
    for (let iter = 0; iter < 85; iter++) {
      for (let i = 0; i < planets.length; i++) {
        for (let j = i + 1; j < planets.length; j++) {
          const pi = planets[i].position;
          const pj = planets[j].position;
          let dx = pi[0] - pj[0];
          let dy = pi[1] - pj[1];
          let dz = pi[2] - pj[2];
          const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist3D < MIN_DISTANCE) {
            if (dist3D < 0.01) {
              dx = (i % 2 === 0 ? 1 : -1) * 0.5;
              dy = (j % 2 === 0 ? 1 : -1) * 0.35;
              dz = 0.5;
            }
            const safeDist = Math.max(dist3D, 0.1);
            const push = ((MIN_DISTANCE - safeDist) / safeDist) * 0.52;
            pi[0] += dx * push;
            pi[1] += dy * push * 0.72;
            pi[2] += dz * push;
            pj[0] -= dx * push;
            pj[1] -= dy * push * 0.72;
            pj[2] -= dz * push;
          }

          // Also prevent 2D screen-space (X/Y) occlusion from the overview camera
          const distXY = Math.sqrt(dx * dx + dy * dy);
          if (distXY < 3.6) {
            const safeXY = Math.max(distXY, 0.1);
            const pushXY = ((3.6 - safeXY) / safeXY) * 0.25;
            pi[0] += dx * pushXY;
            pi[1] += dy * pushXY;
            pj[0] -= dx * pushXY;
            pj[1] -= dy * pushXY;
          }
        }
      }

      for (const p of planets) {
        p.position[0] = Number(
          Math.max(-24.5, Math.min(24.5, p.position[0])).toFixed(2)
        );
        p.position[1] = Number(
          Math.max(-8.2, Math.min(8.2, p.position[1])).toFixed(2)
        );
        p.position[2] = Number(
          Math.max(-23.0, Math.min(12.0, p.position[2])).toFixed(2)
        );
        p.orbitRadius = Number(
          Math.sqrt(
            p.position[0] * p.position[0] +
              p.position[1] * p.position[1] +
              p.position[2] * p.position[2]
          ).toFixed(2)
        );
      }
    }
  }

  // Build constellations based on real shared Jamendo metadata
  const constellations: ConstellationEdge[] = [];

  if (isJourney && planets.length > 1) {
    for (let i = 0; i < planets.length - 1; i++) {
      const a = planets[i];
      const b = planets[i + 1];
      const shared = a.allTags.filter((t) => b.allTags.includes(t));
      constellations.push({
        id: `journey-${a.id}-${b.id}`,
        fromTrackId: a.id,
        toTrackId: b.id,
        sharedAttributes:
          shared.length > 0 ? shared.slice(0, 4) : ['journey progression'],
        strength: 1.0,
        isJourneyRoute: true,
      });
    }
  }

  // Also add metadata similarity constellation links
  const edgeSet = new Set<string>(
    constellations.map((c) => `${c.fromTrackId}:${c.toTrackId}`)
  );

  for (let i = 0; i < planets.length; i++) {
    const a = planets[i];
    const candidates: Array<{
      target: SongPlanet;
      shared: string[];
      score: number;
    }> = [];

    for (let j = 0; j < planets.length; j++) {
      if (i === j) continue;
      const b = planets[j];
      const shared = a.allTags.filter((tag) => b.allTags.includes(tag));
      const sameRegion = a.region === b.region;
      const dx = a.position[0] - b.position[0];
      const dy = a.position[1] - b.position[1];
      const dz = a.position[2] - b.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (shared.length >= 2 || (shared.length >= 1 && sameRegion)) {
        const score =
          shared.length * 2 + (sameRegion ? 1.5 : 0) - dist * 0.05;
        candidates.push({ target: b, shared, score });
      }
    }

    candidates.sort((x, y) => y.score - x.score);
    const maxLinksForPlanet = isJourney ? 1 : 2;

    for (const cand of candidates.slice(0, maxLinksForPlanet)) {
      const key1 = `${a.id}:${cand.target.id}`;
      const key2 = `${cand.target.id}:${a.id}`;
      if (!edgeSet.has(key1) && !edgeSet.has(key2)) {
        edgeSet.add(key1);
        constellations.push({
          id: `constellation-${a.id}-${cand.target.id}`,
          fromTrackId: a.id,
          toTrackId: cand.target.id,
          sharedAttributes:
            cand.shared.length > 0 ? cand.shared.slice(0, 3) : [a.region],
          strength: Math.min(1, Math.max(0.35, cand.shared.length * 0.28)),
          isJourneyRoute: false,
        });
      }
    }
  }

  return { planets, constellations };
}
