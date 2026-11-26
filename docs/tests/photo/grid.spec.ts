import {
  normalizeRole,
  parseBeat,
  parseCycle,
  toNotation,
  Transcription,
  validateTranscription,
} from "../../components/photo/grid";
import { checkNotation } from "../../components/photo/notationChecks";

/** A transcription with one Adi section at 2 slots per beat; override pieces per test. */
function adi(lines: Transcription["sections"][0]["lines"], extra: Partial<Transcription> = {}): Transcription {
  return {
    metadata: [{ key: "Ragam", value: "Mohanam" }],
    cycle: "|4|2|2|",
    timing: "Adi, 16 positions per avartanam",
    sections: [{ heading: "Pallavi", text: "", cycle: "", beatDuration: 2, lines }],
    notes: [],
    ...extra,
  };
}

const line = (sw: string[], sh?: string[], more: Partial<Transcription["sections"][0]["lines"][0]> = {}) => ({
  label: "",
  partial: false,
  uncertain: "",
  roles: [{ role: "Sw", beats: sw }, ...(sh ? [{ role: "Sh", beats: sh }] : [])],
  ...more,
});

// The prompt's own example: swaras without karvais, sahitya aligned by position.
const SW = ["s *,", "r g", "m *,", "*, *,", "p *,", "d *,", "n s.", "*, *,"];
const SH = ["Sa *,", "ri ga", "ma *,", "*, *,", "pa *,", "dha *,", "ni sa", "*, *,"];

describe("parseBeat", () => {
  test("counts slots and marks inferred ones", () => {
    const b = parseBeat("s *, r g");
    expect(b.error).toBeNull();
    expect(b.slots.map((s) => s.text)).toEqual(["s", ",", "r", "g"]);
    expect(b.slots.map((s) => s.inferred)).toEqual([false, true, false, false]);
  });

  test("groups are one slot, embellishments and '-' take none", () => {
    const b = parseBeat("[s r g m] ~/ p - d");
    expect(b.error).toBeNull();
    expect(b.slots.map((s) => s.text)).toEqual(["[s r g m]", "~/ p", "- d"]);
  });

  test("octave dots, unicode syllables and stray bars", () => {
    expect(parseBeat(".n s.. | ").slots.map((s) => s.text)).toEqual([".n", "s.."]);
    expect(parseBeat("śam ரா").slots).toHaveLength(2);
  });

  test("rejects what the DSL cannot hold", () => {
    expect(parseBeat("ga'n ,").error).toContain("not a valid");
    expect(parseBeat("s ;").error).toContain("two units");
    expect(parseBeat("[s r").error).toContain("unclosed");
    expect(parseBeat("s ~/").error).toContain("decorates nothing");
  });
});

describe("parseCycle and normalizeRole", () => {
  test("cycles", () => {
    expect(parseCycle("|4|2|2|")).toEqual([4, 2, 2]);
    expect(parseCycle(" | 3 | 2 | 2 | ")).toEqual([3, 2, 2]);
    expect(parseCycle("4+2+2")).toBeNull();
    expect(parseCycle("|0|")).toBeNull();
  });
  test("roles", () => {
    expect(normalizeRole("sw")).toBe("Sw");
    expect(normalizeRole("Sahityam")).toBe("Sh");
    expect(normalizeRole("tamil lyrics")).toBe("Tamillyrics");
  });
});

