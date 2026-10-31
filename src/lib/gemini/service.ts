import { Type, Schema, Part } from '@google/genai';
import { callGeminiWithRetry } from './config';
import {
  JamendoSearchParams,
  JamendoTrack,
  UniverseAtmosphere,
} from '@/types/echoverse';
import { DEFAULT_ATMOSPHERE } from '@/lib/jamendo/universe-builder';

const DISCOVERY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    spokenTranscript: {
      type: Type.STRING,
      description:
        'If audio input was provided, the verbatim transcript of what the speaker requested. Empty string if no audio input.',
    },
    visualObservation: {
      type: Type.STRING,
      description:
        'If an image was provided, an objective description of the observable setting, lighting, colours, objects, and atmosphere. Never infer sensitive personal attributes or claim to read facial emotions.',
    },
    querySummary: {
      type: Type.STRING,
      description:
        'A concise, evocative 3-6 word title for this musical universe state.',
    },
    guideMessage: {
      type: Type.STRING,
      description:
        'Warm, expressive response (2-3 sentences) from the Echoverse AI Musical Guide explaining how the request or scene translates into musical characteristics.',
    },
    jamendoCriteria: {
      type: Type.OBJECT,
      properties: {
        fuzzytags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            '3 to 5 lowercase Jamendo music tags chosen from: ambient, electronic, synthwave, chillout, downtempo, cinematic, soundtrack, lofi, dreamy, dark, space, piano, guitar, acoustic, indie, rock, pop, jazz, classical, folk, house, techno, hiphop, experimental, relaxing, energetic, melancholic, meditation, orchestral, world, funk, soul.',
        },
        speed: {
          type: Type.STRING,
          description:
            'Optional tempo filter: verylow, low, medium, high, or veryhigh.',
        },
        vocalinstrumental: {
          type: Type.STRING,
          description: 'Optional filter: vocal or instrumental.',
        },
        acousticelectric: {
          type: Type.STRING,
          description: 'Optional filter: acoustic or electric.',
        },
        boost: {
          type: Type.STRING,
          description:
            'Ranking preference: popularity_month, popularity_week, popularity_total, or buzzrate (use buzzrate for less mainstream / underground requests).',
        },
      },
      required: ['fuzzytags'],
    },
    atmosphere: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        primaryColor: {
          type: Type.STRING,
          description: 'Hex color e.g. #7c3aed, #06b6d4, #ec4899, #8b5cf6',
        },
        secondaryColor: {
          type: Type.STRING,
          description: 'Hex color e.g. #22d3ee, #c4b5fd, #38bdf8, #f472b6',
        },
        accentColor: {
          type: Type.STRING,
          description: 'Hex color e.g. #ec4899, #22d3ee, #a855f7',
        },
        fogColor: {
          type: Type.STRING,
          description: 'Deep dark hex color for space background e.g. #040512',
        },
        nebulaIntensity: {
          type: Type.NUMBER,
          description: 'Float between 0.35 and 1.0',
        },
        particleSpeed: {
          type: Type.NUMBER,
          description: 'Float between 0.2 and 1.2',
        },
        energyLevel: {
          type: Type.NUMBER,
          description: 'Float between 0.15 and 1.0',
        },
      },
      required: [
        'name',
        'description',
        'primaryColor',
        'secondaryColor',
        'accentColor',
        'fogColor',
        'nebulaIntensity',
        'particleSpeed',
        'energyLevel',
      ],
    },
  },
  required: ['querySummary', 'guideMessage', 'jamendoCriteria', 'atmosphere'],
};

export interface MultimodalDiscoveryInput {
  prompt?: string;
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
  conversationHistory?: Array<{ role: string; text: string }>;
  currentCriteria?: JamendoSearchParams;
}

export interface MultimodalDiscoveryInterpretation {
  spokenTranscript?: string;
  visualObservation?: string;
  querySummary: string;
  guideMessage: string;
  jamendoCriteria: Partial<JamendoSearchParams>;
  atmosphere: UniverseAtmosphere;
}

