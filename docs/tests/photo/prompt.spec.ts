import { SYSTEM_PROMPT, buildRepairPrompt, buildUserPrompt } from "../../components/photo/prompt";
import { checkNotation } from "../../components/photo/notationChecks";

describe("SYSTEM_PROMPT", () => {
  // The prompt teaches by example, so every example in it has to be valid DSL that lines up.
  const examples = Array.from(SYSTEM_PROMPT.matchAll(/```notation\n([\s\S]*?)```/g)).map((m) => m[1]);

  test("has examples", () => {
    expect(examples.length).toBeGreaterThanOrEqual(2);
  });

  test.each(examples.map((e, i) => [i, e]))("example %i parses and aligns", (_i, src) => {
    const r = checkNotation(src as string);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  test("names the embellishments the parser accepts", () => {
    expect(SYSTEM_PROMPT).toContain("`~\\` irakka jaaru");
    expect(checkNotation('\\cycle("|4|")\nSw: s ~\\ r ~/ g ~w m').errors).toEqual([]);
  });

  test("has nothing that varies per call, so it stays cacheable", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("user and repair prompts", () => {
  test("single and multi page", () => {
    expect(buildUserPrompt(1, "")).toBe("Transcribe the notation in the photo above.");
    const multi = buildUserPrompt(3, "  Ragam: Mohanam ");
    expect(multi).toContain("3 photos");
    expect(multi).toContain("Ragam: Mohanam");
  });

  test("repair prompt lists errors and warnings", () => {
    const p = buildRepairPrompt(["Invalid command: meta"], ["Line 2: short"]);
    expect(p).toContain("- Invalid command: meta");
    expect(p).toContain("- Line 2: short");
  });
});
