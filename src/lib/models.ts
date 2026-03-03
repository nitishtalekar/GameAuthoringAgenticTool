import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { ModelOptions, LLMProvider } from "./types";

/**
 * Returns a ChatOpenAI instance.
 * Reads OPENAI_API_KEY and OPENAI_MODEL from the environment.
 *
 * @example
 * const llm = createOpenAIModel({ temperature: 0.2 });
 */
export function createOpenAIModel(options: ModelOptions = {}): ChatOpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it to .env.local.");
  }

  return new ChatOpenAI({
    apiKey,
    modelName: options.modelName ?? process.env.OPENAI_MODEL ?? "gpt-4o",
    temperature: options.temperature ?? 0.7,
    streaming: options.streaming ?? false,
  });
}

/**
 * Returns a ChatGoogleGenerativeAI instance.
 * Reads GOOGLE_API_KEY and GOOGLE_MODEL from the environment.
 *
 * @example
 * const llm = createGoogleModel({ modelName: "gemini-2.0-flash", temperature: 0 });
 */
export function createGoogleModel(
  options: ModelOptions = {}
): ChatGoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY. Add it to .env.local.");
  }

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: options.modelName ?? process.env.GOOGLE_MODEL ?? "gemini-2.0-flash",
    temperature: options.temperature ?? 0.7,
    streaming: options.streaming ?? false,
  });
}

/**
 * Convenience dispatcher — picks the right factory based on provider.
 *
 * @example
 * const llm = createModel("google", { temperature: 0.5 });
 */
export function createModel(
  provider: LLMProvider,
  options: ModelOptions = {}
): ChatOpenAI | ChatGoogleGenerativeAI {
  if (provider === "google") {
    return createGoogleModel(options);
  }
  return createOpenAIModel(options);
}
