import {
  ConstellationEdge,
  JamendoTrack,
  SongPlanet,
  UniverseAtmosphere,
} from '@/types/echoverse';

export const DEFAULT_ATMOSPHERE: UniverseAtmosphere = {
  name: 'Celestial Resonance',
  description:
    'An expansive midnight galaxy of independent electronic, ambient, and cinematic soundscapes.',
  primaryColor: '#7c3aed',
  secondaryColor: '#06b6d4',
  accentColor: '#ec4899',
  fogColor: '#050510',
  nebulaIntensity: 0.75,
  particleSpeed: 0.45,
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
    center: [15, 3.5, -9],
    primaryColor: '#22d3ee',
    secondaryColor: '#7c3aed',
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
    center: [-15, 4.5, -9],
    primaryColor: '#c4b5fd',
    secondaryColor: '#9333ea',
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
    center: [-13, -3.5, 11],
    primaryColor: '#f472b6',
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
    center: [13, -3.0, 11],
    primaryColor: '#e879f9',
    secondaryColor: '#6366f1',
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

function assignRegion(track: JamendoTrack, allTags: string[]): RegionDefinition {
  let bestRegion = REGIONS[0];
  let bestScore = -1;

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
    if (score > bestScore) {
      bestScore = score;
      bestRegion = region;
    }
  }

  if (bestScore <= 0) {
    const idx = deterministicHash(track.id) % REGIONS.length;
    return REGIONS[idx];
  }
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

const RING_STYLES: Array<'none' | 'thin' | 'double' | 'halo'> = [
  'none',
  'thin',
  'double',
  'halo',
];

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
  const MIN_DISTANCE = 5.2;

  const planets: SongPlanet[] = tracks.map((track, idx) => {
    const allTags = extractTrackTags(track);
    const region = assignRegion(track, allTags);
    const hash = deterministicHash(track.id + ':' + idx);

    let pos: [number, number, number];

    if (isJourney) {
      // Arrange journey planets along an elevated cosmic arc from left to right
      const total = Math.max(tracks.length - 1, 1);
      const t = idx / total; // 0 .. 1
      const angle = (t - 0.5) * Math.PI * 0.85;
      const arcRadius = 22;
      const x = Math.sin(angle) * arcRadius;
      const z = -Math.cos(angle) * arcRadius * 0.55 + 4;
      const y = Math.sin(t * Math.PI) * 5 - 1 + ((hash % 100) / 100 - 0.5) * 1.5;
      pos = [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))];
    } else {
      // Cluster around the assigned region centroid with golden-angle spiral distribution
      const goldenAngle = idx * 2.399963229728653;
      const localRadius = 4.2 + (idx % 5) * 2.4 + ((hash % 100) / 100) * 1.8;
      let candidateX =
        region.center[0] * 0.65 + Math.cos(goldenAngle) * localRadius;
      let candidateY =
        region.center[1] * 0.65 +
        (((hash >> 4) % 100) / 100 - 0.5) * 7.5;
      let candidateZ =
        region.center[2] * 0.65 + Math.sin(goldenAngle) * localRadius;

      // Enforce minimum separation so planets never overlap
      for (let attempt = 0; attempt < 16; attempt++) {
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
        candidateX += Math.cos(goldenAngle + attempt) * 2.5;
        candidateZ += Math.sin(goldenAngle + attempt) * 2.5;
        candidateY += (attempt % 2 === 0 ? 1 : -1) * 1.2;
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
    const planetSize = Number((1.05 + ((hash % 45) / 100)).toFixed(2));
    const orbitSpeed = Number((0.08 + ((hash % 30) / 1000)).toFixed(3));
    const ringStyle = RING_STYLES[hash % RING_STYLES.length];

    const journeyStepMeta =
      isJourney && journeyMetaByIndex ? journeyMetaByIndex[idx] : undefined;

    return {
      id: track.id,
      track,
      position: pos,
      orbitRadius: Number(orbitRadius.toFixed(2)),
      orbitSpeed,
      planetSize: isJourney ? 1.35 : planetSize,
      primaryColor:
        journeyStepMeta?.color ||
        (idx % 3 === 0 ? atmosphere.primaryColor : region.primaryColor),
      secondaryColor:
        idx % 2 === 0 ? atmosphere.secondaryColor : region.secondaryColor,
      ringStyle: isJourney ? 'halo' : ringStyle,
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