export async function interpretMultimodalDiscovery(
  input: MultimodalDiscoveryInput
): Promise<MultimodalDiscoveryInterpretation> {
  const parts: Part[] = [];

  const systemInstruction = `You are the AI Musical Guide of Echoverse — A Universe That Listens to You.
Your task is to interpret a user's natural language request, spoken voice audio, and/or uploaded camera/image scene ("Show Me Your World"), and translate it into valid Jamendo API v3.0 search criteria and a 3D cosmic atmosphere.

Strict rules:
1. Only output valid Jamendo tag slugs in jamendoCriteria.fuzzytags (such as: ambient, electronic, synthwave, chillout, downtempo, cinematic, soundtrack, lofi, dreamy, dark, space, piano, guitar, acoustic, indie, rock, pop, jazz, classical, folk, house, techno, hiphop, experimental, relaxing, energetic, melancholic, meditation, orchestral, world, funk, soul).
2. For speed, only use: verylow, low, medium, high, or veryhigh (or omit if flexible).
3. For vocalinstrumental, only use: vocal or instrumental (or omit if flexible).
4. For acousticelectric, only use: acoustic or electric (or omit if flexible).
5. If an image is provided, describe only observable visual features (setting, lighting, colours, objects, weather, visible atmosphere). NEVER infer sensitive personal characteristics (race, religion, health, age, identity) from people in images, and NEVER claim to detect true human emotions from faces.
6. If the user gives a conversational follow-up (e.g., "Make it more energetic", "Something less mainstream", "More mysterious", "I want something instrumental"), adapt the previous criteria accordingly.
7. Never invent song titles or artists.`;

  let contextText = '';
  if (input.conversationHistory && input.conversationHistory.length > 0) {
    const recent = input.conversationHistory.slice(-4);
    contextText +=
      'Recent conversation context:\n' +
      recent.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join('\n') +
      '\n\n';
  }
  if (input.currentCriteria) {
    contextText += `Previous Jamendo criteria: ${JSON.stringify(
      input.currentCriteria
    )}\n\n`;
  }

  if (input.imageBase64 && input.imageMimeType) {
    parts.push({
      inlineData: {
        data: input.imageBase64,
        mimeType: input.imageMimeType,
      },
    });
  }

  if (input.audioBase64 && input.audioMimeType) {
    parts.push({
      inlineData: {
        data: input.audioBase64,
        mimeType: input.audioMimeType,
      },
    });
  }

  const userText =
    input.prompt?.trim() ||
    (input.imageBase64
      ? 'Turn the observable visual atmosphere of this image into a musical experience.'
      : input.audioBase64
      ? 'Listen to this spoken request and update the musical universe accordingly.'
      : 'Take me somewhere atmospheric and unexpected.');

  parts.push({
    text: `${contextText}User request: "${userText}"`,
  });

  const rawJson = await callGeminiWithRetry(async (ai, modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: DISCOVERY_SCHEMA,
        temperature: 0.65,
      },
    });
    return response.text || '{}';
  });

  const parsed = JSON.parse(rawJson);

  const validHex = (val: unknown, fallback: string) =>
    typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val.trim())
      ? val.trim()
      : fallback;

  const atm = parsed.atmosphere || {};
  const atmosphere: UniverseAtmosphere = {
    name: atm.name || parsed.querySummary || DEFAULT_ATMOSPHERE.name,
    description: atm.description || DEFAULT_ATMOSPHERE.description,
    primaryColor: validHex(atm.primaryColor, DEFAULT_ATMOSPHERE.primaryColor),
    secondaryColor: validHex(
      atm.secondaryColor,
      DEFAULT_ATMOSPHERE.secondaryColor
    ),
    accentColor: validHex(atm.accentColor, DEFAULT_ATMOSPHERE.accentColor),
    fogColor: validHex(atm.fogColor, DEFAULT_ATMOSPHERE.fogColor),
    nebulaIntensity: Math.min(
      1,
      Math.max(0.3, Number(atm.nebulaIntensity) || 0.75)
    ),
    particleSpeed: Math.min(
      1.3,
      Math.max(0.15, Number(atm.particleSpeed) || 0.45)
    ),
    energyLevel: Math.min(1, Math.max(0.15, Number(atm.energyLevel) || 0.55)),
  };

  return {
    spokenTranscript: parsed.spokenTranscript || undefined,
    visualObservation: parsed.visualObservation || undefined,
    querySummary: parsed.querySummary || 'Cosmic Resonance',
    guideMessage:
      parsed.guideMessage ||
      'Exploring the Jamendo galaxy for independent music matching your atmosphere.',
    jamendoCriteria: parsed.jamendoCriteria || {
      fuzzytags: ['ambient', 'electronic', 'chillout'],
    },
    atmosphere,
  };
}

