import { checkNotation } from "../../components/photo/notationChecks";

describe("checkNotation", () => {
  test("accepts front matter, headings, bars and aligned roles", () => {
    const src = `---
title: Test
ragam: "Malahari"
---
\\cycle("|2|4|")
\\beatDuration(2)

> #### Pallavi

Sw: m p d s. s. r. | r. s. d p m p ||
Sh: Sri , Ga na na tha | Sin du ra , var na ||
`;
    const r = checkNotation(src);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.lineCount).toBe(1);
  });

  test("warns when Sw and Sh lengths differ", () => {
    const r = checkNotation(`\\cycle("|2|4|")
\\beatDuration(2)
Sw: m p d s. s. r. r. s. d p m p
Sh: Sri , Ga na na tha Sin du ra , var
`);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes("different lengths"))).toBe(true);
  });

  test("warns on a partial avartanam", () => {
    const r = checkNotation(`\\cycle("|4|2|2|")
\\beatDuration(2)
Sw: s r g m p d n s. s. n d p m g r
`);
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain("not a whole number");
  });

  test("groups count as one unit", () => {
    const r = checkNotation(`\\cycle("|4|")
\\beatDuration(1)
Sw: s [r g] m [p d n s.]
`);
    expect(r.warnings).toEqual([]);
  });

  test("warnings quote the line in DSL form", () => {
    const r = checkNotation(`\\cycle("|4|")
Sw: [s r] .n g. , -
Sh: a b c
`);
    expect(r.warnings[0]).toContain("Sw: [s r] .n g. ,");
    // "-" is a zero-length phrase mark, so it adds nothing to the count.
    expect(r.warnings[0]).toContain("Sw 4 beats, Sh 3 beats");
  });

  test("reports parse errors such as unknown commands", () => {
    const r = checkNotation(`\\meta("Ragam", "Mohanam")
Sw: s r g`);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
