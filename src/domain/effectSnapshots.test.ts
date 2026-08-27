import { afterEach, describe, expect, it } from "vitest";
import { setInstalledEffects, type EffectDefinition } from "@/domain/effects";
import { createEmptyProject } from "@/domain/project";
import { parseProject, serializeProject } from "@/domain/projectFile";
import { buildRenderPlan } from "@/domain/renderPlan";
import { useEditorStore } from "@/stores/editorStore";

const externalEffect: EffectDefinition = {
  id: "sample-pack:chapter",
  name: "Chapter",
  category: "卡片",
  description: "External effect",
  tags: ["chapter"],
  defaultDurationUs: 2_000_000,
  defaultText: "Chapter",
  defaultColor: "#ffffff",
  defaultAccentColor: "#123456",
    recipe: { layout: "panel", entrance: "none", paddingX: 31, paddingY: 17, borderWidth: 5, borderRadius: 7, backgroundOpacity: 0.73, animation: { durationSeconds: 0.6, easing: "ease-out", keyframes: [{ offset: 0, translateX: 0, translateY: 30, scale: 0.8, rotation: -3 }, { offset: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0 }] } }
};

afterEach(() => setInstalledEffects([]));

describe("effect recipe snapshots", () => {
  it("keeps AI scene preview/export data after its package is uninstalled", () => {
    setInstalledEffects([externalEffect]);
    useEditorStore.setState({ project: createEmptyProject(), playheadUs: 0, selectedClipId: null, selectedClipIds: [], past: [], future: [], clipboard: [], zoom: 1 });
    useEditorStore.getState().addGeneratedPlan({
      title: "Generated",
      article: "Article",
      narration: "Narration",
      scenes: [{ title: "Scene", narration: "Narration", durationSeconds: 2, effectId: externalEffect.id, color: "#123456", cameraPreset: "none", mediaAssetId: null, mediaSourceInSeconds: 0 }]
    }, "prompt", "insert");
    const saved = serializeProject(useEditorStore.getState().project);

    setInstalledEffects([]);
    const restored = parseProject(saved);
    const scene = restored.tracks.flatMap((track) => track.clips).find((clip) => clip.kind === "generated")?.scenes[0];
    expect(restored.schemaVersion).toBe(9);
    expect(scene?.recipe).toEqual(externalEffect.recipe);
    expect(buildRenderPlan(restored, "/output.mp4").overlays[0].recipe).toEqual(externalEffect.recipe);
  });
});
