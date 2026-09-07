import { afterEach, describe, expect, it, vi } from "vitest";
import { matchTimelineSounds, type AiProviderConfig } from "@/services/ai/provider";
import { aiSoundMatchesSchema } from "@/services/ai/schema";

const config: AiProviderConfig = { protocol: "openai-chat", baseUrl: "https://example.test", model: "test", inputCostPerMillion: 0, outputCostPerMillion: 0 };
const input = { topic: "测试", timelineDurationSeconds: 10, captions: [0, 1, 4].map((startSeconds) => ({ startSeconds, endSeconds: startSeconds + 1, text: "重点内容" })) };
afterEach(() => vi.unstubAllGlobals());

describe("standalone sound matching", () => {
  it("requests only sound choices, deduplicates indexes and spaces cues", async () => {
    const matches = [
      { captionIndex: 0, soundEffectId: "clean-click" }, { captionIndex: 0, soundEffectId: "soft-pop" },
      { captionIndex: 1, soundEffectId: "soft-pop" }, { captionIndex: 2, soundEffectId: "success-tone" },
      { captionIndex: 7, soundEffectId: "success-tone" }
    ];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ matches }) } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const progress = vi.fn();
    const result = await matchTimelineSounds(config, input, "test-key", undefined, progress);
    expect(result.matches).toEqual([
      { captionIndex: 0, soundEffectId: "clean-click" }, { captionIndex: 1, soundEffectId: null }, { captionIndex: 2, soundEffectId: "success-tone" }
    ]);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.messages[0].content).toContain("只匹配内置音效");
    expect(request.messages[0].content).not.toContain("primaryEffectId");
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "validating" }));
  });

  it("validates unknown sounds and permits an empty result", () => {
    expect(aiSoundMatchesSchema.parse({ matches: [] })).toEqual({ matches: [] });
    expect(() => aiSoundMatchesSchema.parse({ matches: [{ captionIndex: 0, soundEffectId: "invented" }] })).toThrow();
    expect(() => aiSoundMatchesSchema.parse({ matches: [{ captionIndex: -1, soundEffectId: null }] })).toThrow();
  });

  it("does not start a request when cancelled or missing captions", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(matchTimelineSounds(config, input, "test-key", controller.signal)).rejects.toThrow();
    await expect(matchTimelineSounds(config, { ...input, captions: [] }, "test-key")).rejects.toThrow("时间字幕");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
