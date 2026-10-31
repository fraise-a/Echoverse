import {
  JamendoAcousticElectric,
  JamendoSearchParams,
  JamendoSpeed,
  JamendoTrack,
  JamendoVocalInstrumental,
} from '@/types/echoverse';

const JAMENDO_BASE_URL = 'https://api.jamendo.com/v3.0/tracks/';

const VALID_SPEEDS = new Set<JamendoSpeed>([
  'verylow',
  'low',
  'medium',
  'high',
  'veryhigh',
]);

const VALID_VOCAL_INSTRUMENTAL = new Set<JamendoVocalInstrumental>([
  'vocal',
  'instrumental',
]);

const VALID_ACOUSTIC_ELECTRIC = new Set<JamendoAcousticElectric>([
  'acoustic',
  'electric',
]);

// Curated map of common descriptive terms to canonical Jamendo tag slugs
const TAG_SYNONYM_MAP: Record<string, string> = {
  'lo-fi': 'lofi',
  'lo fi': 'lofi',
  'sci-fi': 'space',
  'scifi': 'space',
  'cyberpunk': 'synthwave',
  'neon': 'synthwave',
  'tokyo': 'electronic',
  'midnight': 'chillout',
  'night': 'downtempo',
  'rain': 'ambient',
  'rainy': 'ambient',
  'cosmos': 'space',
  'cosmic': 'space',
  'galaxy': 'space',
  'floating': 'ambient',
  'ethereal': 'dreamy',
  'nostalgic': 'chillout',
  'mysterious': 'dark',
  'mystery': 'dark',
  'peaceful': 'relaxing',
  'calm': 'relaxing',
  'serene': 'meditation',
  'upbeat': 'energetic',
  'club': 'house',
  'dance': 'electronic',
  'film': 'soundtrack',
  'movie': 'cinematic',
  'epic': 'cinematic',
  'beats': 'hiphop',
};

