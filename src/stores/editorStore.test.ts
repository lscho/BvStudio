import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject, type AudioClip, type EffectClip, type ImageClip, type VideoClip } from "@/domain/project";
import { effectById } from "@/domain/effects";
import { estimateMotionLayoutRect, motionLayoutRectsOverlap, type MotionLayoutLayer } from "@/domain/motionLayout";
import type { AiVideoPlan } from "@/services/ai/schema";
import { useEditorStore } from "@/stores/editorStore";

const plan: AiVideoPlan = {
  title: "插入介绍",
  article: "一段完整文章。",
  narration: "一段口播。",
  scenes: [
    { title: "开场", narration: "第一段", durationSeconds: 2, effectIds: ["title-highlight"], color: "#ffb84d", cameraPreset: "push-in", mediaAssetId: null, mediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" },
    { title: "重点", narration: "第二段", durationSeconds: 4, effectIds: ["number-pop"], color: "#47d7ac", cameraPreset: "pan-right", mediaAssetId: null, mediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" }
  ]
};

const motionMatch: NonNullable<AiVideoPlan["matches"]>[number] = {
  captionIndex: 0, primaryEffectId: "test-title-slide", primaryText: "实际标题", secondaryEffectId: null, secondaryText: null,
  accentColor: "#5fa8ff", x: 50, y: 28, scale: 1, secondaryX: 75, secondaryY: 60,
  cameraPreset: "push-in", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0,
  secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full",
  videoLayers: [], backdropPreset: "none", chart: null
};

beforeEach(() => {
  useEditorStore.setState({
    project: createEmptyProject(),
    selectedClipId: null,
    selectedClipIds: [],
    playheadUs: 0,
    zoom: 1,
    rangeStartUs: null,
    rangeEndUs: null,
    past: [],
    future: [],
    clipboard: [],
    focusPickClipId: null,
    previewRequest: null
  });
});

describe("editorStore", () => {
  it("places any number of overlapping videos on independent ordinary tracks", () => {
    for (let index = 1; index <= 4; index += 1) {
      useEditorStore.getState().addVideo({ id: `video-${index}`, name: `video-${index}.mp4`, kind: "video", durationUs: 5_000_000 });
    }

    const project = useEditorStore.getState().project;
    const videos = project.tracks.flatMap((track) => track.clips).filter((clip): clip is VideoClip => clip.kind === "video");
    expect(videos).toHaveLength(4);
    expect(new Set(videos.map((video) => video.trackId))).toHaveLength(4);
    expect(videos.map((video) => video.zIndex)).toEqual([0, 10, 20, 30]);
    expect(videos[0]).toMatchObject({ role: "a-roll", layoutPreset: "full", volume: 1 });
    expect(videos.slice(1).every((video) => video.role === "b-roll" && video.volume === 0)).toBe(true);
    expect(project.tracks.filter((track) => track.kind === "video").every((track) => track.name === "视频")).toBe(true);
  });

  it("preserves visual keyframe continuity when an insertion splits a video", () => {
    useEditorStore.getState().addVideo({ id: "animated-asset", name: "animated.mp4", kind: "video", durationUs: 20_000_000 });
    const clipId = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().updateVideo(clipId, { transformKeyframes: [
      { offsetUs: 0, x: 50, y: 50, scale: 1, easing: "linear" },
      { offsetUs: 10_000_000, x: 82, y: 20, scale: 0.3, easing: "linear" }
    ] });
    useEditorStore.getState().addGeneratedPlan(plan, "插入", "insert", { startUs: 5_000_000 });

    const videos = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).filter((clip): clip is VideoClip => clip.kind === "video").sort((left, right) => left.startUs - right.startUs);
    expect(videos[0].transformKeyframes?.at(-1)).toMatchObject({ offsetUs: 5_000_000, x: 66, y: 35, scale: 0.65 });
    expect(videos[1].transformKeyframes?.[0]).toMatchObject({ offsetUs: 0, x: 66, y: 35, scale: 0.65 });
    expect(videos[1].transformKeyframes?.[1]).toMatchObject({ offsetUs: 5_000_000, x: 82, y: 20, scale: 0.3 });
    expect(videos.map((video) => [video.cameraOffsetUs, video.cameraDurationUs])).toEqual([[0, 20_000_000], [5_000_000, 20_000_000]]);
  });

  it("splits a video and shifts its continuation when an AI block is inserted", () => {
    const store = useEditorStore.getState();
    store.addVideo({ id: "asset-1", name: "source.mp4", kind: "video", durationUs: 20_000_000 });
    useEditorStore.getState().setPlayhead(5_000_000);
    useEditorStore.getState().addGeneratedPlan(plan, "补充说明", "insert");

    const project = useEditorStore.getState().project;
    const videos = project.tracks.find((track) => track.kind === "video")!.clips as VideoClip[];
    const generated = project.tracks.find((track) => track.kind === "generated")!.clips[0];

    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({ startUs: 0, durationUs: 5_000_000, sourceInUs: 0 });
    expect(videos[1]).toMatchObject({ startUs: 11_000_000, durationUs: 15_000_000, sourceInUs: 5_000_000 });
    expect(generated).toMatchObject({ startUs: 5_000_000, durationUs: 6_000_000, kind: "generated" });
  });

  it("adds and edits a parameterized effect with undo support", () => {
    useEditorStore.getState().addEffect("title-highlight");
    const effect = useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0];
    expect(effect).toMatchObject({ effectId: "title-highlight", text: "核心观点", colorRole: "opinion", backdrop: { enabled: true, color: "#111316", opacity: 0.64 } });

    useEditorStore.getState().updateEffect(effect.id, { text: "新的标题", speed: 1.5 });
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({ text: "新的标题", speed: 1.5 });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({ text: "核心观点", speed: 1 });
  });

  it("snapshots and edits component effect params with undo support", () => {
    useEditorStore.getState().addEffect("ring-metric");
    const effect = useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0];
    expect(effect).toMatchObject({ effectId: "ring-metric", params: { value: 92.4, max: 100, unit: "%" }, backdrop: { enabled: false }, transform: { scale: 1 } });

    useEditorStore.getState().updateEffect(effect.id, { params: { ...(effect.kind === "effect" ? effect.params : {}), value: 64 } });
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({ params: { value: 64 } });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({ params: { value: 92.4 } });
  });

  it("places manually added component effects outside the presenter area and each other", () => {
    useEditorStore.getState().updatePresenterSafeArea({ position: "center", widthPercent: 32 });
    useEditorStore.getState().addEffect("ring-metric");
    useEditorStore.getState().addEffect("ring-metric");

    const project = useEditorStore.getState().project;
    const effects = project.tracks.find((track) => track.kind === "effect")!.clips.filter((clip): clip is EffectClip => clip.kind === "effect");
    const layers = effects.map((effect) => ({
      id: effect.id,
      effectId: effect.effectId,
      startUs: effect.startUs,
      durationUs: effect.durationUs,
      desiredX: effect.transform.x,
      desiredY: effect.transform.y,
      scale: effect.transform.scale,
      fontSize: effect.fontSize,
      text: effect.text,
      recipe: effect.recipe ?? effectById(effect.effectId).recipe,
      priority: "primary" as const
    }));
    const rects = effects.map((effect, index) => estimateMotionLayoutRect(layers[index], effect.transform, project.canvas));
    const presenterRect = { left: 34, top: 6, right: 66, bottom: 78 };

    expect(effects).toHaveLength(2);
    expect(rects.every((rect) => !motionLayoutRectsOverlap(rect, presenterRect))).toBe(true);
    expect(motionLayoutRectsOverlap(rects[0], rects[1])).toBe(false);
  });

  it("updates theme colors with undo and redo support", () => {
    const original = useEditorStore.getState().project.motionTheme.colors.data;
    useEditorStore.getState().updateMotionTheme({ colors: { data: "#123456" } });
    expect(useEditorStore.getState().project.motionTheme.colors.data).toBe("#123456");

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.motionTheme.colors.data).toBe(original);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.motionTheme.colors.data).toBe("#123456");
  });

  it("updates the presenter safe area with undo and redo support", () => {
    expect(useEditorStore.getState().project.presenterSafeArea).toEqual({ position: "none", widthPercent: 32 });
    useEditorStore.getState().updatePresenterSafeArea({ position: "right", widthPercent: 40 });
    expect(useEditorStore.getState().project.presenterSafeArea).toEqual({ position: "right", widthPercent: 40 });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.presenterSafeArea).toEqual({ position: "none", widthPercent: 32 });
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.presenterSafeArea).toEqual({ position: "right", widthPercent: 40 });
  });

  it("keeps archived scene backgrounds editable for old project compatibility", () => {
    useEditorStore.getState().updateMotionTheme({ colors: { data: "#47d7ac", opinion: "#47d7ac", warning: "#47d7ac", auxiliary: "#47d7ac" } });
    useEditorStore.getState().addEffect("scene-black-stripes");
    let project = useEditorStore.getState().project;
    expect(project.tracks.find((track) => track.kind === "effect")!.clips).toHaveLength(0);
    expect(project.tracks.find((track) => track.kind === "scene")!.clips).toEqual([
      expect.objectContaining({
        kind: "scene", trackId: "scene-main", effectId: "scene-black-stripes", opacity: 1,
        background: expect.objectContaining({ preset: "black-stripes", borderColor: "#5fa8ff" })
      })
    ]);

    const scene = project.tracks.find((track) => track.kind === "scene")!.clips[0];
    useEditorStore.getState().updateScene(scene.id, { opacity: 0.45 });
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "scene")!.clips[0]).toMatchObject({ opacity: 0.45 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "scene")!.clips[0]).toMatchObject({ opacity: 1 });

    useEditorStore.getState().setTrackState("scene-main", { locked: true });
    useEditorStore.getState().moveClips([scene.id], 1_000_000);
    useEditorStore.getState().trimClip(scene.id, "end", 1_000_000);
    project = useEditorStore.getState().project;
    expect(project.tracks.find((track) => track.kind === "scene")!.clips[0]).toMatchObject({ startUs: 0, durationUs: 8_000_000 });
  });

  it("updates chapter progress with undo support", () => {
    useEditorStore.getState().updateChapterProgress({ enabled: true, preset: "custom", position: "bottom", style: "steps", backgroundOpacity: 2, chapters: [{ id: "intro", title: "开场", startUs: 0 }] });
    expect(useEditorStore.getState().project.chapterProgress).toMatchObject({ enabled: true, preset: "custom", position: "bottom", style: "steps", backgroundOpacity: 1, chapters: [{ title: "开场", startUs: 0 }] });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.chapterProgress.enabled).toBe(false);
  });

  it("updates all unlocked subtitle appearances while preserving text and keywords", () => {
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
    track.clips.push(
      { id: "one", trackId: track.id, kind: "subtitle", label: "第一段", startUs: 0, durationUs: 1_000_000, locked: false, text: "第一段", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88, highlightWords: ["第一"] },
      { id: "two", trackId: track.id, kind: "subtitle", label: "第二段", startUs: 1_000_000, durationUs: 1_000_000, locked: false, text: "第二段", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88, highlightWords: ["第二"] },
      { id: "locked", trackId: track.id, kind: "subtitle", label: "锁定段", startUs: 2_000_000, durationUs: 1_000_000, locked: true, text: "锁定段", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88 }
    );
    useEditorStore.setState({ ...useEditorStore.getState(), project, past: [], future: [] });

    useEditorStore.getState().updateSubtitleAppearance(null, { stylePreset: "bold", fontSize: 58, highlightColor: "#ffcc00" });
    const subtitles = useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips);
    expect(subtitles.find((clip) => clip.id === "one")).toMatchObject({ text: "第一段", highlightWords: ["第一"], stylePreset: "bold", fontSize: 58, highlightColor: "#ffcc00" });
    expect(subtitles.find((clip) => clip.id === "two")).toMatchObject({ text: "第二段", highlightWords: ["第二"], stylePreset: "bold", fontSize: 58, highlightColor: "#ffcc00" });
    expect(subtitles.find((clip) => clip.id === "locked")).not.toMatchObject({ stylePreset: "bold", fontSize: 58 });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "one")).toMatchObject({ fontSize: 44 });
  });

  it("cuts the matching source range when an AI block replaces video", () => {
    useEditorStore.getState().addVideo({ id: "asset-1", name: "source.mp4", kind: "video", durationUs: 20_000_000 });
    useEditorStore.getState().setPlayhead(5_000_000);
    useEditorStore.getState().addGeneratedPlan(plan, "替换说明", "replace");

    const videos = useEditorStore.getState().project.tracks.find((track) => track.kind === "video")!.clips as VideoClip[];
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({ startUs: 0, durationUs: 5_000_000, sourceInUs: 0 });
    expect(videos[1]).toMatchObject({ startUs: 11_000_000, durationUs: 9_000_000, sourceInUs: 11_000_000 });
  });

  it("maps ASR source timestamps onto trimmed video clips", () => {
    useEditorStore.getState().addVideo({ id: "asset-1", name: "source.mp4", kind: "video", durationUs: 10_000_000 });
    const video = useEditorStore.getState().project.tracks[0].clips[0] as VideoClip;
    useEditorStore.getState().updateVideo(video.id, { startUs: 5_000_000, sourceInUs: 2_000_000, durationUs: 4_000_000 });
    useEditorStore.getState().addSubtitles("asset-1", [
      { startSeconds: 1, endSeconds: 3, text: "跨越入点" },
      { startSeconds: 4, endSeconds: 5, text: "片段中" },
      { startSeconds: 8, endSeconds: 9, text: "范围外" }
    ]);
    const subtitles = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips;
    expect(subtitles).toHaveLength(2);
    expect(subtitles[0]).toMatchObject({ kind: "subtitle", startUs: 5_000_000, durationUs: 1_000_000, text: "跨越入点" });
    expect(subtitles[1]).toMatchObject({ startUs: 7_000_000, durationUs: 1_000_000, text: "片段中" });
  });

  it("moves, trims and splits video clips with source-time continuity", () => {
    useEditorStore.getState().addVideo({ id: "asset-1", name: "source.mp4", kind: "video", durationUs: 12_000_000 });
    const video = useEditorStore.getState().project.tracks[0].clips[0] as VideoClip;
    useEditorStore.getState().trimClip(video.id, "start", 2_000_000);
    expect(useEditorStore.getState().project.tracks[0].clips[0]).toMatchObject({ startUs: 2_000_000, durationUs: 10_000_000, sourceInUs: 2_000_000 });
    useEditorStore.getState().moveClips([video.id], 3_000_000);
    useEditorStore.getState().setPlayhead(8_000_000);
    useEditorStore.getState().splitSelected();
    const clips = useEditorStore.getState().project.tracks[0].clips as VideoClip[];
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ startUs: 5_000_000, durationUs: 3_000_000, sourceInUs: 2_000_000 });
    expect(clips[1]).toMatchObject({ startUs: 8_000_000, durationUs: 7_000_000, sourceInUs: 5_000_000 });
  });

  it("chains timed video presentation cues with undo, trim and split continuity", () => {
    useEditorStore.getState().addVideo({ id: "motion-asset", name: "motion.mp4", kind: "video", durationUs: 20_000_000 });
    const videoId = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().addVideoPresentationCue(videoId, "presenter-circle-bottom-right", 1_000_000);
    const presenterCueId = (useEditorStore.getState().project.tracks[0].clips[0] as VideoClip).presentationCues![0].id;
    useEditorStore.getState().updateVideoPresentationCue(videoId, presenterCueId, { transitionDurationUs: 0 });
    expect((useEditorStore.getState().project.tracks[0].clips[0] as VideoClip).presentationCues?.[0].transitionDurationUs).toBe(0);
    useEditorStore.getState().undo();
    expect((useEditorStore.getState().project.tracks[0].clips[0] as VideoClip).presentationCues?.[0].transitionDurationUs).toBe(650_000);
    useEditorStore.getState().redo();
    expect((useEditorStore.getState().project.tracks[0].clips[0] as VideoClip).presentationCues?.[0].transitionDurationUs).toBe(0);
    useEditorStore.getState().addVideoPresentationCue(videoId, "full-screen", 10_000_000);

    let video = useEditorStore.getState().project.tracks[0].clips[0] as VideoClip;
    expect(video.presentationCues?.map((cue) => [cue.offsetUs, cue.presetId])).toEqual([
      [1_000_000, "presenter-circle-bottom-right"],
      [10_000_000, "full-screen"]
    ]);
    useEditorStore.getState().undo();
    video = useEditorStore.getState().project.tracks[0].clips[0] as VideoClip;
    expect(video.presentationCues?.map((cue) => cue.presetId)).toEqual(["presenter-circle-bottom-right"]);
    useEditorStore.getState().redo();

    useEditorStore.getState().trimClip(videoId, "start", 2_000_000);
    video = useEditorStore.getState().project.tracks[0].clips[0] as VideoClip;
    expect(video).toMatchObject({ startUs: 2_000_000, durationUs: 18_000_000, mask: { shape: "circle" } });
    expect(video.presentationCues?.map((cue) => [cue.offsetUs, cue.presetId])).toEqual([[8_000_000, "full-screen"]]);

    useEditorStore.getState().selectClip(videoId);
    useEditorStore.getState().setPlayhead(6_000_000);
    useEditorStore.getState().splitSelected();
    const clips = useEditorStore.getState().project.tracks[0].clips as VideoClip[];
    expect(clips).toHaveLength(2);
    expect(clips[1]).toMatchObject({ startUs: 6_000_000, transform: { x: 84, y: 80, scale: 0.26 }, mask: { shape: "circle" } });
    expect(clips[1].presentationCues?.map((cue) => [cue.offsetUs, cue.presetId])).toEqual([[4_000_000, "full-screen"]]);
  });

  it("copies and pastes multiple clips preserving their relative offset", () => {
    useEditorStore.getState().addEffect("title-highlight");
    const first = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().setPlayhead(4_000_000);
    useEditorStore.getState().addEffect("number-pop");
    const second = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().selectClip(first);
    useEditorStore.getState().selectClip(second, true);
    useEditorStore.getState().copySelected();
    useEditorStore.getState().setPlayhead(10_000_000);
    useEditorStore.getState().pasteAtPlayhead();
    const effects = useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips;
    expect(effects).toHaveLength(4);
    expect(effects.slice(2).map((clip) => clip.startUs)).toEqual([10_000_000, 14_000_000]);
  });

  it("prevents edits on a locked track", () => {
    useEditorStore.getState().addEffect("title-highlight");
    const effect = useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0];
    useEditorStore.getState().setTrackState("effect-main", { locked: true });
    useEditorStore.getState().moveClips([effect.id], 2_000_000);
    useEditorStore.getState().trimClip(effect.id, "end", 2_000_000);
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({ startUs: 0, durationUs: 2_500_000 });
  });

  it("adds, trims and splits audio with source continuity", () => {
    useEditorStore.getState().addAudio({ id: "audio-asset", name: "voice.wav", kind: "audio", durationUs: 8_000_000, hasAudio: true }, "voice");
    const audio = useEditorStore.getState().project.tracks.find((candidate) => candidate.audioRole === "voice")!.clips[0] as AudioClip;
    expect(audio).toMatchObject({ role: "voice", volume: 1.5, fadeInUs: 50_000, fadeOutUs: 50_000 });
    useEditorStore.getState().trimClip(audio.id, "start", 1_000_000);
    useEditorStore.getState().setPlayhead(3_000_000);
    useEditorStore.getState().splitSelected();
    const clips = useEditorStore.getState().project.tracks.find((candidate) => candidate.audioRole === "voice")!.clips as AudioClip[];
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ startUs: 1_000_000, durationUs: 2_000_000, sourceInUs: 1_000_000 });
    expect(clips[1]).toMatchObject({ startUs: 3_000_000, durationUs: 5_000_000, sourceInUs: 3_000_000 });
  });

  it("aligns extracted audio with every source-video edit and mutes duplicate source audio", () => {
    useEditorStore.getState().addVideo({ id: "source-video", name: "source.mp4", kind: "video", durationUs: 10_000_000, hasAudio: true });
    const video = useEditorStore.getState().project.tracks.find((track) => track.kind === "video")!.clips[0] as VideoClip;
    useEditorStore.getState().updateVideo(video.id, { startUs: 3_000_000, sourceInUs: 1_000_000, durationUs: 5_000_000, playbackRate: 1.25, volume: 0.7 });
    useEditorStore.getState().addExtractedAudio({ id: "extracted", name: "source.m4a", kind: "audio", durationUs: 10_000_000, hasAudio: true }, "source-video");
    const updatedVideo = useEditorStore.getState().project.tracks.find((track) => track.kind === "video")!.clips[0] as VideoClip;
    const extracted = useEditorStore.getState().project.tracks.find((track) => track.audioRole === "sound")!.clips[0] as AudioClip;
    expect(updatedVideo.volume).toBe(0);
    expect(extracted).toMatchObject({ startUs: 3_000_000, sourceInUs: 1_000_000, durationUs: 5_000_000, playbackRate: 1.25, volume: 0.7, role: "sound" });
  });

  it("materializes AI-matched local media and effects on ordinary tracks", () => {
    useEditorStore.getState().addVideo({ id: "broll", name: "metrics.mp4", kind: "video", durationUs: 12_000_000, hasAudio: true });
    const matchedPlan: AiVideoPlan = { ...plan, captions: [{ startSeconds: 0, endSeconds: 2, text: "实际标题" }], matches: [{ ...motionMatch, primaryMediaAssetId: "broll", primaryMediaSourceInSeconds: 4, mediaLayoutPreset: "shrink-top-right" }] };
    useEditorStore.getState().addGeneratedPlan(matchedPlan, "metrics", "overlay");
    const project = useEditorStore.getState().project;
    expect(project.tracks.flatMap((track) => track.clips).find((clip) => clip.kind === "video" && clip.label.startsWith("AI 素材"))).toMatchObject({ assetId: "broll", sourceInUs: 4_000_000, zIndex: 10, camera: { preset: "push-in" }, transformKeyframes: expect.any(Array) });
    expect(project.tracks.find((track) => track.kind === "effect")!.clips).toContainEqual(expect.objectContaining({ text: "实际标题", effectId: "test-title-slide" }));
  });

  it("materializes an AI tutorial composition with screen focus and a circular presenter", () => {
    const state = useEditorStore.getState();
    const project = structuredClone(state.project);
    project.assets.push(
      { id: "screen", name: "screen.mp4", kind: "video", durationUs: 10_000_000, hasAudio: false },
      { id: "presenter", name: "presenter.mp4", kind: "video", durationUs: 10_000_000, hasAudio: true }
    );
    useEditorStore.setState({ ...state, project });
    useEditorStore.getState().addGeneratedPlan({
      ...plan,
      captions: [{ startSeconds: 0, endSeconds: 3, text: "点击右上角的设置按钮。" }],
      matches: [{
        ...motionMatch,
        backdropPreset: "dark",
        videoLayers: [
          { assetId: "screen", role: "screen", sourceInSeconds: 0, layoutPreset: "full", shapePreset: "rectangle", transitionPreset: "fade", cameraPreset: "push-in", volume: 0, focus: { enabled: true, x: 50, y: 50, zoom: 2, startOffsetSeconds: 0.3, durationSeconds: 2.2 } },
          { assetId: "presenter", role: "presenter", sourceInSeconds: 0, layoutPreset: "presenter-bottom-right", shapePreset: "circle", transitionPreset: "dock", cameraPreset: "none", volume: 1, focus: null }
        ]
      }]
    }, "教程组合", "overlay");

    const result = useEditorStore.getState().project;
    const videos = result.tracks.flatMap((track) => track.clips).filter((clip): clip is VideoClip => clip.kind === "video");
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({ role: "screen", layoutPreset: "full", focus: { enabled: true, x: 50, y: 50, zoom: 2 }, volume: 0 });
    expect(videos[1]).toMatchObject({ role: "presenter", layoutPreset: "presenter-bottom-right", mask: { shape: "circle" }, transition: { preset: "dock" }, volume: 1 });
    expect(videos[1].transformKeyframes).toHaveLength(2);
    expect(result.tracks.find((track) => track.kind === "effect")?.clips[0]).toMatchObject({ kind: "effect", backdrop: { enabled: true, color: "#111316" } });
  });

  it("creates a bounded one-shot preview request", () => {
    useEditorStore.getState().requestPreview(2_000_000, 2_800_000);
    expect(useEditorStore.getState().previewRequest).toMatchObject({ id: 1, startUs: 2_000_000, endUs: 2_800_000 });
    useEditorStore.getState().requestPreview(-1, 0);
    expect(useEditorStore.getState().previewRequest).toMatchObject({ id: 2, startUs: 0, endUs: 100_000 });
  });

  it("expands a scene template into overlapping timeline effects with shared AI metadata", () => {
    useEditorStore.getState().setPlayhead(2_000_000);
    useEditorStore.getState().addEffect("scene-focus-stack");
    const effects = useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips;

    expect(effects).toHaveLength(3);
    expect(new Set(effects.map((effect) => effect.kind === "effect" ? effect.sceneGroupId : undefined))).toHaveLength(1);
    expect(effects.every((effect) => effect.kind === "effect" && effect.sceneTemplateId === "scene-focus-stack")).toBe(true);
    expect(effects.map((effect) => effect.startUs)).toEqual([2_000_000, 2_480_000, 3_120_000]);
    expect(effects.every((effect) => effect.startUs < 6_000_000 && effect.startUs + effect.durationUs <= 6_000_000)).toBe(true);
  });

  it("materializes at most two AI-selected effects with exact returned text", () => {
    const multiEffectPlan: AiVideoPlan = {
      ...plan,
      captions: [{ startSeconds: 0, endSeconds: 2, text: "增长 42% 的核心结论" }],
      matches: [{ ...motionMatch, primaryText: "增长 42%", secondaryEffectId: "test-keyword-underline", secondaryText: "核心结论", secondaryX: 70, secondaryY: 72 }]
    };
    useEditorStore.getState().addGeneratedPlan(multiEffectPlan, "增长 42% 的核心结论", "overlay");
    const effects = useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips;
    expect(effects).toHaveLength(2);
    expect(effects.map((clip) => clip.kind === "effect" ? clip.text : "")).toEqual(["增长 42%", "核心结论"]);
  });

  it("creates exact timed subtitles returned by the first AI call", () => {
    const captionPlan: AiVideoPlan = {
      ...plan,
      captions: [{ startSeconds: 0, endSeconds: 2, text: "第一句。" }, { startSeconds: 2, endSeconds: 5, text: "最后一句。" }]
    };
    useEditorStore.getState().addGeneratedPlan(captionPlan, "生成字幕", "insert", { startUs: 4_000_000 });
    const project = useEditorStore.getState().project;
    const generated = project.tracks.find((track) => track.kind === "generated")!.clips[0];
    expect(generated.kind).toBe("generated");
    if (generated.kind !== "generated") return;
    const subtitles = project.tracks.find((track) => track.kind === "subtitle")!.clips;
    expect(subtitles.map((clip) => [clip.startUs, clip.startUs + clip.durationUs, clip.kind === "subtitle" ? clip.text : ""])).toEqual([
      [4_000_000, 6_000_000, "第一句。"],
      [6_000_000, 9_000_000, "最后一句。"]
    ]);
    expect(subtitles[1].startUs).toBe(subtitles[0].startUs + subtitles[0].durationUs);
    expect(subtitles.every((clip) => clip.kind === "subtitle" && clip.sourceAssetId === generated.id)).toBe(true);

    useEditorStore.getState().removeSelected();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips).toEqual([]);
  });

  it("materializes the complete AI script, timed-caption and matched-effect chain", () => {
    const chainPlan: AiVideoPlan = {
      ...plan,
      article: "完整文案介绍增长、数据和执行步骤。",
      narration: "先看增长数据。然后执行三个步骤。",
      captions: [{ startSeconds: 0, endSeconds: 2, text: "先看增长数据。" }, { startSeconds: 2, endSeconds: 6, text: "然后执行三个步骤。" }],
      matches: [motionMatch, { ...motionMatch, captionIndex: 1, primaryEffectId: "test-callout-panel", primaryText: "三个步骤", x: 28, y: 60, cameraPreset: "pan-right" }],
      scenes: [
        { ...plan.scenes[0], narration: "先看增长数据。", effectIds: ["title-highlight", "data-bar-chart"] },
        { ...plan.scenes[1], narration: "然后执行三个步骤。", effectIds: ["number-pop", "bullet-reveal"] }
      ]
    };
    useEditorStore.getState().addGeneratedPlan(chainPlan, "全链路测试", "insert");
    const project = useEditorStore.getState().project;
    const generated = project.tracks.find((track) => track.kind === "generated")!.clips[0];
    expect(generated).toMatchObject({ kind: "generated", article: chainPlan.article, narration: chainPlan.narration, scenes: expect.any(Array) });
    if (generated.kind !== "generated") return;
    expect(project.tracks.find((track) => track.kind === "subtitle")!.clips).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "先看增长数据。", sourceAssetId: generated.id }),
      expect.objectContaining({ text: "然后执行三个步骤。", sourceAssetId: generated.id })
    ]));
    const effects = project.tracks.find((track) => track.kind === "effect")!.clips;
    expect(effects.map((clip) => clip.kind === "effect" ? clip.text : "")).toEqual(["实际标题", "三个步骤"]);
    expect(new Set(effects.map((clip) => clip.kind === "effect" ? `${clip.transform.x}:${clip.transform.y}` : "")).size).toBe(2);
  });

  it("keeps ASR extraction separate and applies replaceable AI motion matches afterwards", () => {
    useEditorStore.getState().addVideo({ id: "asr-video", name: "speech.mp4", kind: "video", durationUs: 8_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("asr-video", [
      { startSeconds: 0, endSeconds: 3, text: "核心增长达到百分之四十二。" },
      { startSeconds: 3, endSeconds: 8, text: "接下来分三步完成配置。" }
    ]);
    let project = useEditorStore.getState().project;
    const subtitles = project.tracks.find((track) => track.kind === "subtitle")!.clips;
    expect(subtitles).toHaveLength(2);
    let effects = project.tracks.find((track) => track.kind === "effect")!.clips;
    expect(effects).toHaveLength(0);

    useEditorStore.getState().applyMotionMatches(subtitles.map((clip) => clip.id), [
      { ...motionMatch, primaryText: "增长 42%" },
      { ...motionMatch, captionIndex: 1, primaryEffectId: "test-callout-panel", primaryText: "三步配置", cameraPreset: "pull-out" }
    ]);
    project = useEditorStore.getState().project;
    effects = project.tracks.find((track) => track.kind === "effect")!.clips;
    expect(effects.map((effect) => effect.kind === "effect" ? effect.text : "")).toEqual(["增长 42%", "三步配置"]);
    expect(effects.every((effect) => effect.kind === "effect" && effect.sceneGroupId?.startsWith("ai-subtitle:") && Boolean(effect.matchQuery))).toBe(true);
    expect(project.tracks.flatMap((track) => track.clips).some((clip) => clip.kind === "video" && clip.label.startsWith("AI 运镜"))).toBe(true);

    useEditorStore.getState().addSubtitles("asr-video", [{ startSeconds: 0, endSeconds: 8, text: "替换后的字幕。" }]);
    project = useEditorStore.getState().project;
    effects = project.tracks.find((track) => track.kind === "effect")!.clips;
    expect(project.tracks.find((track) => track.kind === "subtitle")!.clips).toHaveLength(1);
    expect(effects).toHaveLength(0);
  });

  it("uses the project accent color instead of the AI color for matched subtitles and effects", () => {
    useEditorStore.getState().updateMotionTheme({ colors: { data: "#47d7ac", opinion: "#47d7ac", warning: "#47d7ac", auxiliary: "#47d7ac" } });
    useEditorStore.getState().addVideo({ id: "asr-video", name: "speech.mp4", kind: "video", durationUs: 3_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("asr-video", [{ startSeconds: 0, endSeconds: 3, text: "核心增长达到百分之四十二。" }]);
    const subtitle = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips[0];

    useEditorStore.getState().applyMotionMatches([subtitle.id], [{
      ...motionMatch,
      accentColor: "#ff0000",
      backdropPreset: "accent",
      subtitleKeywords: ["核心增长"]
    }]);

    const project = useEditorStore.getState().project;
    expect(project.tracks.find((track) => track.kind === "subtitle")!.clips[0]).toMatchObject({
      highlightWords: ["核心增长"],
      highlightColor: "#47d7ac"
    });
    expect(project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({
      accentColor: "#47d7ac",
      backdrop: { color: "#47d7ac" }
    });
  });

  it("uses the project accent color throughout generated plans", () => {
    useEditorStore.getState().updateMotionTheme({ colors: { data: "#ffb84d", opinion: "#ffb84d", warning: "#ffb84d", auxiliary: "#ffb84d" } });
    useEditorStore.getState().addGeneratedPlan({
      ...plan,
      captions: [{ startSeconds: 0, endSeconds: 2, text: "统一主题色" }],
      matches: [{ ...motionMatch, accentColor: "#ff0000", backdropPreset: "accent", subtitleKeywords: ["主题色"] }]
    }, "统一主题色", "overlay");

    const project = useEditorStore.getState().project;
    const generated = project.tracks.find((track) => track.kind === "generated")!.clips[0];
    expect(generated).toMatchObject({ kind: "generated", scenes: [expect.objectContaining({ accentColor: "#ffb84d" })] });
    expect(project.tracks.find((track) => track.kind === "subtitle")!.clips[0]).toMatchObject({ highlightColor: "#ffb84d" });
    expect(project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({
      accentColor: "#ffb84d",
      backdrop: { color: "#ffb84d" }
    });
  });

  it("adds replaceable AI-matched sounds to the unlocked sound track", () => {
    useEditorStore.getState().addVideo({ id: "asr-video", name: "speech.mp4", kind: "video", durationUs: 4_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("asr-video", [{ startSeconds: 1, endSeconds: 4, text: "点击按钮完成操作。" }]);
    const subtitle = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips[0];
    const clickAsset = { id: "builtin-sound:clean-click", name: "字幕弹出.wav", kind: "audio" as const, durationUs: 220_000, sourcePath: "/cache/click.wav", objectUrl: "asset://click", hasAudio: true, missing: false };
    const summary = useEditorStore.getState().applyMotionMatches([subtitle.id], [{ ...motionMatch, soundEffectId: "clean-click" }], [clickAsset]);

    expect(summary).toMatchObject({ requestedEffectCount: 1, effectCount: 1, sceneCount: 0, soundCount: 1, skippedEffectCount: 0 });

    let soundTrack = useEditorStore.getState().project.tracks.find((track) => track.audioRole === "sound")!;
    expect(soundTrack.clips).toEqual([expect.objectContaining({
      kind: "audio", label: "AI 音效 · 字幕弹出", startUs: 1_000_000, durationUs: 220_000,
      assetId: clickAsset.id, role: "sound", sourceSubtitleId: subtitle.id
    })]);
    expect(useEditorStore.getState().project.assets).toContainEqual(expect.objectContaining({ id: clickAsset.id }));

    const successAsset = { ...clickAsset, id: "builtin-sound:success-tone", name: "片尾收束.wav", durationUs: 1_050_000, sourcePath: "/cache/success.wav" };
    useEditorStore.getState().applyMotionMatches([subtitle.id], [{ ...motionMatch, soundEffectId: "success-tone" }], [successAsset]);
    soundTrack = useEditorStore.getState().project.tracks.find((track) => track.audioRole === "sound")!;
    expect(soundTrack.clips).toHaveLength(1);
    expect(soundTrack.clips[0]).toMatchObject({ label: "AI 音效 · 片尾收束", assetId: successAsset.id });

    useEditorStore.getState().setTrackState(soundTrack.id, { locked: true });
    useEditorStore.getState().applyMotionMatches([subtitle.id], [{ ...motionMatch, soundEffectId: null }]);
    expect(useEditorStore.getState().project.tracks.find((track) => track.audioRole === "sound")!.clips).toHaveLength(1);
  });

  it("uses only exact subtitle keywords for highlights and keeps divergent motion copy", () => {
    useEditorStore.getState().addVideo({ id: "asr-video", name: "speech.mp4", kind: "video", durationUs: 3_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("asr-video", [{ startSeconds: 0, endSeconds: 3, text: "核心增长达到百分之四十二。" }]);
    const subtitle = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips[0];
    useEditorStore.getState().applyMotionMatches([subtitle.id], [{
      ...motionMatch,
      subtitleKeywords: ["核心增长", "无关内容"],
      primaryText: "增势进入关键阶段"
    }]);
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips[0]).toMatchObject({ highlightWords: ["核心增长"], highlightColor: "#5fa8ff" });
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({ text: "增势进入关键阶段" });
  });

  it("materializes a text-free scene background from subtitle motion matching", () => {
    useEditorStore.getState().updateMotionTheme({ colors: { data: "#9b8cff", opinion: "#9b8cff", warning: "#9b8cff", auxiliary: "#9b8cff" } });
    useEditorStore.getState().addVideo({ id: "asr-video", name: "speech.mp4", kind: "video", durationUs: 3_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("asr-video", [{ startSeconds: 0, endSeconds: 3, text: "行业进入精细化运营阶段。" }]);
    const subtitle = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips[0];
    useEditorStore.getState().applyMotionMatches([subtitle.id], [{
      ...motionMatch,
      primaryEffectId: "scene-dark-grid",
      primaryText: ""
    }]);
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips).toHaveLength(0);
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "scene")!.clips[0]).toMatchObject({
      kind: "scene",
      effectId: "scene-dark-grid",
      background: { preset: "dark-grid", borderColor: "#9b8cff" }
    });
  });

  it("materializes a staged motion group across multiple subtitle ranges", () => {
    useEditorStore.getState().addVideo({ id: "market-video", name: "market.mp4", kind: "video", durationUs: 8_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("market-video", [
      { startSeconds: 0, endSeconds: 1.5, text: "市场格局上，" },
      { startSeconds: 1.5, endSeconds: 5, text: "公共充电桩占60%，私人充电桩占40%。" },
      { startSeconds: 5, endSeconds: 7, text: "头部运营商占据主导。" }
    ]);
    const subtitles = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips;
    useEditorStore.getState().applyMotionMatches(subtitles.map((subtitle) => subtitle.id), [
      { ...motionMatch, captionIndex: 0, motionGroupId: "charging-market", persistUntilCaptionIndex: 2, primaryText: "市场格局" },
      { ...motionMatch, captionIndex: 1, motionGroupId: "charging-market", persistUntilCaptionIndex: 2, primaryEffectId: "test-callout-panel", primaryText: "公共充电桩", secondaryEffectId: "test-callout-panel", secondaryText: "私人充电桩", x: 30, secondaryX: 70, y: 48, secondaryY: 48 },
      { ...motionMatch, captionIndex: 2, motionGroupId: "charging-market", persistUntilCaptionIndex: 2, primaryEffectId: "test-keyword-underline", primaryText: "头部运营商主导", y: 70 }
    ]);

    const effects = useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips;
    expect(effects.map((effect) => [effect.startUs, effect.durationUs, effect.kind === "effect" ? effect.text : ""])).toEqual([
      [0, 7_000_000, "市场格局"],
      [1_500_000, 5_500_000, "公共充电桩"],
      [1_500_000, 5_500_000, "私人充电桩"],
      [5_000_000, 2_000_000, "头部运营商主导"]
    ]);
    expect([...new Set(effects.map((effect) => effect.kind === "effect" ? effect.sceneGroupId : null))]).toEqual([expect.stringMatching(/^ai-motion:charging-market:/)]);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips).toEqual([]);
  });

  it("resolves overlapping AI motion positions before writing timeline clips", () => {
    useEditorStore.getState().addVideo({ id: "layout-video", name: "layout.mp4", kind: "video", durationUs: 5_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("layout-video", [
      { startSeconds: 0, endSeconds: 2, text: "先显示市场格局。" },
      { startSeconds: 2, endSeconds: 5, text: "再显示公共和私人充电桩数据。" }
    ]);
    const subtitles = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips;
    useEditorStore.getState().applyMotionMatches(subtitles.map((subtitle) => subtitle.id), [
      { ...motionMatch, captionIndex: 0, motionGroupId: "layout", persistUntilCaptionIndex: 1, primaryText: "市场格局", x: 50, y: 88 },
      { ...motionMatch, captionIndex: 1, motionGroupId: "layout", persistUntilCaptionIndex: 1, primaryEffectId: "test-callout-panel", primaryText: "公共与私人充电桩", x: 50, y: 88 }
    ]);

    const project = useEditorStore.getState().project;
    const effects = project.tracks.find((track) => track.kind === "effect")!.clips as EffectClip[];
    const layoutLayers: MotionLayoutLayer[] = effects.map((effect) => ({
      id: effect.id,
      effectId: effect.effectId,
      startUs: effect.startUs,
      durationUs: effect.durationUs,
      desiredX: effect.transform.x,
      desiredY: effect.transform.y,
      scale: effect.transform.scale,
      fontSize: effect.fontSize,
      text: effect.text,
      recipe: effect.recipe ?? effectById(effect.effectId).recipe,
      priority: "primary"
    }));
    const rectangles = effects.map((effect, index) => estimateMotionLayoutRect(layoutLayers[index], effect.transform, project.canvas));

    expect(effects).toHaveLength(2);
    expect(rectangles.every((rect) => rect.bottom <= 78)).toBe(true);
    expect(motionLayoutRectsOverlap(rectangles[0], rectangles[1])).toBe(false);
  });

  it("keeps AI chart effects readable when the model requests a tiny scale", () => {
    useEditorStore.getState().addVideo({ id: "asr-video", name: "speech.mp4", kind: "video", durationUs: 3_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("asr-video", [{ startSeconds: 0, endSeconds: 3, text: "年收入约一万五千元。" }]);
    const subtitle = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips[0];
    useEditorStore.getState().applyMotionMatches([subtitle.id], [{
      ...motionMatch,
      primaryEffectId: "test-number-counter",
      primaryText: "1.5万元",
      scale: 0.3,
      chart: { categories: ["年收入"], series: [1.5], unit: "万元" }
    }]);

    const effect = useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0];
    expect(effect).toMatchObject({ kind: "effect", fontSize: 80, transform: { scale: 0.8 } });
  });

  it("normalizes Overlay Studio effect scale and keeps it outside the presenter area", () => {
    useEditorStore.getState().updatePresenterSafeArea({ position: "right", widthPercent: 40 });
    useEditorStore.getState().addVideo({ id: "presenter-video", name: "presenter.mp4", kind: "video", durationUs: 3_000_000, hasAudio: true });
    useEditorStore.getState().addSubtitles("presenter-video", [{ startSeconds: 0, endSeconds: 3, text: "增长达到百分之四十二。" }]);
    const subtitle = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips[0];
    useEditorStore.getState().applyMotionMatches([subtitle.id], [{
      ...motionMatch,
      primaryEffectId: "ring-metric",
      primaryText: "42%｜增长指标",
      scale: 2.5
    }]);

    const project = useEditorStore.getState().project;
    const effect = project.tracks.find((track) => track.kind === "effect")!.clips[0] as EffectClip;
    const layer: MotionLayoutLayer = {
      id: effect.id,
      effectId: effect.effectId,
      startUs: effect.startUs,
      durationUs: effect.durationUs,
      desiredX: effect.transform.x,
      desiredY: effect.transform.y,
      scale: effect.transform.scale,
      fontSize: effect.fontSize,
      text: effect.text,
      recipe: effect.recipe ?? effectById(effect.effectId).recipe,
      priority: "primary"
    };
    const presenterRect = { left: 57, top: 6, right: 97, bottom: 78 };

    expect(effect).toMatchObject({ fontSize: 48, transform: { scale: 1 } });
    expect(motionLayoutRectsOverlap(estimateMotionLayoutRect(layer, effect.transform, project.canvas), presenterRect)).toBe(false);
  });

  it("clears only subtitles inside an AI replace range", () => {
    const state = useEditorStore.getState();
    const project = structuredClone(state.project);
    const subtitleTrack = project.tracks.find((track) => track.kind === "subtitle")!;
    subtitleTrack.clips.push({ id: "existing", trackId: subtitleTrack.id, kind: "subtitle", label: "existing", startUs: 1_000_000, durationUs: 10_000_000, locked: false, text: "existing", color: "#fff", backgroundColor: "#000", fontSize: 44, positionY: 88 });
    useEditorStore.setState({ ...state, project });
    useEditorStore.getState().addGeneratedPlan({ ...plan, scenes: [plan.scenes[0]] }, "替换字幕", "replace", { startUs: 4_000_000, durationUs: 2_000_000 });
    const subtitles = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips;
    expect(subtitles).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "existing", startUs: 1_000_000, durationUs: 3_000_000 }),
      expect.objectContaining({ startUs: 6_000_000, durationUs: 5_000_000, text: "existing" }),
      expect.objectContaining({ startUs: 4_000_000, durationUs: 2_000_000, text: "第一段" })
    ]));
  });

  it("adapts an empty canvas to the first video and keeps manual canvas settings", () => {
    useEditorStore.getState().addVideo({ id: "portrait", name: "portrait.mp4", kind: "video", durationUs: 5_000_000, width: 576, height: 1280, fpsNumerator: 30_000, fpsDenominator: 1_001 });
    expect(useEditorStore.getState().project.canvas).toEqual({ width: 576, height: 1280, fpsNumerator: 30_000, fpsDenominator: 1_001 });

    useEditorStore.getState().updateCanvas({ width: 1080, height: 1920, fpsNumerator: 60_000, fpsDenominator: 1_000 });
    useEditorStore.getState().addVideo({ id: "landscape", name: "landscape.mp4", kind: "video", durationUs: 4_000_000, width: 1920, height: 1080, fpsNumerator: 24, fpsDenominator: 1 });
    expect(useEditorStore.getState().project.canvas).toEqual({ width: 1080, height: 1920, fpsNumerator: 60_000, fpsDenominator: 1_000 });
  });

  it("uses an explicit range target and normalizes scene durations exactly", () => {
    useEditorStore.getState().addVideo({ id: "source", name: "source.mp4", kind: "video", durationUs: 20_000_000 });
    useEditorStore.getState().addGeneratedPlan(plan, "选区替换", "replace", { startUs: 3_000_000, durationUs: 5_000_001 });
    const generated = useEditorStore.getState().project.tracks.find((track) => track.kind === "generated")!.clips[0];
    expect(generated).toMatchObject({ kind: "generated", startUs: 3_000_000, durationUs: 5_000_001 });
    if (generated.kind !== "generated") return;
    expect(generated.scenes.reduce((sum, scene) => sum + scene.durationUs, 0)).toBe(5_000_001);
    const videos = useEditorStore.getState().project.tracks.find((track) => track.kind === "video")!.clips as VideoClip[];
    expect(videos).toEqual([
      expect.objectContaining({ startUs: 0, durationUs: 3_000_000 }),
      expect.objectContaining({ startUs: 8_000_001, durationUs: 11_999_999, sourceInUs: 8_000_001 })
    ]);
  });

  it("materializes a short AI-matched source as a real video clip", () => {
    useEditorStore.getState().addVideo({ id: "short", name: "short.mp4", kind: "video", durationUs: 1_000_000, hasAudio: true });
    const matchedPlan: AiVideoPlan = { ...plan, captions: [{ startSeconds: 0, endSeconds: 2, text: "短素材" }], matches: [{ ...motionMatch, primaryMediaAssetId: "short", primaryMediaSourceInSeconds: 0.8 }] };
    useEditorStore.getState().addGeneratedPlan(matchedPlan, "循环短素材", "insert", { startUs: 4_000_000 });
    const video = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.kind === "video" && clip.label.startsWith("AI 素材"));
    expect(video).toMatchObject({ kind: "video", assetId: "short", sourceInUs: 800_000, durationUs: 2_000_000 });
  });

  it("places generated narration at its target start instead of the current playhead", () => {
    useEditorStore.getState().setPlayhead(12_000_000);
    useEditorStore.getState().addAudio({ id: "voice-target", name: "voice.wav", kind: "audio", durationUs: 3_000_000 }, "voice", 4_000_000);
    const voice = useEditorStore.getState().project.tracks.find((track) => track.audioRole === "voice")!.clips[0];
    expect(voice).toMatchObject({ startUs: 4_000_000, durationUs: 3_000_000 });
  });

  it("replaces an older voice generated for the same AI content block", () => {
    useEditorStore.getState().addAudio({ id: "old-voice", name: "old.wav", kind: "audio", durationUs: 2_000_000 }, "voice", 1_000_000, "generated-one");
    useEditorStore.getState().addAudio({ id: "new-voice", name: "new.wav", kind: "audio", durationUs: 3_000_000 }, "voice", 1_000_000, "generated-one");

    const project = useEditorStore.getState().project;
    const voices = project.tracks.find((track) => track.audioRole === "voice")!.clips;
    expect(voices).toHaveLength(1);
    expect(voices[0]).toMatchObject({ assetId: "new-voice", sourceBlockId: "generated-one" });
    expect(project.assets.map((asset) => asset.id)).toContain("new-voice");
    expect(project.assets.map((asset) => asset.id)).not.toContain("old-voice");
  });

  it("retimes generated subtitles, effects and following clips to the actual TTS duration", () => {
    useEditorStore.getState().addVideo({ id: "base", name: "base.mp4", kind: "video", durationUs: 20_000_000 });
    const generatedId = useEditorStore.getState().addGeneratedPlan({
      ...plan,
      captions: [{ startSeconds: 0, endSeconds: 2, text: "开场信息" }, { startSeconds: 2, endSeconds: 6, text: "核心结论" }],
      matches: [motionMatch, { ...motionMatch, captionIndex: 1, primaryText: "核心结论" }]
    }, "时长对齐", "insert", { startUs: 5_000_000 });

    useEditorStore.getState().alignGeneratedBlockDuration(generatedId, 7_200_000);
    const project = useEditorStore.getState().project;
    const generated = project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === generatedId)!;
    const subtitles = project.tracks.find((track) => track.kind === "subtitle")!.clips.sort((left, right) => left.startUs - right.startUs);
    const effects = project.tracks.find((track) => track.kind === "effect")!.clips.sort((left, right) => left.startUs - right.startUs);
    const continuation = project.tracks.flatMap((track) => track.clips).find((clip) => clip.kind === "video" && clip.label.includes("续"));

    expect(generated).toMatchObject({ durationUs: 7_200_000 });
    expect(subtitles.map((clip) => [clip.startUs, clip.durationUs])).toEqual([[5_000_000, 2_400_000], [7_400_000, 4_800_000]]);
    expect(effects.map((clip) => [clip.startUs, clip.durationUs])).toEqual([[5_000_000, 2_400_000], [7_400_000, 4_800_000]]);
    expect(continuation).toMatchObject({ startUs: 12_200_000 });
  });

  it("uses each measured TTS segment duration for subtitles and linked effects", () => {
    const generatedId = useEditorStore.getState().addGeneratedPlan({
      ...plan,
      captions: [
        { startSeconds: 0, endSeconds: 2, text: "第一句" },
        { startSeconds: 2, endSeconds: 4, text: "第二句" }
      ],
      matches: [motionMatch, { ...motionMatch, captionIndex: 1, primaryText: "第二句重点" }]
    }, "逐句配音", "insert", { startUs: 1_000_000 });
    useEditorStore.getState().addAudio({ id: "generated-voice", name: "voice.wav", kind: "audio", durationUs: 3_400_000 }, "voice", 1_000_000, generatedId);

    useEditorStore.getState().alignGeneratedSceneDurations(generatedId, [1_100_000, 2_300_000]);

    const project = useEditorStore.getState().project;
    const generated = project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === generatedId);
    const subtitles = project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "subtitle" && clip.sourceBlockId === generatedId).sort((left, right) => left.startUs - right.startUs);
    const effects = project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "effect" && clip.sourceBlockId === generatedId).sort((left, right) => left.startUs - right.startUs);
    const voice = project.tracks.flatMap((track) => track.clips).find((clip): clip is AudioClip => clip.kind === "audio" && clip.sourceBlockId === generatedId);
    expect(generated).toMatchObject({ durationUs: 3_400_000, scenes: [{ durationUs: 1_100_000 }, { durationUs: 2_300_000 }] });
    expect(subtitles.map((clip) => [clip.startUs, clip.durationUs])).toEqual([[1_000_000, 1_100_000], [2_100_000, 2_300_000]]);
    expect(effects.map((clip) => [clip.startUs, clip.durationUs])).toEqual([[1_000_000, 1_100_000], [2_100_000, 2_300_000]]);
    expect(voice).toMatchObject({ startUs: 1_000_000, durationUs: 3_400_000, sourceInUs: 0, playbackRate: 1 });
  });

  it("preserves effects spanning multiple subtitles when measured TTS timings change", () => {
    const generatedId = useEditorStore.getState().addGeneratedPlan({
      ...plan,
      captions: [
        { startSeconds: 0, endSeconds: 2, text: "第一句" },
        { startSeconds: 2, endSeconds: 4, text: "第二句" }
      ],
      matches: [{ ...motionMatch, motionGroupId: "summary", persistUntilCaptionIndex: 1 }]
    }, "跨句动效", "insert", { startUs: 1_000_000 });
    const effect = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.kind === "effect")!;
    expect(effect).toMatchObject({ startUs: 1_000_000, durationUs: 4_000_000 });

    useEditorStore.getState().alignGeneratedSceneDurations(generatedId, [1_100_000, 2_300_000]);

    const aligned = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === effect.id);
    expect(aligned).toMatchObject({ startUs: 1_000_000, durationUs: 3_400_000 });
  });

  it("adds, edits and reuses an image sticker at the playhead", () => {
    useEditorStore.getState().addImage({ id: "image-asset", name: "badge.png", kind: "image", durationUs: 5_000_000, width: 400, height: 240 });
    const first = useEditorStore.getState().project.tracks.find((track) => track.kind === "image")!.clips[0] as ImageClip;
    expect(first).toMatchObject({ kind: "image", entrance: "pop", transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 } });
    useEditorStore.getState().updateImage(first.id, { speed: 1.6, transform: { ...first.transform, x: 72, rotation: 15 } });
    useEditorStore.getState().setPlayhead(8_000_000);
    useEditorStore.getState().placeAsset("image-asset");
    const images = useEditorStore.getState().project.tracks.find((track) => track.kind === "image")!.clips as ImageClip[];
    expect(images).toHaveLength(2);
    expect(images[0]).toMatchObject({ speed: 1.6, transform: { x: 72, rotation: 15 } });
    expect(images[1]).toMatchObject({ startUs: 8_000_000, durationUs: 5_000_000 });
  });

  it("selects, moves and stretches scene groups as one undoable unit", () => {
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "effect")!;
    const base = {
      trackId: track.id, kind: "effect" as const, locked: false, effectId: "test-title-slide", color: "#ffffff", accentColor: "#47d7ac",
      fontSize: 48, speed: 1, transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }, sceneGroupId: "scene-one"
    };
    track.clips.push(
      { ...base, id: "first", label: "第一层", text: "第一层", startUs: 1_000_000, durationUs: 4_000_000 },
      { ...base, id: "second", label: "第二层", text: "第二层", startUs: 2_000_000, durationUs: 3_000_000, dimAtUs: 2_000_000 }
    );
    useEditorStore.setState({ ...useEditorStore.getState(), project, past: [], future: [] });

    useEditorStore.getState().selectClip("first");
    expect(useEditorStore.getState().selectedClipIds).toEqual(["first", "second"]);
    useEditorStore.getState().moveClips(["first"], 1_000_000);
    expect(track.clips.map((clip) => clip.startUs)).toEqual([1_000_000, 2_000_000]);
    expect(useEditorStore.getState().project.tracks.find((candidate) => candidate.id === track.id)!.clips.map((clip) => clip.startUs)).toEqual([2_000_000, 3_000_000]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.tracks.find((candidate) => candidate.id === track.id)!.clips.map((clip) => clip.startUs)).toEqual([1_000_000, 2_000_000]);

    useEditorStore.getState().trimClip("first", "end", 2_000_000);
    const stretched = useEditorStore.getState().project.tracks.find((candidate) => candidate.id === track.id)!.clips;
    expect(stretched.map((clip) => [clip.startUs, clip.durationUs])).toEqual([[1_000_000, 6_000_000], [2_500_000, 4_500_000]]);
    expect(stretched[1].kind === "effect" ? stretched[1].dimAtUs : undefined).toBe(3_000_000);
  });
});
