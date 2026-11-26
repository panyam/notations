/**
 * transcriber.ts - Turns photos of Carnatic notation into Notations DSL with Claude.
 *
 * The loop:
 *
 *   1. Send the photos and the user's hints, with the DSL guide as a cached system prompt.
 *   2. Pull the ```notation block out of the reply and run it through the real parser
 *      (checkNotation). That catches syntax the model got wrong and lines that do not add up.
 *   3. If there are problems, hand the errors back in the same conversation and ask for a
 *      corrected document, up to `maxRepairs` times. Parse errors always earn another round;
 *      alignment warnings earn one, since some are legitimate (a song that ends mid-cycle).
 *
 * The Anthropic client is passed in, so this module has no idea whether the key came from the
 * user's browser or from a proxy, and tests can hand it a fake.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildRepairPrompt, buildUserPrompt } from "./prompt";
import { checkNotation, NotationCheck } from "./notationChecks";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam;

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface TranscribeImage {
  /** Base64 data with no `data:` prefix. */
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export interface TranscribeOptions {
  /** Photos in reading order. */
  images: TranscribeImage[];
  /** Free-text hints from the user: raga, tala, composer, conventions. */
  hints?: string;
  model?: string;
  /** How much the model thinks; "high" reads dense pages noticeably better than the default. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Correction rounds after the first answer. 0 disables the loop. */
  maxRepairs?: number;
  signal?: AbortSignal;
  /** Streamed reply text, delta by delta. A new attempt starts with onAttemptStart. */
  onText?: (delta: string) => void;
  onAttemptStart?: (attempt: number) => void;
  onStatus?: (message: string) => void;
}

export interface TranscribeAttempt {
  notation: string;
  notes: string;
  check: NotationCheck;
  stopReason: string | null;
}

export interface TranscribeResult {
  /** The best notation produced: the last attempt that parsed, else the last attempt. */
  notation: string;
  /** Free-text notes the model wrote after the code block. */
  notes: string;
  check: NotationCheck;
  attempts: TranscribeAttempt[];
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

/** The model declined to transcribe the image. */
export class TranscriptionRefusedError extends Error {
  constructor(explanation: string | null) {
    super(explanation ? `The model declined this request: ${explanation}` : "The model declined this request.");
    this.name = "TranscriptionRefusedError";
  }
}

/**
 * Splits a reply into the notation inside its fenced block and whatever prose follows.
 *
 * Accepts ```notation, ```v4 or an untagged fence, in that order of preference, and falls back
 * to the whole reply when there is no fence at all (the parser will judge it).
 */
export function extractNotation(reply: string): { notation: string; notes: string } {
  const fence = /```([a-zA-Z0-9_-]*)[^\n]*\n([\s\S]*?)(?:\n```|$)/g;
  let best: { tag: string; body: string; end: number } | null = null;
  const rank = (tag: string) => (tag === "notation" ? 3 : tag === "v4" ? 2 : tag === "" ? 1 : 0);
  for (const m of reply.matchAll(fence)) {
    const cand = { tag: m[1].toLowerCase(), body: m[2], end: (m.index ?? 0) + m[0].length };
    if (best == null || rank(cand.tag) > rank(best.tag)) best = cand;
  }
  if (best == null) {
    return { notation: reply.trim(), notes: "" };
  }
  const after = reply.slice(best.end).trim();
  const notes = after.replace(/^notes:\s*/i, "").trim();
  return { notation: best.body.replace(/\s+$/, "") + "\n", notes };
}

function textOf(message: BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Transcribes the photos. Throws on API failures, a refusal, or an abort; otherwise returns
 * the best attempt even when it still has problems, so the user can fix the rest by hand.
 */
export async function transcribe(client: Anthropic, opts: TranscribeOptions): Promise<TranscribeResult> {
  if (opts.images.length === 0) throw new Error("Add at least one photo first.");
  const model = opts.model || DEFAULT_MODEL;
  const maxRepairs = opts.maxRepairs ?? 2;
  const status = opts.onStatus || (() => {});

  const firstTurn: BetaContentBlockParam[] = [];
  opts.images.forEach((img, i) => {
    if (opts.images.length > 1) firstTurn.push({ type: "text", text: `Page ${i + 1}:` });
    firstTurn.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  });
  firstTurn.push({ type: "text", text: buildUserPrompt(opts.images.length, opts.hints || "") });
  const messages: BetaMessageParam[] = [{ role: "user", content: firstTurn }];

  const attempts: TranscribeAttempt[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let servedBy = model;
  let warnedOnce = false;

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    opts.onAttemptStart?.(attempt);
    status(attempt === 0 ? "Reading the photo..." : `Correcting (round ${attempt} of ${maxRepairs})...`);

    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: opts.effort || "high" },
        // On a policy decline the API retries on a fallback model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages,
      },
      { signal: opts.signal },
    );
    if (opts.onText) stream.on("text", opts.onText);
    const message = await stream.finalMessage();

    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens || 0;
    servedBy = message.model;

    if (message.stop_reason === "refusal") {
      throw new TranscriptionRefusedError(message.stop_details?.explanation ?? null);
    }

    const { notation, notes } = extractNotation(textOf(message));
    const check = checkNotation(notation);
    attempts.push({ notation, notes, check, stopReason: message.stop_reason });

    if (message.stop_reason === "max_tokens") {
      status("The reply hit the length limit; the end of the notation may be missing.");
      break;
    }
    const needsRepair = check.errors.length > 0 || (check.warnings.length > 0 && !warnedOnce);
    if (!needsRepair || attempt === maxRepairs) break;

    if (check.errors.length === 0) warnedOnce = true;
    status(
      check.errors.length > 0
        ? `Parser found ${check.errors.length} error(s); asking for a fix...`
        : `${check.warnings.length} line(s) do not add up; asking for a re-check...`,
    );
    // Pass the reply back unchanged (thinking blocks included) so the model keeps its reasoning.
    messages.push({ role: "assistant", content: message.content as BetaContentBlockParam[] });
    messages.push({ role: "user", content: buildRepairPrompt(check.errors, check.warnings) });
  }

  // Prefer the latest attempt that parsed; a later broken "fix" should not replace a good one.
  const parsed = [...attempts].reverse().find((a) => a.check.errors.length === 0);
  const best = parsed || attempts[attempts.length - 1];
  return { notation: best.notation, notes: best.notes, check: best.check, attempts, model: servedBy, usage };
}
