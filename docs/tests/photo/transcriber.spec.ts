import { parseTranscription, transcribe, TranscriptionRefusedError } from "../../components/photo/transcriber";
import type { Transcription } from "../../components/photo/grid";

/** A stand-in for client.beta.messages.stream that replays canned replies and records requests. */
function fakeClient(
  replies: Array<{
    text: string;
    thinking?: string;
    stop_reason?: string;
    explanation?: string;
    /** The model that served the reply, as after a server-side fallback. */
    model?: string;
    cacheWrite?: number;
  }>,
) {
  const requests: any[] = [];
  let i = 0;
  const client: any = {
    beta: {
      messages: {
        stream(params: any) {
          // Copy the messages, since the transcriber keeps appending to the same array.
          requests.push({ ...params, messages: params.messages.slice() });
          const r = replies[Math.min(i++, replies.length - 1)];
          const handlers: Record<string, Array<(d: any) => void>> = {};
          const emit = (event: string, data: any) => (handlers[event] || []).forEach((h) => h(data));
          return {
            on(event: string, fn: (d: any) => void) {
              (handlers[event] = handlers[event] || []).push(fn);
              return this;
            },
            async finalMessage() {
              emit("streamEvent", {
                type: "message_start",
                message: { usage: { input_tokens: 20, cache_read_input_tokens: 80 } },
              });
              if (r.thinking) emit("thinking", r.thinking);
              emit("text", r.text);
              return {
                model: r.model || params.model,
                content: [
                  { type: "thinking", thinking: "", signature: "sig" },
                  { type: "text", text: r.text },
                ],
                stop_reason: r.stop_reason || "end_turn",
                stop_details: r.explanation ? { type: "refusal", explanation: r.explanation } : null,
                usage: {
                  input_tokens: 100,
                  output_tokens: 50,
                  cache_read_input_tokens: 80,
                  cache_creation_input_tokens: r.cacheWrite || 0,
                },
              };
            },
          };
        },
      },
    },
  };
  return { client, requests };
}

const IMG = [{ data: "AAAA", mediaType: "image/jpeg" as const }];

function grid(sw: string[], sh: string[]): string {
  const t: Transcription = {
    metadata: [{ key: "ragam", value: "Mohanam" }],
    cycle: "|4|",
    timing: "Eka, 2 per beat",
    sections: [
      {
        heading: "Pallavi",
        text: "",
        cycle: "",
        beatDuration: 2,
        lines: [
          {
            label: "",
            partial: false,
            uncertain: "",
            roles: [
              { role: "Sw", beats: sw },
              { role: "Sh", beats: sh },
            ],
          },
        ],
      },
    ],
    notes: ["sahitya aligned by position"],
  };
  return JSON.stringify(t);
}

const GOOD = grid(["s *,", "r g", "p *,", "d s."], ["Sa *,", "ri ga", "pa *,", "da sa"]);
const SHORT_BEAT = grid(["s", "r g", "p *,", "d s."], ["Sa *,", "ri ga", "pa *,", "da sa"]);

describe("parseTranscription", () => {
  test("accepts a grid and rejects anything else", () => {
    expect(parseTranscription(GOOD)?.cycle).toBe("|4|");
    expect(parseTranscription('{"cycle": "|4|"')).toBeNull();
    expect(parseTranscription('{"cycle": "|4|"}')).toBeNull();
  });
});

