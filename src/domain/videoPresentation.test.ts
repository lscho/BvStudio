import { describe, expect, it } from "vitest";
import { cameraMotionForPreset } from "@/domain/camera";
import { createEmptyProject, type ImageClip, type TimelineTrack, type VideoClip } from "@/domain/project";
import { createVideoPresentationCue, momentumExitTransition, momentumTransitionVisualState, selectedVisualTransitionCuts, videoMotionPresetPatch, videoPresentationAt } from "@/domain/videoPresentation";

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

  it("shrinks both sides of an adjacent momentum cut to 80 percent", () => {
    const outgoing = { ...clip, id: "outgoing" };
    const incoming: VideoClip = {
      ...clip,
      id: "incoming",
      startUs: clip.durationUs,
      transition: { preset: "momentum-zoom", durationUs: 500_000, easing: "ease-in-out" }
    };
    const exitTransition = momentumExitTransition(outgoing, [outgoing, incoming]);

    expect(exitTransition).toMatchObject({ preset: "momentum-zoom", durationUs: 500_000 });
    expect(momentumTransitionVisualState(outgoing, 4_500_000, exitTransition)).toEqual({ scale: 1, blur: 0 });
    expect(momentumTransitionVisualState(outgoing, 4_750_000, exitTransition)).toEqual({ scale: 0.95, blur: 0.5 });
    expect(momentumTransitionVisualState(outgoing, 5_000_000, exitTransition)).toEqual({ scale: 0.8, blur: 1 });
    expect(momentumTransitionVisualState(incoming, 0)).toEqual({ scale: 0.8, blur: 1 });
    expect(momentumTransitionVisualState(incoming, 250_000)).toEqual({ scale: 0.95, blur: 0.5 });
    expect(momentumTransitionVisualState(incoming, 500_000)).toEqual({ scale: 1, blur: 0 });
  });

  it("resolves an explicitly linked cross-track image transition", () => {
    const outgoing = { ...clip, id: "outgoing" };
    const incoming: ImageClip = {
      id: "incoming", trackId: "image-main", kind: "image", label: "贴图", startUs: 5_000_000, durationUs: 2_000_000,
      locked: false, assetId: "image", transform: { x: 68, y: 42, scale: 0.7, rotation: 8, opacity: 1 }, entrance: "pop", speed: 1,
      transition: { preset: "momentum-zoom", durationUs: 500_000, easing: "ease-in-out", fromClipId: outgoing.id }
    };

    expect(momentumExitTransition(outgoing, [outgoing, incoming])).toMatchObject({ preset: "momentum-zoom", fromClipId: outgoing.id });
    expect(momentumExitTransition(outgoing, [outgoing, { ...incoming, transition: { ...incoming.transition!, fromClipId: undefined } }])).toMatchObject({ preset: "momentum-zoom" });
    expect(momentumTransitionVisualState(incoming, 250_000)).toEqual({ scale: 0.95, blur: 0.5 });
  });

  it("skips an ambiguous cross-track cut unless the incoming material has an explicit source", () => {
    const project = createEmptyProject();
    const firstTrack = project.tracks.find((track) => track.kind === "video")!;
    const secondTrack: TimelineTrack = { ...structuredClone(firstTrack), id: "video-layer", clips: [] };
    const imageTrack = project.tracks.find((track) => track.kind === "image")!;
    project.tracks.splice(1, 0, secondTrack);
    firstTrack.clips.push({ ...clip, id: "first" });
    secondTrack.clips.push({ ...clip, id: "second", trackId: secondTrack.id });
    const image: ImageClip = {
      id: "incoming", trackId: imageTrack.id, kind: "image", label: "贴图", startUs: 5_000_000, durationUs: 1_000_000,
      locked: false, assetId: "image", transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, entrance: "pop", speed: 1
    };
    imageTrack.clips.push(image);

    expect(selectedVisualTransitionCuts(project, ["first", "second", "incoming"])).toEqual([]);
    image.transition = { preset: "none", durationUs: 500_000, easing: "ease-in-out", fromClipId: "second" };
    expect(selectedVisualTransitionCuts(project, ["first", "second", "incoming"])).toEqual([{ outgoing: secondTrack.clips[0], incoming: image }]);
    secondTrack.hidden = true;
    expect(selectedVisualTransitionCuts(project, ["first", "second", "incoming"])).toEqual([{ outgoing: firstTrack.clips[0], incoming: image }]);
  });
});
