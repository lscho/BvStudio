import { describe, expect, it } from "vitest";
import { lintMotionProject } from "@/domain/motionLint";
import { createEmptyProject, type CompositionClip } from "@/domain/project";
import { compositionById } from "@/domain/effects";

function effect(id: string, startUs = 0): CompositionClip {
  return {
    id, trackId: "effect-main", kind: "composition", label: id, startUs, durationUs: 2_000_000, locked: false,
    compositionId: "test-title-slide", text: id, color: "#ffffff", accentColor: "#47d7ac", fontSize: 48, speed: 1,
    transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }, sceneGroupId: "group"
  };
}

describe("motion lint", () => {
  it.each([
    ["checklist", 0], ["checklist", 400_000], ["card-swap", 0], ["card-swap", 400_000]
  ] as const)("allows %s over a covering Shotcraft base with %s us entry offset", (cardId, offsetUs) => {
    const project = createEmptyProject();
    const group = "ai-motion:shotcraft:caption";
    project.tracks.find((track) => track.kind === "composition")!.clips.push(
      { ...effect("base"), compositionId: "shotcraft-glow-orb-ambient", durationUs: 6_000_000, sceneGroupId: group },
      { ...effect("card", offsetUs), compositionId: cardId, durationUs: 6_000_000 - offsetUs, sceneGroupId: group }
    );
    expect(lintMotionProject(project).filter((item) => item.severity === "error")).toEqual([]);
  });
  it("still checks entry staggering for a Shotcraft paired with an ineligible effect", () => {
    const project = createEmptyProject();
    project.tracks.find((track) => track.kind === "composition")!.clips.push(
      { ...effect("base"), compositionId: "shotcraft-glow-orb-ambient", sceneGroupId: "ai-motion:group" },
      { ...effect("exclusive"), compositionId: "shotcraft-glow-orb-ambient", sceneGroupId: "ai-motion:group" }
    );
    expect(lintMotionProject(project).some((item) => item.ruleId === "entry-stagger")).toBe(true);
  });
  it("does not exempt a third content layer or a card outside its Shotcraft base", () => {
    const project = createEmptyProject();
    const clips = project.tracks.find((track) => track.kind === "composition")!.clips;
    clips.push(
      { ...effect("base"), compositionId: "shotcraft-glow-orb-ambient", sceneGroupId: "ai-motion:group" },
      { ...effect("card"), compositionId: "checklist", sceneGroupId: "ai-motion:group", durationUs: 3_000_000 }
    );
    expect(lintMotionProject(project).some((item) => item.ruleId === "entry-stagger")).toBe(true);
    clips[1].durationUs = 2_000_000;
    clips.push({ ...effect("extra"), sceneGroupId: "ai-motion:group" });
    expect(lintMotionProject(project).some((item) => item.ruleId === "too-many-layers")).toBe(true);
    expect(lintMotionProject(project).some((item) => item.ruleId === "entry-stagger")).toBe(true);
  });
  it("does not count migrated scene backgrounds as foreground group layers", () => {
    const project = createEmptyProject();
    project.tracks.find(t => t.kind === "composition")!.clips.push(
      ...Array.from({ length: 4 }, (_, index) => ({ ...effect(`effect-${index}`), recipe: compositionById("test-title-slide").recipe })),
      { ...effect("background"), compositionId: "scene-dark-grid", recipe: compositionById("scene-dark-grid").recipe }
    );
    expect(lintMotionProject(project).filter(issue => issue.severity === "error")).toEqual([]);
  });
  it("reports more than two simultaneous AI scene layers", () => {
    const project = createEmptyProject();
    project.tracks.find((track) => track.kind === "composition")!.clips.push(...Array.from({ length: 3 }, (_, index) => ({ ...effect(`effect-${index}`), sceneGroupId: "ai-motion:group:caption" })));
    expect(lintMotionProject(project)).toContainEqual(expect.objectContaining({ ruleId: "too-many-layers", severity: "error" }));
  });

  it("reports AI content layers that enter less than half a second apart", () => {
    const project = createEmptyProject();
    project.tracks.find((track) => track.kind === "composition")!.clips.push(
      { ...effect("first"), sceneGroupId: "ai-motion:group:caption" },
      { ...effect("second", 400_000), sceneGroupId: "ai-motion:group:caption" }
    );
    expect(lintMotionProject(project)).toContainEqual(expect.objectContaining({ ruleId: "entry-stagger", severity: "error" }));
  });

  it("respects per-clip lint exceptions", () => {
    const project = createEmptyProject();
    const clip = effect("unsafe");
    clip.transform.x = 1;
    clip.lintOff = ["unsafe-bounds"];
    project.tracks.find((track) => track.kind === "composition")!.clips.push(clip);
    expect(lintMotionProject(project).some((item) => item.ruleId === "unsafe-bounds")).toBe(false);
  });

  it("reports an outer-stage transform on a replicated reference effect", () => {
    const project = createEmptyProject();
    const clip = effect("reference-outside");
    clip.compositionId = "info-board";
    clip.transform = { ...clip.transform, x: 82, y: 30 };
    project.tracks.find((track) => track.kind === "composition")!.clips.push(clip);

    expect(lintMotionProject(project)).toContainEqual(expect.objectContaining({
      ruleId: "reference-stage-transform",
      severity: "warning",
      clipId: "reference-outside"
    }));
  });

  it("reports unknown unsnapshotted effects", () => {
    const project = createEmptyProject();
    const clip = effect("unknown");
    clip.compositionId = "removed-effect";
    project.tracks.find((track) => track.kind === "composition")!.clips.push(clip);
    expect(lintMotionProject(project)).toContainEqual(expect.objectContaining({ ruleId: "unknown-effect", severity: "error" }));
  });
});
