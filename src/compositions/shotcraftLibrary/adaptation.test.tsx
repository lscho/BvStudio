import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { libraryLoaders } from "@/compositions/shotcraftLibrary/loaders";
import { ShotcraftFrameContext, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";
import { libraryShot } from "@/domain/shotcraftLibrary/catalog";
import { normalizeShotcraftSettings, defaultShotcraftSettings, shotcraftFrame } from "@/domain/shotcraft";
import { ShotcraftComposition } from "@/compositions/shotcraft";
import { createEffectPreviewClip } from "@/domain/effectPreview";
import { createEmptyProject } from "@/domain/project";
import { effectControlsFor } from "@/compositions/registry";

async function shotFrame(id: string, frame: number, texts: Record<string, string> = {}, images: string[] = []) {
  const content: ShotcraftContent = { texts, images, imageKeys: [] };
  const Component = (await libraryLoaders[id]()).createDemo(content);
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ShotcraftFrameContext.Provider value={{ ...content, frame, durationInFrames: libraryShot(id)!.frames, width: 1920, height: 1080 }}><Component /></ShotcraftFrameContext.Provider>);
  return host;
}

it("中文首词独立入场且强调词不依赖空格", async () => {
  const host = await shotFrame("shotcraft-lead-word-zoom-assemble", 8, { copy0: "生成很快", copy1: "生成", copy2: "改片很慢" });
  const words = [...host.querySelectorAll("span")];
  expect(words.find((node) => node.textContent === "生成")?.style.opacity).toBe("1");
  expect(words.find((node) => node.textContent === "很快")?.style.opacity).toBe("0");
  expect(host.textContent).toContain("生成很快");
});

it("旧 104 帧时钟仍可读取，末帧已完成时间线推近", async () => {
  const id = "shotcraft-timeline-travel";
  const settings = normalizeShotcraftSettings({ ...defaultShotcraftSettings(id), timeMap: [{ timeUs: 0, frame: 0 }, { timeUs: 4_800_000, frame: 104 }] }, id);
  const host = await shotFrame(id, shotcraftFrame(id, 4_800_000, settings));
  expect(host.innerHTML).toContain("transform:scale(1.28)");
});

it.each(["BVideo Studio", "这是一个更长的中文产品品牌"])("品牌 %s 在收尾前完成全部字母入场并保留空格", async (brand) => {
  const host = await shotFrame("shotcraft-logo-shrink-wordmark-lockup", 100, { copy1: brand, copy0: "AI 给初稿，你来掌控" });
  const letters = [...host.querySelectorAll("span")].filter((node) => node.style.opacity !== "");
  expect(letters.length).toBeGreaterThan(0);
  expect(letters.every((node) => node.style.opacity === "1")).toBe(true);
  expect(letters.map((node) => node.textContent).join("")).toBe(brand);
});

it("画框切换绑定真实两态并移除默认模式标签", async () => {
  const copy = { copy0: "调整前", copy1: "调整后" };
  const images = ["data:image/png;base64,YQ==", "data:image/png;base64,Yg=="];
  const before = await shotFrame("shotcraft-brand-frame-snap", 50, copy, images);
  const after = await shotFrame("shotcraft-brand-frame-snap", 100, copy, images);
  expect(before.textContent).toContain("调整前");
  expect(after.textContent).toContain("调整后");
  expect(after.textContent).not.toMatch(/DESIGN|DEV MODE/u);
  expect(before.querySelector("img")?.src).toBe(images[0]);
  expect(after.querySelector("img")?.src).toBe(images[1]);
  expect([...after.querySelectorAll("[data-shotcraft-frame-band]")]).toHaveLength(4);
});

it("焦点说明可编辑，预览渲染会随四个焦点切换", () => {
  const clip = createEffectPreviewClip("shotcraft-cursor-flyover", createEmptyProject().motionTheme, []);
  clip.text = "识别素材｜匹配镜头｜绑定图片｜继续编辑";
  expect(effectControlsFor(clip)).toContainEqual(expect.objectContaining({ kind: "text", field: "text", label: "焦点说明（用｜分隔）" }));
  const props = { compositionId: clip.compositionId, text: clip.text, color: clip.color, accentColor: clip.accentColor, fontSize: clip.fontSize, recipe: clip.recipe!, durationUs: clip.durationUs, canvasWidth: 1920, canvasHeight: 1080, shotcraftData: { clip } };
  expect(renderToStaticMarkup(<ShotcraftComposition {...props} timeUs={1_000_000} />)).toContain("识别素材");
  expect(renderToStaticMarkup(<ShotcraftComposition {...props} timeUs={5_500_000} />)).toContain("继续编辑");
});

it("慢推长中文自适应宽度，未绑定图片时尾部保留文案", async () => {
  const text = "镜头错配，素材、字幕、音乐分散";
  const middle = await shotFrame("shotcraft-slow-push-in", 80, { copy0: text, copy1: "" });
  const title = [...middle.querySelectorAll("div")].find((node) => node.textContent === text && node.style.fontSize);
  expect(Number.parseFloat(title!.style.fontSize)).toBeLessThan(100);
  const tail = await shotFrame("shotcraft-slow-push-in", 149, { copy0: text, copy1: "" });
  expect(tail.textContent).toContain(text);
});

it("普通镜头的两句说明使用换行，不显示分隔符", () => {
  const clip = createEffectPreviewClip("shotcraft-card-stack", createEmptyProject().motionTheme, []);
  clip.text = "每个镜头都可编辑｜也可撤销重做";
  const html = renderToStaticMarkup(<ShotcraftComposition compositionId={clip.compositionId} text={clip.text} color={clip.color} accentColor={clip.accentColor} fontSize={clip.fontSize} recipe={clip.recipe!} durationUs={clip.durationUs} canvasWidth={1920} canvasHeight={1080} shotcraftData={{ clip }} timeUs={1_000_000} />);
  expect(html).toContain("每个镜头都可编辑\n也可撤销重做");
});

it("无图节奏字卡尾部保留结论，不切入示例页面", async () => {
  const host = await shotFrame("shotcraft-card-footage-cadence", 149, { copy0: "预览", copy1: "导出", copy2: "同一镜头数据" });
  expect(host.textContent).toContain("同一镜头数据");
});

it("拉远孤立的中文主卡在卡内换行，不溢出", async () => {
  const text = "镜头错配、素材字幕分散";
  const host = await shotFrame("shotcraft-pull-back-isolation", 130, { copy0: text });
  const title = [...host.querySelectorAll("div")].find((node) => node.textContent === text && node.style.fontSize);
  expect(Number.parseFloat(title!.style.fontSize)).toBeLessThanOrEqual(72);
  expect(title!.style.lineHeight).toBe("1.3");
});