interface CacheEntry {
  timestamp: number;
  tracks: JamendoTrack[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const queryCache = new Map<string, CacheEntry>();

export function getJamendoClientId(): string {
  const clientId = process.env.JAMENDO_CLIENT_ID?.trim();
  if (!clientId || clientId === 'YOUR_JAMENDO_CLIENT_ID') {
    throw new Error(
      'Missing or placeholder JAMENDO_CLIENT_ID environment variable in .env.local.'
    );
  }
  return clientId;
}

// Non-musical stopwords to exclude if raw prompt tokens are passed in fallback mode
const STOPWORD_TAGS = new Set<string>([
  'make',
  'this',
  'feel',
  'feels',
  'like',
  'want',
  'give',
  'something',
  'that',
  'with',
  'from',
  'into',
  'more',
  'less',
  'very',
  'some',
  'music',
  'song',
  'songs',
  'track',
  'tracks',
  'find',
  'show',
  'take',
  'the',
  'and',
  'for',
  'not',
  'but',
  'you',
  'your',
  'through',
  'walking',
  'floating',
  'somewhere',
  'completely',
  'unexpected',
]);

export function sanitizeTagList(rawTags?: string[]): string[] {
  if (!rawTags || !Array.isArray(rawTags)) return [];
  const cleaned: string[] = [];
  for (const raw of rawTags) {
    const lower = raw.toLowerCase().trim();
    if (!lower || STOPWORD_TAGS.has(lower)) continue;
    const mapped = TAG_SYNONYM_MAP[lower] || lower.replace(/[^a-z0-9-]/g, '');
    if (
      mapped &&
      mapped.length >= 2 &&
      !STOPWORD_TAGS.has(mapped) &&
      !cleaned.includes(mapped)
    ) {
      cleaned.push(mapped);
    }
  }
  return cleaned.slice(0, 6);
}

export function validateJamendoParams(
  input: Partial<JamendoSearchParams>
): JamendoSearchParams {
  const validated: JamendoSearchParams = {};

  if (input.search && typeof input.search === 'string') {
    const cleanSearch = input.search.trim().slice(0, 80);
    if (cleanSearch) validated.search = cleanSearch;
  }

  const tags = sanitizeTagList(input.tags);
  if (tags.length > 0) validated.tags = tags;

  const fuzzytags = sanitizeTagList(input.fuzzytags);
  if (fuzzytags.length > 0) validated.fuzzytags = fuzzytags;

  if (input.speed && VALID_SPEEDS.has(input.speed)) {
    validated.speed = input.speed;
  }

  if (
    input.vocalinstrumental &&
    VALID_VOCAL_INSTRUMENTAL.has(input.vocalinstrumental)
  ) {
    validated.vocalinstrumental = input.vocalinstrumental;
  }

  if (
    input.acousticelectric &&
    VALID_ACOUSTIC_ELECTRIC.has(input.acousticelectric)
  ) {
    validated.acousticelectric = input.acousticelectric;
  }

  if (input.groupby === 'artist_id' || input.groupby === 'album_id') {
    validated.groupby = input.groupby;
  } else {
    validated.groupby = 'artist_id';
  }

  if (
    input.type === 'single' ||
    input.type === 'albumtrack' ||
    input.type === 'single+albumtrack'
  ) {
    validated.type = input.type;
  } else {
    validated.type = 'single+albumtrack';
  }

  if (
    input.boost === 'popularity_total' ||
    input.boost === 'popularity_month' ||
    input.boost === 'popularity_week' ||
    input.boost === 'buzzrate'
  ) {
    validated.boost = input.boost;
  } else {
    validated.boost = 'popularity_month';
  }

  const limit = Number(input.limit);
  validated.limit =
    Number.isFinite(limit) && limit >= 1 && limit <= 50 ? Math.floor(limit) : 18;

  return validated;
}

async function executeJamendoQuery(
  params: JamendoSearchParams
): Promise<JamendoTrack[]> {
  const clientId = getJamendoClientId();
  const url = new URL(JAMENDO_BASE_URL);

  url.searchParams.set('client_id', clientId);
  url.searchParams.set('format', 'json');
  url.searchParams.set('include', 'musicinfo+licenses');
  url.searchParams.set('audioformat', 'mp32');
  url.searchParams.set('imagesize', '500');
  const requestLimit = Math.min(50, Math.max((params.limit ?? 18) * 2, 30));
  url.searchParams.set('limit', String(requestLimit));

  // Note: Jamendo v3.0 returns 0 results if `groupby` is combined with `fuzzytags`.
  // Only send `groupby` when `fuzzytags` is not present; otherwise diversify artists in memory.
  if (params.groupby && (!params.fuzzytags || params.fuzzytags.length === 0)) {
    url.searchParams.set('groupby', params.groupby);
  }
  if (params.type) {
    url.searchParams.set('type', params.type);
  }
  if (params.boost) {
    url.searchParams.set('boost', params.boost);
  }
  if (params.search) {
    url.searchParams.set('search', params.search);
  }
  if (params.tags && params.tags.length > 0) {
    url.searchParams.set('tags', params.tags.join('+'));
  }
  if (params.fuzzytags && params.fuzzytags.length > 0) {
    url.searchParams.set('fuzzytags', params.fuzzytags.join('+'));
  }
  if (params.speed) {
    url.searchParams.set('speed', params.speed);
  }
  if (params.vocalinstrumental) {
    url.searchParams.set('vocalinstrumental', params.vocalinstrumental);
  }
  if (params.acousticelectric) {
    url.searchParams.set('acousticelectric', params.acousticelectric);
  }

  // Build cache key without exposing client_id
  const cacheUrl = new URL(url.toString());
  cacheUrl.searchParams.delete('client_id');
  const cacheKey = cacheUrl.searchParams.toString();

  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.tracks;
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(
      `Jamendo API request failed with HTTP status ${response.status}`
    );
  }

  const data = await response.json();
  if (data?.headers?.status && data.headers.status !== 'success') {
    throw new Error(
      `Jamendo API error: ${data.headers.error_message || 'Unknown error'}`
    );
  }

  const rawResults: JamendoTrack[] = Array.isArray(data?.results)
    ? data.results
    : [];

  // Filter strictly to tracks that have a real streaming audio URL
  const validTracks = rawResults.filter(
    (track) =>
      track &&
      typeof track.id === 'string' &&
      typeof track.name === 'string' &&
      typeof track.audio === 'string' &&
      track.audio.startsWith('http')
  );

  // Diversify by artist_id first so one artist doesn't dominate the constellation
  const targetLimit = params.limit ?? 18;
  const distinctArtistTracks: JamendoTrack[] = [];
  const overflowTracks: JamendoTrack[] = [];
  const seenArtists = new Set<string>();

  for (const track of validTracks) {
    if (!seenArtists.has(track.artist_id)) {
      seenArtists.add(track.artist_id);
      distinctArtistTracks.push(track);
    } else {
      overflowTracks.push(track);
    }
  }

  const finalTracks = [...distinctArtistTracks, ...overflowTracks].slice(
    0,
    targetLimit
  );

  queryCache.set(cacheKey, {
    timestamp: Date.now(),
    tracks: finalTracks,
  });

  return finalTracks;
}

export interface JamendoDiscoveryResult {
  tracks: JamendoTrack[];
  criteriaUsed: JamendoSearchParams;
  relaxedSearchUsed: boolean;
  relaxationExplanation?: string;
}

/**
 * Searches Jamendo with intelligent, transparent relaxation if strict filters
 * yield fewer than minDesired tracks.
 */
export async function searchJamendoTracksWithFallback(
  rawParams: Partial<JamendoSearchParams>,
  minDesired = 8
): Promise<JamendoDiscoveryResult> {
  const initialParams = validateJamendoParams(rawParams);

  // Attempt 1: Exact validated parameters
  let tracks = await executeJamendoQuery(initialParams);
  if (tracks.length >= minDesired) {
    return {
      tracks,
      criteriaUsed: initialParams,
      relaxedSearchUsed: false,
    };
  }

  // Merge unique tracks helper
  const seenIds = new Set(tracks.map((t) => t.id));
  const mergeTracks = (more: JamendoTrack[]) => {
    for (const t of more) {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        tracks.push(t);
      }
    }
  };

