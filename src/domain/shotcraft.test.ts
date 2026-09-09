import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHOTCRAFT_SHOTS, defaultShotcraftSettings, normalizeShotcraftSettings, shotcraftFrame, shotcraftPredecessor, shotcraftTransitionState } from "@/domain/shotcraft";
import { createEmptyProject, type CompositionClip } from "@/domain/project";
import { parseProject, serializeProject } from "@/domain/projectFile";

export function shotClip(id = "shot-a", compositionId = "shotcraft-blur-slide"): CompositionClip {
  return { id, compositionId, trackId: "composition-main", kind: "composition", label: "镜头", locked: false,
    startUs: 0, durationUs: 3_800_000, animationDurationUs: 3_800_000, sourceOffsetUs: 0, speed: 1,
    text: "让创意｜成为作品", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48,
    transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, bindings: [],
    shotcraft: defaultShotcraftSettings(compositionId) };
}

describe("Shotcraft shot data", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("extends the hero's reading hold without slowing its return or restarting a trimmed shot", () => {
    const settings = { ...defaultShotcraftSettings("shotcraft-spotlight-hero-card"), holdUs: 1_000_000 };
    expect(shotcraftFrame("shotcraft-spotlight-hero-card", 3_733_333, settings)).toBeCloseTo(112, 3);
    expect(shotcraftFrame("shotcraft-spotlight-hero-card", 4_233_333, settings)).toBeCloseTo(112, 3);
    expect(shotcraftFrame("shotcraft-spotlight-hero-card", 4_933_333, settings)).toBeCloseTo(118, 3);
    expect(shotcraftFrame("shotcraft-spotlight-hero-card", 30_000_000, settings)).toBe(144);
  });

  it("lands on authored frame boundaries after integer microsecond rounding", () => {
    const settings = defaultShotcraftSettings("shotcraft-spotlight-hero-card");
    expect(shotcraftFrame("shotcraft-spotlight-hero-card", Math.round(130 / 30 * 1_000_000), settings)).toBe(130);
    expect(shotcraftFrame("shotcraft-spotlight-hero-card", Math.round(129.5 / 30 * 1_000_000), settings)).toBeCloseTo(129.5);
  });

  it("validates regions, renderer versions, finite times and supported transitions", () => {
    const settings = defaultShotcraftSettings("shotcraft-cursor-flyover");
    expect(normalizeShotcraftSettings(undefined, "shotcraft-cursor-flyover")).toEqual(settings);
    for (const patch of [{ version: 2 }, { holdUs: -1 }, { holdUs: 0.5 }, { regions: [{ x: 95, y: 0, width: 10, height: 10 }] }, { transition: { preset: "unknown" } }]) {
      expect(() => normalizeShotcraftSettings({ ...settings, ...patch }, "shotcraft-cursor-flyover")).toThrow();
    }
  });

  it("keeps the complete outgoing and incoming scenes attached during a push", () => {
    const start = shotcraftTransitionState("push-up", 0, 1_000_000);
    const middle = shotcraftTransitionState("push-up", 500_000, 1_000_000);
    const end = shotcraftTransitionState("push-up", 1_000_000, 1_000_000);
    expect(start).toMatchObject({ outgoingY: 0, incomingY: 100 });
    expect(middle.incomingY - middle.outgoingY).toBeCloseTo(100);
    expect(end).toMatchObject({ outgoingY: -100, incomingY: 0 });
  });

  it("resolves the original cut after splitting, and rejects hidden, moved or unrelated sources", () => {
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "composition")!;
    const previous = { ...shotClip(), trackId: track.id };
    const current = { ...shotClip("shot-b"), trackId: track.id, startUs: 3_900_000, sourceOffsetUs: 100_000,
      shotcraft: { ...defaultShotcraftSettings("shotcraft-blur-slide"), transition: { preset: "push-up" as const, durationUs: 1_000_000, fromClipId: previous.id } } };
    track.clips = [previous, current];
    expect(shotcraftPredecessor(project, current)?.id).toBe(previous.id);
    track.hidden = true;
    expect(shotcraftPredecessor(project, current)).toBeUndefined();
    track.hidden = false;
    previous.startUs = 1_000_000;
    expect(shotcraftPredecessor(project, current)).toBeUndefined();
  });

  it("round-trips all six shot settings and migrates v30 without changing old compositions", () => {
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "composition")!;
    track.clips = SHOTCRAFT_SHOTS.map((shot, index) => ({ ...shotClip(`shot-${index}`, shot.id), trackId: track.id }));
    const restored = parseProject(serializeProject(project));
    expect(restored.schemaVersion).toBe(32);
    expect(parseProject(serializeProject(restored))).toEqual(restored);
    const previous = parseProject(JSON.stringify({ ...createEmptyProject(), schemaVersion: 30 }));
    expect(previous.schemaVersion).toBe(32);
    expect(previous.tracks.flatMap((entry) => entry.clips)).toEqual([]);
    const broken = { ...project, tracks: [{ ...track, clips: [{ ...track.clips[0], shotcraft: { version: 999 } }] }] };
    expect(() => parseProject(JSON.stringify(broken))).toThrow("镜头");
  });
});
