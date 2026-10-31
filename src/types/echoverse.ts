export type JamendoSpeed = 'verylow' | 'low' | 'medium' | 'high' | 'veryhigh';
export type JamendoVocalInstrumental = 'vocal' | 'instrumental';
export type JamendoAcousticElectric = 'acoustic' | 'electric';

export interface JamendoMusicInfo {
  vocalinstrumental?: string;
  lang?: string;
  gender?: string;
  acousticelectric?: string;
  speed?: string;
  tags?: {
    genres: string[];
    instruments: string[];
    vartags: string[];
  };
}

export interface JamendoLicenseInfo {
  ccnc?: string;
  ccnd?: string;
  ccsa?: string;
  prolicensing?: string;
  prost?: string;
}

export interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_id: string;
  artist_name: string;
  artist_idstr?: string;
  album_name: string;
  album_id: string;
  license_ccurl: string;
  position?: number;
  releasedate: string;
  album_image: string;
  audio: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  prourl?: string;
  shorturl?: string;
  shareurl: string;
  waveform?: string;
  image: string;
  musicinfo?: JamendoMusicInfo;
  licenses?: JamendoLicenseInfo;
}

export interface JamendoSearchParams {
  search?: string;
  tags?: string[];
  fuzzytags?: string[];
  speed?: JamendoSpeed;
  vocalinstrumental?: JamendoVocalInstrumental;
  acousticelectric?: JamendoAcousticElectric;
  groupby?: 'artist_id' | 'album_id';
  limit?: number;
  type?: 'single' | 'albumtrack' | 'single+albumtrack';
  boost?: 'popularity_total' | 'popularity_month' | 'popularity_week' | 'buzzrate';
}

export interface UniverseAtmosphere {
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fogColor: string;
  nebulaIntensity: number;
  particleSpeed: number;
  energyLevel: number;
}

export type PlanetArchetype =
  | 'gas-giant'
  | 'terrestrial'
  | 'crystalline'
  | 'ethereal';

export interface SongPlanet {
  id: string;
  track: JamendoTrack;
  position: [number, number, number];
  orbitRadius: number;
  orbitSpeed: number;
  planetSize: number;
  primaryColor: string;
  secondaryColor: string;
  surfaceColor?: string;
  atmosphereColor?: string;
  archetype?: PlanetArchetype;
  archetypeLabel?: string;
  textureVariant?: number;
  axialTilt?: [number, number, number];
  hasMoon?: boolean;
  ringStyle: 'none' | 'thin' | 'double' | 'halo';
  region: string;
  similarityScore: number;
  aiReason: string;
  allTags: string[];
  journeyStepIndex?: number;
  journeyStageTitle?: string;
  journeyStageDescription?: string;
}

export interface ConstellationEdge {
  id: string;
  fromTrackId: string;
  toTrackId: string;
  sharedAttributes: string[];
  strength: number;
  isJourneyRoute?: boolean;
}

export interface JourneyStep {
  stepNumber: number;
  stageTitle: string;
  stageDescription: string;
  atmosphereColor: string;
  track: JamendoTrack;
  planetId: string;
  searchCriteriaUsed: JamendoSearchParams;
}

export interface MusicalJourney {
  id: string;
  title: string;
  originDescription: string;
  destinationDescription: string;
  narrativeOverview: string;
  steps: JourneyStep[];
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  mode?: 'text' | 'voice' | 'vision' | 'journey';
  visualObservation?: string;
  criteriaUsed?: JamendoSearchParams;
}

export interface DiscoveryResponse {
  querySummary: string;
  guideMessage: string;
  visualObservation?: string;
  interpretedCriteria: JamendoSearchParams;
  relaxedSearchUsed: boolean;
  relaxationExplanation?: string;
  atmosphere: UniverseAtmosphere;
  planets: SongPlanet[];
  constellations: ConstellationEdge[];
  journey?: MusicalJourney;
  aiAvailable: boolean;
  warning?: string;
}
