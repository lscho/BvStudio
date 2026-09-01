import { describe, expect, it } from "vitest";
import { barGeometryAt, counterValueAt, donutGeometryAt, formatChartValue, lineGeometryAt, measureChartBox, niceMax } from "@/domain/chartEffects";

const BOX = { width: 320, height: 200 };
const FONT = 32;

describe("chart value formatting", () => {
  it("groups thousands and keeps decimals stable", () => {
    expect(formatChartValue(1234567.89, 2)).toBe("1,234,567.89");
    expect(formatChartValue(1234567.5)).toBe("1,234,568"); // whole numbers round like labels do
    expect(formatChartValue(0, 2)).toBe("0.00");
    expect(formatChartValue(-4200)).toBe("-4,200");
  });

  it("rounds axis maxima to friendly numbers", () => {
    expect(niceMax(82)).toBe(100);
    expect(niceMax(101)).toBe(200);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(0)).toBe(1);
  });
});

describe("deterministic chart geometry", () => {
  it("rolls counters as a pure function of progress", () => {
    const spec = { kind: "counter" as const, startValue: 10, endValue: 90 };
    expect(counterValueAt(spec, 0)).toBeCloseTo(10);
    expect(counterValueAt(spec, 1)).toBeCloseTo(90);
    // cubic-out at mid progress reaches 87.5%
    expect(counterValueAt(spec, 0.5)).toBeCloseTo(10 + 80 * 0.875);
    // determinism: same input, same output
    expect(counterValueAt(spec, 0.37)).toBe(counterValueAt(spec, 0.37));
  });

  it("grows horizontal comparison bars monotonically with stagger", () => {
    const spec = { kind: "bar" as const, series: [20, 60, 40], categories: ["a", "b", "c"] };
    const early = barGeometryAt(BOX, spec, FONT, 0.2);
    const late = barGeometryAt(BOX, spec, FONT, 0.9);
    early.bars.forEach((bar, index) => {
      expect(bar.fill).toBeGreaterThanOrEqual(0);
      expect(late.bars[index].width).toBeGreaterThanOrEqual(bar.width);
      if (early.bars[index].fill > 0) {
        expect(early.bars[index].y).toBeCloseTo(late.bars[index].y, 9);
      }
    });
    expect(late.bars.every((bar) => bar.width <= bar.maxWidth)).toBe(true);
    expect(late.bars[1].y).toBeGreaterThan(late.bars[0].y);
    // same inputs → identical geometry
    const again = barGeometryAt(BOX, spec, FONT, 0.2);
    expect(again.bars.map((bar) => bar.fill)).toEqual(early.bars.map((bar) => bar.fill));
  });

  it("sweeps donut arcs within the full circle and tracks the center counter", () => {
    const spec = { kind: "donut" as const, series: [50, 30, 20], suffix: "%" };
    const done = donutGeometryAt(BOX, spec, FONT, 1);
    const total = done.slices.reduce((sum, slice) => sum + slice.endIndex - slice.startIndex, 0);
    expect(total).toBeLessThanOrEqual(Math.PI * 2 + 1e-6);
    expect(done.centerValue).toBeCloseTo(50);
    expect(done.centerX).toBeLessThan(BOX.width / 2);
    expect(done.legendX).toBeGreaterThan(done.centerX + done.radius);
    const early = donutGeometryAt(BOX, spec, FONT, 0.1);
    expect(early.slices[0].endIndex - early.slices[0].startIndex).toBeGreaterThan(0);
    expect(early.slices[1].endIndex - early.slices[1].startIndex).toBe(0);
    const empty = donutGeometryAt(BOX, spec, FONT, 0);
    expect(empty.slices.every((slice) => slice.endIndex - slice.startIndex <= 1e-9)).toBe(true);
  });

  it("reveals the polyline by traveled distance, then freezes", () => {
    const spec = { kind: "line" as const, series: [10, 40, 25, 70], categories: ["一", "二", "三", "四"] };
    const start = lineGeometryAt(BOX, spec, FONT, 0);
    const mid = lineGeometryAt(BOX, spec, FONT, 0.5);
    const done = lineGeometryAt(BOX, spec, FONT, 1);
    expect(start.traveled).toBeLessThan(mid.traveled);
    expect(mid.revealedIndex).toBeLessThanOrEqual(done.revealedIndex);
    const total = done.segmentLengths.reduce((sum, length) => sum + length, 0);
    expect(done.traveled).toBeCloseTo(total, 6);
    expect(lineGeometryAt(BOX, spec, FONT, 0.85).traveled).toBe(lineGeometryAt(BOX, spec, FONT, 0.85).traveled);
  });

  it("sizes overlay boxes proportionally to font size per chart kind", () => {
    expect(measureChartBox({ kind: "counter", endValue: 100 }, 20).width).toBeGreaterThan(0);
    expect(measureChartBox({ kind: "donut" }, 20).width).toBeCloseTo(measureChartBox({ kind: "donut" }, 40).width / 2, 6);
    expect(measureChartBox({ kind: "bar" }, 20).width).toBe(measureChartBox({ kind: "line" }, 20).width);
    expect(measureChartBox({ kind: "donut" }, 20).width).toBeGreaterThan(measureChartBox({ kind: "donut" }, 20).height);
    expect(measureChartBox({ kind: "line" }, 48).width).toBeCloseTo(460.8);
    expect(measureChartBox({ kind: "line" }, 48).height).toBeCloseTo(273.6);
  });
});
