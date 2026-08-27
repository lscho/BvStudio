import { describe, expect, it } from "vitest";
import { CAMERA_PRESETS, cameraMotionForPreset, cameraStateAt } from "@/domain/camera";

describe("camera motion", () => {
  it("provides fixed, zoom, pan and combined camera presets", () => {
    expect(CAMERA_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(CAMERA_PRESETS.map((preset) => preset.id)).toEqual(expect.arrayContaining(["none", "push-in", "pull-out", "pan-left", "pan-right", "ken-burns-left"]));
  });

  it("interpolates and clamps camera motion with easing", () => {
    const motion = cameraMotionForPreset("push-right");
    expect(cameraStateAt(motion, -1)).toEqual({ scale: motion.startScale, x: motion.startX, y: motion.startY });
    expect(cameraStateAt(motion, 1)).toEqual({ scale: motion.endScale, x: motion.endX, y: motion.endY });
    expect(cameraStateAt(motion, 0.5)).toMatchObject({ scale: (motion.startScale + motion.endScale) / 2, x: 0 });
  });
});
