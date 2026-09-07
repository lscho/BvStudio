import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject, type SceneClip } from "@/domain/project";
import { parseProject, serializeProject } from "@/domain/projectFile";
import { buildRenderPlan } from "@/domain/renderPlan";

describe("scene track migration", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-06T00:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("migrates v26 backgrounds without changing pixels, timing, groups or track permissions", () => {
    const project = createEmptyProject();
    const scene: SceneClip = { id: "old-bg", kind: "scene", trackId: "scene-main", compositionId: "scene-dark-grid", label: "网格", startUs: 1_000_000, durationUs: 3_000_000, locked: true, sceneGroupId: "g", opacity: 0.6, dimAtUs: 1_500_000, background: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: 0.72 } };
    project.tracks.push({ id: "scene-main", kind: "scene", name: "场景", locked: true, muted: true, hidden: false, clips: [scene] });
    const before = buildRenderPlan(project, "/output.mp4").overlays;
    const migrated = parseProject(JSON.stringify({ ...project, schemaVersion: 26 }));
    expect(migrated.schemaVersion).toBe(30);
    expect(migrated.tracks.some(t => t.kind === "scene")).toBe(false);
    expect(migrated.tracks.find(t => t.id === scene.trackId)).toMatchObject({ kind: "composition", locked: true, muted: true, clips: [expect.objectContaining({ kind: "composition", id: scene.id, sceneGroupId: "g", transform: expect.objectContaining({ opacity: .6 }), recipe: expect.objectContaining({ sceneBackground: scene.background }) })] });
    expect(buildRenderPlan(migrated, "/output.mp4").overlays).toEqual(before);
    expect(parseProject(serializeProject(migrated))).toEqual(migrated);
  });
  it("does not create empty scene tracks and preserves hidden legacy backgrounds", () => {
    const project = createEmptyProject();
    expect(project.tracks.some(t => t.kind === "scene")).toBe(false);
    project.tracks.push({ id: "scene-main", kind: "scene", name: "场景", hidden: true, locked: false, muted: false, clips: [] });
    expect(parseProject(JSON.stringify({ ...project, schemaVersion: 26 })).tracks.some(t => t.kind === "scene")).toBe(false);
    const scene: SceneClip = { id: "hidden-bg", trackId: "scene-main", kind: "scene", label: "隐藏背景", compositionId: "scene-dark-grid", startUs: 0, durationUs: 2_000_000, locked: false, opacity: 1, background: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: 0.72 } };
    project.tracks.at(-1)!.clips.push(scene);
    const restored = parseProject(JSON.stringify({ ...project, schemaVersion: 26 }));
    expect(restored.tracks.find(t => t.id === "scene-main")).toMatchObject({ hidden: true, kind: "composition", clips: [expect.objectContaining({ id: scene.id })] });
    expect(buildRenderPlan(restored, "/output.mp4").overlays).toEqual([]);
  });
  it("preserves current composition metadata and source timing across repeated saves", () => {
    const project = createEmptyProject();
    const track = project.tracks.find(t => t.kind === "composition")!;
    track.clips.push({ id: "background", trackId: track.id, kind: "composition", label: "背景", compositionId: "scene-dark-grid", startUs: 1_000_000, durationUs: 2_000_000, locked: false, text: "", color: "#ffffff", accentColor: "#47d7ac", fontSize: 48, speed: 1, bindings: [], sourceOffsetUs: 500_000, animationDurationUs: 5_000_000, sceneGroupId: "g", sceneTemplateId: "template", transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: .7 }, recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0, sceneBackground: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: .72 } } });
    const restored = parseProject(serializeProject(project));
    expect(restored.tracks.find(t => t.id === track.id)?.clips[0]).toMatchObject(track.clips[0]);
    expect(parseProject(serializeProject(restored))).toEqual(restored);
    const background = restored.tracks.flatMap((track) => track.clips).find((clip) => clip.kind === "composition");
    if (!background || background.kind !== "composition") throw new Error("Missing background");
    background.zIndex = 250;
    expect(buildRenderPlan(restored, "/output.mp4").overlays.every((overlay) => overlay.zIndex === 250)).toBe(true);
  });
});
