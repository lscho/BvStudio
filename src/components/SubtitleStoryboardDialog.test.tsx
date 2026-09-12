import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SubtitleStoryboardDialog } from "@/components/SubtitleStoryboardDialog";

const baseProps = { open: true, assets: [], onOpenChange: vi.fn(), onApply: vi.fn(), onNeedSettings: vi.fn(), subtitleCount: 5, durationSeconds: 20 };
const preview = {
  subtitleIds: ["subtitle-1"],
  captions: [{ startSeconds: 0, endSeconds: 5, text: "保留口播" }],
  selection: { segments: [{ segmentId: "opening", startCaptionIndex: 0, endCaptionIndex: 0, title: "开场", roll: "a-roll" as const, intent: "hook" as const, evidenceKinds: ["none" as const], primaryEffectId: null, secondaryEffectId: null, materialNeed: "", selectionReason: "保留人物" }] },
  matches: [], preparedAssets: [], projectUpdatedAt: "now"
};

it("没有字幕时提示先导入，不能发送请求", () => {
  render(<SubtitleStoryboardDialog {...baseProps} onGenerate={vi.fn()} subtitleCount={0} />);
  expect(screen.getByRole("button", { name: "生成整套分镜" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "应用整套编排" })).toBeDisabled();
});

it("只有图片素材时说明将生成全屏图片镜头", async () => {
  render(<SubtitleStoryboardDialog {...baseProps} assets={[{
    id: "screen", name: "产品截图.png", kind: "image", durationUs: 0, objectUrl: "blob:screen", missing: false
  }]} onGenerate={vi.fn()} />);
  expect(await screen.findByRole("status")).toHaveTextContent("仅使用图片：将自动生成全屏图片镜头");
});

it("提交纯模式和分镜要求，冲突要求留在本地", async () => {
  const generate = vi.fn(async () => preview);
  const apply = vi.fn();
  render(<SubtitleStoryboardDialog {...baseProps} onGenerate={generate} onApply={apply} />);
  fireEvent.pointerDown(screen.getByRole("combobox", { name: "分镜画面模式" }), { button: 0, pointerType: "mouse", ctrlKey: false });
  fireEvent.click(await screen.findByRole("option", { name: "纯 A-roll · 口播为主" }));
  fireEvent.change(screen.getByRole("textbox", { name: "分镜要求" }), { target: { value: "0-5秒 B-roll 展示产品" } });
  fireEvent.click(screen.getByRole("button", { name: "生成整套分镜" }));
  expect(screen.getByRole("alert")).toHaveTextContent("冲突");expect(generate).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "分镜要求" }), { target: { value: "0-5秒 A-roll 保留口播" } });
  fireEvent.click(screen.getByRole("button", { name: "生成整套分镜" }));
  await waitFor(() => expect(screen.getByText("1 个语义段 · 0 个镜头动作")).toBeVisible());
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({ storyboard: { mode: "a-roll", prompt: "0-5秒 A-roll 保留口播", shotcraftTextMode: "narration" }, soundEnabled: true, beatSync: false }), expect.any(AbortSignal), expect.any(Function));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "应用整套编排" }));
  expect(apply).toHaveBeenCalledWith(preview, expect.objectContaining({ storyboard: { mode: "a-roll", prompt: "0-5秒 A-roll 保留口播", shotcraftTextMode: "narration" } }));
});

it("可选择由 Shotcraft 承担宣传片字幕", async () => {
  const generate = vi.fn(async () => preview);
  render(<SubtitleStoryboardDialog {...baseProps} onGenerate={generate} />);

  expect(screen.getByRole("combobox", { name: "Shotcraft 文案策略" })).toHaveTextContent("口播字幕优先");
  fireEvent.pointerDown(screen.getByRole("combobox", { name: "Shotcraft 文案策略" }), { button: 0, pointerType: "mouse", ctrlKey: false });
  fireEvent.click(await screen.findByRole("option", { name: "宣传片文案 · Shotcraft 承担字幕" }));
  fireEvent.click(screen.getByRole("button", { name: "生成整套分镜" }));

  await waitFor(() => expect(generate).toHaveBeenCalled());
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({
    storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "promo" }
  }), expect.any(AbortSignal), expect.any(Function));
});
