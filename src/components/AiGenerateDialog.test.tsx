import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiGenerateDialog } from "@/components/AiGenerateDialog";
import { createEmptyProject } from "@/domain/project";
import { DEFAULT_SETTINGS } from "@/services/storage";
import { useEditorStore } from "@/stores/editorStore";

const emptyUsage = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };

vi.mock("@/services/ai/provider", () => ({
  browserApiKey: vi.fn(() => "test-key"),
  generateTimedScript: vi.fn((...args: unknown[]) => {
    const onProgress = args[4];
    if (typeof onProgress === "function") onProgress({ phase: "receiving", message: "正在接收模型结果 · 2 KB", receivedCharacters: 2_048 });
    return new Promise(() => undefined);
  }),
  getAiSessionUsage: vi.fn(() => emptyUsage),
  hasApiKey: vi.fn(async () => true),
  subscribeAiSessionUsage: vi.fn(() => () => undefined)
}));

beforeEach(() => {
  useEditorStore.setState({
    project: createEmptyProject(),
    selectedClipId: null,
    selectedClipIds: [],
    playheadUs: 0,
    zoom: 1,
    rangeStartUs: null,
    rangeEndUs: null,
    past: [],
    future: [],
    clipboard: []
  });
});

describe("AiGenerateDialog", () => {
  it("shows persistent generation feedback without offering automatic voice generation", async () => {
    render(
      <AiGenerateDialog
        open
        settings={{ ...DEFAULT_SETTINGS, aiProvider: { ...DEFAULT_SETTINGS.aiProvider, model: "test-model" } }}
        onOpenChange={vi.fn()}
        onNeedSettings={vi.fn()}
      />
    );

    expect(screen.queryByRole("checkbox", { name: "同时生成 MiMo 云端配音" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "主题与要求" }), { target: { value: "介绍充电桩市场" } });
    fireEvent.click(screen.getByRole("button", { name: "生成片段" }));

    expect(await screen.findByRole("status")).toHaveTextContent("正在接收模型结果 · 2 KB");
    expect(screen.getByRole("textbox", { name: "主题与要求" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "停止生成" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "正在生成" })).toBeDisabled();
  });
});
