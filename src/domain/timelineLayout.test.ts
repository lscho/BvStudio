import { describe, expect, it } from "vitest";
import { minimumPixelsPerSecondForLanes, packTimelineLanes, timelineRows } from "@/domain/timelineLayout";
import { createEmptyProject, type CompositionClip } from "@/domain/project";

const clip = (id: string, startUs: number, durationUs: number): CompositionClip => ({ id, trackId: "effect-main", kind: "composition", compositionId: "motion-zoom", label: id, startUs, durationUs, locked: false, text: "", color: "#ffffff", accentColor: "#ffffff", fontSize: 48, speed: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 } });
describe("timeline lane layout", () => {
  it("separates overlaps and reuses lanes without mutating the render order", () => {
    const clips = [clip("b", 1_000_000, 3_000_000), clip("a", 0, 2_000_000), clip("c", 4_000_000, 2_000_000)];
    expect(packTimelineLanes(clips, 24).map(lane => lane.map(c => c.id))).toEqual([["a", "c"], ["b"]]);
    expect(clips.map(c => c.id)).toEqual(["b", "a", "c"]);
  });
  it("reserves hit areas for short clips and collapses tracks without losing members", () => {
    const track = createEmptyProject().tracks.find(t => t.kind === "composition")!;
    track.clips = [clip("a", 0, 100_000), clip("b", 200_000, 100_000)];
    expect(packTimelineLanes(track.clips, 24)).toHaveLength(2);
    const collapsed = timelineRows([track], new Set([track.id]), 24);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({ members: track.clips, clips: [], expanded: false });
  });
  it("calculates enough horizontal density for adjacent short clips to keep their real lanes", () => {
    const clips = [clip("a", 0, 1_100_000), clip("b", 1_100_000, 2_000_000)];
    const pixelsPerSecond = minimumPixelsPerSecondForLanes(clips, 34);

    expect(pixelsPerSecond).toBe(31);
    expect(packTimelineLanes(clips, pixelsPerSecond)).toHaveLength(1);
  });
  it("does not try to flatten clips whose real time ranges overlap", () => {
    const clips = [clip("a", 0, 2_000_000), clip("b", 1_000_000, 2_000_000)];
    const pixelsPerSecond = minimumPixelsPerSecondForLanes(clips, 34);

    expect(packTimelineLanes(clips, Math.max(24, pixelsPerSecond))).toHaveLength(2);
  });
  it("reuses rows across sequential groups without overview or group header rows", () => {
    const track = createEmptyProject().tracks.find(t => t.kind === "composition")!;
    track.clips = Array.from({ length: 12 }, (_, index) => ({ ...clip(`c${index}`, Math.floor(index / 2) * 4_000_000, 3_000_000), sceneGroupId: `g${Math.floor(index / 2)}` }));
    const rows = timelineRows([track], new Set(), 24);
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.clips.length)).toEqual([6, 6]);
    expect(rows[0].kind).toBe("track");
    expect(rows.flatMap(r => r.clips)).toHaveLength(12);
  });
  it("hides script tracks without changing project data and focuses only the chosen group", () => {
    const project = createEmptyProject();
    const track = project.tracks.find(t => t.kind === "composition")!;
    track.clips = [{ ...clip("a", 0, 2_000_000), sceneGroupId: "one" }, { ...clip("b", 4_000_000, 2_000_000), sceneGroupId: "two" }];
    expect(timelineRows(project.tracks, new Set(), 24).some(r => r.track.kind === "generated")).toBe(false);
    expect(project.tracks.some(t => t.kind === "generated")).toBe(true);
    expect(timelineRows(project.tracks, new Set(), 24, "two").flatMap(r => r.clips).map(c => c.id)).toEqual(["b"]);
  });
});
