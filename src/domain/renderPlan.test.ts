import { describe, expect, it } from "vitest";
import { createEmptyProject, type AudioClip, type GeneratedBlock, type GeneratedScene, type VideoClip } from "@/domain/project";
import { buildRenderPlan } from "@/domain/renderPlan";
import { cameraMotionForPreset } from "@/domain/camera";

function scene(overrides: Partial<GeneratedScene> = {}): GeneratedScene {
  return {
    id: "scene",
    title: "重点",
    narration: "",
    durationUs: 3_000_000,
    effectId: "title-highlight",
    textColor: "#ffffff",
    accentColor: "#ffb84d",
    fontSize: 58,
    speed: 1,
    transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
    mediaSourceInUs: 0,
    mediaFit: "cover",
    mediaVolume: 0,
    camera: cameraMotionForPreset("none"),
    ...overrides
  };
}

describe("buildRenderPlan", () => {
  it("uses generated scenes as base segments and exports effects as overlays", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 10_000_000, sourcePath: "/media/source.mp4", hasAudio: true });
    const video: VideoClip = { id: "video", trackId: "video-main", kind: "video", label: "source", startUs: 0, durationUs: 10_000_000, locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 0.8, fit: "cover", camera: cameraMotionForPreset("none") };
    const generated: GeneratedBlock = { id: "generated", trackId: "generated-main", kind: "generated", label: "AI", startUs: 2_000_000, durationUs: 3_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "replace", scenes: [scene({ fontSize: 64, speed: 1.4, transform: { x: 62, y: 44, scale: 1.2, rotation: 5, opacity: 0.85 } })] };
    project.tracks.find((track) => track.kind === "video")!.clips.push(video);
    project.tracks.find((track) => track.kind === "generated")!.clips.push(generated);
    project.tracks.find((track) => track.kind === "effect")!.clips.push({ id: "effect", trackId: "effect-main", kind: "effect", label: "标题", startUs: 1_000_000, durationUs: 2_000_000, locked: false, effectId: "title-highlight", text: "你好", color: "#ffffff", accentColor: "#ff0000", fontSize: 48, speed: 1, transform: { x: 40, y: 30, scale: 1, rotation: 0, opacity: 0.9 } });

    const plan = buildRenderPlan(project, "/output.mp4");

    expect(plan.segments.map((segment) => [segment.kind, segment.durationUs])).toEqual([
      ["video", 2_000_000], ["generated", 3_000_000], ["video", 5_000_000]
    ]);
    expect(plan.segments[0]).toMatchObject({ path: "/media/source.mp4", volume: 0.8, fit: "cover", hasAudio: true });
    expect(plan.segments[2].sourceInUs).toBe(5_000_000);
    expect(plan.overlays).toContainEqual(expect.objectContaining({ text: "你好", startUs: 1_000_000, x: 40, opacity: 0.9 }));
    expect(plan.overlays).toContainEqual(expect.objectContaining({ text: "重点", fontSize: 64, speed: 1.4, x: 62, y: 44, scale: 1.2, rotation: 5, opacity: 0.85 }));
    expect(plan.audios).toEqual([]);
  });

  it("keeps video as the base for overlay AI blocks", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 4_000_000, sourcePath: "/source.mp4" });
    project.tracks[0].clips.push({ id: "video", trackId: "video-main", kind: "video", label: "source", startUs: 0, durationUs: 4_000_000, locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "contain", camera: cameraMotionForPreset("none") });
    project.tracks.find((track) => track.kind === "generated")!.clips.push({ id: "generated", trackId: "generated-main", kind: "generated", label: "AI", startUs: 1_000_000, durationUs: 2_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "overlay", scenes: [scene({ title: "补充", durationUs: 2_000_000, accentColor: "#47d7ac" })] });

    const plan = buildRenderPlan(project, "/output.mp4");
    expect(plan.segments.every((segment) => segment.kind === "video")).toBe(true);
    expect(plan.overlays).toContainEqual(expect.objectContaining({ text: "补充", startUs: 1_000_000, durationUs: 2_000_000 }));
  });

  it("uses AI-matched local video as a generated scene base", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "broll", name: "growth.mp4", kind: "video", durationUs: 8_000_000, sourcePath: "/media/growth.mp4", hasAudio: true });
    project.tracks.find((track) => track.kind === "generated")!.clips.push({ id: "generated", trackId: "generated-main", kind: "generated", label: "AI", startUs: 0, durationUs: 3_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "insert", scenes: [scene({ mediaAssetId: "broll", mediaSourceInUs: 2_000_000, mediaFit: "contain", mediaVolume: 0.25 })] });

    const plan = buildRenderPlan(project, "/output.mp4");
    expect(plan.segments).toEqual([expect.objectContaining({ kind: "video", path: "/media/growth.mp4", sourceInUs: 2_000_000, durationUs: 3_000_000, fit: "contain", volume: 0.25, hasAudio: true, loop: true })]);
  });

  it("wraps a short matched video source in-point for split generated segments", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "short", name: "short.mp4", kind: "video", durationUs: 1_000_000, sourcePath: "/media/short.mp4" });
    project.tracks.find((track) => track.kind === "video")!.clips.push({ id: "underlay", trackId: "video-main", kind: "video", label: "underlay", startUs: 1_500_000, durationUs: 500_000, locked: false, assetId: "short", sourceInUs: 0, playbackRate: 1, volume: 0, fit: "cover", camera: cameraMotionForPreset("none") });
    project.tracks.find((track) => track.kind === "generated")!.clips.push({ id: "generated", trackId: "generated-main", kind: "generated", label: "AI", startUs: 0, durationUs: 3_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "insert", scenes: [scene({ durationUs: 3_000_000, mediaAssetId: "short", mediaSourceInUs: 800_000 })] });
    const plan = buildRenderPlan(project, "/output.mp4");
    expect(plan.segments.map((segment) => segment.sourceInUs)).toEqual([800_000, 300_000, 800_000]);
    expect(plan.segments.every((segment) => segment.loop)).toBe(true);
  });

  it("keeps camera progress continuous when video segments are split by other timeline cuts", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 8_000_000, sourcePath: "/source.mp4" });
    project.tracks.find((track) => track.kind === "video")!.clips.push({ id: "video", trackId: "video-main", kind: "video", label: "source", startUs: 0, durationUs: 8_000_000, locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForPreset("push-in") });
    project.tracks.find((track) => track.kind === "generated")!.clips.push({ id: "overlay", trackId: "generated-main", kind: "generated", label: "overlay", startUs: 2_000_000, durationUs: 2_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "overlay", scenes: [scene({ durationUs: 2_000_000 })] });

    const segments = buildRenderPlan(project, "/output.mp4").segments;
    expect(segments.map((segment) => [segment.cameraOffsetUs, segment.cameraDurationUs])).toEqual([[0, 8_000_000], [2_000_000, 8_000_000], [4_000_000, 8_000_000]]);
    expect(segments.every((segment) => segment.camera?.preset === "push-in")).toBe(true);
  });

  it("exports audio clips with mixing roles and ignores muted audio tracks", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "voice", name: "voice.wav", kind: "audio", durationUs: 3_000_000, sourcePath: "/voice.wav", hasAudio: true });
    const voice: AudioClip = { id: "voice-clip", trackId: "audio-main", kind: "audio", label: "Voice", startUs: 1_000_000, durationUs: 2_000_000, locked: false, assetId: "voice", sourceInUs: 250_000, playbackRate: 1, volume: 0.9, fadeInUs: 100_000, fadeOutUs: 200_000, role: "voice" };
    project.tracks.find((track) => track.audioRole === "voice")!.clips.push(voice);

    expect(buildRenderPlan(project, "/output.mp4").audios).toEqual([expect.objectContaining({ path: "/voice.wav", role: "voice", startUs: 1_000_000, volume: 0.9 })]);
    project.tracks.find((track) => track.audioRole === "voice")!.muted = true;
    expect(buildRenderPlan(project, "/output.mp4").audios).toEqual([]);
  });

  it("exports image stickers with their transform and entrance recipe", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "image", name: "badge.png", kind: "image", durationUs: 5_000_000, sourcePath: "/media/badge.png", width: 600, height: 400 });
    project.tracks.find((track) => track.kind === "image")!.clips.push({ id: "sticker", trackId: "image-main", kind: "image", label: "badge", startUs: 2_000_000, durationUs: 4_000_000, locked: false, assetId: "image", transform: { x: 70, y: 35, scale: 1.4, rotation: -12, opacity: 0.75 }, entrance: "fade-up", speed: 1.8 });

    expect(buildRenderPlan(project, "/output.mp4").overlays).toContainEqual(expect.objectContaining({
      kind: "image", imagePath: "/media/badge.png", startUs: 2_000_000, durationUs: 4_000_000,
      targetWidthPx: Math.round(1920 * 0.3 * 1.4), x: 70, y: 35, rotation: -12, opacity: 0.75,
      speed: 1.8, recipe: expect.objectContaining({ entrance: "fade-up" })
    }));
  });
});
