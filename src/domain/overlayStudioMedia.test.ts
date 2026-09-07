import { describe, expect, it } from "vitest";
import type { CompositionBinding } from "@/domain/compositions";
import { effectControlsFor } from "@/compositions/registry";
import { createEffectPreviewClip } from "@/domain/effectPreview";
import { createEmptyProject } from "@/domain/project";
import {
  overlayStudioMediaControlMode,
  overlayStudioMediaEffectIds,
  overlayStudioMediaParamKeys,
  overlayStudioMediaSlots,
  resolveOverlayStudioMediaParams,
  type OverlayStudioMediaSource
} from "@/domain/overlayStudioMedia";

const expectedMediaEffects = [
  "cam-frame", "cam-pan", "chat-volley", "clip-flow", "clip-parade", "cover-flow", "cover-stack",
  "demo-rail", "demo-tour", "doc-scroll", "ghost-video", "hand-lift", "icon-pop", "icon-swarm",
  "info-board", "phone-shot", "photo-halo", "proof-shot", "proof-wall", "punch-zoom", "quote-cite",
  "screen-demo", "video-showcase"
];

function resolve(
  compositionId: string,
  params: Record<string, string | number | boolean>,
  bindings: CompositionBinding[],
  sources: OverlayStudioMediaSource[]
) {
  return resolveOverlayStudioMediaParams(compositionId, params, bindings, (assetId) => sources.find((source) => source.id === assetId));
}

describe("Overlay Studio material bindings", () => {
  it("audits every replicated effect that reads external image or video material", () => {
    expect([...overlayStudioMediaEffectIds].sort()).toEqual(expectedMediaEffects);
    for (const compositionId of expectedMediaEffects) expect(overlayStudioMediaSlots(compositionId).length, compositionId).toBeGreaterThan(0);
  });

  it("owns every direct path parameter so the inspector can hide it", () => {
    expect(overlayStudioMediaParamKeys("screen-demo")).toEqual(expect.arrayContaining(["videoSrc", "camSrc"]));
    expect(overlayStudioMediaControlMode("screen-demo", "videoSrc")).toBe("hidden");
    expect(overlayStudioMediaControlMode("ghost-video", "src")).toBe("hidden");
    expect(overlayStudioMediaControlMode("video-showcase", "clips")).toBe("metadata");
    expect(overlayStudioMediaControlMode("clip-parade", "tiles")).toBe("metadata");

    const project = createEmptyProject();
    const screenDemoFields = effectControlsFor(createEffectPreviewClip("screen-demo", project.motionTheme, [])).map((control) => control.field);
    expect(screenDemoFields).not.toEqual(expect.arrayContaining(["videoSrc", "camSrc"]));
    const showcaseControl = effectControlsFor(createEffectPreviewClip("video-showcase", project.motionTheme, [])).find((control) => control.field === "clips");
    expect(showcaseControl).toMatchObject({ label: expect.not.stringContaining("路径") });
  });

  it("resolves the same asset ids to caller-provided preview or export URLs", () => {
    const bindings = [{ slotId: "recording", assetIds: ["screen"] }];
    expect(resolve("cam-pan", { videoSrc: "/demo/legacy.mp4" }, bindings, [{ id: "screen", kind: "video", url: "blob:screen" }]).videoSrc).toBe("blob:screen#bvideo-video");
    expect(resolve("cam-pan", { videoSrc: "/demo/legacy.mp4" }, bindings, [{ id: "screen", kind: "video", url: "asset://localhost/screen.mp4" }]).videoSrc).toBe("asset://localhost/screen.mp4");
  });

  it("routes a demo tour visual to the correct image or video parameter", () => {
    const bindings = [{ slotId: "demo", assetIds: ["still"] }];
    expect(resolve("demo-tour", { videoSrc: "old.mp4", imgSrc: "old.png" }, bindings, [{ id: "still", kind: "image", url: "blob:still" }])).toMatchObject({ videoSrc: "", imgSrc: "blob:still" });
  });

  it("rebuilds structured material rows while preserving timing and labels", () => {
    const bindings = [{ slotId: "clips", assetIds: ["a", "b"] }];
    const params = resolve("video-showcase", { clips: "/old/a.mp4|1.5|甲\n/old/b.mp4|3|乙" }, bindings, [
      { id: "a", kind: "video", url: "blob:a" },
      { id: "b", kind: "image", url: "blob:b" }
    ]);
    expect(params.clips).toBe("blob:a#bvideo-video|1.5|甲\nblob:b|3|乙");
  });

  it("keeps vector icon text but lets selected project images replace hybrid icon fields", () => {
    const params = resolve("hand-lift", { leftIcon: "aperture", rightIcon: "code" }, [{ slotId: "icons", assetIds: ["logo"] }], [
      { id: "logo", kind: "image", url: "blob:logo" }
    ]);
    expect(params).toMatchObject({ leftIcon: "blob:logo", rightIcon: "code" });
  });
});
