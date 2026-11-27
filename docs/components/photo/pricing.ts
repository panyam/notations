/**
 * Estimated API cost of a transcription, from the token counts the API reports.
 *
 * The rates are copied from Anthropic's price list and can go stale. The Anthropic Console
 * has the actual bill, so the page and the CLI label these figures as estimates.
 */

/** Token counts for one request, or summed over several. Thinking tokens count as output. */
export interface TokenUsage {
  /** Input tokens read at the full rate (the API's input_tokens). */
  inputTokens: number;
  /** Input tokens written to the prompt cache (5-minute TTL). */
  cacheWriteTokens: number;
  /** Input tokens served from the prompt cache. */
  cacheReadTokens: number;
  outputTokens: number;
}

/** US dollars per million tokens. */
interface Rates {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

/** When the rates below were last checked against Anthropic's price list. */
export const RATES_CHECKED_ON = "2026-11-26";

const RATES: Record<string, Rates> = {
  "claude-opus-5-5": { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
};

/**
 * The estimated cost in US dollars of `usage` on `model`, or null when there are no rates for
 * that model. Callers then show tokens only, rather than a guess.
 */
export function estimateCost(model: string, usage: TokenUsage): number | null {
  const r = RATES[model];
  if (!r) return null;
  return (
    (usage.inputTokens * r.input +
      usage.cacheWriteTokens * r.cacheWrite +
      usage.cacheReadTokens * r.cacheRead +
      usage.outputTokens * r.output) /
    1_000_000
  );
}

/** "$0.103" under a dollar, "$1.23" from a dollar up, "unknown" for null. */
export function formatCost(cost: number | null): string {
  if (cost === null) return "unknown";
  return "$" + cost.toFixed(cost < 1 ? 3 : 2);
}
