import {
  mergeNotation,
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

describe("a handwritten ragamalika notebook (conventions from a real page)", () => {
  // Hand-made grid in the shape the model is asked for: Adi at 4 per beat, one section per raga,
  // letter case as swarasthana (m = suddha, M = prati), an underlined double-speed run as groups,
  // sahitya only under the first lines.
  const t: Transcription = {
    metadata: [
      { key: "composer", value: "Patnam Subramanya Iyer" },
      { key: "talam", value: "Adi" },
    ],
    cycle: "|4|2|2|",
    timing: "Each row spans both columns: 16 units on the left (laghu), 16 on the right (drutams).",
    notes: ["Ticks and hooks above the swaras are the writer's gamaka marks; left out."],
    sections: [
      {
        heading: "Pallavi - Kedaram",
        text: "",
        cycle: "",
        beatDuration: 4,
        lines: [
          line(
            ["P , N ,", "S , , ,", "S N S R", "S S N N", "S m G m", "P N P P", "m m G G", "R R S N"],
            ["Va , la ,", "chi , , ,", "va , , ,", "chi , , ,", "yun , , ,", "naa , , ,", "naa , , ,", "pai , , ,"],
          ),
        ],
      },
      {
        heading: "Anupallavi - Shankarabharanam",
        text: "",
        cycle: "",
        beatDuration: 4,
        lines: [
          line([
            "S , P ,",
            "P m G R",
            "G , m ,",
            "P , , ,",
            "G m P D",
            "D P m P",
            "D N S N",
            "[S N] [D P] [m G] [R S]",
          ]),
        ],
      },
      {
        heading: "Chittaswaram - Kalyani",
        text: "",
        cycle: "",
        beatDuration: 4,
        lines: [line(["D N S R", ", G S R", "G M , D", "P M G R", "M G R S", ", D N S", "R , , G", ", M P D"])],
      },
    ],
  };

  test("validates, keeps letter case, and parses", () => {
    expect(validateTranscription(t).errors).toEqual([]);
    const dsl = toNotation(t);
    expect(dsl).toContain("> #### Pallavi - Kedaram");
    expect(dsl).toContain("Sw: P , N , S , , , S N S R S S N N | S m G m P N P P | m m G G R R S N ||");
    expect(dsl).toContain("[S N] [D P] [m G] [R S] ||");
    expect(dsl).toContain("G M , D"); // prati madhyamam stays upper case
    expect(dsl).not.toMatch(/Sh: *\n/); // swara-only lines get no empty sahitya row
    const check = checkNotation(dsl);
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([]);
    expect(check.lineCount).toBe(3);
  });
});

describe("mergeNotation (adding a snippet after earlier ones)", () => {
  const snippet = (heading: string, meta: Transcription["metadata"] = []) =>
    adi([line(SW, SH)], {
      metadata: meta,
      sections: [{ heading, text: "", cycle: "", beatDuration: 2, lines: [line(SW, SH)] }],
    });

  test("into an empty or placeholder editor it is the whole document", () => {
    const t = snippet("Pallavi", [{ key: "ragam", value: "Mohanam" }]);
    expect(mergeNotation("", t)).toBe(toNotation(t));
    expect(mergeNotation("// placeholder\n\n", t)).toBe(toNotation(t));
  });

  test("snippets in sequence make one valid document with one front matter", () => {
    let doc = mergeNotation("", snippet("Pallavi", [{ key: "ragam", value: "Mohanam" }]));
    doc = mergeNotation(
      doc,
      snippet("Anupallavi", [
        { key: "Ragam", value: "ignored, already set" },
        { key: "composer", value: "X" },
      ]),
    );
    doc = mergeNotation(doc, snippet("Charanam"));
    expect(doc.match(/^---$/gm)).toHaveLength(2);
    expect(doc).toContain('ragam: "Mohanam"');
    expect(doc).not.toContain("ignored, already set");
    expect(doc).toContain('composer: "X"');
    expect(doc.indexOf("Pallavi")).toBeLessThan(doc.indexOf("Anupallavi"));
    expect(doc.indexOf("Anupallavi")).toBeLessThan(doc.indexOf("Charanam"));
    const check = checkNotation(doc);
    expect(check.errors).toEqual([]);
    expect(check.lineCount).toBe(3);
  });

  test("metadata from a snippet goes to the top when the editor had none", () => {
    const doc = mergeNotation(
      '\\cycle("|4|2|2|")\nSw: s r g m p d n s.\n',
      snippet("Charanam", [{ key: "talam", value: "Adi" }]),
    );
    expect(doc.startsWith('---\ntalam: "Adi"\n---\n\\cycle')).toBe(true);
    expect(checkNotation(doc).errors).toEqual([]);
  });
});
