import { extractNotation, transcribe, TranscriptionRefusedError } from "../../components/photo/transcriber";

/** A stand-in for client.beta.messages.stream that replays canned replies and records requests. */
function fakeClient(replies: Array<{ text: string; stop_reason?: string; explanation?: string }>) {
  const requests: any[] = [];
  let i = 0;
  const client: any = {
    beta: {
      messages: {
        stream(params: any) {
          // Copy the messages, since the transcriber keeps appending to the same array.
          requests.push({ ...params, messages: params.messages.slice() });
          const r = replies[Math.min(i++, replies.length - 1)];
          const handlers: Array<(d: string) => void> = [];
          return {
            on(event: string, fn: (d: string) => void) {
              if (event === "text") handlers.push(fn);
              return this;
            },
            async finalMessage() {
              handlers.forEach((h) => h(r.text));
              return {
                model: params.model,
                content: [
                  { type: "thinking", thinking: "", signature: "sig" },
                  { type: "text", text: r.text },
                ],
                stop_reason: r.stop_reason || "end_turn",
                stop_details: r.explanation ? { type: "refusal", explanation: r.explanation } : null,
                usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 80 },
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
const fenced = (body: string, notes = "") => "```notation\n" + body + "\n```\n" + (notes ? `Notes: ${notes}\n` : "");

const GOOD = `\\cycle("|4|")
Sw: s r g m
Sh: sa ri ga ma`;

describe("extractNotation", () => {
  test("takes the notation block and the notes after it", () => {
    const r = extractNotation(fenced(GOOD, "tala inferred"));
    expect(r.notation).toBe(GOOD + "\n");
    expect(r.notes).toBe("tala inferred");
  });

  test("prefers a notation-tagged block over other fences", () => {
    const r = extractNotation("```yaml\nx: 1\n```\n```notation\nSw: s\n```");
    expect(r.notation).toBe("Sw: s\n");
  });

  test("survives an unterminated fence and no fence", () => {
    expect(extractNotation("```notation\nSw: s r").notation).toBe("Sw: s r\n");
    expect(extractNotation("Sw: s r").notation).toBe("Sw: s r");
  });
});

describe("transcribe", () => {
  test("returns the first answer when it parses and aligns", async () => {
    const { client, requests } = fakeClient([{ text: fenced(GOOD) }]);
    const r = await transcribe(client, { images: IMG, hints: "Ragam: Mohanam" });
    expect(requests).toHaveLength(1);
    expect(r.notation).toBe(GOOD + "\n");
    expect(r.check.errors).toEqual([]);

    const req = requests[0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.thinking).toEqual({ type: "adaptive" });
    expect(req.fallbacks).toBe("default");
    expect(req.system[0].cache_control).toEqual({ type: "ephemeral" });
    const content = req.messages[0].content;
    expect(content[0].type).toBe("image");
    expect(content[content.length - 1].text).toContain("Ragam: Mohanam");
  });

  test("sends parse errors back and keeps the corrected answer", async () => {
    const { client, requests } = fakeClient([{ text: fenced('\\meta("x")\n' + GOOD) }, { text: fenced(GOOD) }]);
    const r = await transcribe(client, { images: IMG });
    expect(requests).toHaveLength(2);
    const second = requests[1].messages;
    expect(second).toHaveLength(3);
    // The assistant turn goes back unchanged, thinking block included.
    expect(second[1].content[0].type).toBe("thinking");
    expect(second[2].content).toContain("Invalid command: meta");
    expect(r.attempts).toHaveLength(2);
    expect(r.check.errors).toEqual([]);
    expect(r.usage.cacheReadTokens).toBe(160);
  });

  test("asks about alignment warnings only once", async () => {
    const short = `\\cycle("|4|")\nSw: s r g`;
    const { client, requests } = fakeClient([{ text: fenced(short) }, { text: fenced(short) }]);
    const r = await transcribe(client, { images: IMG, maxRepairs: 3 });
    expect(requests).toHaveLength(2);
    expect(r.check.warnings).toHaveLength(1);
  });

  test("keeps an earlier answer that parsed over a later broken one", async () => {
    const short = `\\cycle("|4|")\nSw: s r g`;
    const { client } = fakeClient([{ text: fenced(short) }, { text: fenced("\\bogus\n") }]);
    const r = await transcribe(client, { images: IMG, maxRepairs: 1 });
    expect(r.notation).toBe(short + "\n");
  });

  test("gives up after maxRepairs and still returns the last attempt", async () => {
    const { client, requests } = fakeClient([{ text: fenced("\\bogus\n") }]);
    const r = await transcribe(client, { images: IMG, maxRepairs: 2 });
    expect(requests).toHaveLength(3);
    expect(r.check.errors.length).toBeGreaterThan(0);
  });

  test("labels pages when there are several photos", async () => {
    const { client, requests } = fakeClient([{ text: fenced(GOOD) }]);
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
    const { client } = fakeClient([{ text: fenced(GOOD) }]);
    await expect(transcribe(client, { images: [] })).rejects.toThrow("at least one photo");
  });
});
