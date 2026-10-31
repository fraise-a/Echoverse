import { NextRequest, NextResponse } from 'next/server';
import { planMusicalJourneyBlueprint } from '@/lib/gemini/service';
import { isGeminiConfigured } from '@/lib/gemini/config';
import {
  getJamendoClientId,
  searchJamendoTracksWithFallback,
} from '@/lib/jamendo/client';
import { buildUniverseFromTracks } from '@/lib/jamendo/universe-builder';
import {
  DiscoveryResponse,
  JamendoTrack,
  JourneyStep,
  MusicalJourney,
} from '@/types/echoverse';

export async function POST(request: NextRequest) {
  try {
    getJamendoClientId();

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY is required in .env.local to generate AI musical journeys.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { originPrompt, destinationPrompt } = body as {
      originPrompt?: string;
      destinationPrompt?: string;
    };

    if (!originPrompt || !originPrompt.trim()) {
      return NextResponse.json(
        {
          error:
            'Please provide a journey description or starting atmosphere.',
        },
        { status: 400 }
      );
    }

    const blueprint = await planMusicalJourneyBlueprint(
      originPrompt.trim(),
      destinationPrompt?.trim()
    );

    const selectedTracks: JamendoTrack[] = [];
    const usedTrackIds = new Set<string>();
    const usedArtistIds = new Set<string>();
    const journeySteps: JourneyStep[] = [];

    for (let i = 0; i < blueprint.stages.length; i++) {
      const stage = blueprint.stages[i];
      const searchRes = await searchJamendoTracksWithFallback(
        {
          ...stage.criteria,
          limit: 12,
        },
        3
      );

      // Pick the first real track whose ID and artist haven't been used yet
      let chosen: JamendoTrack | undefined = searchRes.tracks.find(
        (t) => !usedTrackIds.has(t.id) && !usedArtistIds.has(t.artist_id)
      );
      if (!chosen) {
        chosen = searchRes.tracks.find((t) => !usedTrackIds.has(t.id));
      }
      if (!chosen && searchRes.tracks.length > 0) {
        chosen = searchRes.tracks[0];
      }

      if (chosen) {
        usedTrackIds.add(chosen.id);
        usedArtistIds.add(chosen.artist_id);
        selectedTracks.push(chosen);
        journeySteps.push({
          stepNumber: i + 1,
          stageTitle: stage.stageTitle,
          stageDescription: stage.stageDescription,
          atmosphereColor: stage.atmosphereColor,
          track: chosen,
          planetId: chosen.id,
          searchCriteriaUsed: searchRes.criteriaUsed,
        });
      }
    }

    if (selectedTracks.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not retrieve Jamendo tracks for this journey. Please try a different prompt.',
        },
        { status: 404 }
      );
    }

    const journeyMeta = journeySteps.map((s) => ({
      stageTitle: `Step ${s.stepNumber}: ${s.stageTitle}`,
      stageDescription: s.stageDescription,
      color: s.atmosphereColor,
    }));

    const { planets, constellations } = buildUniverseFromTracks(
      selectedTracks,
      {},
      blueprint.atmosphere,
      true,
      journeyMeta
    );

    const journey: MusicalJourney = {
      id: `journey-${Date.now()}`,
      title: blueprint.title,
      originDescription: blueprint.originDescription,
      destinationDescription: blueprint.destinationDescription,
      narrativeOverview: blueprint.narrativeOverview,
      steps: journeySteps,
      createdAt: new Date().toISOString(),
    };

    const response: DiscoveryResponse = {
      querySummary: `Journey: ${blueprint.title}`,
      guideMessage: blueprint.narrativeOverview,
      interpretedCriteria: journeySteps[0]?.searchCriteriaUsed || {},
      relaxedSearchUsed: false,
      atmosphere: blueprint.atmosphere,
      planets,
      constellations,
      journey,
      aiAvailable: true,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to construct musical journey.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
