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
import { SYSTEM_PROMPT, buildRepairPrompt, buildUserPrompt, KnownFacts, SnippetRequest } from "./prompt";
import { estimateCost, TokenUsage } from "./pricing";
import { checkNotation, NotationCheck } from "./notationChecks";
import { GridReport, parseCycle, toNotation, Transcription, TRANSCRIPTION_SCHEMA, validateTranscription } from "./grid";

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
  /** Facts the user is sure of. A given cycle is enforced, not just suggested. */
  known?: KnownFacts;
  /** Transcribe only part of the photos, and/or follow on from earlier notation. */
  snippet?: SnippetRequest;
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
  /** Summarized thinking, delta by delta. Arrives before the reply text. */
  onThinking?: (delta: string) => void;
  /** Live progress while a reply streams, and exact counts when the request starts and ends. */
  onProgress?: (progress: StreamProgress) => void;
}

/**
 * One progress report. The API gives exact output tokens only at the end of a reply, so
 * mid-stream counts are estimates from streamed characters.
 */
export type StreamProgress =
  | { kind: "started"; attempt: number; inputTokens: number; cacheReadTokens: number }
  | { kind: "streaming"; attempt: number; phase: "thinking" | "writing"; estimatedOutputTokens: number }
  | {
      kind: "finished";
      attempt: number;
      /** The model that served this round, which a server-side fallback can change. */
      model: string;
      outputTokens: number;
      stopReason: string | null;
      /** Estimated US dollars for this round, or null when `model` has no rates. */
      costUsd: number | null;
    };

/** Rough characters per token, for the mid-stream estimate only. */
const CHARS_PER_TOKEN = 4;

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
  /** The model that served the last round. */
  model: string;
  /** Tokens summed over every round. */
  usage: TokenUsage;
  /**
   * Estimated US dollars summed over every round, each priced at the rates of the model that
   * served it. Null when any round ran on a model without rates.
   */
  costUsd: number | null;
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

/** Adds errors for anything that contradicts what the user told us. */
export function withKnownFacts(report: GridReport, t: Transcription, known?: KnownFacts): GridReport {
  const want = known?.cycle ? parseCycle(known.cycle) : null;
  if (!want) return report;
  const same = (c: string) => (parseCycle(c) || []).join(",") === want.join(",");
  const errors = [...report.errors];
  if (!same(t.cycle)) {
    errors.push(`The user gave the tala as "${known!.cycle}", but the grid uses "${t.cycle}". Use the user's cycle.`);
  }
  t.sections.forEach((s, i) => {
    if (s.cycle?.trim() && !same(s.cycle)) {
      const name = s.heading?.trim() ? `"${s.heading.trim()}"` : `section ${i + 1}`;
      errors.push(
        `${name} uses cycle "${s.cycle}", but the user gave "${known!.cycle}". Leave the section cycle empty.`,
      );
    }
  });
  return { ...report, errors };
}

/**
 * Puts the ragam the user gave into the grid's metadata, replacing whatever the model read off the
 * page. A page heading is often a misspelling ("KEDHARM") or names only one raga of a ragamalika,
 * and the front matter should carry what the user typed.
 */
export function applyKnownRagam(t: Transcription, known?: KnownFacts): void {
  const ragam = known?.ragams?.trim();
  if (!ragam) return;
  const rest = (t.metadata || []).filter((m) => m.key.trim().toLowerCase() !== "ragam");
  t.metadata = [{ key: "ragam", value: ragam }, ...rest];
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
  firstTurn.push({
    type: "text",
    text: buildUserPrompt(opts.images.length, opts.hints || "", opts.known, opts.snippet),
  });
  const messages: BetaMessageParam[] = [{ role: "user", content: firstTurn }];

  const attempts: TranscribeAttempt[] = [];
  const usage: TokenUsage = { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  let costUsd: number | null = 0;
  let servedBy = model;

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    opts.onAttemptStart?.(attempt);
    status(attempt === 0 ? "Reading the photo..." : `Correcting (round ${attempt} of ${maxRepairs})...`);

    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        // "summarized" so the thinking text streams; Opus 5.5 sends it empty by default.
        thinking: { type: "adaptive", display: "summarized" },
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
    let streamedChars = 0;
    const progress = (phase: "thinking" | "writing", delta: string) => {
      streamedChars += delta.length;
      opts.onProgress?.({
        kind: "streaming",
        attempt,
        phase,
        estimatedOutputTokens: Math.round(streamedChars / CHARS_PER_TOKEN),
      });
    };
    stream.on("thinking", (delta: string) => {
      opts.onThinking?.(delta);
      progress("thinking", delta);
    });
    stream.on("text", (delta: string) => {
      opts.onText?.(delta);
      progress("writing", delta);
    });
    stream.on("streamEvent", (event: any) => {
      if (event.type === "message_start") {
        const u = event.message.usage;
        opts.onProgress?.({
          kind: "started",
          attempt,
          inputTokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
          cacheReadTokens: u.cache_read_input_tokens || 0,
        });
      }
    });
    const message = await stream.finalMessage();
    const round: TokenUsage = {
      inputTokens: message.usage.input_tokens,
      cacheWriteTokens: message.usage.cache_creation_input_tokens || 0,
      cacheReadTokens: message.usage.cache_read_input_tokens || 0,
      outputTokens: message.usage.output_tokens,
    };
    const roundCost = estimateCost(message.model, round);
    opts.onProgress?.({
      kind: "finished",
      attempt,
      model: message.model,
      outputTokens: round.outputTokens,
      stopReason: message.stop_reason,
      costUsd: roundCost,
    });

    usage.inputTokens += round.inputTokens;
    usage.cacheWriteTokens += round.cacheWriteTokens;
    usage.cacheReadTokens += round.cacheReadTokens;
    usage.outputTokens += round.outputTokens;
    costUsd = costUsd === null || roundCost === null ? null : costUsd + roundCost;
    servedBy = message.model;

    if (message.stop_reason === "refusal") {
      throw new TranscriptionRefusedError(message.stop_details?.explanation ?? null);
    }

    const transcription = parseTranscription(textOf(message));
    const report: GridReport = transcription
      ? withKnownFacts(validateTranscription(transcription), transcription, opts.known)
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

  applyKnownRagam(best.transcription, opts.known);
  const notation = toNotation(best.transcription);
  return {
    notation,
    transcription: best.transcription,
    report: best.report,
    check: checkNotation(notation),
    attempts,
    model: servedBy,
    usage,
    costUsd,
  };
}
