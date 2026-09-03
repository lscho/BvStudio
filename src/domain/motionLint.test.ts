import { describe, expect, it } from "vitest";
import { lintMotionProject } from "@/domain/motionLint";
import { createEmptyProject, type EffectClip } from "@/domain/project";

function effect(id: string, startUs = 0): EffectClip {
  return {
    id, trackId: "effect-main", kind: "effect", label: id, startUs, durationUs: 2_000_000, locked: false,
    effectId: "test-title-slide", text: id, color: "#ffffff", accentColor: "#47d7ac", fontSize: 48, speed: 1,
    transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }, sceneGroupId: "group"
  };
}

describe("motion lint", () => {
  it("reports more than four simultaneous scene layers", () => {
    const project = createEmptyProject();
    project.tracks.find((track) => track.kind === "effect")!.clips.push(...Array.from({ length: 5 }, (_, index) => effect(`effect-${index}`)));
    expect(lintMotionProject(project)).toContainEqual(expect.objectContaining({ ruleId: "too-many-layers", severity: "error" }));
  });

  it("respects per-clip lint exceptions", () => {
    const project = createEmptyProject();
    const clip = effect("unsafe");
    clip.transform.x = 1;
    clip.lintOff = ["unsafe-bounds"];
    project.tracks.find((track) => track.kind === "effect")!.clips.push(clip);
    expect(lintMotionProject(project).some((item) => item.ruleId === "unsafe-bounds")).toBe(false);
  });

  it("reports unknown unsnapshotted effects", () => {
    const project = createEmptyProject();
    const clip = effect("unknown");
    clip.effectId = "removed-effect";
    project.tracks.find((track) => track.kind === "effect")!.clips.push(clip);
    expect(lintMotionProject(project)).toContainEqual(expect.objectContaining({ ruleId: "unknown-effect", severity: "error" }));
  });
});
