import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject, type CompositionClip } from "@/domain/project";
import { compositionTimeUs } from "@/domain/compositions";
import { shotcraftFrame, shotcraftPredecessor } from "@/domain/shotcraft";
import { useEditorStore } from "@/stores/editorStore";

const clips = () => useEditorStore.getState().project.tracks.flatMap((track) => track.clips).filter((clip): clip is CompositionClip => clip.kind === "composition");
beforeEach(() => useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 0, past: [], future: [], clipboard: [] }));
function pair() {
  useEditorStore.getState().addComposition("shotcraft-blur-slide");
  const previous = clips()[0];
  useEditorStore.setState({ playheadUs: previous.durationUs });
  useEditorStore.getState().addComposition("shotcraft-blur-slide");
  const current = clips()[1];
  useEditorStore.getState().updateComposition(current.id, { shotcraft: { ...current.shotcraft!, transition: { preset: "push-up", durationUs: 1_000_000, fromClipId: previous.id } } });
  return { previous, current: clips()[1] };
}

describe("editable Shotcraft clips", () => {
  it("整套编排作为一次撤销操作加入新轨道，保持锁定轨道", () => {
    useEditorStore.getState().addComposition("shotcraft-blur-slide");
    const original = clips()[0];
    useEditorStore.getState().setTrackState(original.trackId, { locked: true });
    const before = useEditorStore.getState().project;
    useEditorStore.getState().addShotcraftSequence({ title: "新镜头", scenes: [{ shotId: "shotcraft-marker-underline-title", text: "标题", durationSeconds: 4, copy: [{ key: "copy0", value: "把想法" }, { key: "copy1", value: "变成" }, { key: "copy2", value: "作品" }], bindings: [], regions: [], transition: "none", sounds: [], reason: "开场" }] }, [], { startUs: 5_000_000, musicSourceInUs: 0, musicVolume: 0.2, beatSync: false, soundEnabled: false });
    const after = useEditorStore.getState().project;
    expect(after.tracks.find((track) => track.id === original.trackId)).toEqual(before.tracks.find((track) => track.id === original.trackId));
    expect(clips()).toHaveLength(2);
    expect(useEditorStore.getState().selectedClipIds).toEqual([]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project).toEqual(before);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project).toEqual(after);
    const generated = clips().find((clip) => clip.id !== original.id)!;
    useEditorStore.getState().selectClip(generated.id);
    useEditorStore.setState({ playheadUs: generated.startUs + 1_500_000 });
    useEditorStore.getState().splitSelected();
    const tail = clips().find((clip) => clip.startUs === generated.startUs + 1_500_000)!;
    expect(shotcraftFrame(tail.compositionId, compositionTimeUs(tail, 500_000), tail.shotcraft!)).toBeCloseTo(shotcraftFrame(generated.compositionId, 2_000_000, generated.shotcraft!));
  });
  it("inserts full-frame shots and extends a reading hold with undo and redo", () => {
    useEditorStore.getState().addComposition("shotcraft-spotlight-hero-card");
    const original = clips()[0];
    expect(original).toMatchObject({ transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, backdrop: { enabled: false } });
    useEditorStore.getState().updateComposition(original.id, { shotcraft: { ...original.shotcraft!, holdUs: 1_000_000 } });
    expect(clips()[0].durationUs).toBe(original.durationUs + 1_000_000);
    expect(clips()[0].animationDurationUs).toBe(original.animationDurationUs! + 1_000_000);
    useEditorStore.getState().undo();
    expect(clips()[0]).toEqual(original);
    useEditorStore.getState().redo();
    expect(clips()[0].shotcraft?.holdUs).toBe(1_000_000);
  });

  it("keeps source frames continuous through speed, trim and split edits", () => {
    useEditorStore.getState().addComposition("shotcraft-cursor-flyover");
    const original = clips()[0];
    useEditorStore.getState().retimeComposition(original.id, 3_000_000);
    expect(clips()[0]).toMatchObject({ speed: 2, animationDurationUs: 6_000_000 });
    useEditorStore.getState().trimClip(original.id, "start", 500_000);
    useEditorStore.setState({ playheadUs: 1_000_000 });
    useEditorStore.getState().splitSelected();
    const tail = clips().find((clip) => clip.id !== original.id)!;
    expect(tail).toMatchObject({ sourceOffsetUs: 2_000_000, speed: 2 });
    expect(shotcraftFrame(tail.compositionId, compositionTimeUs(tail, 500_000), tail.shotcraft!)).toBe(90);
  });

  it("preserves a cropped return phase when adding hold before its source in-point", () => {
    useEditorStore.getState().addComposition("shotcraft-spotlight-hero-card");
    const id = clips()[0].id;
    useEditorStore.getState().trimClip(id, "start", 4_100_000);
    const before = clips()[0];
    useEditorStore.getState().updateComposition(id, { shotcraft: { ...before.shotcraft!, holdUs: 1_000_000 } });
    const after = clips()[0];
    expect(after.sourceOffsetUs).toBe(before.sourceOffsetUs! + 1_000_000);
    expect(after.durationUs).toBe(before.durationUs);
    expect(shotcraftFrame(after.compositionId, after.sourceOffsetUs!, after.shotcraft!))
      .toBeCloseTo(shotcraftFrame(before.compositionId, before.sourceOffsetUs!, before.shotcraft!));
  });

  it.each(["clip", "track"])("rejects edits to a locked %s without adding history", (target) => {
    useEditorStore.getState().addComposition("shotcraft-blur-slide");
    const clip = clips()[0];
    if (target === "clip") useEditorStore.getState().updateComposition(clip.id, { locked: true });
    else useEditorStore.getState().setTrackState(clip.trackId, { locked: true });
    const before = useEditorStore.getState();
    useEditorStore.getState().updateComposition(clip.id, { shotcraft: { ...clip.shotcraft!, holdUs: 1_000_000 } });
    expect(useEditorStore.getState().project).toBe(before.project);
    expect(useEditorStore.getState().past).toBe(before.past);
  });

  it("rejects invalid settings without modifying the project", () => {
    useEditorStore.getState().addComposition("shotcraft-blur-slide");
    const before = useEditorStore.getState();
    expect(() => before.updateComposition(clips()[0].id, { shotcraft: { ...clips()[0].shotcraft!, holdUs: -1 } })).toThrow("镜头");
    expect(useEditorStore.getState().project).toBe(before.project);
  });

  it("rebinds the outgoing end after splitting it, and restores the original reference on undo", () => {
    const { previous, current } = pair();
    useEditorStore.getState().selectClip(previous.id);
    useEditorStore.setState({ playheadUs: 2_000_000 });
    useEditorStore.getState().splitSelected();
    const edited = clips().find((clip) => clip.id === current.id)!;
    const predecessor = shotcraftPredecessor(useEditorStore.getState().project, edited);
    expect(predecessor?.startUs).toBe(2_000_000);
    useEditorStore.getState().undo();
    expect(clips().find((clip) => clip.id === current.id)?.shotcraft?.transition.fromClipId).toBe(previous.id);
  });

  it("keeps copied shot pairs connected to their own predecessor", () => {
    const { previous, current } = pair();
    useEditorStore.setState({ selectedClipIds: [previous.id, current.id], playheadUs: 10_000_000 });
    useEditorStore.getState().copySelected();
    useEditorStore.getState().pasteAtPlayhead();
    const copies = clips().filter((clip) => clip.startUs >= 10_000_000);
    expect(copies).toHaveLength(2);
    expect(shotcraftPredecessor(useEditorStore.getState().project, copies[1])?.id).toBe(copies[0].id);
    expect(copies[1].shotcraft?.transition.fromClipId).not.toBe(previous.id);
  });
});
