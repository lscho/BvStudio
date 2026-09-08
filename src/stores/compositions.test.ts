import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject, type CompositionClip, type MediaAsset } from "@/domain/project";
import { compositionTimeUs } from "@/domain/compositions";
import { parseProject, serializeProject } from "@/domain/projectFile";
import { visualTransformAt } from "@/domain/transforms";
import { buildRenderPlan } from "@/domain/renderPlan";
import { createAiMotionMatchesSchema } from "@/services/ai/schema";
import { normalizeMotionMatches } from "@/services/ai/provider";
import { useEditorStore } from "@/stores/editorStore";

const assets: MediaAsset[] = ["a", "b"].map((id) => ({ id, name: `${id}.png`, kind: "image", durationUs: 0, sourcePath: `/images/${id}.png`, objectUrl: `blob:${id}` }));
const clips = () => useEditorStore.getState().project.tracks.flatMap((track) => track.clips).filter((clip): clip is CompositionClip => clip.kind === "composition");
beforeEach(() => useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 0, past: [], future: [] }));

describe("material compositions", () => {
  it("keeps group copies independent from their originals", () => {
    useEditorStore.getState().addComposition("scene-focus-stack");
    const original = clips();
    const groupId = original[0].sceneGroupId!;
    useEditorStore.getState().selectSceneGroup(groupId);
    useEditorStore.getState().copySelected();
    useEditorStore.setState({ playheadUs: 12_000_000 });
    useEditorStore.getState().pasteAtPlayhead();
    const copies = clips().filter(c => !original.some(o => o.id === c.id));
    expect(new Set(copies.map(c => c.sceneGroupId))).toHaveLength(1);
    expect(copies[0].sceneGroupId).not.toBe(groupId);
    useEditorStore.getState().selectSceneGroup(groupId);
    expect(useEditorStore.getState().selectedClipIds).toEqual(original.map(c => c.id));
  });
  it("shifts dimming and sound triggers when trimming a composition start", () => {
    useEditorStore.getState().addComposition("background-stripes");
    const clip = clips()[0];
    useEditorStore.getState().updateComposition(clip.id, { dimAtUs: 4_000_000, soundCues: [{ soundId: "ding", offsetUs: 3_000_000, durationUs: 50_000, volume: .5 }] });
    useEditorStore.getState().trimClip(clip.id, "start", 1_000_000);
    expect(clips()[0]).toMatchObject({ dimAtUs: 3_000_000, soundCues: [{ offsetUs: 2_000_000, durationUs: 50_000 }] });
    useEditorStore.getState().retimeComposition(clip.id, 2_500_000);
    const restored = parseProject(serializeProject(useEditorStore.getState().project));
    expect(restored.tracks.flatMap(t => t.clips).find(c => c.id === clip.id)).toMatchObject({ dimAtUs: 1_500_000, soundCues: [{ offsetUs: 1_000_000, durationUs: 50_000 }] });
  });
  it("trims one group member independently and retimes source progress with undo and redo", () => {
    useEditorStore.getState().addComposition("poster-wall-3d");
    useEditorStore.getState().addComposition("background-stripes");
    for (const clip of clips()) useEditorStore.getState().updateComposition(clip.id, { sceneGroupId: "g" });
    const original = clips()[0];
    useEditorStore.getState().trimClip(original.id, "start", 2_000_000);
    expect(clips()[1].startUs).toBe(0);
    expect(clips()[0]).toMatchObject({ durationUs: 8_000_000, sourceOffsetUs: 2_000_000, animationDurationUs: 10_000_000 });
    useEditorStore.getState().retimeComposition(original.id, 4_000_000);
    expect(clips()[0]).toMatchObject({ durationUs: 4_000_000, sourceOffsetUs: 1_000_000, animationDurationUs: 5_000_000, speed: 1 });
    useEditorStore.getState().undo();
    expect(clips()[0].durationUs).toBe(8_000_000);
    useEditorStore.getState().redo();
    expect(clips()[0].durationUs).toBe(4_000_000);
    const before = useEditorStore.getState();
    useEditorStore.getState().updateComposition(clips()[1].id, { locked: true });
    const locked = useEditorStore.getState();
    useEditorStore.getState().retimeSceneGroup("g", 12_000_000);
    expect(useEditorStore.getState().project).toBe(locked.project);
    expect(useEditorStore.getState().past).toBe(locked.past);
    expect(before.project.tracks).not.toBe(locked.project.tracks);
  });
  it("bounds retiming and preserves text speed through save and restore", () => {
    useEditorStore.getState().addComposition("motion-zoom");
    useEditorStore.getState().retimeComposition(clips()[0].id, 100_000_000);
    expect(clips()[0].durationUs).toBe(10_000_000);
    useEditorStore.getState().retimeComposition(clips()[0].id, 1);
    expect(clips()[0].durationUs).toBe(2_000_000);
    useEditorStore.getState().addComposition("test-title-slide");
    const text = clips()[1];
    useEditorStore.getState().retimeComposition(text.id, 100_000_000);
    expect(clips()[1].speed).toBe(0.25);
    const restored = parseProject(serializeProject(useEditorStore.getState().project));
    expect(restored.tracks.flatMap(t => t.clips).find(c => c.id === text.id)).toMatchObject({ speed: clips()[1].speed, durationUs: clips()[1].durationUs });
  });
  it("keeps composition positioning keyframes continuous after start trim and split", () => {
    useEditorStore.getState().addComposition("background-stripes");
    const original = clips()[0];
    useEditorStore.getState().updateComposition(original.id, { transformKeyframes: [{ offsetUs: 0, x: 20, y: 50, scale: 1, easing: "linear" }, { offsetUs: 6_000_000, x: 80, y: 50, scale: 2, easing: "linear" }] });
    const before = clips()[0];
    const boundary = visualTransformAt(before.transform, before.transformKeyframes, 2_000_000);
    useEditorStore.getState().trimClip(original.id, "start", 2_000_000);
    expect(visualTransformAt(clips()[0].transform, clips()[0].transformKeyframes, 0)).toEqual(boundary);
    useEditorStore.getState().undo();
    useEditorStore.getState().selectClip(original.id);
    useEditorStore.setState({ playheadUs: 2_000_000 });
    useEditorStore.getState().splitSelected();
    expect(visualTransformAt(clips()[1].transform, clips()[1].transformKeyframes, 0)).toEqual(boundary);
  });
  it("keeps transform edits undoable and exports their keyframes without changing source time", () => {
    useEditorStore.getState().addComposition("background-stripes");
    const original = clips()[0];
    const transform = { x: 25, y: 70, scale: 0.5, rotation: 30, opacity: 0.8 };
    const transformKeyframes = [{ offsetUs: 0, x: 25, y: 70, scale: 0.5, easing: "linear" as const }];
    useEditorStore.getState().updateComposition(original.id, { transform, transformKeyframes });
    expect(buildRenderPlan(useEditorStore.getState().project, "/output.mp4").overlays[0]).toMatchObject({ ...transform, transformKeyframes });
    expect(clips()[0].animationDurationUs).toBe(original.animationDurationUs);
    useEditorStore.getState().undo();
    expect(clips()[0].transform).toEqual(original.transform);
    useEditorStore.getState().redo();
    expect(clips()[0].transform).toEqual(transform);
    useEditorStore.getState().setTrackState(original.trackId, { locked: true });
    useEditorStore.getState().updateComposition(original.id, { transform: original.transform });
    expect(clips()[0].transform).toEqual(transform);
  });
  it("exports a source-free background below transparent media compositions", () => {
    useEditorStore.getState().addComposition("background-stripes");
    const background = clips()[0];
    expect(background.bindings).toEqual([]);
    expect(useEditorStore.getState().previewRequest).toMatchObject({ startUs: 0, endUs: 6_000_000 });
    useEditorStore.getState().addComposition("poster-wall-3d");
    useEditorStore.getState().bindCompositionAssets(clips()[1].id, [{ slotId: "posters", assetIds: ["a", "b"] }], assets);
    const overlays = buildRenderPlan(useEditorStore.getState().project, "/output.mp4").overlays;
    expect(overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ compositionId: "background-stripes", renderer: "canvas", compositionImages: [], zIndex: 0 }),
      expect.objectContaining({ compositionId: "poster-wall-3d", zIndex: 220, params: { travel: 0.65, spacing: 1 } })
    ]));
  });
  it("owns mixed video/image inputs and bounds authored showcase durations to 2-10 seconds", () => {
    useEditorStore.getState().addComposition("motion-zoom");
    const clip = clips()[0];
    useEditorStore.getState().bindCompositionAssets(clip.id, [{ slotId: "media", assetIds: ["b", "a"] }], [assets[0], { ...assets[1], kind: "video", sourcePath: "/video.mp4" }]);
    useEditorStore.getState().updateComposition(clip.id, { durationUs: 12_000_000 });
    expect(clips()[0].durationUs).toBe(10_000_000);
    useEditorStore.getState().updateComposition(clip.id, { durationUs: 1_000_000 });
    expect(clips()[0]).toMatchObject({ durationUs: 2_000_000, animationDurationUs: 2_000_000 });
    expect(buildRenderPlan(useEditorStore.getState().project, "/output.mp4").overlays[0]).toMatchObject({
      renderer: "canvas", compositionId: "motion-zoom", compositionImages: [{ id: "b", kind: "video", path: "/video.mp4" }, { id: "a", kind: "image", path: "/images/a.png" }]
    });
    useEditorStore.getState().undo();
    expect(clips()[0].durationUs).toBe(10_000_000);
  });
  it("keeps grouped 3D displays independent from sequenced duration limits", () => {
    useEditorStore.getState().addComposition("poster-wall-3d");
    const clip = clips()[0];
    useEditorStore.getState().updateComposition(clip.id, { durationUs: 12_000_000 });
    expect(clips()[0]).toMatchObject({ durationUs: 12_000_000, animationDurationUs: 12_000_000 });
    useEditorStore.getState().retimeComposition(clip.id, 20_000_000);
    expect(clips()[0].durationUs).toBe(20_000_000);
  });
  it("binds a presenter video to a focus card and exports its animated media layer", () => {
    const project = createEmptyProject();
    const presenter: MediaAsset = { id: "presenter", name: "presenter.mp4", kind: "video", durationUs: 12_000_000, sourcePath: "/presenter.mp4", objectUrl: "blob:presenter" };
    project.assets.push(presenter);
    project.tracks.find((track) => track.kind === "video")!.clips.push({
      id: "presenter-clip", trackId: "video-main", kind: "video", label: "presenter", startUs: 0, durationUs: 10_000_000,
      locked: false, assetId: presenter.id, sourceInUs: 500_000, playbackRate: 1.5, volume: 1, fit: "cover",
      transform: { x: 75, y: 70, scale: 0.5, rotation: 0, opacity: 1 },
      mask: { shape: "circle", radius: 0, feather: 0, borderWidth: 0, borderColor: "#ffffff", focusX: 50, focusY: 50 },
      camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" }
    });
    useEditorStore.setState({ project, playheadUs: 2_000_000 });
    useEditorStore.getState().addComposition("focus-card");
    const focus = clips()[0];
    expect(() => buildRenderPlan(useEditorStore.getState().project, "/output.mp4")).toThrow("人物视频需要 1 个视频");
    expect(() => useEditorStore.getState().bindCompositionAssets(focus.id, [{ slotId: "presenter", assetIds: ["a"] }], assets)).toThrow();
    useEditorStore.getState().bindCompositionAssets(focus.id, [{ slotId: "presenter", assetIds: [presenter.id] }]);

    const plan = buildRenderPlan(useEditorStore.getState().project, "/output.mp4");
    expect(plan.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "video", startUs: 0, durationUs: 2_000_000, path: "/presenter.mp4" }),
      expect.objectContaining({ renderer: "react", compositionId: "focus-card", zIndex: 220 }),
      expect.objectContaining({
        renderer: "canvas",
        compositionId: "focus-card-media",
        compositionImages: [{ id: presenter.id, path: "/presenter.mp4", kind: "video" }],
        zIndex: 221,
        params: expect.objectContaining({
          focusMediaSourceInUs: 3_500_000,
          focusMediaPlaybackRate: 1.5,
          focusEffectSpeed: 1,
          focusSourceX: 1_170,
          focusSourceY: 486,
          focusSourceWidth: 540,
          focusSourceHeight: 540,
          focusSourceRadius: 270
        })
      })
    ]));
    expect(plan.overlays.filter((overlay) => overlay.kind === "video")).toHaveLength(1);
    const scaledMedia = buildRenderPlan(useEditorStore.getState().project, "/output.mp4", { width: 960, height: 540 }).overlays.find((overlay) => overlay.kind === "composition" && overlay.compositionId === "focus-card-media");
    expect(scaledMedia).toMatchObject({
      params: {
        focusSourceX: 585,
        focusSourceY: 243,
        focusSourceWidth: 270,
        focusSourceHeight: 270,
        focusSourceRadius: 135
      }
    });
    useEditorStore.getState().undo();
    expect(clips()[0].bindings).toEqual([]);
  });
  it("materializes AI picture bindings without text or video layers", () => {
    const project = createEmptyProject();
    project.assets = assets;
    const track = project.tracks.find((track) => track.kind === "subtitle")!;
    track.clips.push({ id: "caption", trackId: track.id, kind: "subtitle", label: "字幕", text: "电影海报展示", startUs: 0, durationUs: 5_000_000, locked: false, color: "#ffffff", backgroundColor: "#000000", fontSize: 48, positionY: 88 });
    useEditorStore.setState({ project });
    const matches = createAiMotionMatchesSchema(["poster-wall-3d"], [], ["a", "b"]).parse({ matches: [{
      captionIndex: 0, primaryEffectId: "poster-wall-3d", primaryText: "", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null,
      compositionBindings: [{ slotId: "posters", assetIds: ["b", "a"] }]
    }] }).matches;
    const normalized = normalizeMotionMatches(matches, [{ text: "电影海报展示", startSeconds: 0, endSeconds: 5 }], 5, assets.map((asset) => ({ id: asset.id, name: asset.name, kind: "image", durationSeconds: 0 })));
    const result = useEditorStore.getState().applyMotionMatches(["caption"], normalized);
    expect(result).toMatchObject({ effectCount: 1, videoCount: 0, skippedEffectCount: 0 });
    expect(clips()[0]).toMatchObject({ compositionId: "poster-wall-3d", bindings: matches[0].compositionBindings, text: "", animationDurationUs: 5_000_000 });
    useEditorStore.getState().undo();
    expect(clips()).toEqual([]);
  });
  it("materializes AI bindings for a React recording effect", () => {
    const project = createEmptyProject();
    const recording: MediaAsset = { id: "screen", name: "screen.mp4", kind: "video", durationUs: 8_000_000, sourcePath: "/screen.mp4" };
    project.assets = [recording];
    const track = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
    track.clips.push({ id: "caption", trackId: track.id, kind: "subtitle", label: "字幕", text: "演示关键操作", startUs: 0, durationUs: 5_000_000, locked: false, color: "#ffffff", backgroundColor: "#000000", fontSize: 48, positionY: 88 });
    useEditorStore.setState({ project });
    const matches = createAiMotionMatchesSchema(["screen-demo"], [recording.id]).parse({ matches: [{
      captionIndex: 0, primaryEffectId: "screen-demo", primaryText: "关键操作", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null,
      compositionBindings: [{ slotId: "recording", assetIds: [recording.id] }]
    }] }).matches;
    const result = useEditorStore.getState().applyMotionMatches(["caption"], matches);
    expect(result).toMatchObject({ effectCount: 1, skippedEffectCount: 0 });
    expect(clips()[0]).toMatchObject({ compositionId: "screen-demo", bindings: matches[0].compositionBindings, params: { title: "关键操作" } });
  });

  it("keeps a transparent media placeholder when the selected effect has no compatible asset", () => {
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
    track.clips.push({ id: "caption", trackId: track.id, kind: "subtitle", label: "字幕", text: "接下来演示软件操作", startUs: 0, durationUs: 5_000_000, locked: false, color: "#ffffff", backgroundColor: "#000000", fontSize: 48, positionY: 88 });
    useEditorStore.setState({ project });
    const matches = createAiMotionMatchesSchema(["screen-demo"], [], []).parse({ matches: [{
      captionIndex: 0, subtitleKeywords: [], motionGroupId: null, persistUntilCaptionIndex: null,
      primaryEffectId: "screen-demo", primaryText: "软件操作", primaryParams: [], primaryTimingCaptionIndices: [],
      compositionBindings: [], materialPlaceholder: true, secondaryEffectId: null, secondaryText: null,
      secondaryParams: [], secondaryTimingCaptionIndices: [], accentColor: "#5fa8ff", x: 50, y: 50, scale: 1,
      secondaryX: 75, secondaryY: 60, cameraPreset: "none", soundEffectId: null, videoLayers: [], backdropPreset: "none", chart: null
    }] }).matches;
    expect(useEditorStore.getState().applyMotionMatches(["caption"], matches)).toMatchObject({ effectCount: 1, skippedEffectCount: 0 });
    expect(clips()[0]).toMatchObject({ compositionId: "screen-demo", bindings: [], lintOff: ["composition-input"] });
    expect(clips()[0].label).toContain("待补素材");
    expect(buildRenderPlan(useEditorStore.getState().project, "/output.mp4").overlays[0]).toMatchObject({ compositionId: "screen-demo", compositionImages: [] });
  });
  it("binds and reorders images with one undo step and no image clips", () => {
    useEditorStore.getState().addComposition("poster-wall-3d");
    const clip = clips()[0];
    useEditorStore.getState().bindCompositionAssets(clip.id, [{ slotId: "posters", assetIds: ["b", "a"] }], assets);
    expect(clips()[0].bindings?.[0].assetIds).toEqual(["b", "a"]);
    expect(useEditorStore.getState().project.assets).toHaveLength(2);
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "image")?.clips).toEqual([]);
    expect(useEditorStore.getState().selectedClipId).toBe(clip.id);
    expect(useEditorStore.getState().previewRequest).toMatchObject({ startUs: 0, endUs: 10_000_000 });
    useEditorStore.getState().undo();
    expect(clips()[0].bindings).toEqual([]);
    expect(useEditorStore.getState().project.assets).toEqual([]);
    useEditorStore.getState().redo();
    expect(clips()[0].bindings?.[0].assetIds).toEqual(["b", "a"]);
    const overlay = buildRenderPlan(useEditorStore.getState().project, "/output.mp4").overlays[0];
    expect(overlay).toMatchObject({ kind: "composition", renderer: "three", compositionImages: [{ id: "b", path: "/images/b.png" }, { id: "a", path: "/images/a.png" }], animationDurationUs: 10_000_000 });
    expect(JSON.stringify(overlay)).not.toContain("blob:");
  });

  it("exports reference-effect bindings as local sources without persisting preview URLs", () => {
    const recording: MediaAsset = { id: "recording", name: "screen.mp4", kind: "video", durationUs: 8_000_000, sourcePath: "/screen.mp4", objectUrl: "blob:screen" };
    useEditorStore.getState().addComposition("cam-pan");
    useEditorStore.getState().bindCompositionAssets(clips()[0].id, [{ slotId: "recording", assetIds: [recording.id] }], [recording]);

    const clip = clips()[0];
    expect(clip.bindings).toEqual([{ slotId: "recording", assetIds: [recording.id] }]);
    expect(JSON.stringify(parseProject(serializeProject(useEditorStore.getState().project)))).not.toContain("blob:");
    expect(buildRenderPlan(useEditorStore.getState().project, "/output.mp4").overlays[0]).toMatchObject({
      compositionId: "cam-pan",
      renderer: "react",
      compositionImages: [{ id: recording.id, kind: "video", path: "/screen.mp4" }],
      compositionBindings: [{ slotId: "recording", assetIds: [recording.id] }]
    });
  });

  it("rejects invalid bindings and blocks export until inputs are complete", () => {
    useEditorStore.getState().addComposition("image-duet-3d");
    const clip = clips()[0];
    expect(() => useEditorStore.getState().bindCompositionAssets(clip.id, [{ slotId: "left", assetIds: ["a", "b"] }], assets)).toThrow();
    expect(() => useEditorStore.getState().bindCompositionAssets(clip.id, [{ slotId: "unknown", assetIds: ["a"] }], assets)).toThrow();
    expect(() => buildRenderPlan(useEditorStore.getState().project, "/output.mp4")).toThrow("左图");
    useEditorStore.getState().bindCompositionAssets(clip.id, [{ slotId: "left", assetIds: ["a"] }, { slotId: "right", assetIds: ["b"] }], assets);
    useEditorStore.setState((state) => ({ project: { ...state.project, assets: [{ ...assets[0], missing: true }, assets[1]] } }));
    expect(() => buildRenderPlan(useEditorStore.getState().project, "/output.mp4")).toThrow("缺失");
  });

  it("does not add, edit or bind on a locked track", () => {
    useEditorStore.getState().addComposition("poster-wall-3d");
    const clip = clips()[0];
    useEditorStore.setState((state) => ({ project: { ...state.project, tracks: state.project.tracks.map((track) => ({ ...track, locked: track.kind === "composition" })) } }));
    const before = useEditorStore.getState();
    useEditorStore.getState().addComposition("image-duet-3d");
    useEditorStore.getState().updateComposition(clip.id, { durationUs: 1_000_000 });
    useEditorStore.getState().bindCompositionAssets(clip.id, [{ slotId: "posters", assetIds: ["a", "b"] }], assets);
    expect(useEditorStore.getState().project).toEqual(before.project);
    expect(useEditorStore.getState().past).toEqual(before.past);
  });

  it("preserves the camera clock through split, trim and undo", () => {
    useEditorStore.getState().addComposition("poster-wall-3d");
    const original = clips()[0];
    useEditorStore.setState({ playheadUs: 4_000_000 });
    useEditorStore.getState().splitSelected();
    const trailing = clips().find((clip) => clip.id !== original.id)!;
    expect(trailing).toMatchObject({ startUs: 4_000_000, sourceOffsetUs: 4_000_000, animationDurationUs: 10_000_000 });
    expect(compositionTimeUs(trailing, 500_000)).toBe(compositionTimeUs(original, 4_500_000));
    useEditorStore.getState().trimClip(trailing.id, "start", 1_000_000);
    expect(clips().find((clip) => clip.id === trailing.id)).toMatchObject({ startUs: 5_000_000, sourceOffsetUs: 5_000_000, animationDurationUs: 10_000_000 });
    useEditorStore.getState().undo();
    expect(clips().find((clip) => clip.id === trailing.id)?.sourceOffsetUs).toBe(4_000_000);
  });
});