describe("transcribe", () => {
  test("turns a clean grid into DSL in one round", async () => {
    const { client, requests } = fakeClient([{ text: GOOD }]);
    const r = await transcribe(client, { images: IMG, hints: "Ragam: Mohanam" });
    expect(requests).toHaveLength(1);
    expect(r.notation).toContain("Sw: s , r g p , d s. ||");
    expect(r.notation).toContain("Sh: Sa , ri ga pa , da sa ||");
    expect(r.report.errors).toEqual([]);
    expect(r.report.inferredSlots).toBe(4);
    expect(r.check.errors).toEqual([]);

    const req = requests[0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.thinking).toEqual({ type: "adaptive", display: "summarized" });
    expect(req.output_config.effort).toBe("high");
    expect(req.output_config.format.type).toBe("json_schema");
    expect(req.fallbacks).toBe("default");
    expect(req.system[0].cache_control).toEqual({ type: "ephemeral" });
    const content = req.messages[0].content;
    expect(content[0].type).toBe("image");
    expect(content[content.length - 1].text).toContain("Ragam: Mohanam");
  });

  test("sends located grid errors back and keeps the corrected grid", async () => {
    const { client, requests } = fakeClient([{ text: SHORT_BEAT }, { text: GOOD }]);
    const r = await transcribe(client, { images: IMG, effort: "xhigh" });
    expect(requests).toHaveLength(2);
    const second = requests[1].messages;
    expect(second).toHaveLength(3);
    expect(second[1].content[0].type).toBe("thinking"); // reply passed back unchanged
    expect(second[2].content).toContain('"Pallavi", line 1, Sw, beat 1 ("s") has 1 slot(s)');
    expect(requests[1].output_config.effort).toBe("xhigh");
    expect(r.attempts).toHaveLength(2);
    expect(r.report.errors).toEqual([]);
    expect(r.usage.cacheReadTokens).toBe(160);
  });

  test("keeps the attempt with fewest errors when the fixes run out", async () => {
    const worse = grid(["s", "r", "p *,", "d s."], ["Sa *,", "ri ga", "pa *,", "da sa"]);
    const { client, requests } = fakeClient([{ text: SHORT_BEAT }, { text: worse }]);
    const r = await transcribe(client, { images: IMG, maxRepairs: 1 });
    expect(requests).toHaveLength(2);
    expect(r.report.errors).toHaveLength(1);
    expect(r.notation).toContain("Sw: s r g"); // still written out, for fixing by hand
  });

  test("an unreadable reply earns a retry", async () => {
    const { client, requests } = fakeClient([{ text: "{" }, { text: GOOD }]);
    const r = await transcribe(client, { images: IMG });
    expect(requests).toHaveLength(2);
    expect(requests[1].messages[2].content).toContain("not a readable grid");
    expect(r.report.errors).toEqual([]);
  });

  test("a reply cut off at max_tokens with nothing usable fails clearly", async () => {
    const { client, requests } = fakeClient([{ text: '{"metadata": [', stop_reason: "max_tokens" }]);
    await expect(transcribe(client, { images: IMG })).rejects.toThrow("cut off");
    expect(requests).toHaveLength(1);
  });

  test("labels pages when there are several photos", async () => {
    const { client, requests } = fakeClient([{ text: GOOD }]);
    await transcribe(client, { images: [IMG[0], IMG[0]] });
    const content = requests[0].messages[0].content;
    expect(content.map((c: any) => c.type)).toEqual(["text", "image", "text", "image", "text"]);
    expect(content[0].text).toBe("Page 1:");
    expect(content[4].text).toContain("2 photos");
  });

  test("throws on a refusal", async () => {
    const { client } = fakeClient([{ text: "", stop_reason: "refusal", explanation: "nope" }]);
    await expect(transcribe(client, { images: IMG })).rejects.toBeInstanceOf(TranscriptionRefusedError);
  });

  test("needs at least one photo", async () => {
    const { client } = fakeClient([{ text: GOOD }]);
    await expect(transcribe(client, { images: [] })).rejects.toThrow("at least one photo");
  });
});

