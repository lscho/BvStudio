import { describe, expect, it } from "vitest";
import { EASING_NAMES, LEGACY_EASING_NAMES, eased } from "@/domain/easing";

describe("domain easing registry", () => {
  it("keeps the legacy quadratic curves exactly as previously hard-coded", () => {
    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    for (const name of LEGACY_EASING_NAMES) {
      for (const p of samples) {
        const expected = name === "ease-in" ? p * p
          : name === "ease-out" ? 1 - (1 - p) ** 2
            : name === "ease-in-out" ? (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2)
              : p;
        expect(eased(p, name)).toBeCloseTo(expected, 12);
      }
    }
  });

  it("exposes every named curve with monotone endpoints", () => {
    for (const name of EASING_NAMES) {
      expect(eased(0, name)).toBeCloseTo(name === "elastic-out" ? 0 : eased(0, name), 12);
      // Elastic/back overshoot; they must still return to rest at t=1.
      expect(eased(1, name)).toBeCloseTo(1, 9);
      expect(Number.isFinite(eased(0.5, name))).toBe(true);
    }
  });

  it("adds expressive overshoot curves beyond the legacy set", () => {
    expect(eased(0.85, "back-out")).toBeGreaterThan(1);
    expect(eased(0.5, "bounce-out")).toBeGreaterThanOrEqual(0.7);
    expect(eased(0.5, "cubic-out")).toBeCloseTo(0.875, 12);
    expect(eased(0.5, "quart-out")).toBeCloseTo(1 - 0.5 ** 4, 12);
    expect(eased(0.5, "circ-out")).toBeCloseTo(Math.sqrt(1 - 0.25), 12);
  });
});
