import { act, render, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LibraryScene, preloadLibraryShot } from "@/compositions/shotcraftLibrary/adapter";
import { createEffectPreviewClip } from "@/domain/effectPreview";
import { createEmptyProject } from "@/domain/project";

it("持久化的叠卡参数通过镜头适配器移除演示主体，独立镜头不受影响", async () => {
  const clip = createEffectPreviewClip("shotcraft-glow-orb-ambient", createEmptyProject().motionTheme, []);
  await preloadLibraryShot(clip.compositionId);
  const view = render(<LibraryScene clip={clip} assets={[]} frame={90} width={960} height={540} />);
  await act(async () => {});
  expect(view.container.innerHTML).toContain("width: 560px");
  view.rerender(<LibraryScene clip={{ ...clip, params: { ...clip.params, shotcraftUnderlay: true } }} assets={[]} frame={90} width={960} height={540} />);
  await act(async () => {});
  expect(view.container.innerHTML).not.toContain("width: 560px");
  expect(view.container.innerHTML).toContain("opacity: 0.12");
});

it("逐帧预览和素材对象刷新不重新挂载已测量的镜头", async () => {
  const clip = createEffectPreviewClip("shotcraft-marker-underline-title", createEmptyProject().motionTheme, []);
  clip.params = { copy0: "真实项目标题" };
  await preloadLibraryShot(clip.compositionId);
  const view = render(<LibraryScene clip={clip} assets={[]} frame={40} width={960} height={540} />);
  await act(async () => {});
  const title = view.getByText(/真实项目标题/u);
  view.rerender(<LibraryScene clip={{ ...clip }} assets={[]} frame={41} width={960} height={540} />);
  expect(view.getByText(/真实项目标题/u)).toBe(title);
});

it("镜头舞台不继承编辑器字幕的居中对齐", async () => {
  const clip = createEffectPreviewClip("shotcraft-crash-zoom-real", createEmptyProject().motionTheme, []);
  await preloadLibraryShot(clip.compositionId);
  const view = render(<div style={{ textAlign: "center" }}><LibraryScene clip={clip} assets={[]} frame={90} width={960} height={540} /></div>);
  await act(async () => {});
  expect(view.container.querySelector("[data-shotcraft-stage]")).toHaveStyle({ textAlign: "left" });
});

it("叠卡底层在竖屏填满画布，不沿用独立镜头的完整显示留边", async () => {
  const clip = createEffectPreviewClip("shotcraft-radial-wave", createEmptyProject().motionTheme, []);
  clip.params = { ...clip.params, shotcraftUnderlay: true };
  await preloadLibraryShot(clip.compositionId);
  const view = render(<LibraryScene clip={clip} assets={[]} frame={90} width={540} height={960} />);
  await act(async () => {});
  expect(view.container.querySelector("[data-shotcraft-design-stage]")).toHaveStyle({ transform: `translate(-50%, -50%) scale(${960 / 1080})` });
});

it("按横屏、竖屏和方形预览容器的实际尺寸缩放固定 1920×1080 镜头", async () => {
  let stageWidth = 960;
  let stageHeight = 540;
  const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-shotcraft-stage") ? stageWidth : 0;
  });
  const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-shotcraft-stage") ? stageHeight : 0;
  });
  try {
    const clip = createEffectPreviewClip("shotcraft-grid-wave-flip", createEmptyProject().motionTheme, []);
    const view = render(<LibraryScene clip={clip} assets={[]} frame={40} width={1920} height={1080} />);
    await waitFor(() => {
      expect(view.container.querySelector("[data-shotcraft-design-stage]")).toHaveStyle({
        width: "1920px",
        height: "1080px",
        transform: "translate(-50%, -50%) scale(0.5)"
      });
    });
    stageWidth = 540;
    stageHeight = 960;
    view.rerender(<LibraryScene clip={clip} assets={[]} frame={41} width={1080} height={1920} />);
    await waitFor(() => {
      expect(view.container.querySelector("[data-shotcraft-design-stage]")).toHaveStyle({
        transform: "translate(-50%, -50%) scale(0.28125)"
      });
    });
    stageWidth = 600;
    stageHeight = 600;
    view.rerender(<LibraryScene clip={clip} assets={[]} frame={42} width={1080} height={1080} />);
    await waitFor(() => {
      expect(view.container.querySelector("[data-shotcraft-design-stage]")).toHaveStyle({
        transform: "translate(-50%, -50%) scale(0.3125)"
      });
    });
  } finally {
    width.mockRestore();
    height.mockRestore();
  }
});

it("慢推镜头在硬切点后展示绑定的真实素材", async () => {
  const clip = createEffectPreviewClip("shotcraft-slow-push-in", createEmptyProject().motionTheme, []);
  clip.bindings = [{ slotId: "images", assetIds: ["screen"] }];
  await preloadLibraryShot(clip.compositionId);
  const view = render(<LibraryScene clip={clip} assets={[{ id: "screen", objectUrl: "data:image/png;base64,screen", width: 1920, height: 1080 }]} frame={130} width={960} height={540} />);
  await act(async () => {});
  expect(view.container.querySelector("img")).toHaveAttribute("src", "data:image/png;base64,screen");
});

it("推拉变焦镜头使用项目表面色而不是固定浅色背景", async () => {
  const clip = createEffectPreviewClip("shotcraft-dolly-zoom-real", createEmptyProject().motionTheme, []);
  clip.bindings = [{ slotId: "images", assetIds: ["screen"] }];
  await preloadLibraryShot(clip.compositionId);
  const view = render(<LibraryScene clip={clip} assets={[{ id: "screen", objectUrl: "data:image/png;base64,screen", width: 1086, height: 1124 }]} frame={120} width={960} height={540} appearance={{ color: "#ffffff", accent: "#5fa8ff", surface: "#111316", fontFamily: "sans-serif" }} />);
  await act(async () => {});
  expect(view.container.querySelector("[data-shotcraft-design-stage] > div")).toHaveStyle({ backgroundColor: "#111316" });
  expect(Array.from(view.container.querySelectorAll("img")).at(-1)).toHaveStyle({ height: `${520 * 1124 / 1086}px`, zIndex: "2" });
});