describe("validateTranscription", () => {
  test("a clean grid passes and counts what was filled in", () => {
    const r = validateTranscription(adi([line(SW, SH)]));
    expect(r.errors).toEqual([]);
    expect(r.inferredSlots).toBe(16);
  });

  test("points at the beat with the wrong number of slots", () => {
    const sw = [...SW];
    sw[5] = "d";
    const r = validateTranscription(adi([line(SW, SH), line(sw, SH)]));
    expect(r.errors).toEqual([
      expect.stringMatching(/^"Pallavi", line 2, Sw, beat 6 \("d"\) has 1 slot\(s\); beatDuration is 2/),
    ]);
  });

  test("roles that do not line up, and lines that are not whole avartanams", () => {
    const r = validateTranscription(adi([line(SW, SH.slice(0, 7))]));
    expect(r.errors.join("\n")).toContain("different numbers of beats (Sw 8, Sh 7)");
    const short = validateTranscription(adi([line(SW.slice(0, 6))]));
    expect(short.errors[0]).toContain("6 beats, not a multiple of the 8-beat avartanam");
  });

  test("partial lines and uncertain readings become things to check, not errors", () => {
    const r = validateTranscription(
      adi([line(SW.slice(0, 6), undefined, { partial: true, uncertain: "beat 5: m or n" })]),
    );
    expect(r.errors).toEqual([]);
    expect(r.checks).toEqual([
      '"Pallavi", line 1: beat 5: m or n',
      '"Pallavi", line 1: marked partial (6 beats, avartanam is 8).',
    ]);
  });

  test("bad cycle and beatDuration", () => {
    expect(validateTranscription(adi([], { cycle: "adi" })).errors[0]).toContain("not of the form");
    const t = adi([line(SW)]);
    t.sections[0].beatDuration = 0;
    expect(validateTranscription(t).errors[0]).toContain("beatDuration 0");
  });
});

describe("toNotation", () => {
  test("writes DSL that parses, with bars from the tala and the inferred spots commented", () => {
    const t = adi([line(SW, SH, { uncertain: "beat 7: n or r" })], {
      metadata: [{ key: "Title", value: 'Ninnu: "Kori"' }],
    });
    const dsl = toNotation(t);
    expect(dsl).toContain('title: "Ninnu: \\"Kori\\""');
    expect(dsl).toContain("> #### Pallavi");
    expect(dsl).toContain("\\beatDuration(2)");
    expect(dsl).toContain("Sw: s , r g m , , , | p , d , | n s. , , ||");
    expect(dsl).toContain("Sh: Sa , ri ga ma , , , | pa , dha , | ni sa , , ||");
    expect(dsl).toContain("// check: beat 7: n or r");
    expect(dsl).toContain("// unwritten units filled in at beats 1, 3-6, 8 (Sw, Sh)");
    const check = checkNotation(dsl);
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([]);
  });

  test("names filled-in beats per role when the roles differ", () => {
    const sw = ["s r", "g *,", "m p", "d n", "s. r.", "g. m.", "p. *,", "*, *,"];
    const sh = ["a b", "c d", "e f", "g h", "i j", "k l", "m n", "o *,"];
    const dsl = toNotation(adi([line(sw, sh)]));
    expect(dsl).toContain("// unwritten units filled in at beats 2 (Sw), 7 (Sw), 8 (Sw, Sh)");
  });

  test("per-section speed and tala, extra roles, groups and gamakas all parse", () => {
    const t: Transcription = {
      metadata: [],
      cycle: "|2|4|",
      timing: "",
      notes: [],
      sections: [
        {
          heading: "Pallavi",
          text: "Sing twice.",
          cycle: "",
          beatDuration: 1,
          lines: [line(["s", "r", "g", "~/ m", "p", "[d n]"], ["a", "b", "c", "d", "e", "f"])],
        },
        {
          heading: "Muktayi Swaram",
          text: "",
          cycle: "|4|2|2|",
          beatDuration: 4,
          lines: [
            {
              label: "2nd speed",
              partial: false,
              uncertain: "",
              roles: [
                { role: "Sw", beats: Array(8).fill("s r - g m") },
                { role: "Jathi", beats: Array(8).fill("ta ka dhi mi") },
              ],
            },
          ],
        },
      ],
    };
    expect(validateTranscription(t).errors).toEqual([]);
    const dsl = toNotation(t);
    expect(dsl).toContain("> Sing twice.");
    expect(dsl).toContain('\\cycle("|4|2|2|")');
    expect(dsl).toContain('\\role("Jathi", notes=false)');
    expect(dsl).toContain('\\line("2nd speed")');
    const check = checkNotation(dsl);
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([]);
    expect(check.lineCount).toBe(2);
  });
});
