import { estimateCost, formatCost } from "../../components/photo/pricing";

describe("estimateCost", () => {
  test("prices each kind of token at its own Opus 5.5 rate", () => {
    // One million of each: $4 input + $5 cache write + $0.20 cache read + $20 output.
    const cost = estimateCost("claude-opus-5-5", {
      inputTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(29.2, 6);
  });

  test("matches the second real Kedaram run", () => {
    // 1898 uncached in, 4989 from cache, 4718 out on Opus 5.5.
    const cost = estimateCost("claude-opus-5-5", {
      inputTokens: 1898,
      cacheWriteTokens: 0,
      cacheReadTokens: 4989,
      outputTokens: 4718,
    });
    expect(cost).toBeCloseTo(0.10295, 5);
  });

  test("uses Sonnet 5.5 rates for Sonnet", () => {
    const cost = estimateCost("claude-sonnet-5-5", {
      inputTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(2 + 2.5 + 0.1 + 10, 6);
  });

  test("returns null for a model it has no rates for", () => {
    const usage = { inputTokens: 10, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 10 };
    expect(estimateCost("claude-some-future-model", usage)).toBeNull();
  });
});

describe("formatCost", () => {
  test("shows cents to three places under a dollar, two above", () => {
    expect(formatCost(0.1027)).toBe("$0.103");
    expect(formatCost(1.234)).toBe("$1.23");
    expect(formatCost(0)).toBe("$0.000");
  });

  test("says unknown for null", () => {
    expect(formatCost(null)).toBe("unknown");
  });
});
