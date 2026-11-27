import { MAX_CONTEXT_CHARS, SYSTEM_PROMPT, buildRepairPrompt, buildUserPrompt } from "../../components/photo/prompt";
import { parseBeat, TRANSCRIPTION_SCHEMA } from "../../components/photo/grid";
import { checkNotation } from "../../components/photo/notationChecks";

describe("SYSTEM_PROMPT", () => {
  test("its worked example obeys the grid rules it teaches", () => {
    // The example is Adi tala at 2 slots per beat; every beat shown must hold exactly 2 slots.
    const rows = Array.from(SYSTEM_PROMPT.matchAll(/"(Sw|Sh)": \[(.*)\]/g)).map((m) =>
      Array.from(m[2].matchAll(/"([^"]*)"/g)).map((b) => b[1]),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].length).toBe(rows[1].length);
    for (const row of rows) {
      for (const beat of row) {
        const parsed = parseBeat(beat);
        expect(parsed.error).toBeNull();
        expect(parsed.slots).toHaveLength(2);
      }
    }
  });

  test("every embellishment it names parses as written", () => {
    const gamakas = Array.from(SYSTEM_PROMPT.matchAll(/"(~\S* g)"/g)).map((m) => m[1]);
    expect(gamakas).toContain("~\\ g");
    expect(gamakas.length).toBeGreaterThanOrEqual(6);
    const dsl = '\\cycle("|' + gamakas.length + '|")\nSw: ' + gamakas.join(" ");
    expect(checkNotation(dsl).errors).toEqual([]);
  });

  test("every tala it lists is a valid cycle", () => {
    const cycles = Array.from(SYSTEM_PROMPT.matchAll(/"(\|[\d|]+\|)"/g)).map((m) => m[1]);
    expect(cycles.length).toBeGreaterThanOrEqual(9);
    for (const c of cycles) expect(checkNotation(`\\cycle("${c}")\nSw: s`).errors).toEqual([]);
  });

  test("has nothing that varies per call, so it stays cacheable", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("schema", () => {
  test("is strict-mode friendly: every object closed, every property required", () => {
    const visit = (node: any) => {
      if (node && typeof node === "object") {
        if (node.type === "object") {
          expect(node.additionalProperties).toBe(false);
          expect([...node.required].sort()).toEqual(Object.keys(node.properties).sort());
        }
        Object.values(node).forEach(visit);
      }
    };
    visit(TRANSCRIPTION_SCHEMA);
  });
});

describe("user and repair prompts", () => {
  test("single and multi page", () => {
    expect(buildUserPrompt(1, "")).toBe("Transcribe the notation in the photo above.");
    const multi = buildUserPrompt(3, "  Ragam: Mohanam ");
    expect(multi).toContain("3 photos");
    expect(multi).toContain("Ragam: Mohanam");
  });

  test("repair prompt lists the errors and caps a long list", () => {
    expect(buildRepairPrompt(["line 2, beat 6 has 1 slot"])).toContain("- line 2, beat 6 has 1 slot");
    const many = buildRepairPrompt(Array.from({ length: 50 }, (_, i) => `e${i}`));
    expect(many).toContain("- e39");
    expect(many).not.toContain("- e40");
    expect(many).toContain("10 more");
  });
});

describe("known facts", () => {
  test("are stated as facts, ahead of free-text hints", () => {
    const p = buildUserPrompt(2, "underline means double speed", {
      ragams: "Kedaram, Shankarabharanam",
      cycle: "|4|2|2|",
      notesPerBeat: 4,
      letterCase: "swarasthana",
    });
    expect(p).toContain("- Raga(s): Kedaram, Shankarabharanam");
    expect(p).toContain('cycle "|4|2|2|". Use exactly this cycle.');
    expect(p).toContain("Swaras per beat: 4");
    expect(p).toContain("names the swarasthana");
    expect(p.indexOf("Facts from the user")).toBeLessThan(p.indexOf("underline means double speed"));
  });

  test("nothing given, nothing added", () => {
    expect(buildUserPrompt(1, "", {})).toBe("Transcribe the notation in the photo above.");
  });

  test("the prompt teaches case as swarasthana, not length, by default", () => {
    expect(SYSTEM_PROMPT).toContain("case usually names the swarasthana");
    expect(SYSTEM_PROMPT).toContain("Clusters are phrases, not beats");
  });
});

describe("snippets", () => {
  test("only-this-part and earlier notation as context", () => {
    const p = buildUserPrompt(1, "", {}, { only: "Charanam swaram 3 (Mohanam)", context: "Sw: s r g" });
    expect(p).toContain("Transcribe only this part of the photo above: Charanam swaram 3 (Mohanam).");
    expect(p).toContain("<earlier_notation>\nSw: s r g\n</earlier_notation>");
    expect(p.indexOf("earlier_notation")).toBeLessThan(p.indexOf("Transcribe only"));
  });

  test("long context keeps its end, nearest the new part", () => {
    const long = "a".repeat(MAX_CONTEXT_CHARS) + "THE END";
    const p = buildUserPrompt(1, "", {}, { context: long });
    expect(p).toContain("THE END");
    expect(p).toContain("...\n");
    expect(p.length).toBeLessThan(MAX_CONTEXT_CHARS + 500);
  });

  test("the system prompt explains crops cut mid-row", () => {
    expect(SYSTEM_PROMPT).toContain("A crop can cut a row in the middle");
  });
});
