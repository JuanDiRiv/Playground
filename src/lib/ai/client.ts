import "server-only";
import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

/** Default model for evaluation and interactive Q&A. */
export const MODEL_DEFAULT = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

/** Cheaper/faster model for bulk generation and progressive hints. */
export const MODEL_FAST = process.env.OPENAI_MODEL_FAST ?? "gpt-5.4-nano";