  // Attempt 2: Convert strict `tags` (AND) to `fuzzytags` (OR) and drop restrictive free-text `search`
  const combinedFuzzy = Array.from(
    new Set([...(initialParams.fuzzytags || []), ...(initialParams.tags || [])])
  );

  const step2Params: JamendoSearchParams = {
    ...initialParams,
    tags: undefined,
    search: combinedFuzzy.length > 0 ? undefined : initialParams.search,
    fuzzytags:
      combinedFuzzy.length > 0
        ? combinedFuzzy
        : ['ambient', 'electronic', 'chillout', 'cinematic'],
  };

  const step2Tracks = await executeJamendoQuery(step2Params);
  mergeTracks(step2Tracks);

  if (tracks.length >= minDesired) {
    return {
      tracks: tracks.slice(0, initialParams.limit || 18),
      criteriaUsed: step2Params,
      relaxedSearchUsed: true,
      relaxationExplanation:
        'Broadened strict multi-tag combinations to fuzzy tag matching to surface more independent tracks.',
    };
  }

  // Attempt 3: Relax speed and acousticelectric constraints while keeping fuzzytags & vocal/instrumental
  const step3Params: JamendoSearchParams = {
    fuzzytags: step2Params.fuzzytags,
    vocalinstrumental: initialParams.vocalinstrumental,
    groupby: 'artist_id',
    type: 'single+albumtrack',
    boost: 'popularity_month',
    limit: initialParams.limit || 18,
  };

  const step3Tracks = await executeJamendoQuery(step3Params);
  mergeTracks(step3Tracks);

  if (tracks.length >= minDesired) {
    return {
      tracks: tracks.slice(0, initialParams.limit || 18),
      criteriaUsed: step3Params,
      relaxedSearchUsed: true,
      relaxationExplanation:
        'Relaxed tempo and acoustic/electric filters while preserving mood tags to ensure a full constellation of tracks.',
    };
  }

  // Attempt 4: Broad atmospheric fallback so the universe is never empty
  const step4Params: JamendoSearchParams = {
    fuzzytags: ['electronic', 'ambient', 'chillout', 'indie', 'cinematic'],
    groupby: 'artist_id',
    type: 'single+albumtrack',
    boost: 'popularity_month',
    limit: initialParams.limit || 18,
  };

  const step4Tracks = await executeJamendoQuery(step4Params);
  mergeTracks(step4Tracks);

  return {
    tracks: tracks.slice(0, initialParams.limit || 18),
    criteriaUsed: step4Params,
    relaxedSearchUsed: true,
    relaxationExplanation:
      'No exact matches were found for all specific constraints; expanded discovery to related atmospheric independent tracks on Jamendo.',
  };
}
