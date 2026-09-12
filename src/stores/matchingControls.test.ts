import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject, type SubtitleClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { buildRenderPlan } from "@/domain/renderPlan";
import type { AiMotionMatch } from "@/services/ai/schema";

const soundId = "shotcraft-audio:sfx-camera-camera-lens-shutter";
const soundAsset = { id: soundId, name: "相机 · camera-lens-shutter", kind: "audio" as const, sourcePath: "/click.mp3", durationUs: 1_462_857 };
const motion: AiMotionMatch = {
  captionIndex: 0, primaryEffectId: "test-title-slide", primaryText: "核心内容", secondaryEffectId: null, secondaryText: null,
  accentColor: "#5fa8ff", x: 50, y: 28, scale: 1, secondaryX: 75, secondaryY: 60, cameraPreset: "none",
  primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0,
  mediaLayoutPreset: "full", videoLayers: [], backdropPreset: "none", chart: null, soundEffectId: soundId
};

beforeEach(() => {
  const project = createEmptyProject();
  const track = project.tracks.find((track) => track.kind === "subtitle")!;
  track.clips = [0, 1].map((index): SubtitleClip => ({ id: `caption-${index}`, trackId: track.id, kind: "subtitle", startUs: index * 3_000_000, durationUs: 3_000_000, locked: false, label: "核心内容", text: "核心内容", color: "#ffffff", highlightColor: "#ffb84d", backgroundColor: "#000000", fontSize: 44, positionY: 88 }));
  useEditorStore.setState({ project, selectedClipId: "caption-0", selectedClipIds: ["caption-0"], playheadUs: 0, past: [], future: [] });
});

describe("independent matching and subtitle themes", () => {
  it("matches effects without adding or clearing audio or embedded sound cues", () => {
    useEditorStore.getState().applySoundMatches(["caption-0"], [{ captionIndex: 0, soundEffectId: soundId }], [soundAsset]);
    const before = structuredClone(useEditorStore.getState().project.tracks.filter((track) => track.kind === "audio"));
    useEditorStore.getState().applyMotionMatches(["caption-0"], [motion]);
    const project = useEditorStore.getState().project;
    expect(project.tracks.filter((track) => track.kind === "audio")).toEqual(before);
    expect(project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "composition")).toEqual([
      expect.objectContaining({ soundCues: [] })
    ]);
    const rendered = buildRenderPlan(project, "/output.mp4");
    expect(rendered.audios).toHaveLength(1);
  });

  it("changes only sound clips in the selected range and supports undo and redo", () => {
    useEditorStore.getState().applyMotionMatches(["caption-0"], [motion]);
    useEditorStore.getState().applySoundMatches(["caption-1"], [{ captionIndex: 0, soundEffectId: soundId }], [soundAsset]);
    const before = structuredClone(useEditorStore.getState().project);
    useEditorStore.getState().applySoundMatches(["caption-0"], [{ captionIndex: 0, soundEffectId: soundId }, { captionIndex: 0, soundEffectId: soundId }], [soundAsset]);
    const project = useEditorStore.getState().project;
    expect(project.tracks.filter((track) => track.audioRole !== "sound")).toEqual(before.tracks.filter((track) => track.audioRole !== "sound"));
    expect(project.tracks.find((track) => track.audioRole === "sound")!.clips).toHaveLength(2);
    expect(project.tracks.find((track) => track.audioRole === "sound")!.clips[0]).toEqual(before.tracks.find((track) => track.audioRole === "sound")!.clips[0]);
    expect(useEditorStore.getState().selectedClipIds).toEqual(["caption-0"]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project).toEqual(before);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project).toEqual(project);
  });

  it.each(["clip", "track"])("preserves a locked sound %s during rematching", (lock) => {
    useEditorStore.getState().applySoundMatches(["caption-0"], [{ captionIndex: 0, soundEffectId: soundId }], [soundAsset]);
    const project = structuredClone(useEditorStore.getState().project);
    const track = project.tracks.find((track) => track.audioRole === "sound")!;
    if (lock === "track") track.locked = true;
    else track.clips[0].locked = true;
    useEditorStore.setState({ project, past: [] });
    useEditorStore.getState().applySoundMatches(["caption-0"], [{ captionIndex: 0, soundEffectId: soundId }], [soundAsset]);
    expect(useEditorStore.getState().project.tracks.find((candidate) => candidate.id === track.id)).toEqual(track);
    expect(useEditorStore.getState().past).toEqual([]);
  });

  it("persists subtitle colors for future captions, respects locks and exports the colors", () => {
    const project = structuredClone(useEditorStore.getState().project);
    project.tracks.find((track) => track.kind === "subtitle")!.clips[1].locked = true;
    useEditorStore.setState({ project });
    useEditorStore.getState().updateSubtitleAppearance(null, { color: "#47d7ac", highlightColor: "#ff7b72" });
    let next = useEditorStore.getState().project;
    expect(next.subtitleTheme).toEqual({ color: "#47d7ac", highlightColor: "#ff7b72" });
    expect(next.tracks.find((track) => track.kind === "subtitle")!.clips).toEqual([
      expect.objectContaining(next.subtitleTheme), expect.objectContaining({ color: "#ffffff", highlightColor: "#ffb84d" })
    ]);
    useEditorStore.getState().addGeneratedPlan({ title: "新字幕", article: "核心", narration: "核心", scenes: [], captions: [{ startSeconds: 0, endSeconds: 2, text: "核心" }], matches: [] }, "", "overlay");
    next = useEditorStore.getState().project;
    expect(next.tracks.find((track) => track.kind === "subtitle")!.clips.at(-1)).toMatchObject(next.subtitleTheme);
    expect(buildRenderPlan(next, "/output.mp4").overlays.find((overlay) => overlay.kind === "text" && overlay.text === "核心内容"))
      .toMatchObject({ color: "#47d7ac", subtitleStyle: { highlightColor: "#ff7b72" } });
  });
});
