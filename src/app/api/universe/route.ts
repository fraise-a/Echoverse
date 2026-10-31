import { NextRequest, NextResponse } from 'next/server';
import {
  getJamendoClientId,
  searchJamendoTracksWithFallback,
} from '@/lib/jamendo/client';
import {
  buildUniverseFromTracks,
  DEFAULT_ATMOSPHERE,
} from '@/lib/jamendo/universe-builder';
import { isGeminiConfigured } from '@/lib/gemini/config';
import { DiscoveryResponse, JamendoSearchParams } from '@/types/echoverse';

export async function GET(request: NextRequest) {
  try {
    // Verify Jamendo credential exists
    getJamendoClientId();

    const { searchParams } = new URL(request.url);
    const fuzzyParam = searchParams.get('fuzzytags');
    const search = searchParams.get('search') || undefined;
    const speed = (searchParams.get('speed') || undefined) as JamendoSearchParams['speed'];
    const vocalinstrumental = (searchParams.get('vocalinstrumental') ||
      undefined) as JamendoSearchParams['vocalinstrumental'];
    const acousticelectric = (searchParams.get('acousticelectric') ||
      undefined) as JamendoSearchParams['acousticelectric'];

    const initialCriteria: Partial<JamendoSearchParams> = {
      fuzzytags: fuzzyParam
        ? fuzzyParam.split(',').map((s) => s.trim()).filter(Boolean)
        : ['electronic', 'ambient', 'synthwave', 'chillout', 'cinematic'],
      search,
      speed,
      vocalinstrumental,
      acousticelectric,
      limit: 18,
    };

    const result = await searchJamendoTracksWithFallback(initialCriteria, 10);
    const { planets, constellations } = buildUniverseFromTracks(
      result.tracks,
      {},
      DEFAULT_ATMOSPHERE,
      false
    );

    const payload: DiscoveryResponse = {
      querySummary: search
        ? `Catalogue: ${search}`
        : fuzzyParam
        ? `Constellation: ${fuzzyParam}`
        : 'Celestial Resonance',
      guideMessage:
        'Welcome to Echoverse. Where do you want your music to take you? Explore the glowing song planets around you, describe a feeling or place, speak to your guide, or show me your world.',
      interpretedCriteria: result.criteriaUsed,
      relaxedSearchUsed: result.relaxedSearchUsed,
      relaxationExplanation: result.relaxationExplanation,
      atmosphere: DEFAULT_ATMOSPHERE,
      planets,
      constellations,
      aiAvailable: isGeminiConfigured(),
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to load initial musical universe from Jamendo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
