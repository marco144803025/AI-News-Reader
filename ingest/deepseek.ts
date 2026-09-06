import OpenAI from "openai";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CLASSIFY_MODEL = "deepseek-v4-flash";
export const BRIEF_MODEL = "deepseek-v4-pro";

/** Errors whose messages are authored locally, never copied from API payloads. */
export class PipelineError extends Error {}

export function createDeepSeekClient(
  apiKey = process.env.DEEPSEEK_API_KEY,
  transport?: typeof fetch,
): OpenAI {
  if (!apiKey?.trim() || apiKey.includes("your-key")) {
    throw new PipelineError("DEEPSEEK_API_KEY is missing. Set it in .env or GitHub Actions secrets.");
  }
  return new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: "https://api.deepseek.com",
    maxRetries: 0,
    timeout: 60_000,
    ...(transport ? { fetch: transport } : {}),
  });
}

/** Use a normal JSON-array completion; the outer pipeline owns bounded retries. */
export async function completeText(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  // NOTE: Await completes the request before parsing. SDK retries are disabled
  // so the caller's retry loop cannot accidentally multiply billable requests.
  const request = {
    model,
    max_tokens: maxTokens,
    stream: false as const,
    thinking: { type: "disabled" },
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
  };
  const response = await client.chat.completions.create(request);
  const choice = response.choices?.[0];
  if (choice?.finish_reason !== "stop") {
    throw new PipelineError("DeepSeek returned an incomplete response. Check the output token limit.");
  }
  const text = choice.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new PipelineError("DeepSeek returned empty content.");
  }
  return text;
}

export function isTransientError(error: unknown): boolean {
  return error instanceof OpenAI.APIConnectionError ||
    (error instanceof OpenAI.APIError &&
      (error.status === 408 || error.status === 429 || (error.status ?? 0) >= 500));
}

export function safePipelineError(error: unknown): string {
  if (error instanceof PipelineError) return error.message;
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return "DeepSeek authentication failed. Check DEEPSEEK_API_KEY and account access.";
    if (error.status === 402) return "DeepSeek balance is insufficient. Check your account balance.";
    if (error.status === 429) return "DeepSeek rate limit reached. Try again later.";
    return "DeepSeek request failed. Check service availability and model configuration.";
  }
  if (error instanceof SyntaxError) return "Invalid JSON. Check the input file or model response.";
  return "Pipeline failed. Check input files, permissions, and network access.";
}

/** Compare file URLs so Windows drive letters and spaces work with tsx. */
export function isMainModule(url: string): boolean {
  return Boolean(process.argv[1]) && url === pathToFileURL(resolve(process.argv[1])).href;
}
