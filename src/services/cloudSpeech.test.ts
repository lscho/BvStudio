import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudSpeechEndpoint, validateCloudSpeechTtsConfig, verifyCloudSpeech } from "@/services/cloudSpeech";
import { DEFAULT_SETTINGS } from "@/services/storage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cloud speech configuration", () => {
  it("normalizes MiMo roots and chat endpoints", () => {
    expect(cloudSpeechEndpoint(DEFAULT_SETTINGS.cloudSpeech)).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(cloudSpeechEndpoint({ ...DEFAULT_SETTINGS.cloudSpeech, baseUrl: "https://api.xiaomimimo.com/v1/chat/completions" }, "models")).toBe("https://api.xiaomimimo.com/v1/models");
  });

  it("checks an OpenAI-compatible model list without exposing the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "mimo-v2.5-tts" }, { id: "mimo-v2.5-asr" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyCloudSpeech(DEFAULT_SETTINGS.cloudSpeech, "speech-secret")).resolves.toContain("不验证推理余额");
    expect(fetchMock).toHaveBeenCalledWith("https://api.xiaomimimo.com/v1/models", { headers: { authorization: "Bearer speech-secret" } });
  });

  it("rejects a model list that does not contain the configured speech models", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "mimo-v2.5-tts" }] }), { status: 200 })));
    await expect(verifyCloudSpeech(DEFAULT_SETTINGS.cloudSpeech, "speech-secret")).rejects.toThrow("mimo-v2.5-asr");
  });

  it("requires a user voice description for the voice-design model", () => {
    expect(() => validateCloudSpeechTtsConfig({
      ...DEFAULT_SETTINGS.cloudSpeech,
      ttsModel: "mimo-v2.5-tts-voicedesign",
      ttsStyle: ""
    })).toThrow("音色设计模型必须填写音色设计描述");
    expect(() => validateCloudSpeechTtsConfig({
      ...DEFAULT_SETTINGS.cloudSpeech,
      ttsModel: "mimo-v2.5-tts-voicedesign",
      ttsStyle: "年轻、清亮、自然的中文女声"
    })).not.toThrow();
  });
});
