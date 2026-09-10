import { act, render, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LibraryScene, preloadLibraryShot } from "@/compositions/shotcraftLibrary/adapter";
import { createEffectPreviewClip } from "@/domain/effectPreview";
import { createEmptyProject } from "@/domain/project";

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
