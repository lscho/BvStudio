import { describe, expect, it } from "vitest";
import { createEmptyProject, type GeneratedBlock, type TimelineTrack, type VideoClip } from "@/domain/project";
import { buildRenderPlan } from "@/domain/renderPlan";
import { cameraMotionForPreset } from "@/domain/camera";
import { createVideoPresentationCue } from "@/domain/videoPresentation";

describe("buildRenderPlan", () => {
  it("does not render legacy generated-scene effects or media", () => {
    const project = createEmptyProject();
    const generated: GeneratedBlock = {
      id: "generated", trackId: "generated-main", kind: "generated", label: "AI", startUs: 0, durationUs: 2_000_000,
      locked: false, article: "文章", narration: "口播", prompt: "主题", insertMode: "insert",
      scenes: [{ id: "legacy", title: "旧占位文字", narration: "字幕", durationUs: 2_000_000, effectId: "scene-focus-stack", textColor: "#ffffff", accentColor: "#ff0000", fontSize: 64, speed: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: cameraMotionForPreset("none") }]
    };
    project.tracks.find((track) => track.kind === "generated")!.clips.push(generated);
    const plan = buildRenderPlan(project, "/output.mp4");
    expect(plan.segments).toEqual([expect.objectContaining({ kind: "generated", title: "" })]);
    expect(plan.overlays).toEqual([]);
  });

  it("exports materialized subtitle and effect timeline clips", () => {
    const project = createEmptyProject();
    project.tracks.find((track) => track.kind === "effect")!.clips.push({ id: "effect", trackId: "effect-main", kind: "effect", label: "AI 动效", startUs: 1_000_000, durationUs: 2_000_000, locked: false, effectId: "test-title-slide", text: "真实内容", color: "#ffffff", accentColor: "#ff0000", fontSize: 48, speed: 1, transform: { x: 40, y: 30, scale: 1, rotation: 0, opacity: 0.9 } });
    project.tracks.find((track) => track.kind === "subtitle")!.clips.push({ id: "subtitle", trackId: "subtitle-main", kind: "subtitle", label: "字幕", startUs: 1_000_000, durationUs: 2_000_000, locked: false, text: "时间字幕。", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88 });
    const overlays = buildRenderPlan(project, "/output.mp4").overlays;
    expect(overlays).toContainEqual(expect.objectContaining({ text: "真实内容", startUs: 1_000_000, x: 40 }));
    expect(overlays).toContainEqual(expect.objectContaining({ text: "时间字幕", startUs: 1_000_000, y: 88 }));
  });

  it("preserves staged cross-caption motion timing in the render plan", () => {
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "effect")!;
    track.clips.push(
      { id: "title", trackId: track.id, kind: "effect", label: "市场格局", startUs: 1_000_000, durationUs: 6_000_000, locked: false, effectId: "test-title-slide", text: "市场格局", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, speed: 1, sceneGroupId: "ai-motion:market", transform: { x: 50, y: 24, scale: 1, rotation: 0, opacity: 1 } },
      { id: "public", trackId: track.id, kind: "effect", label: "公共充电桩", startUs: 2_500_000, durationUs: 4_500_000, locked: false, effectId: "test-callout-panel", text: "公共充电桩", color: "#ffffff", accentColor: "#47d7ac", fontSize: 44, speed: 1, sceneGroupId: "ai-motion:market", transform: { x: 30, y: 48, scale: 1, rotation: 0, opacity: 1 } }
    );
    const overlays = buildRenderPlan(project, "/output.mp4").overlays;
    expect(overlays).toContainEqual(expect.objectContaining({ text: "市场格局", startUs: 1_000_000, durationUs: 6_000_000 }));
    expect(overlays).toContainEqual(expect.objectContaining({ text: "公共充电桩", startUs: 2_500_000, durationUs: 4_500_000 }));
  });

  it("exports styled subtitle keywords and chapter progress", () => {
    const project = createEmptyProject();
    project.chapterProgress = {
      enabled: true, backgroundColor: "#111316", activeColor: "#ffb84d", textColor: "#ffffff", height: 52,
      chapters: [{ id: "intro", title: "开场", startUs: 0 }, { id: "steps", title: "步骤", startUs: 4_000_000 }]
    };
    project.tracks.find((track) => track.kind === "subtitle")!.clips.push({
      id: "subtitle", trackId: "subtitle-main", kind: "subtitle", label: "字幕", startUs: 0, durationUs: 2_000_000,
      locked: false, text: "先整理素材", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88,
      stylePreset: "bold", highlightWords: ["整理素材"], highlightColor: "#ffb84d", outlineColor: "#000000", outlineWidth: 4,
      backgroundOpacity: 0, borderRadius: 0
    });
    const overlays = buildRenderPlan(project, "/output.mp4").overlays;
    expect(overlays).toContainEqual(expect.objectContaining({ kind: "text", subtitleStyle: expect.objectContaining({ preset: "bold", highlightWords: ["整理素材"] }) }));
    expect(overlays).toContainEqual(expect.objectContaining({ kind: "progress", chapters: project.chapterProgress.chapters, zIndex: 500 }));
  });

  it("applies one-off output dimensions, frame rate and format without changing the project", () => {
    const project = createEmptyProject();
    const plan = buildRenderPlan(project, "/output.mov", { format: "mov", width: 1280, height: 720, fps: 24 });
    expect(plan).toMatchObject({ format: "mov", width: 1280, height: 720, fps: 24 });
    expect(project.canvas).toMatchObject({ width: 1920, height: 1080, fpsNumerator: 30 });
  });

  it("exports scene backgrounds below videos and text overlays", () => {
    const project = createEmptyProject();
    project.tracks.find((track) => track.kind === "scene")!.clips.push({
      id: "scene", trackId: "scene-main", kind: "scene", label: "黑色条纹", startUs: 0, durationUs: 4_000_000,
      locked: false, effectId: "scene-black-stripes", opacity: 1,
      background: { preset: "black-stripes", primaryColor: "#111317", secondaryColor: "#252a31", borderColor: "#5fa8ff", intensity: 0.72 }
    });
    const plan = buildRenderPlan(project, "/output.mp4");
    expect(plan.overlays[0]).toMatchObject({ kind: "scene", zIndex: -100, x: 50, y: 50, recipe: { sceneBackground: { preset: "black-stripes" } } });
    project.tracks.find((track) => track.kind === "scene")!.hidden = true;
    expect(buildRenderPlan(project, "/output.mp4").overlays).toEqual([]);
  });

  it("keeps camera progress continuous when timeline cuts split a video", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 8_000_000, sourcePath: "/source.mp4" });
    project.tracks.find((track) => track.kind === "video")!.clips.push({ id: "video", trackId: "video-main", kind: "video", label: "source", startUs: 0, durationUs: 8_000_000, locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForPreset("push-in") });
    project.tracks.find((track) => track.kind === "generated")!.clips.push({ id: "metadata", trackId: "generated-main", kind: "generated", label: "metadata", startUs: 2_000_000, durationUs: 2_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "overlay", scenes: [] });
    const plan = buildRenderPlan(project, "/output.mp4");
    expect(plan.segments.every((segment) => segment.kind !== "video")).toBe(true);
    expect(plan.overlays).toContainEqual(expect.objectContaining({ kind: "video", cameraOffsetUs: 0, cameraDurationUs: 8_000_000 }));
  });

  it("exports overlapping videos with animated keyframes below text effects", () => {
    const project = createEmptyProject();
    project.assets.push(
      { id: "background", name: "background.mp4", kind: "video", durationUs: 5_000_000, sourcePath: "/media/background.mp4", hasAudio: true },
      { id: "foreground", name: "foreground.mp4", kind: "video", durationUs: 5_000_000, sourcePath: "/media/foreground.mp4", hasAudio: true }
    );
    const backgroundTrack = project.tracks.find((track) => track.kind === "video")!;
    const foregroundTrack: TimelineTrack = { ...backgroundTrack, id: "video-layer-2", name: "视频", clips: [] };
    project.tracks.splice(1, 0, foregroundTrack);
    backgroundTrack.clips.push({ id: "background-clip", trackId: backgroundTrack.id, kind: "video", label: "background", startUs: 0, durationUs: 5_000_000, locked: false, assetId: "background", sourceInUs: 0, playbackRate: 1, volume: 0, fit: "cover", zIndex: 0, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, camera: cameraMotionForPreset("none") });
    foregroundTrack.clips.push({ id: "foreground-clip", trackId: foregroundTrack.id, kind: "video", label: "foreground", startUs: 0, durationUs: 5_000_000, locked: false, assetId: "foreground", sourceInUs: 0, playbackRate: 1, volume: 0.5, fit: "cover", zIndex: 10, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, transformKeyframes: [{ offsetUs: 0, x: 50, y: 50, scale: 1, easing: "ease-in-out" }, { offsetUs: 1_000_000, x: 82, y: 20, scale: 0.3, easing: "ease-in-out" }], camera: cameraMotionForPreset("push-in"), mask: { shape: "circle", radius: 50, feather: 0, borderWidth: 3, borderColor: "#ffffff", focusX: 45, focusY: 35 }, transition: { preset: "dock", durationUs: 600_000, easing: "ease-in-out" }, focus: { enabled: true, startOffsetUs: 1_000_000, durationUs: 2_000_000, x: 40, y: 60, zoom: 1.8, radius: 15, feather: 5, dimOpacity: 0.5, showCursor: true } });
    project.tracks.find((track) => track.kind === "effect")!.clips.push({ id: "effect", trackId: "effect-main", kind: "effect", label: "text", startUs: 0, durationUs: 2_000_000, locked: false, effectId: "test-title-slide", text: "上层文字", color: "#ffffff", accentColor: "#ffb84d", fontSize: 48, speed: 1, zIndex: 20, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, backdrop: { enabled: true, color: "#111316", opacity: 0.8, blur: 8, paddingX: 18, paddingY: 10, radius: 4 } });
    const plan = buildRenderPlan(project, "/output.mp4");
    expect(plan.segments).toEqual([expect.objectContaining({ kind: "gap" })]);
    expect(plan.overlays.map((overlay) => overlay.kind)).toEqual(["video", "video", "focus", "text"]);
    expect(plan.overlays[1]).toMatchObject({ path: "/media/foreground.mp4", mask: { shape: "circle", focusX: 45, focusY: 35 }, transition: { preset: "dock" }, focus: { enabled: true }, transformKeyframes: [expect.objectContaining({ x: 50 }), expect.objectContaining({ x: 82 })] });
    expect(plan.overlays.at(-1)).toMatchObject({ kind: "text", backdrop: { enabled: true, blur: 8 } });
    expect(plan.audios).toContainEqual(expect.objectContaining({ path: "/media/foreground.mp4", volume: 0.5 }));
  });

  it("exports chained video presentation cues as continuous source-time ranges", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 12_000_000, sourcePath: "/media/source.mp4" });
    const clip: VideoClip = {
      id: "video", trackId: "video-layer-1", kind: "video", label: "source", startUs: 0, durationUs: 12_000_000,
      locked: false, assetId: "asset", sourceInUs: 500_000, playbackRate: 1, volume: 0, fit: "cover",
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, camera: cameraMotionForPreset("none")
    };
    clip.presentationCues = [
      createVideoPresentationCue("presenter-circle-bottom-right", clip, 1_000_000),
      createVideoPresentationCue("full-screen", clip, 10_000_000)
    ];
    project.tracks.find((track) => track.kind === "video")!.clips.push(clip);

    const videos = buildRenderPlan(project, "/output.mp4").overlays.filter((overlay) => overlay.kind === "video");
    expect(videos.map((overlay) => [overlay.startUs, overlay.durationUs, overlay.sourceInUs])).toEqual([
      [0, 1_000_000, 500_000],
      [1_000_000, 650_000, 1_500_000],
      [1_650_000, 8_350_000, 2_150_000],
      [10_000_000, 650_000, 10_500_000],
      [10_650_000, 1_350_000, 11_150_000]
    ]);
    expect(videos[1]).toMatchObject({ mask: { shape: "circle" }, transformKeyframes: [
      { offsetUs: 0, x: 50, y: 50, scale: 1 },
      { offsetUs: 650_000, x: 84, y: 80, scale: 0.26 }
    ] });
    expect(videos[2]).toMatchObject({ mask: { shape: "circle" }, x: 84, y: 80, scale: 0.26 });
    expect(videos[3]).toMatchObject({ mask: { shape: "rectangle" }, transformKeyframes: [
      { offsetUs: 0, x: 84, y: 80, scale: 0.26 },
      { offsetUs: 650_000, x: 50, y: 50, scale: 1 }
    ] });
    expect(videos[4]).toMatchObject({ mask: { shape: "rectangle" }, x: 50, y: 50, scale: 1 });
  });

  it("exports an instant presenter layout without animating before the cue", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 5_000_000, sourcePath: "/media/source.mp4" });
    const clip: VideoClip = {
      id: "video", trackId: "video-main", kind: "video", label: "source", startUs: 0, durationUs: 5_000_000,
      locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 0, fit: "cover",
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, camera: cameraMotionForPreset("none")
    };
    const cue = createVideoPresentationCue("presenter-circle-bottom-right", clip, 1_000_000);
    cue.transitionDurationUs = 0;
    clip.presentationCues = [cue];
    project.tracks.find((track) => track.kind === "video")!.clips.push(clip);

    const videos = buildRenderPlan(project, "/output.mp4").overlays.filter((overlay) => overlay.kind === "video");
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({ startUs: 0, durationUs: 1_000_000, x: 50, y: 50, scale: 1, mask: { shape: "rectangle" } });
    expect(videos[0].transformKeyframes).toBeUndefined();
    expect(videos[1]).toMatchObject({ startUs: 1_000_000, durationUs: 4_000_000, x: 84, y: 80, scale: 0.26, mask: { shape: "circle" } });
    expect(videos[1].transformKeyframes).toBeUndefined();
  });

  it("limits exported focus overlays to the cue focus duration", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "screen", name: "screen.mp4", kind: "video", durationUs: 8_000_000, sourcePath: "/media/screen.mp4" });
    const clip: VideoClip = {
      id: "screen-clip", trackId: "video-layer-1", kind: "video", label: "screen", startUs: 0, durationUs: 8_000_000,
      locked: false, assetId: "screen", sourceInUs: 0, playbackRate: 1, volume: 0, fit: "cover",
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, camera: cameraMotionForPreset("none")
    };
    const cue = createVideoPresentationCue("screen-focus", clip, 1_000_000);
    cue.focus.durationUs = 2_000_000;
    clip.presentationCues = [cue];
    project.tracks.find((track) => track.kind === "video")!.clips.push(clip);

    const plan = buildRenderPlan(project, "/output.mp4");
    const focusOverlays = plan.overlays.filter((overlay) => overlay.kind === "focus");
    expect(focusOverlays.map((overlay) => [overlay.startUs, overlay.durationUs])).toEqual([
      [1_000_000, 650_000],
      [1_650_000, 1_350_000]
    ]);
    expect(plan.overlays.every((overlay) => overlay.kind !== "video" || overlay.startUs < 3_000_000 || overlay.focus?.enabled === false)).toBe(true);
  });

  it("keeps exported focus overlays attached to the animated video frame", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "presenter", name: "presenter.mp4", kind: "video", durationUs: 6_000_000, sourcePath: "/media/presenter.mp4" });
    const clip: VideoClip = {
      id: "presenter-clip", trackId: "video-layer-1", kind: "video", label: "presenter", startUs: 0, durationUs: 6_000_000,
      locked: false, assetId: "presenter", sourceInUs: 0, playbackRate: 1, volume: 0, fit: "cover",
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, camera: cameraMotionForPreset("none")
    };
    const presenter = createVideoPresentationCue("presenter-circle-bottom-right", clip, 500_000);
    const focus = createVideoPresentationCue("screen-focus", clip, 3_000_000);
    clip.presentationCues = [presenter, focus];
    project.tracks.find((track) => track.kind === "video")!.clips.push(clip);

    const overlays = buildRenderPlan(project, "/output.mp4").overlays;
    const transitionVideo = overlays.find((overlay) => overlay.kind === "video" && overlay.startUs === 3_000_000);
    const transitionFocus = overlays.find((overlay) => overlay.kind === "focus" && overlay.startUs === 3_000_000);

    expect(transitionVideo).toMatchObject({ x: 84, y: 80, scale: 0.26, mask: { shape: "rectangle" } });
    expect(transitionFocus).toMatchObject({
      x: transitionVideo?.x,
      y: transitionVideo?.y,
      scale: transitionVideo?.scale,
      transformKeyframes: transitionVideo?.transformKeyframes,
      mask: { shape: "rectangle", borderWidth: 0, focusX: 50, focusY: 50 }
    });
  });
});
