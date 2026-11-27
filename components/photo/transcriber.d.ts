import type Anthropic from "@anthropic-ai/sdk";
import { KnownFacts, SnippetRequest } from "./prompt";
import { NotationCheck } from "./notationChecks";
import { GridReport, Transcription } from "./grid";
export declare const DEFAULT_MODEL = "claude-opus-5-5";
export interface TranscribeImage {
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}
export interface TranscribeOptions {
    images: TranscribeImage[];
    hints?: string;
    known?: KnownFacts;
    snippet?: SnippetRequest;
    model?: string;
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
    maxRepairs?: number;
    signal?: AbortSignal;
    onText?: (delta: string) => void;
    onAttemptStart?: (attempt: number) => void;
    onStatus?: (message: string) => void;
    onThinking?: (delta: string) => void;
    onProgress?: (progress: StreamProgress) => void;
}
export type StreamProgress = {
    kind: "started";
    attempt: number;
    inputTokens: number;
    cacheReadTokens: number;
} | {
    kind: "streaming";
    attempt: number;
    phase: "thinking" | "writing";
    estimatedOutputTokens: number;
} | {
    kind: "finished";
    attempt: number;
    outputTokens: number;
    stopReason: string | null;
};
export interface TranscribeAttempt {
    transcription: Transcription | null;
    report: GridReport;
    stopReason: string | null;
}
export interface TranscribeResult {
    notation: string;
    transcription: Transcription;
    report: GridReport;
    check: NotationCheck;
    attempts: TranscribeAttempt[];
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
    };
}
export declare class TranscriptionRefusedError extends Error {
    constructor(explanation: string | null);
}
export declare function withKnownFacts(report: GridReport, t: Transcription, known?: KnownFacts): GridReport;
export declare function parseTranscription(text: string): Transcription | null;
export declare function transcribe(client: Anthropic, opts: TranscribeOptions): Promise<TranscribeResult>;
