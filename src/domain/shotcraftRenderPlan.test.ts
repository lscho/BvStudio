import { describe, expect, it } from "vitest";
import { createEmptyProject, type CompositionClip } from "@/domain/project";
import { createEffectPreviewClip } from "@/domain/effectPreview";
import { buildRenderPlan } from "@/domain/renderPlan";
import { SHOTCRAFT_SHOTS, shotcraftHeroZoom, shotcraftImageRect } from "@/domain/shotcraft";

describe("Shotcraft rendering contract", () => {
  it.each([[1920, 1080], [1080, 1920], [1080, 1080]])("carries all six source clocks and screenshot dimensions at %i x %i", (width, height) => {
    const project = createEmptyProject();
    project.canvas = { ...project.canvas, width, height };
    project.assets = Array.from({ length: 8 }, (_, i) => ({ id: `image-${i}`, name: "产品截图", kind: "image", durationUs: 0, sourcePath: `/images/${i}.png`, objectUrl: `blob:${i}`, width: 1440, height: 1000 }));
    const track = project.tracks.find((entry) => entry.kind === "composition")!;
    track.clips = SHOTCRAFT_SHOTS.map((shot, i) => ({ ...createEffectPreviewClip(shot.id, project.motionTheme, project.assets), id: `shot-${i}`, trackId: track.id, startUs: i * 10_000_000, sourceOffsetUs: 500_000, speed: 1.5 }));
    const plan = buildRenderPlan(project, "/out.mp4");
    expect(plan).toMatchObject({ width, height });
    expect(plan.overlays).toHaveLength(6);
    plan.overlays.forEach((overlay, index) => {
      expect(overlay).toMatchObject({ renderer: "react", sourceOffsetUs: 500_000, speed: 1.5, shotcraftData: { clip: track.clips[index] } });
      if (overlay.kind === "composition") for (const image of overlay.compositionImages ?? []) expect(image).toMatchObject({ width: 1440, height: 1000 });
    });
  });

  it("includes the outgoing screenshot for transitions and rejects missing source assets", () => {
    const project = createEmptyProject();
    project.assets = [{ id: "page", name: "页面", kind: "image", durationUs: 0, sourcePath: "/page.png", objectUrl: "blob:page", width: 1000, height: 1600 }];
    const track = project.tracks.find((entry) => entry.kind === "composition")!;
    const before = { ...createEffectPreviewClip("shotcraft-cursor-flyover", project.motionTheme, project.assets), id: "before", trackId: track.id };
    const after: CompositionClip = { ...createEffectPreviewClip("shotcraft-blur-slide", project.motionTheme, []), id: "after", trackId: track.id, startUs: before.durationUs };
    after.shotcraft = { ...after.shotcraft!, transition: { preset: "flash-cut", durationUs: 500_000, fromClipId: before.id } };
    track.clips = [before, after];
    expect(buildRenderPlan(project, "/out.mp4").overlays[1]).toMatchObject({ shotcraftData: { previous: before }, compositionImages: [{ id: "page", path: "/page.png" }] });
    project.assets[0].missing = true;
    expect(() => buildRenderPlan(project, "/out.mp4")).toThrow("缺失");
    track.hidden = true;
    expect(buildRenderPlan(project, "/out.mp4").overlays).toEqual([]);
  });

  it("maps focus coordinates inside the image's actual letterboxed rectangle", () => {
    expect(shotcraftImageRect(1920, 1080, 1080, 1920)).toMatchObject({ x: 0, width: 100, height: 31.640625 });
    expect(shotcraftImageRect(1080, 1920, 1920, 1080)).toMatchObject({ y: 0, height: 100, width: 31.640625 });
    expect(shotcraftImageRect(1000, 1000, 1000, 1000)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("leaves room for the raised near edge of large hero cards while retaining close-ups of small cards", () => {
    // 58.8% of a 480 × 333.33 screenshot, the central editor canvas used in visual QA.
    const zoom = shotcraftHeroZoom(282.24, 158.333, 270);
    expect(zoom).toBeLessThan(1);
    expect(zoom).toBeGreaterThan(0.7);
    expect(shotcraftHeroZoom(60, 40, 270)).toBe(2.6);
    expect(shotcraftHeroZoom(282.24, 158.333, 853.333)).toBeGreaterThan(zoom);
  });
});
