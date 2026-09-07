import { describe, expect, it } from "vitest";
import { adjustPresenterSafeArea, normalizePresenterSafeArea, presenterSafeAreaGeometry } from "@/domain/presenterSafeArea";
import { presenterMotionSafeArea } from "@/domain/motionLayout";

describe("presenter safe area", () => {
  it("preserves legacy preset bounds", () => {
    expect(presenterSafeAreaGeometry({ position: "right", widthPercent: 40 })).toEqual({ position: "custom", xPercent: 57, yPercent: 6, widthPercent: 40, heightPercent: 72 });
    expect(presenterMotionSafeArea({ position: "none", widthPercent: 32 }, 0, 5_000_000)).toBeNull();
  });

  it("uses the exact free-positioned bounds for matching", () => {
    expect(presenterMotionSafeArea({ position: "custom", xPercent: 12, yPercent: 24, widthPercent: 28, heightPercent: 50 }, 2_000_000, 4_000_000)).toEqual({
      startUs: 2_000_000, durationUs: 4_000_000, rect: { left: 12, top: 24, right: 40, bottom: 74 }
    });
  });

  it("normalizes malformed and out-of-bounds geometry", () => {
    expect(normalizePresenterSafeArea(null)).toEqual({ position: "none", widthPercent: 32 });
    expect(normalizePresenterSafeArea({ position: "custom", xPercent: Infinity, yPercent: "top", widthPercent: NaN, heightPercent: null })).toEqual({ position: "custom", xPercent: 34, yPercent: 6, widthPercent: 32, heightPercent: 72 });
    expect(normalizePresenterSafeArea({ position: "custom", xPercent: 99, yPercent: -40, widthPercent: 200, heightPercent: 200 })).toEqual({ position: "custom", xPercent: 40, yPercent: 0, widthPercent: 60, heightPercent: 100 });
  });

  it("moves within the canvas and resizes while anchoring the opposite corner", () => {
    const area = presenterSafeAreaGeometry({ position: "center", widthPercent: 32 });
    expect(adjustPresenterSafeArea(area, "move", 100, -100)).toMatchObject({ xPercent: 68, yPercent: 0, widthPercent: 32, heightPercent: 72 });
    expect(adjustPresenterSafeArea(area, "se", 10, 10)).toMatchObject({ xPercent: 34, yPercent: 6, widthPercent: 42, heightPercent: 82 });
    expect(adjustPresenterSafeArea(area, "nw", 10, 10)).toMatchObject({ xPercent: 44, yPercent: 16, widthPercent: 22, heightPercent: 62 });
    expect(adjustPresenterSafeArea(area, "nw", 100, 100)).toMatchObject({ xPercent: 48, yPercent: 60, widthPercent: 18, heightPercent: 18 });
    expect(adjustPresenterSafeArea(area, "se", 100, 100)).toMatchObject({ xPercent: 34, yPercent: 6, widthPercent: 60, heightPercent: 94 });
  });
});
