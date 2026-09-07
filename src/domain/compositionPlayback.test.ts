import { describe, expect, it } from "vitest";
import { compositionMediaTimeUs, compositionMomentum, compositionSegment } from "@/domain/compositionPlayback";

describe("multi-material composition clock", () => {
  it("partitions 2-10 seconds without a gap at cut boundaries", () => {
    for (const duration of [2_000_000, 6_000_000, 10_000_000]) {
      expect(compositionSegment(0, duration, 3)).toMatchObject({ index: 0, startUs: 0, localUs: 0 });
      expect(compositionSegment(duration, duration, 3).index).toBe(2);
      expect(compositionSegment(Math.ceil(duration / 3), duration, 3).index).toBe(1);
    }
  });
  it("resets sequential video time at its own entrance but not simultaneous layers", () => {
    expect(compositionMediaTimeUs("motion-zoom", 1, 3_500_000, 6_000_000, 2)).toBe(500_000);
    expect(compositionMediaTimeUs("card-stack", 1, 1_000_000, 6_000_000, 2)).toBe(0);
    expect(compositionMediaTimeUs("split-reveal", 1, 3_500_000, 6_000_000, 2)).toBe(3_500_000);
  });
  it("reuses the existing momentum curve continuously across a cut", () => {
    const before = compositionMomentum(1_000_000, 1_000_000, 0, 2);
    const after = compositionMomentum(0, 1_000_000, 1, 2);
    expect(before.scale).toBeCloseTo(after.scale);
    expect(compositionMomentum(500_000, 1_000_000, 1, 2).scale).toBe(1);
  });
});
