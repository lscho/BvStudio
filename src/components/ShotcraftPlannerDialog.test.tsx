import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ShotcraftPlannerDialog } from "@/components/ShotcraftPlannerDialog";
import { createEmptyProject } from "@/domain/project";
import { DEFAULT_SETTINGS } from "@/services/storage";
import { useEditorStore } from "@/stores/editorStore";
import { generateShotcraftPlan } from "@/services/ai/shotcraft";

vi.mock("@/services/ai/shotcraft", () => ({ generateShotcraftPlan: vi.fn() }));
vi.mock("@/services/ai/provider", () => ({ hasApiKey: vi.fn(async () => true) }));
const settings = { ...DEFAULT_SETTINGS, aiProvider: { ...DEFAULT_SETTINGS.aiProvider, model: "test" } };
const plan = { title: "产品标题", scenes: [{ shotId: "shotcraft-blur-slide", text: "用户内容", durationSeconds: 4, copy: [], bindings: [], regions: [], transition: "none", sounds: [], reason: "标题开场" }] };
beforeEach(() => {
  vi.clearAllMocks();
  useEditorStore.setState({ project: createEmptyProject(), past: [], future: [], selectedClipId: null, selectedClipIds: [], playheadUs: 0 });
});
it("显示实际编排后，用户加入才提交，并支持撤销", async () => {
  vi.mocked(generateShotcraftPlan).mockResolvedValue({ data: plan, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 } });
  render(<ShotcraftPlannerDialog open settings={settings} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "视频内容与镜头要求" }), { target: { value: "介绍产品" } });
  fireEvent.click(screen.getByRole("button", { name: "生成分镜" }));
  expect(await screen.findByText("产品标题 · 4.00 秒")).toBeVisible();
  expect(useEditorStore.getState().past).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "加入时间线" }));
  expect(useEditorStore.getState().past).toHaveLength(1);
  act(() => useEditorStore.getState().undo());
  expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips)).toHaveLength(0);
});
it("关闭时取消请求，过期响应不能恢复旧计划", async () => {
  let resolve: ((value: Awaited<ReturnType<typeof generateShotcraftPlan>>) => void) | undefined;
  vi.mocked(generateShotcraftPlan).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const view = render(<ShotcraftPlannerDialog open settings={settings} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "视频内容与镜头要求" }), { target: { value: "内容" } });
  fireEvent.click(screen.getByRole("button", { name: "生成分镜" }));
  await waitFor(() => expect(generateShotcraftPlan).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(generateShotcraftPlan).mock.calls[0][2];
  view.rerender(<ShotcraftPlannerDialog open={false} settings={settings} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);
  expect(signal?.aborted).toBe(true);
  await act(async () => { resolve?.({ data: plan, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 } }); });
  view.rerender(<ShotcraftPlannerDialog open settings={settings} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);
  expect(screen.getByRole("button", { name: "加入时间线" })).toBeDisabled();
});