describe("known facts", () => {
  test("a talam the user gave is enforced", async () => {
    const { client, requests } = fakeClient([
      { text: GOOD },
      { text: GOOD.replace('"cycle":"|4|"', '"cycle":"|4|2|2|"') },
    ]);
    // GOOD is Eka (|4|); the user says Adi, so the first answer is sent back.
    const r = await transcribe(client, { images: IMG, known: { cycle: "|4|2|2|" }, maxRepairs: 1 });
    expect(requests).toHaveLength(2);
    expect(requests[0].messages[0].content.at(-1).text).toContain('cycle "|4|2|2|"');
    expect(requests[1].messages[2].content).toContain('The user gave the tala as "|4|2|2|"');
    // The second answer uses Adi, but its 4-beat line is now half an avartanam: still reported.
    expect(r.report.errors.join("\n")).toContain("not a multiple of the 8-beat avartanam");
  });
});

describe("snippets", () => {
  test("the part and the earlier notation reach the model", async () => {
    const { client, requests } = fakeClient([{ text: GOOD }]);
    await transcribe(client, { images: IMG, snippet: { only: "Pallavi", context: "Sw: s r g m" } });
    const text = requests[0].messages[0].content.at(-1).text;
    expect(text).toContain("Transcribe only this part of the photo above: Pallavi.");
    expect(text).toContain("Sw: s r g m");
  });
});

describe("transcribe progress", () => {
  test("asks for summarized thinking and reports thinking, estimates and exact counts", async () => {
    const { client, requests } = fakeClient([{ text: GOOD, thinking: "Counting beats in row one." }]);
    const thinking: string[] = [];
    const progress: any[] = [];
    await transcribe(client, {
      images: IMG,
      onThinking: (d) => thinking.push(d),
      onProgress: (p) => progress.push(p),
    });

    expect(requests[0].thinking).toEqual({ type: "adaptive", display: "summarized" });
    expect(thinking).toEqual(["Counting beats in row one."]);
    expect(progress[0]).toEqual({ kind: "started", attempt: 0, inputTokens: 100, cacheReadTokens: 80 });
    const phases = progress.filter((p) => p.kind === "streaming").map((p) => p.phase);
    expect(phases).toEqual(["thinking", "writing"]);
    const last = progress[progress.length - 1];
    expect(last).toEqual({
      kind: "finished",
      attempt: 0,
      model: "claude-opus-5-5",
      outputTokens: 50,
      stopReason: "end_turn",
      costUsd: ONE_OPUS_ROUND,
    });
  });
});

// Each fake reply: 100 uncached input, 80 cache read, 50 output tokens.
const ONE_OPUS_ROUND = (100 * 4 + 80 * 0.2 + 50 * 20) / 1e6;
const ONE_SONNET_ROUND = (100 * 2 + 80 * 0.1 + 50 * 10) / 1e6;

describe("transcribe cost", () => {
  test("sums the estimate over repair rounds", async () => {
    const { client } = fakeClient([{ text: SHORT_BEAT }, { text: GOOD }]);
    const r = await transcribe(client, { images: IMG });
    expect(r.attempts).toHaveLength(2);
    expect(r.costUsd).toBeCloseTo(2 * ONE_OPUS_ROUND, 9);
  });

  test("prices a fallback round at the rates of the model that served it", async () => {
    const { client } = fakeClient([{ text: SHORT_BEAT }, { text: GOOD, model: "claude-sonnet-5-5" }]);
    const r = await transcribe(client, { images: IMG });
    expect(r.model).toBe("claude-sonnet-5-5");
    expect(r.costUsd).toBeCloseTo(ONE_OPUS_ROUND + ONE_SONNET_ROUND, 9);
  });

  test("counts cache writes in the usage and the cost", async () => {
    const { client } = fakeClient([{ text: GOOD, cacheWrite: 1000 }]);
    const r = await transcribe(client, { images: IMG });
    expect(r.usage.cacheWriteTokens).toBe(1000);
    expect(r.costUsd).toBeCloseTo(ONE_OPUS_ROUND + (1000 * 5) / 1e6, 9);
  });

  test("has no estimate when a round ran on a model without rates", async () => {
    const { client } = fakeClient([{ text: SHORT_BEAT }, { text: GOOD, model: "claude-unpriced" }]);
    const r = await transcribe(client, { images: IMG });
    expect(r.costUsd).toBeNull();
  });
});
