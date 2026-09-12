import { afterEach, describe, expect, it, vi } from "vitest";
import { matchTimelineSounds, soundMatchesAccessIssue, type AiProviderConfig } from "@/services/ai/provider";
import { createAiSoundMatchesSchema } from "@/services/ai/schema";

const config: AiProviderConfig = { protocol: "openai-chat", baseUrl: "https://example.test", model: "test", inputCostPerMillion: 0, outputCostPerMillion: 0 };
const freeSoundId = "shotcraft-audio:sfx-camera-camera-lens-shutter";
const secondFreeSoundId = "shotcraft-audio:sfx-camera-camera-shutter-hard";
const proSoundId = "shotcraft-audio:sfx-camera-ui-zoom-in";
const input = { topic: "测试", timelineDurationSeconds: 10, captions: [0, 1, 4].map((startSeconds) => ({ startSeconds, endSeconds: startSeconds + 1, text: "重点内容" })), isPro: false };
afterEach(() => vi.unstubAllGlobals());

describe("standalone sound matching", () => {
  it("requests only sound choices, deduplicates indexes and spaces cues", async () => {
    const matches = [
      { captionIndex: 0, soundEffectId: freeSoundId }, { captionIndex: 0, soundEffectId: secondFreeSoundId },
      { captionIndex: 1, soundEffectId: secondFreeSoundId }, { captionIndex: 2, soundEffectId: freeSoundId },
      { captionIndex: 7, soundEffectId: freeSoundId }
    ];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ matches }) } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const progress = vi.fn();
    const result = await matchTimelineSounds(config, input, "test-key", undefined, progress);
    expect(result.matches).toEqual([
      { captionIndex: 0, soundEffectId: freeSoundId }, { captionIndex: 1, soundEffectId: null }, { captionIndex: 2, soundEffectId: freeSoundId }
    ]);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.messages[0].content).toContain("只匹配新版音效库");
    expect(request.messages[0].content).toContain(freeSoundId);
    expect(request.messages[0].content).not.toContain(proSoundId);
    expect(request.messages[0].content).not.toContain("clean-click");
    expect(request.messages[0].content).not.toContain("primaryEffectId");
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "validating" }));
  });

  it("validates the identity-specific sound whitelist and permits an empty result", () => {
    const schema = createAiSoundMatchesSchema([freeSoundId]);
    expect(schema.parse({ matches: [] })).toEqual({ matches: [] });
    expect(() => schema.parse({ matches: [{ captionIndex: 0, soundEffectId: proSoundId }] })).toThrow();
    expect(() => schema.parse({ matches: [{ captionIndex: 0, soundEffectId: "clean-click" }] })).toThrow();
    expect(() => schema.parse({ matches: [{ captionIndex: -1, soundEffectId: null }] })).toThrow();
  });

  it("includes Pro sounds only for Pro matching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ matches: [] }) } }] })));
    vi.stubGlobal("fetch", fetchMock);
    await matchTimelineSounds(config, { ...input, isPro: true }, "test-key");
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.messages[0].content).toContain(proSoundId);
  });

  it("rechecks sound access before applying a completed result", () => {
    const matches = [{ captionIndex: 0, soundEffectId: proSoundId }];
    expect(soundMatchesAccessIssue(matches, false)).toContain(proSoundId);
    expect(soundMatchesAccessIssue(matches, true)).toBeUndefined();
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
