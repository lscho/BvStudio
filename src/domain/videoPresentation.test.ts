import { describe, expect, it } from "vitest";
import { cameraMotionForPreset } from "@/domain/camera";
import type { VideoClip } from "@/domain/project";
import { createVideoPresentationCue, videoMotionPresetPatch, videoPresentationAt } from "@/domain/videoPresentation";

const clip: VideoClip = {
  id: "video", trackId: "video-1", kind: "video", label: "演示", startUs: 0, durationUs: 5_000_000,
  locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 0.8, fit: "cover",
  camera: cameraMotionForPreset("none")
};

describe("videoMotionPresetPatch", () => {
  it("creates the circular bottom-right presenter motion in one operation", () => {
    const patch = videoMotionPresetPatch("presenter-circle-bottom-right", clip);
    expect(patch).toMatchObject({ role: "presenter", layoutPreset: "presenter-bottom-right", mask: { shape: "circle", borderWidth: 3, focusX: 50, focusY: 38 }, transition: { preset: "dock" } });
    expect(patch.transformKeyframes).toHaveLength(2);
  });

  it("resets stale low-level properties when restoring full screen", () => {
    const patch = videoMotionPresetPatch("full-screen", clip);
    expect(patch).toMatchObject({ layoutPreset: "full", role: "a-roll", zIndex: 0, focus: { enabled: false }, mask: { shape: "rectangle" }, transition: { preset: "none" }, camera: { preset: "none" } });
    expect(patch.transformKeyframes).toEqual([]);
  });

  it("provides distinct magnify, spotlight and combined screen focus motions", () => {
    expect(videoMotionPresetPatch("screen-magnify", clip)).toMatchObject({ role: "screen", volume: 0, focus: { enabled: true, durationUs: clip.durationUs, zoom: 2.25, dimOpacity: 0, showCursor: false } });
    expect(videoMotionPresetPatch("screen-spotlight", clip)).toMatchObject({ focus: { enabled: true, zoom: 1, dimOpacity: 0.66, showCursor: false } });
    expect(videoMotionPresetPatch("screen-focus", clip)).toMatchObject({ focus: { enabled: true, durationUs: clip.durationUs, zoom: 1.85, radius: 15, dimOpacity: 0.42, showCursor: true } });
  });

  it("chains timed motions from the previous target instead of a fixed origin", () => {
    const timedClip = { ...clip, durationUs: 12_000_000 };
    const presenter = createVideoPresentationCue("presenter-circle-bottom-right", timedClip, 1_000_000);
    const full = createVideoPresentationCue("full-screen", timedClip, 10_000_000);
    timedClip.presentationCues = [presenter, full];

    expect(videoPresentationAt(timedClip, 999_999).transform).toMatchObject({ x: 50, y: 50, scale: 1 });
    expect(videoPresentationAt(timedClip, 2_000_000)).toMatchObject({ transform: { x: 84, y: 80, scale: 0.26 }, mask: { shape: "circle" } });
    const returning = videoPresentationAt(timedClip, 10_325_000).transform;
    expect(returning.x).toBeCloseTo(67);
    expect(returning.y).toBeCloseTo(65);
    expect(returning.scale).toBeCloseTo(0.63);
    expect(videoPresentationAt(timedClip, 11_000_000)).toMatchObject({ transform: { x: 50, y: 50, scale: 1 }, mask: { shape: "rectangle" } });
  });

  it("applies a zero-duration presentation cue immediately on its first frame", () => {
    const timedClip = { ...clip, presentationCues: [createVideoPresentationCue("presenter-circle-bottom-right", clip, 0)] };
    timedClip.presentationCues[0].transitionDurationUs = 0;

    expect(videoPresentationAt(timedClip, 0)).toMatchObject({
      transform: { x: 84, y: 80, scale: 0.26 },
      mask: { shape: "circle" }
    });
  });
});
