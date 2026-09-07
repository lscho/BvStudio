import { describe, expect, it } from "vitest";
import { focusCardMediaRect, focusCardMoveProgress, focusCardSourceRect, focusCardTargetRect } from "@/domain/focusCard";

describe("focus card media motion", () => {
  it("moves from the full canvas into the same reference frame used by the card", () => {
    const params = { side: "left", camW: 700, camH: 700, camDX: 0, camDY: 0, moveMs: 720 };
    expect(focusCardTargetRect(params, 1920, 1080)).toEqual({ x: 110, y: 190, width: 700, height: 700, radius: 36 });
    expect(focusCardMediaRect(params, 1920, 1080, 0)).toEqual({ x: 0, y: 0, width: 1920, height: 1080, radius: 0 });
    expect(focusCardMediaRect(params, 1920, 1080, 720_000)).toEqual({ x: 110, y: 190, width: 700, height: 700, radius: 36 });
  });

  it("uses bounded deterministic easing and supports the right-side frame", () => {
    expect(focusCardMoveProgress({ moveMs: 720 }, -1)).toBe(0);
    expect(focusCardMoveProgress({ moveMs: 720 }, 9_000_000)).toBe(1);
    expect(focusCardTargetRect({ side: "right" }, 1920, 1080).x).toBe(1110);
  });

  it("keeps the presenter frame square and moves the list below it on portrait canvases", () => {
    const target = focusCardTargetRect({ camW: 700, camH: 700 }, 1080, 1920);
    expect(target.width).toBeCloseTo(864, 1);
    expect(target.height).toBeCloseTo(864, 1);
    expect(target.x).toBeCloseTo(108, 1);
    expect(target.y).toBeCloseTo(153.6, 1);
  });

  it("starts from the associated timeline video's actual position and shape", () => {
    const source = focusCardSourceRect({ x: 75, y: 70, scale: 0.5, rotation: 0, opacity: 1 }, "circle", 0, 1920, 1080);
    expect(source).toEqual({ x: 1170, y: 486, width: 540, height: 540, radius: 270 });
    expect(focusCardMediaRect({}, 1920, 1080, 0, source)).toEqual(source);
  });
});
