/**
 * transcriber.ts - Turns photos of Carnatic notation into Notations DSL with Claude.
 *
 * The loop:
 *
 *   1. Send the photos and the user's hints, with the reading guide as a cached system prompt.
 *      The model answers with a beat grid (grid.ts) under a JSON schema, not with DSL.
 *   2. validateTranscription() checks every beat's slot count, that roles line up and that lines
 *      are whole avartanams, and reports each problem with its location.
 *   3. If there are problems, they go back in the same conversation and the model sends a
 *      corrected grid, up to `maxRepairs` times.
 *   4. toNotation() writes the DSL from the best grid, and the real parser checks it as a
 *      final safety net.
 *
 * The Anthropic client is passed in, so this module has no idea whether the key came from the
 * user's browser or from a proxy, and tests can hand it a fake.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildRepairPrompt, buildUserPrompt } from "./prompt";
import { checkNotation, NotationCheck } from "./notationChecks";
import { GridReport, toNotation, Transcription, TRANSCRIPTION_SCHEMA, validateTranscription } from "./grid";

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
  /** How much the model thinks. Poor photos and sparse notation benefit from "xhigh". */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Correction rounds after the first answer. 0 disables the loop. */
  maxRepairs?: number;
  signal?: AbortSignal;
  /** Streamed reply text (JSON), delta by delta. A new attempt starts with onAttemptStart. */
  onText?: (delta: string) => void;
  onAttemptStart?: (attempt: number) => void;
  onStatus?: (message: string) => void;
}

export interface TranscribeAttempt {
  transcription: Transcription | null;
  report: GridReport;
  stopReason: string | null;
}

export interface TranscribeResult {
  /** DSL for the best attempt. */
  notation: string;
  transcription: Transcription;
  /** Grid problems left in the best attempt, unwritten units filled in, and lines to check. */
  report: GridReport;
  /** The parser's verdict on the generated DSL. */
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

function textOf(message: BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Parses the model's JSON; structured outputs make failure rare, but a cut-off reply can still fail. */
export function parseTranscription(text: string): Transcription | null {
  try {
    const t = JSON.parse(text);
    if (t && typeof t === "object" && Array.isArray(t.sections)) return t as Transcription;
  } catch {
    // fall through
  }
  return null;
}

/**
 * Transcribes the photos. Throws on API failures, a refusal, an abort, or when no attempt
 * produced a readable grid; otherwise returns the best attempt even when it still has
 * problems, so the user can fix the rest by hand.
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

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    opts.onAttemptStart?.(attempt);
    status(attempt === 0 ? "Reading the photo..." : `Correcting (round ${attempt} of ${maxRepairs})...`);

    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: opts.effort || "high",
          format: { type: "json_schema", schema: TRANSCRIPTION_SCHEMA as unknown as Record<string, unknown> },
        },
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

    const transcription = parseTranscription(textOf(message));
    const report: GridReport = transcription
      ? validateTranscription(transcription)
      : {
          errors: [
            message.stop_reason === "max_tokens"
              ? "The reply was cut off at the length limit."
              : "The reply was not a readable grid.",
          ],
          inferredSlots: 0,
          checks: [],
        };
    attempts.push({ transcription, report, stopReason: message.stop_reason });

    if (report.errors.length === 0 || attempt === maxRepairs) break;
    if (!transcription && message.stop_reason === "max_tokens") break; // a retry would be cut off too

    status(`${report.errors.length} problem(s) in the grid; asking for a fix...`);
    // Pass the reply back unchanged (thinking blocks included) so the model keeps its reasoning.
    messages.push({ role: "assistant", content: message.content as BetaContentBlockParam[] });
    messages.push({ role: "user", content: buildRepairPrompt(report.errors) });
  }

  // Best attempt: fewest grid errors, latest on ties (a later round has seen more feedback).
  let best: TranscribeAttempt | null = null;
  for (const a of attempts) {
    if (!a.transcription) continue;
    if (best == null || a.report.errors.length <= best.report.errors.length) best = a;
  }
  if (!best || !best.transcription) {
    throw new Error(attempts[attempts.length - 1]?.report.errors[0] || "No transcription was produced.");
  }

  const notation = toNotation(best.transcription);
  return {
    notation,
    transcription: best.transcription,
    report: best.report,
    check: checkNotation(notation),
    attempts,
    model: servedBy,
    usage,
  };
}
