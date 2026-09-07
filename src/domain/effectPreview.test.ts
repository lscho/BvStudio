import { describe, expect, it } from "vitest";
import { createEffectPreviewClip, createEffectPreviewModel } from "@/domain/effectPreview";
import { createEmptyProject } from "@/domain/project";

describe("effect library preview clips", () => {
  it("uses the same Overlay Studio placement and transparent chrome as timeline insertion", () => {
    const project = createEmptyProject();
    const clip = createEffectPreviewClip("punch-pill", project.motionTheme, project.assets);

    expect(clip.transform).toEqual({ x: 50, y: 82, scale: 1, rotation: 0, opacity: 1 });
    expect(clip.backdrop?.enabled).toBe(false);
    expect(clip.accentColor).toBe(project.motionTheme.colors.opinion);
  });

  it("binds available compatible assets without modifying the project", () => {
    const project = createEmptyProject();
    project.assets.push(
      { id: "one", name: "one.png", kind: "image", durationUs: 1_000_000, objectUrl: "blob:one" },
      { id: "two", name: "two.png", kind: "image", durationUs: 1_000_000, objectUrl: "blob:two" }
    );

    const clip = createEffectPreviewClip("image-duet-3d", project.motionTheme, project.assets);
    expect(clip.bindings).toEqual([
      { slotId: "left", assetIds: ["one"] },
      { slotId: "right", assetIds: ["two"] }
    ]);
    expect(project.tracks.find((track) => track.kind === "composition")!.clips).toHaveLength(0);
  });

  it("fills missing preview slots with temporary demonstration images", () => {
    const project = createEmptyProject();
    const poster = createEffectPreviewModel("poster-wall-3d", project.motionTheme, project.assets);
    const focus = createEffectPreviewModel("focus-card", project.motionTheme, project.assets);

    expect(poster.clip.bindings?.[0].assetIds).toHaveLength(3);
    expect(poster.assets.every((asset) => asset.objectUrl?.startsWith("data:image/svg+xml"))).toBe(true);
    expect(focus.clip.bindings).toEqual([{ slotId: "presenter", assetIds: ["effect-demo:focus-card:presenter:0"] }]);
    expect(focus.assets[0]).toMatchObject({ kind: "video", name: "演示素材" });
    expect(project.assets).toEqual([]);
  });
});
