import { NextRequest, NextResponse } from 'next/server';
import { interpretMultimodalDiscovery } from '@/lib/gemini/service';
import { isGeminiConfigured } from '@/lib/gemini/config';
import {
  getJamendoClientId,
  sanitizeTagList,
  searchJamendoTracksWithFallback,
} from '@/lib/jamendo/client';
import {
  buildUniverseFromTracks,
  DEFAULT_ATMOSPHERE,
} from '@/lib/jamendo/universe-builder';
import { DiscoveryResponse, JamendoSearchParams } from '@/types/echoverse';

export async function POST(request: NextRequest) {
  try {
    getJamendoClientId();

    const body = await request.json();
    const {
      prompt,
      imageBase64,
      imageMimeType,
      audioBase64,
      audioMimeType,
      conversationHistory,
      currentCriteria,
    } = body as {
      prompt?: string;
      imageBase64?: string;
      imageMimeType?: string;
      audioBase64?: string;
      audioMimeType?: string;
      conversationHistory?: Array<{ role: string; text: string }>;
      currentCriteria?: JamendoSearchParams;
    };

    if (!prompt && !imageBase64 && !audioBase64) {
      return NextResponse.json(
        {
          error:
            'Please provide a text description, spoken audio recording, or image to explore.',
        },
        { status: 400 }
      );
    }

    if (!isGeminiConfigured()) {
      // Honest degraded mode when GEMINI_API_KEY is missing: basic Jamendo tag discovery
      const words = (prompt || '').toLowerCase().split(/\s+/);
      const fallbackTags = sanitizeTagList(words);
      const criteria: Partial<JamendoSearchParams> = {
        fuzzytags:
          fallbackTags.length > 0
            ? fallbackTags
            : ['ambient', 'electronic', 'chillout'],
        search: fallbackTags.length === 0 ? prompt : undefined,
        limit: 18,
      };
      const jamendoRes = await searchJamendoTracksWithFallback(criteria, 8);
      const { planets, constellations } = buildUniverseFromTracks(
        jamendoRes.tracks,
        {},
        DEFAULT_ATMOSPHERE,
        false
      );

      const response: DiscoveryResponse = {
        querySummary: prompt || 'Direct Jamendo Discovery',
        guideMessage:
          'Gemini AI is not configured; retrieved tracks directly from the Jamendo catalogue using keyword matching.',
        interpretedCriteria: jamendoRes.criteriaUsed,
        relaxedSearchUsed: jamendoRes.relaxedSearchUsed,
        relaxationExplanation: jamendoRes.relaxationExplanation,
        atmosphere: DEFAULT_ATMOSPHERE,
        planets,
        constellations,
        aiAvailable: false,
        warning:
          'GEMINI_API_KEY is missing or invalid in .env.local. Running in direct Jamendo catalogue mode.',
      };
      return NextResponse.json(response);
    }

    try {
      const interpretation = await interpretMultimodalDiscovery({
        prompt,
        imageBase64,
        imageMimeType,
        audioBase64,
        audioMimeType,
        conversationHistory,
        currentCriteria,
      });

      const jamendoResult = await searchJamendoTracksWithFallback(
        {
          ...interpretation.jamendoCriteria,
          limit: 18,
        },
        8
      );

      const { planets, constellations } = buildUniverseFromTracks(
        jamendoResult.tracks,
        {},
        interpretation.atmosphere,
        false
      );

      const response: DiscoveryResponse = {
        querySummary: interpretation.querySummary,
        guideMessage: interpretation.spokenTranscript
          ? `Heard: "${interpretation.spokenTranscript}" — ${interpretation.guideMessage}`
          : interpretation.guideMessage,
        visualObservation: interpretation.visualObservation,
        interpretedCriteria: jamendoResult.criteriaUsed,
        relaxedSearchUsed: jamendoResult.relaxedSearchUsed,
        relaxationExplanation: jamendoResult.relaxationExplanation,
        atmosphere: interpretation.atmosphere,
        planets,
        constellations,
        aiAvailable: true,
      };

      return NextResponse.json(response);
    } catch (geminiError: unknown) {
      const errMsg =
        geminiError instanceof Error
          ? geminiError.message
          : 'Gemini service error';

      // If Gemini fails, never disguise the failure — report the warning honestly while still serving real Jamendo tracks if text was given
      if (prompt) {
        const fallbackTags = sanitizeTagList(prompt.toLowerCase().split(/\s+/));
        const jamendoRes = await searchJamendoTracksWithFallback(
          {
            fuzzytags:
              fallbackTags.length > 0
                ? fallbackTags
                : ['ambient', 'electronic', 'cinematic'],
            limit: 18,
          },
          8
        );
        const { planets, constellations } = buildUniverseFromTracks(
          jamendoRes.tracks,
          {},
          DEFAULT_ATMOSPHERE,
          false
        );

        return NextResponse.json({
          querySummary: `Fallback: ${prompt.slice(0, 32)}`,
          guideMessage:
            'Gemini AI encountered an error, so Echoverse fell back to direct Jamendo catalogue tag matching.',
          interpretedCriteria: jamendoRes.criteriaUsed,
          relaxedSearchUsed: true,
          relaxationExplanation: jamendoRes.relaxationExplanation,
          atmosphere: DEFAULT_ATMOSPHERE,
          planets,
          constellations,
          aiAvailable: false,
          warning: `Gemini API error: ${errMsg}`,
        } satisfies DiscoveryResponse);
      }

      return NextResponse.json(
        { error: `Gemini multimodal analysis failed: ${errMsg}` },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unexpected error during music discovery.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
