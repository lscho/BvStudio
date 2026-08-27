import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTokenUsage, generateVideoPlan, listProviderModels, providerEndpoint, verifyProviderConfiguration, type AiProviderConfig } from "@/services/ai/provider";
import { retrieveEffects } from "@/domain/effects";

const pricing = { inputCostPerMillion: 2.5, outputCostPerMillion: 10 };
const config: AiProviderConfig = {
  protocol: "openai-chat",
  baseUrl: "https://models.example.com",
  model: "test-model",
  maxTokens: 1_000,
  ...pricing
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractTokenUsage", () => {
  it("normalizes OpenAI Responses usage and estimates cost", () => {
    expect(extractTokenUsage("openai-responses", {
      usage: { input_tokens: 2_000, output_tokens: 500, total_tokens: 2_500 }
    }, pricing)).toEqual({
      inputTokens: 2_000,
      outputTokens: 500,
      totalTokens: 2_500,
      estimatedCostUsd: 0.01
    });
  });

  it("normalizes Chat Completions token field names", () => {
    expect(extractTokenUsage("openai-chat", {
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    }, pricing)).toMatchObject({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
  });

  it("derives Anthropic total tokens and tolerates missing usage", () => {
    expect(extractTokenUsage("anthropic", { usage: { input_tokens: 7, output_tokens: 9 } }, pricing).totalTokens).toBe(16);
    expect(extractTokenUsage("anthropic", {}, pricing)).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 });
  });
});

describe("provider requests", () => {
  it("normalizes service roots, v1 roots, and full compatible endpoints", () => {
    expect(providerEndpoint(config)).toBe("https://models.example.com/v1/chat/completions");
    expect(providerEndpoint({ ...config, baseUrl: "https://opencode.ai/zen/v1" })).toBe("https://opencode.ai/zen/v1/chat/completions");
    expect(providerEndpoint({ ...config, baseUrl: "https://models.example.com/v1/chat/completions" })).toBe("https://models.example.com/v1/chat/completions");
    expect(providerEndpoint({ ...config, protocol: "openai-responses", baseUrl: "https://models.example.com/v1/chat/completions" })).toBe("https://models.example.com/v1/responses");
  });

  it("loads and sorts an OpenAI-compatible model list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "z-model" }, { id: "a-model" }] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listProviderModels(config, "secret")).resolves.toEqual({ models: ["a-model", "z-model"], message: "连接成功，发现 2 个模型" });
    expect(fetchMock).toHaveBeenCalledWith("https://models.example.com/v1/models", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer secret" }) }));
  });

  it("retries a transient provider failure with exponential backoff", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "busy" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "ready" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = listProviderModels(config, "secret");
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toMatchObject({ models: ["ready"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight browser provider request", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })));
    const controller = new AbortController();
    const result = listProviderModels(config, "secret", controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow("模型请求已取消");
  });

  it("sends only local material metadata and accepts a matched material id", async () => {
    const allowedEffectId = retrieveEffects("制作开篇")[0].id;
    const responsePlan = {
      title: "开篇",
      article: "文章",
      narration: "口播",
      scenes: [{ title: "开篇", narration: "口播", durationSeconds: 3, effectId: allowedEffectId, color: "#ffb84d", cameraPreset: "push-in", mediaAssetId: "local-video", mediaSourceInSeconds: 2 }]
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(responsePlan) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateVideoPlan(config, {
      topic: "制作开篇",
      durationSeconds: 3,
      style: "简洁",
      materials: [{ id: "local-video", name: "office.mp4", durationSeconds: 12, width: 1920, height: 1080 }]
    }, "secret")).resolves.toMatchObject({ plan: { title: "开篇", article: "文章", narration: "口播", scenes: [expect.objectContaining({ effectId: retrieveEffects("开篇 口播", 1)[0].id, mediaAssetId: "local-video", mediaSourceInSeconds: 2, cameraPreset: "push-in" })] } });
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(JSON.stringify(payload)).toContain("office.mp4");
    expect(JSON.stringify(payload)).toContain("local-video");
    expect(JSON.stringify(payload)).not.toContain("/Users/");
    expect(payload.response_format).toEqual({ type: "json_object" });
    expect(payload.max_tokens).toBe(1_000);
  });

  it("accepts one million configured output tokens but probes with a small real request", async () => {
    const millionConfig = { ...config, baseUrl: "https://opencode.ai/zen/v1", maxTokens: 1_000_000 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyProviderConfiguration(millionConfig, "secret")).resolves.toMatchObject({ models: [], message: expect.stringContaining("配置有效") });
    expect(fetchMock.mock.calls[0][0]).toBe("https://opencode.ai/zen/v1/models");
    expect(fetchMock.mock.calls[1][0]).toBe("https://opencode.ai/zen/v1/chat/completions");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ model: "test-model", max_tokens: 16 });
  });

  it("surfaces a failed inference probe even when model listing works", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "test-model" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "model is not available" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyProviderConfiguration(config, "secret")).rejects.toThrow("model is not available");
  });
});
