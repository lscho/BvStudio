import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compositionAssetIds, compositionBindingIssues, compositionTimeUs, compositionTransformPatch, normalizeBindings } from "@/domain/compositions";
import { createEmptyProject, type CompositionClip, type MediaAsset } from "@/domain/project";
import { parseProject, serializeProject } from "@/domain/projectFile";

const assets: MediaAsset[] = ["a", "b"].map((id) => ({ id, name: id, kind: "image", durationUs: 0 }));

describe("composition bindings", () => {
  it("edits the current positioning keyframe while preserving base rotation and opacity", () => {
    const clip = { transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, transformKeyframes: [
      { offsetUs: 0, x: 20, y: 30, scale: 0.5, easing: "linear" as const },
      { offsetUs: 2_000_000, x: 80, y: 70, scale: 1, easing: "linear" as const }
    ] };
    const patch = compositionTransformPatch(clip, 1_000_000, { x: 40, rotation: 30, opacity: 0.8 });
    expect(patch.transform).toEqual({ ...clip.transform, rotation: 30, opacity: 0.8 });
    expect(patch.transformKeyframes?.[1]).toMatchObject({ offsetUs: 1_000_000, x: 40, y: 50, scale: 0.75 });
    expect(clip.transformKeyframes).toHaveLength(2);
  });
  it("allows mixed visual media only in visual slots and no slots on backgrounds", () => {
    const mixed: MediaAsset[] = [assets[0], { ...assets[1], kind: "video" }];
    expect(compositionBindingIssues({ compositionId: "motion-zoom", bindings: [{ slotId: "media", assetIds: ["a", "b"] }] }, mixed)).toEqual([]);
    expect(compositionBindingIssues({ compositionId: "poster-wall-3d", bindings: [{ slotId: "posters", assetIds: ["a", "b"] }] }, mixed)).toEqual(["海报只接受图片"]);
    expect(compositionBindingIssues({ compositionId: "background-stripes", bindings: [] }, [])).toEqual([]);
    expect(compositionBindingIssues({ compositionId: "background-stripes", bindings: [{ slotId: "media", assetIds: ["a"] }] }, assets)).toHaveLength(1);
  });
  it("validates variable and fixed slots and preserves ordering", () => {
    const clip = { compositionId: "poster-wall-3d", bindings: [{ slotId: "posters", assetIds: ["b", "a"] }] };
    expect(compositionBindingIssues(clip, assets)).toEqual([]);
    expect(compositionAssetIds(clip)).toEqual(["b", "a"]);
    expect(compositionBindingIssues({ ...clip, bindings: [] }, assets)).toHaveLength(1);
    expect(compositionBindingIssues({ compositionId: "image-duet-3d", bindings: [{ slotId: "left", assetIds: ["a", "b"] }] }, assets)).toHaveLength(2);
  });

  it("rejects malformed bindings and reports missing or wrong media", () => {
    expect(() => normalizeBindings([{ slotId: "posters", assetIds: [5] }])).toThrow();
    expect(() => normalizeBindings([{ slotId: "a", assetIds: [] }, { slotId: "a", assetIds: [] }])).toThrow();
    const clip = { compositionId: "poster-wall-3d", bindings: [{ slotId: "posters", assetIds: ["a", "missing"] }] };
    expect(compositionBindingIssues(clip, [{ ...assets[0], kind: "video" }])).toHaveLength(2);
  });

  it("uses source time independently of trimmed duration", () => {
    expect(compositionTimeUs({ speed: 2, sourceOffsetUs: 1_000_000 }, 500_000)).toBe(2_000_000);
  });
});

describe("composition project migration", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-06T00:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("splits a v25 wall background once while preserving source clocks and locks", () => {
    const old = createEmptyProject();
    const track = old.tracks.find((track) => track.kind === "composition")!;
    track.locked = true;
    const wall: CompositionClip = { id: "wall", trackId: track.id, kind: "composition", compositionId: "poster-wall-3d", label: "海报墙", startUs: 2_000_000, durationUs: 4_000_000, sourceOffsetUs: 1_000_000, animationDurationUs: 6_000_000, locked: true, speed: 1, text: "", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 0.7 }, bindings: [{ slotId: "posters", assetIds: ["a", "b"] }], params: { background: "#223344", gridColor: "#667788", grid: false, travel: 0.8 } };
    track.clips.push(wall);
    const migrated = parseProject(JSON.stringify({ ...old, schemaVersion: 25 }));
    const clips = migrated.tracks.find((track) => track.id === wall.trackId)!.clips;
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ id: "wall", bindings: wall.bindings, params: { travel: 0.8 } });
    expect(clips[1]).toMatchObject({ compositionId: "background-grid", startUs: 2_000_000, durationUs: 4_000_000, sourceOffsetUs: 1_000_000, animationDurationUs: 6_000_000, locked: true, params: { background: "#223344", grid: false, layoutCount: 2 }, transform: { opacity: 0.7 } });
    expect(parseProject(serializeProject(migrated))).toEqual(migrated);
  });
  it("migrates a v24 effect without losing its ID, recipe or parameters", () => {
    const old = {
      ...createEmptyProject(), schemaVersion: 24,
      tracks: [{ id: "effect-main", kind: "effect", name: "动效", clips: [{
        id: "old", trackId: "effect-main", kind: "effect", label: "计数", startUs: 0, durationUs: 3_000_000, locked: false,
        effectId: "odometer", text: "300", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, speed: 1,
        transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, params: { value: 300 }
      }] }]
    };
    const project = parseProject(JSON.stringify(old));
    const clip = project.tracks.flatMap((track) => track.clips).find((candidate) => candidate.id === "old");
    expect(project.schemaVersion).toBe(31);
    expect(clip).toMatchObject({ kind: "composition", compositionId: "odometer", bindings: [], params: { value: 300 } });
    expect(serializeProject(project)).not.toContain('"effectId"');
    expect(parseProject(serializeProject(project))).toEqual(project);
  });

  it("round-trips asset IDs while rejecting malformed composition inputs", () => {
    const old = { ...createEmptyProject(), tracks: [{ id: "c", kind: "composition", name: "动效", clips: [{
      id: "wall", trackId: "c", kind: "composition", label: "海报墙", startUs: 0, durationUs: 5_000_000, locked: false,
      compositionId: "poster-wall-3d", text: "", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, speed: 1,
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, bindings: [{ slotId: "posters", assetIds: ["a", "b"] }]
    }] }] };
    const project = parseProject(JSON.stringify(old));
    expect(parseProject(serializeProject(project))).toEqual(project);
    old.tracks[0].clips[0].bindings[0].assetIds.push("x".repeat(257));
    expect(() => parseProject(JSON.stringify(old))).toThrow("素材槽");
    expect(() => parseProject(JSON.stringify({ ...old, schemaVersion: 999 }))).toThrow("版本");
  });
});
