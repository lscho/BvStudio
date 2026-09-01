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
  recipe: { layout: "panel", entrance: "none", paddingX: 31, paddingY: 17, borderWidth: 5, borderRadius: 7, backgroundOpacity: 0.73, animation: { durationSeconds: 0.6, easing: "ease-out", keyframes: [{ offset: 0, translateX: 0, translateY: 30, scale: 0.8, rotation: -3 }, { offset: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0 }] } },
  soundCues: [{ soundId: "sample-pack:notice", offsetUs: 100_000, volume: 0.5, durationUs: 600_000, sourcePath: "/cache/notice.wav" }]
};

const externalScene: EffectDefinition = {
  id: "sample-pack:studio-grid",
  name: "Studio grid",
  category: "场景",
  description: "External scene",
  tags: ["scene"],
  defaultDurationUs: 4_000_000,
  defaultText: "",
  defaultColor: "#102030",
  defaultAccentColor: "#abcdef",
  recipe: {
    layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0,
    sceneBackground: { preset: "dark-grid", primaryColor: "#102030", secondaryColor: "#304050", borderColor: "#abcdef", intensity: 0.65 }
  },
  soundCues: [{ soundId: "sample-pack:scene", offsetUs: 0, volume: 0.4, durationUs: 500_000, sourcePath: "/cache/scene.wav" }]
};

afterEach(() => setInstalledEffects([]));

describe("effect recipe snapshots", () => {
  it("keeps a materialized AI effect recipe after its package is uninstalled", () => {
    setInstalledEffects([externalEffect]);
    useEditorStore.setState({ project: createEmptyProject(), playheadUs: 0, selectedClipId: null, selectedClipIds: [], past: [], future: [], clipboard: [], zoom: 1 });
    useEditorStore.getState().addGeneratedPlan({
      title: "Generated",
      article: "Article",
      narration: "Narration",
      captions: [{ startSeconds: 0, endSeconds: 2, text: "Narration" }],
      matches: [{ captionIndex: 0, primaryEffectId: externalEffect.id, primaryText: "Narration", secondaryEffectId: null, secondaryText: null, accentColor: "#123456", x: 50, y: 30, scale: 1, secondaryX: 75, secondaryY: 60, cameraPreset: "none", videoLayers: [], backdropPreset: "none", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", chart: null }],
      scenes: [{ title: "Scene", narration: "Narration", durationSeconds: 2, effectIds: [externalEffect.id], color: "#123456", cameraPreset: "none", mediaAssetId: null, mediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" }]
    }, "prompt", "insert");
    const saved = serializeProject(useEditorStore.getState().project);

    setInstalledEffects([]);
    const restored = parseProject(saved);
    const effect = restored.tracks.flatMap((track) => track.clips).find((clip) => clip.kind === "effect");
    expect(restored.schemaVersion).toBe(18);
    expect(effect?.recipe).toEqual(externalEffect.recipe);
    expect(effect?.kind === "effect" ? effect.soundCues : undefined).toEqual(externalEffect.soundCues);
    expect(buildRenderPlan(restored, "/output.mp4").overlays[0].recipe).toEqual(externalEffect.recipe);
    expect(buildRenderPlan(restored, "/output.mp4").audios).toContainEqual(expect.objectContaining({ path: "/cache/notice.wav", startUs: 100_000, role: "sound" }));
  });

  it("keeps an independent scene snapshot after its package is uninstalled", () => {
    setInstalledEffects([externalScene]);
    useEditorStore.setState({ project: createEmptyProject(), playheadUs: 0, selectedClipId: null, selectedClipIds: [], past: [], future: [], clipboard: [], zoom: 1 });
    useEditorStore.getState().addEffect(externalScene.id);
    const saved = serializeProject(useEditorStore.getState().project);

    setInstalledEffects([]);
    const restored = parseProject(saved);
    const scene = restored.tracks.find((track) => track.kind === "scene")?.clips[0];
    expect(scene).toMatchObject({
      kind: "scene",
      background: externalScene.recipe.sceneBackground,
      soundCues: externalScene.soundCues
    });
    expect(buildRenderPlan(restored, "/output.mp4").overlays[0]).toMatchObject({ kind: "scene", recipe: { sceneBackground: externalScene.recipe.sceneBackground } });
    expect(buildRenderPlan(restored, "/output.mp4").audios).toContainEqual(expect.objectContaining({ path: "/cache/scene.wav", role: "sound" }));
  });
});
