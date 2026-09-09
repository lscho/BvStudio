import { act, render } from "@testing-library/react";
import { expect, it } from "vitest";
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
