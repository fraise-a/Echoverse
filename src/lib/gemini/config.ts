import { GoogleGenAI } from '@google/genai';

/**
 * Central Gemini model configuration for Echoverse.
 * All model identifiers are configured here so they can be updated in one place.
 */
export const GEMINI_CONFIG = {
  // Primary multimodal model supporting text, vision (image/camera), audio, and structured JSON output
  primaryMultimodalModel:
    process.env.GEMINI_MODEL_PRIMARY || 'gemini-3.8-flash',
  // Fallback multimodal model if the primary model experiences transient unavailability
  fallbackMultimodalModel:
    process.env.GEMINI_MODEL_FALLBACK || 'gemini-flash-latest',
  maxRetries: 2,
  initialBackoffMs: 700,
} as const;

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'YOUR_GEMINI_API_KEY' && key.length > 10);
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY environment variable is missing or set to a placeholder in .env.local.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a Gemini SDK call with bounded exponential backoff for transient
 * rate-limit (429) or overload (503) errors, falling back to fallbackMultimodalModel
 * if the primary model is unavailable.
 */
export async function callGeminiWithRetry<T>(
  operation: (ai: GoogleGenAI, modelName: string) => Promise<T>
): Promise<T> {
  const ai = getGeminiClient();
  const modelsToTry = [
    GEMINI_CONFIG.primaryMultimodalModel,
    GEMINI_CONFIG.fallbackMultimodalModel,
  ];

  let lastError: unknown = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt <= GEMINI_CONFIG.maxRetries; attempt++) {
      try {
        return await operation(ai, modelName);
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient =
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('overloaded');

        const isModelNotFound =
          msg.includes('404') || msg.includes('NOT_FOUND');

        if (isModelNotFound) {
          // Break inner retry loop and try fallback model immediately
          break;
        }

        if (isTransient && attempt < GEMINI_CONFIG.maxRetries) {
          const delay = GEMINI_CONFIG.initialBackoffMs * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gemini API request failed');
}