const RANKING_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    explanations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          trackId: { type: Type.STRING },
          reason: {
            type: Type.STRING,
            description:
              '1-sentence explanation grounded strictly in the provided Jamendo metadata (tags, instruments, speed, vocal/instrumental). Never invent facts not in the metadata.',
          },
        },
        required: ['trackId', 'reason'],
      },
    },
  },
  required: ['explanations'],
};

/**
 * Grounds explanations in the real Jamendo track metadata returned by the API.
 */
export async function explainRealCandidateTracks(
  userQuery: string,
  tracks: JamendoTrack[]
): Promise<Record<string, string>> {
  if (tracks.length === 0) return {};

  const compactCandidates = tracks.slice(0, 12).map((t) => ({
    trackId: t.id,
    title: t.name,
    artist: t.artist_name,
    genres: t.musicinfo?.tags?.genres || [],
    instruments: t.musicinfo?.tags?.instruments || [],
    moods: t.musicinfo?.tags?.vartags || [],
    speed: t.musicinfo?.speed || 'unknown',
    vocalinstrumental: t.musicinfo?.vocalinstrumental || 'unknown',
    acousticelectric: t.musicinfo?.acousticelectric || 'unknown',
  }));

  try {
    const rawJson = await callGeminiWithRetry(async (ai, modelName) => {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `User atmosphere request: "${userQuery}"\n\nHere are the real Jamendo tracks retrieved from the catalogue with their actual metadata:\n${JSON.stringify(
                  compactCandidates
                )}\n\nFor each track, write a concise 1-sentence reason explaining how its real metadata (genres, instruments, mood tags, tempo, vocal/instrumental) connects to the request. Do NOT fabricate any musical facts not present in the metadata.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: RANKING_SCHEMA,
          temperature: 0.4,
        },
      });
      return response.text || '{}';
    });

    const parsed = JSON.parse(rawJson);
    const map: Record<string, string> = {};
    if (Array.isArray(parsed.explanations)) {
      for (const item of parsed.explanations) {
        if (item.trackId && item.reason) {
          map[String(item.trackId)] = String(item.reason);
        }
      }
    }
    return map;
  } catch {
    // Non-fatal: universe-builder will use deterministic metadata descriptions
    return {};
  }
}

const JOURNEY_PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Evocative title for this 5-stage musical journey.',
    },
    originDescription: { type: Type.STRING },
    destinationDescription: { type: Type.STRING },
    narrativeOverview: {
      type: Type.STRING,
      description:
        '2-3 sentences describing the sonic progression from start to destination.',
    },
    atmosphere: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        primaryColor: { type: Type.STRING },
        secondaryColor: { type: Type.STRING },
        accentColor: { type: Type.STRING },
        fogColor: { type: Type.STRING },
        nebulaIntensity: { type: Type.NUMBER },
        particleSpeed: { type: Type.NUMBER },
        energyLevel: { type: Type.NUMBER },
      },
      required: [
        'name',
        'description',
        'primaryColor',
        'secondaryColor',
        'accentColor',
        'fogColor',
        'nebulaIntensity',
        'particleSpeed',
        'energyLevel',
      ],
    },
    stages: {
      type: Type.ARRAY,
      description:
        'Exactly 5 stages progressing coherently from the starting mood to the destination mood.',
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          stageTitle: { type: Type.STRING },
          stageDescription: { type: Type.STRING },
          atmosphereColor: {
            type: Type.STRING,
            description: 'Hex color representing this stage of the journey.',
          },
          fuzzytags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 to 4 valid lowercase Jamendo tags for this step.',
          },
          speed: {
            type: Type.STRING,
            description: 'verylow, low, medium, high, or veryhigh',
          },
          vocalinstrumental: {
            type: Type.STRING,
            description: 'vocal or instrumental',
          },
          acousticelectric: {
            type: Type.STRING,
            description: 'acoustic or electric',
          },
        },
        required: [
          'stepNumber',
          'stageTitle',
          'stageDescription',
          'atmosphereColor',
          'fuzzytags',
        ],
      },
    },
  },
  required: [
    'title',
    'originDescription',
    'destinationDescription',
    'narrativeOverview',
    'atmosphere',
    'stages',
  ],
};

export interface PlannedJourneyStage {
  stepNumber: number;
  stageTitle: string;
  stageDescription: string;
  atmosphereColor: string;
  criteria: Partial<JamendoSearchParams>;
}

export interface PlannedJourneyBlueprint {
  title: string;
  originDescription: string;
  destinationDescription: string;
  narrativeOverview: string;
  atmosphere: UniverseAtmosphere;
  stages: PlannedJourneyStage[];
}

export async function planMusicalJourneyBlueprint(
  originPrompt: string,
  destinationPrompt?: string
): Promise<PlannedJourneyBlueprint> {
  const combinedText = destinationPrompt
    ? `Starting point: "${originPrompt}"\nDestination: "${destinationPrompt}"`
    : `Journey request: "${originPrompt}"`;

  const systemInstruction = `You are the AI Musical Architect of Echoverse.
Design a coherent 5-stage musical journey ("Take Me Somewhere") progressing from the user's starting atmosphere to their destination atmosphere.
Each of the 5 stages must use valid Jamendo search tags (ambient, electronic, synthwave, chillout, downtempo, cinematic, soundtrack, lofi, dreamy, dark, space, piano, guitar, acoustic, indie, rock, pop, jazz, classical, folk, house, techno, hiphop, experimental, relaxing, energetic, melancholic, meditation, orchestral, world, funk, soul) and valid speed/vocal/acoustic filters so real tracks can be retrieved for every step.`;

  const rawJson = await callGeminiWithRetry(async (ai, modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: combinedText }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: JOURNEY_PLAN_SCHEMA,
        temperature: 0.65,
      },
    });
    return response.text || '{}';
  });

  const parsed = JSON.parse(rawJson);
  const validHex = (val: unknown, fallback: string) =>
    typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val.trim())
      ? val.trim()
      : fallback;

  const atm = parsed.atmosphere || {};
  const atmosphere: UniverseAtmosphere = {
    name: atm.name || parsed.title || 'Celestial Odyssey',
    description: atm.description || parsed.narrativeOverview || '',
    primaryColor: validHex(atm.primaryColor, '#7c3aed'),
    secondaryColor: validHex(atm.secondaryColor, '#06b6d4'),
    accentColor: validHex(atm.accentColor, '#ec4899'),
    fogColor: validHex(atm.fogColor, '#040510'),
    nebulaIntensity: Math.min(1, Math.max(0.4, Number(atm.nebulaIntensity) || 0.8)),
    particleSpeed: Math.min(1.2, Math.max(0.2, Number(atm.particleSpeed) || 0.55)),
    energyLevel: Math.min(1, Math.max(0.2, Number(atm.energyLevel) || 0.65)),
  };

  const rawStages = Array.isArray(parsed.stages) ? parsed.stages.slice(0, 5) : [];
  const stages: PlannedJourneyStage[] = rawStages.map((s: Record<string, unknown>, idx: number) => ({
    stepNumber: idx + 1,
    stageTitle: String(s.stageTitle || `Stage ${idx + 1}`),
    stageDescription: String(
      s.stageDescription || 'Transitioning through the musical cosmos.'
    ),
    atmosphereColor: validHex(s.atmosphereColor, '#22d3ee'),
    criteria: {
      fuzzytags: Array.isArray(s.fuzzytags)
        ? s.fuzzytags.map(String)
        : ['ambient', 'electronic'],
      speed: typeof s.speed === 'string' ? (s.speed as JamendoSearchParams['speed']) : undefined,
      vocalinstrumental:
        typeof s.vocalinstrumental === 'string'
          ? (s.vocalinstrumental as JamendoSearchParams['vocalinstrumental'])
          : undefined,
      acousticelectric:
        typeof s.acousticelectric === 'string'
          ? (s.acousticelectric as JamendoSearchParams['acousticelectric'])
          : undefined,
      limit: 10,
    },
  }));

  return {
    title: parsed.title || 'Cosmic Musical Journey',
    originDescription: parsed.originDescription || originPrompt,
    destinationDescription:
      parsed.destinationDescription || destinationPrompt || 'Horizon',
    narrativeOverview:
      parsed.narrativeOverview ||
      'A five-stage sonic progression curated across independent artists on Jamendo.',
    atmosphere,
    stages,
  };
}
