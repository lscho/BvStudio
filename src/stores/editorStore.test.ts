import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject, type AudioClip, type ImageClip, type VideoClip } from "@/domain/project";
import type { AiVideoPlan } from "@/services/ai/schema";
import { useEditorStore } from "@/stores/editorStore";

const plan: AiVideoPlan = {
  title: "插入介绍",
  article: "一段完整文章。",
  narration: "一段口播。",
  scenes: [
    { title: "开场", narration: "第一段", durationSeconds: 2, effectId: "title-highlight", color: "#ffb84d", cameraPreset: "push-in", mediaAssetId: null, mediaSourceInSeconds: 0 },
    { title: "重点", narration: "第二段", durationSeconds: 4, effectId: "number-pop", color: "#47d7ac", cameraPreset: "pan-right", mediaAssetId: null, mediaSourceInSeconds: 0 }
  ]
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
    clipboard: []
  });
});

describe("editorStore", () => {
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
    expect(effect).toMatchObject({ effectId: "title-highlight", text: "核心观点" });

    useEditorStore.getState().updateEffect(effect.id, { text: "新的标题", speed: 1.5 });
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({ text: "新的标题", speed: 1.5 });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({ text: "核心观点", speed: 1 });
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
    expect(audio).toMatchObject({ role: "voice", volume: 1, fadeInUs: 50_000 });
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

  it("stores AI-matched local media and fully editable scene effect parameters", () => {
    useEditorStore.getState().addVideo({ id: "broll", name: "metrics.mp4", kind: "video", durationUs: 12_000_000, hasAudio: true });
    const matchedPlan: AiVideoPlan = { ...plan, scenes: [{ ...plan.scenes[0], mediaAssetId: "broll", mediaSourceInSeconds: 4 }] };
    useEditorStore.getState().addGeneratedPlan(matchedPlan, "metrics", "overlay");
    const generated = useEditorStore.getState().project.tracks.find((track) => track.kind === "generated")!.clips[0];
    expect(generated.kind).toBe("generated");
    if (generated.kind !== "generated") return;
    expect(generated.scenes[0]).toMatchObject({ mediaAssetId: "broll", mediaSourceInUs: 4_000_000, textColor: "#ffffff", accentColor: "#ffb84d", fontSize: 58, speed: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, camera: { preset: "push-in", startScale: 1, endScale: 1.22 } });
    useEditorStore.getState().updateGeneratedScene(generated.id, generated.scenes[0].id, { fontSize: 72, speed: 1.6, transform: { ...generated.scenes[0].transform, x: 68 } });
    expect((useEditorStore.getState().project.tracks.find((track) => track.kind === "generated")!.clips[0] as typeof generated).scenes[0]).toMatchObject({ fontSize: 72, speed: 1.6, transform: { x: 68 } });
  });

  it("creates exact timed subtitles for cloud narration and regenerates them after edits", () => {
    const captionPlan: AiVideoPlan = {
      ...plan,
      scenes: [
        { ...plan.scenes[0], narration: "第一句。第二句更长。", durationSeconds: 2 },
        { ...plan.scenes[1], narration: "最后一句。", durationSeconds: 3 }
      ]
    };
    useEditorStore.getState().addGeneratedPlan(captionPlan, "生成字幕", "insert", { startUs: 4_000_000 });
    const project = useEditorStore.getState().project;
    const generated = project.tracks.find((track) => track.kind === "generated")!.clips[0];
    expect(generated.kind).toBe("generated");
    if (generated.kind !== "generated") return;
    let subtitles = project.tracks.find((track) => track.kind === "subtitle")!.clips;
    expect(subtitles.map((clip) => [clip.startUs, clip.startUs + clip.durationUs, clip.kind === "subtitle" ? clip.text : ""])).toEqual([
      [4_000_000, expect.any(Number), "第一句。"],
      [expect.any(Number), 6_000_000, "第二句更长。"],
      [6_000_000, 9_000_000, "最后一句。"]
    ]);
    expect(subtitles[1].startUs).toBe(subtitles[0].startUs + subtitles[0].durationUs);
    expect(subtitles.every((clip) => clip.kind === "subtitle" && clip.sourceAssetId === generated.id)).toBe(true);

    useEditorStore.getState().updateGeneratedScene(generated.id, generated.scenes[0].id, { narration: "改写后的单句。", durationUs: 1_500_000 });
    subtitles = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips;
    expect(subtitles.map((clip) => [clip.startUs, clip.startUs + clip.durationUs, clip.kind === "subtitle" ? clip.text : ""])).toEqual([
      [4_000_000, 5_500_000, "改写后的单句。"],
      [5_500_000, 8_500_000, "最后一句。"]
    ]);

    useEditorStore.getState().removeSelected();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips).toEqual([]);
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

  it("keeps short AI-matched material so export can loop it", () => {
    useEditorStore.getState().addVideo({ id: "short", name: "short.mp4", kind: "video", durationUs: 1_000_000, hasAudio: true });
    const matchedPlan: AiVideoPlan = { ...plan, scenes: [{ ...plan.scenes[0], durationSeconds: 2, mediaAssetId: "short", mediaSourceInSeconds: 0.8 }] };
    useEditorStore.getState().addGeneratedPlan(matchedPlan, "循环短素材", "insert", { startUs: 4_000_000 });
    const generated = useEditorStore.getState().project.tracks.find((track) => track.kind === "generated")!.clips[0];
    expect(generated.kind).toBe("generated");
    if (generated.kind !== "generated") return;
    expect(generated.scenes[0]).toMatchObject({ mediaAssetId: "short", mediaSourceInUs: 800_000, durationUs: 2_000_000 });
  });

  it("places generated narration at its target start instead of the current playhead", () => {
    useEditorStore.getState().setPlayhead(12_000_000);
    useEditorStore.getState().addAudio({ id: "voice-target", name: "voice.wav", kind: "audio", durationUs: 3_000_000 }, "voice", 4_000_000);
    const voice = useEditorStore.getState().project.tracks.find((track) => track.audioRole === "voice")!.clips[0];
    expect(voice).toMatchObject({ startUs: 4_000_000, durationUs: 3_000_000 });
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
});
