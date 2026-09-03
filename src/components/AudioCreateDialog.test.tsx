import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AudioCreateDialog } from "@/components/AudioCreateDialog";
import { DEFAULT_SETTINGS } from "@/services/storage";

const synthesizeCloudSpeechTrack = vi.fn();

vi.mock("@/services/runtime", () => ({ isDesktopRuntime: () => true }));
vi.mock("@/services/cloudSpeech", () => ({
  MIMO_TTS_VOICES: [{ value: "冰糖", label: "冰糖 · 中文女声" }],
  synthesizeCloudSpeechTrack: (...args: unknown[]) => synthesizeCloudSpeechTrack(...args)
}));

beforeEach(() => {
  synthesizeCloudSpeechTrack.mockReset();
  synthesizeCloudSpeechTrack.mockImplementation(async (...args: unknown[]) => {
    const onProgress = args[2];
    if (typeof onProgress === "function") onProgress({ completed: 1, total: 2, message: "正在生成第 1/2 条字幕" });
    return { path: "/speech/merged.wav", durationUs: 3_400_000, segmentDurationsUs: [1_100_000, 2_300_000] };
  });
});

describe("AudioCreateDialog", () => {
  it("synthesizes generated narration from the exact subtitle segments", async () => {
    const onCreated = vi.fn(async () => undefined);
    render(<AudioCreateDialog
      open
      defaultText="另一份口播字段"
      speechSegments={[{ id: "one", text: "第一句。" }, { id: "two", text: "第二句！" }]}
      cloudSpeech={DEFAULT_SETTINGS.cloudSpeech}
      onOpenChange={vi.fn()}
      onCreated={onCreated}
    />);

    const text = screen.getByRole("textbox", { name: "字幕配音文本" });
    expect(text).toHaveValue("第一句。\n第二句！");
    expect(text).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "按 2 条字幕生成并加入" }));

    await waitFor(() => expect(synthesizeCloudSpeechTrack).toHaveBeenCalledWith(
      expect.objectContaining({ ttsModel: "mimo-v2.5-tts" }),
      ["第一句。", "第二句！"],
      expect.any(Function)
    ));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      path: "/speech/merged.wav",
      segmentDurationsUs: [1_100_000, 2_300_000],
      sourceSubtitleIds: ["one", "two"]
    })));
  });
});
