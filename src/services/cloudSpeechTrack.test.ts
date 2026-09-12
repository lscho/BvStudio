import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/services/storage";

const invoke = vi.fn();
const probeMedia = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {},
  invoke: (...args: unknown[]) => invoke(...args)
}));
vi.mock("@/services/runtime", () => ({ isDesktopRuntime: () => true }));
vi.mock("@/services/media", () => ({ probeMedia: (...args: unknown[]) => probeMedia(...args) }));

import { synthesizeCloudSpeechTrack } from "@/services/cloudSpeech";

beforeEach(() => {
  invoke.mockReset();
  probeMedia.mockReset();
});

describe("synthesizeCloudSpeechTrack", () => {
  it("limits subtitle synthesis to three concurrent requests and preserves segment order", async () => {
    const pending = new Map<string, (path: string) => void>();
    let active = 0;
    let peak = 0;
    invoke.mockImplementation((command: string, payload: { text?: string; paths?: string[] }) => {
      if (command === "merge_cloud_speech_segments") return Promise.resolve("/speech/merged.wav");
      active += 1;
      peak = Math.max(peak, active);
      return new Promise<string>((resolve) => pending.set(payload.text ?? "", (path) => {
        active -= 1;
        resolve(path);
      }));
    });
    probeMedia.mockImplementation((path: string) => Promise.resolve({
      hasAudio: true,
      durationUs: path === "/speech/merged.wav" ? 5_000_000 : 1_000_000
    }));

    const result = synthesizeCloudSpeechTrack(DEFAULT_SETTINGS.cloudSpeech, ["一", "二", "三", "四", "五"]);
    await vi.waitFor(() => expect(pending.size).toBe(3));
    expect(peak).toBe(3);
    pending.get("二")?.("/speech/two.wav");
    await vi.waitFor(() => expect(pending.has("四")).toBe(true));
    pending.get("一")?.("/speech/one.wav");
    pending.get("三")?.("/speech/three.wav");
    await vi.waitFor(() => expect(pending.has("五")).toBe(true));
    pending.get("四")?.("/speech/four.wav");
    pending.get("五")?.("/speech/five.wav");

    await expect(result).resolves.toEqual({
      path: "/speech/merged.wav",
      durationUs: 5_000_000,
      segmentDurationsUs: [1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000]
    });
    expect(invoke).toHaveBeenLastCalledWith("merge_cloud_speech_segments", {
      paths: ["/speech/one.wav", "/speech/two.wav", "/speech/three.wav", "/speech/four.wav", "/speech/five.wav"]
    });
  });

  it("generates and measures every subtitle before merging the voice track", async () => {
    invoke
      .mockResolvedValueOnce("/speech/one.wav")
      .mockResolvedValueOnce("/speech/two.wav")
      .mockResolvedValueOnce("/speech/merged.wav");
    probeMedia
      .mockResolvedValueOnce({ hasAudio: true, durationUs: 1_100_000 })
      .mockResolvedValueOnce({ hasAudio: true, durationUs: 2_300_000 })
      .mockResolvedValueOnce({ hasAudio: true, durationUs: 3_400_125 });
    const progress = vi.fn();

    await expect(synthesizeCloudSpeechTrack(DEFAULT_SETTINGS.cloudSpeech, ["第一句。", "第二句！"], progress)).resolves.toEqual({
      path: "/speech/merged.wav",
      durationUs: 3_400_125,
      segmentDurationsUs: [1_100_000, 2_300_125]
    });
    expect(invoke.mock.calls).toEqual([
      ["synthesize_cloud_speech", { config: DEFAULT_SETTINGS.cloudSpeech, text: "第一句。" }],
      ["synthesize_cloud_speech", { config: DEFAULT_SETTINGS.cloudSpeech, text: "第二句！" }],
      ["merge_cloud_speech_segments", { paths: ["/speech/one.wav", "/speech/two.wav"] }]
    ]);
    expect(probeMedia.mock.calls.map(([path]) => path)).toEqual(["/speech/one.wav", "/speech/two.wav", "/speech/merged.wav"]);
    expect(progress).toHaveBeenLastCalledWith({ completed: 2, total: 2, message: "正在合并字幕配音" });
  });

  it("rejects a merged voice file that is shorter than its generated segments", async () => {
    invoke
      .mockResolvedValueOnce("/speech/one.wav")
      .mockResolvedValueOnce("/speech/two.wav")
      .mockResolvedValueOnce("/speech/merged.wav");
    probeMedia
      .mockResolvedValueOnce({ hasAudio: true, durationUs: 1_800_000 })
      .mockResolvedValueOnce({ hasAudio: true, durationUs: 2_200_000 })
      .mockResolvedValueOnce({ hasAudio: true, durationUs: 2_600_000 });

    await expect(synthesizeCloudSpeechTrack(DEFAULT_SETTINGS.cloudSpeech, ["第一句。", "第二句。"]))
      .rejects.toThrow("合并后的配音时长异常");
  });
});
