import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "@/services/runtime";
import { retrieveEffects } from "@/domain/effects";
import { createAiVideoPlanSchema, createVideoPlanJsonSchema, type AiVideoPlan } from "@/services/ai/schema";
import type { EffectDefinition } from "@/domain/effects";
import { CAMERA_PRESETS } from "@/domain/camera";

export type AiProtocol = "openai-responses" | "openai-chat" | "anthropic";
export const MAX_MODEL_OUTPUT_TOKENS = 1_000_000;

export interface AiProviderConfig {
  protocol: AiProtocol;
  baseUrl: string;
  model: string;
  maxTokens: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface GeneratePlanInput {
  topic: string;
  durationSeconds: number;
  style: string;
  materials: AiMaterialCandidate[];
}

export interface AiMaterialCandidate {
  id: string;
  name: string;
  durationSeconds: number;
  width?: number;
  height?: number;
}

interface ProviderResponse {
  status: number;
  body: unknown;
}

export interface AiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiSessionUsage extends AiTokenUsage {
  requests: number;
}

export interface GeneratedVideoPlan {
  plan: AiVideoPlan;
  usage: AiTokenUsage;
}

export interface ProviderModelResult {
  models: string[];
  message: string;
}

function validateProviderConfig(config: AiProviderConfig) {
  if (!config.baseUrl.trim()) throw new Error("请先填写 Base URL");
  try {
    const url = new URL(providerEndpoint(config));
    if (!/^https?:$/u.test(url.protocol)) throw new Error();
  } catch {
    throw new Error("Base URL 必须是有效的 HTTP 或 HTTPS 地址");
  }
  if (!config.model.trim()) throw new Error("请先填写模型 ID");
  if (!Number.isInteger(config.maxTokens) || config.maxTokens < 1 || config.maxTokens > MAX_MODEL_OUTPUT_TOKENS) {
    throw new Error(`最大输出 Token 必须在 1 到 ${MAX_MODEL_OUTPUT_TOKENS.toLocaleString()} 之间`);
  }
}

const EMPTY_USAGE: AiSessionUsage = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
let sessionUsage: AiSessionUsage = { ...EMPTY_USAGE };
const usageListeners = new Set<() => void>();

const ENDPOINT_SUFFIXES = ["/chat/completions", "/responses", "/messages"] as const;

function providerRoot(value: string) {
  const base = value.trim().replace(/\/+$/, "");
  const suffix = ENDPOINT_SUFFIXES.find((candidate) => base.endsWith(candidate));
  return suffix ? base.slice(0, -suffix.length) : base;
}

export function providerEndpoint(config: AiProviderConfig) {
  const original = config.baseUrl.trim().replace(/\/+$/, "");
  const suffix = config.protocol === "openai-responses"
    ? "/responses"
    : config.protocol === "openai-chat"
      ? "/chat/completions"
      : "/messages";
  if (original.endsWith(suffix)) return original;
  const base = providerRoot(original);
  return base.endsWith("/v1") ? `${base}${suffix}` : `${base}/v1${suffix}`;
}

function modelsEndpoint(config: AiProviderConfig) {
  const base = providerRoot(config.baseUrl);
  return base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
}

function systemPrompt(candidates: EffectDefinition[], materials: AiMaterialCandidate[]) {
  const effects = candidates.map(({ id, name, description, tags }) => ({ id, name, description, tags }));
  const media = materials.map(({ id, name, durationSeconds, width, height }) => ({ id, name, durationSeconds, width, height }));
  const cameras = CAMERA_PRESETS.map(({ id, name, description }) => ({ id, name, description }));
  return `你是视频分镜、动效与素材规划器。根据主题生成中文文章、口播和分镜。只能从以下动效中选择，不得创造其他 effectId：${JSON.stringify(effects)}。每个分镜选择一个 cameraPreset：${JSON.stringify(cameras)}。可用本地视频素材：${JSON.stringify(media)}。仅在素材名称和分镜内容确实相关时填写对应 mediaAssetId，否则填写 null；mediaSourceInSeconds 必须位于素材时长内。口播应自然、简洁，每个分镜时长与内容匹配。客户端会根据每段口播生成带时间字幕，并再次本地匹配动效。`;
}

function userPrompt(input: GeneratePlanInput) {
  return `主题：${input.topic}\n目标时长：约 ${input.durationSeconds} 秒\n风格：${input.style}\n请输出完整方案。`;
}

function requestPayload(config: AiProviderConfig, input: GeneratePlanInput, candidates: EffectDefinition[]) {
  const system = systemPrompt(candidates, input.materials);
  const user = userPrompt(input);
  const schema = createVideoPlanJsonSchema(candidates.map((effect) => effect.id), input.materials.map((material) => material.id));
  if (config.protocol === "openai-responses") {
    return {
      model: config.model,
      store: false,
      max_output_tokens: config.maxTokens,
      input: [
        { role: "developer", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] }
      ],
      text: { format: { type: "json_schema", name: "video_plan", strict: true, schema } }
    };
  }
  if (config.protocol === "openai-chat") {
    return {
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [{ role: "system", content: `${system}\n必须只输出一个 JSON 对象，并严格满足这个 JSON Schema：${JSON.stringify(schema)}` }, { role: "user", content: user }],
      response_format: { type: "json_object" }
    };
  }
  return {
    model: config.model,
    max_tokens: config.maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    tools: [{ name: "create_video_plan", description: "创建结构化视频方案", input_schema: schema }],
    tool_choice: { type: "tool", name: "create_video_plan" }
  };
}

function providerHeaders(config: AiProviderConfig, apiKey: string, includeContentType = true) {
  const headers: Record<string, string> = includeContentType ? { "content-type": "application/json" } : {};
  if (config.protocol === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function cancellationError() {
  const error = new Error("模型请求已取消");
  error.name = "AbortError";
  return error;
}

function normalizedError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw cancellationError();
}

async function callFromBrowser(config: AiProviderConfig, payload: unknown, apiKey: string, signal?: AbortSignal): Promise<ProviderResponse> {
  const response = await fetch(providerEndpoint(config), { method: "POST", headers: providerHeaders(config, apiKey), body: JSON.stringify(payload), signal });
  const body = await response.json().catch(() => ({ error: { message: response.statusText } }));
  return { status: response.status, body };
}

async function callFromDesktop(config: AiProviderConfig, payload: unknown, signal?: AbortSignal): Promise<ProviderResponse> {
  throwIfCancelled(signal);
  const requestId = crypto.randomUUID();
  const cancel = () => { void invoke("cancel_ai_request", { requestId }); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    return await invoke<ProviderResponse>("invoke_ai_provider", { config, payload, requestId });
  } catch (error) {
    if (signal?.aborted) throw cancellationError();
    throw normalizedError(error);
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

async function callProvider(config: AiProviderConfig, payload: unknown, browserApiKey?: string, signal?: AbortSignal) {
  if (isDesktopRuntime()) {
    return await callFromDesktop(config, payload, signal);
  }
  if (!browserApiKey) throw new Error("浏览器预览需要临时输入 API Key");
  return await callFromBrowser(config, payload, browserApiKey, signal);
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function waitForRetry(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    throwIfCancelled(signal);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(cancellationError());
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function withRetry(operation: () => Promise<ProviderResponse>, signal?: AbortSignal, retries = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    throwIfCancelled(signal);
    try {
      const response = await operation();
      if (!shouldRetryStatus(response.status) || attempt === retries) return response;
      lastError = new Error(providerError(response.body, response.status));
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw cancellationError();
      lastError = error;
      if (attempt === retries) throw error;
    }
    await waitForRetry(500 * 2 ** attempt, signal);
  }
  throw lastError;
}

function providerError(body: unknown, status: number) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return `模型请求失败（HTTP ${status}）`;
}

function extractPlan(protocol: AiProtocol, body: unknown): unknown {
  if (!body || typeof body !== "object") throw new Error("模型返回了无效响应");
  if (protocol === "openai-responses") {
    const output = (body as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output ?? [];
    const text = output.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!text) throw new Error("OpenAI 响应中没有结构化文本");
    return JSON.parse(text);
  }
  if (protocol === "openai-chat") {
    const content = (body as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI 兼容响应中没有文本");
    return JSON.parse(content);
  }
  const blocks = (body as { content?: Array<{ type?: string; input?: unknown; text?: string }> }).content ?? [];
  const toolUse = blocks.find((block) => block.type === "tool_use");
  if (toolUse?.input) return toolUse.input;
  const text = blocks.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic 响应中没有方案数据");
  return JSON.parse(text);
}

function nonNegativeToken(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function extractTokenUsage(protocol: AiProtocol, body: unknown, config: Pick<AiProviderConfig, "inputCostPerMillion" | "outputCostPerMillion">): AiTokenUsage {
  const usage = body && typeof body === "object" && "usage" in body ? (body as { usage?: Record<string, unknown> }).usage : undefined;
  const inputTokens = nonNegativeToken(protocol === "openai-chat" ? usage?.prompt_tokens : usage?.input_tokens);
  const outputTokens = nonNegativeToken(protocol === "openai-chat" ? usage?.completion_tokens : usage?.output_tokens);
  const totalTokens = nonNegativeToken(usage?.total_tokens) || inputTokens + outputTokens;
  const inputRate = Math.max(0, Number(config.inputCostPerMillion) || 0);
  const outputRate = Math.max(0, Number(config.outputCostPerMillion) || 0);
  const estimatedCostUsd = inputTokens / 1_000_000 * inputRate + outputTokens / 1_000_000 * outputRate;
  return { inputTokens, outputTokens, totalTokens, estimatedCostUsd };
}

function recordUsage(usage: AiTokenUsage) {
  sessionUsage = {
    requests: sessionUsage.requests + 1,
    inputTokens: sessionUsage.inputTokens + usage.inputTokens,
    outputTokens: sessionUsage.outputTokens + usage.outputTokens,
    totalTokens: sessionUsage.totalTokens + usage.totalTokens,
    estimatedCostUsd: sessionUsage.estimatedCostUsd + usage.estimatedCostUsd
  };
  usageListeners.forEach((listener) => listener());
}

export function getAiSessionUsage(): AiSessionUsage {
  return sessionUsage;
}

export function subscribeAiSessionUsage(listener: () => void) {
  usageListeners.add(listener);
  return () => { usageListeners.delete(listener); };
}

export function resetAiSessionUsage() {
  sessionUsage = { ...EMPTY_USAGE };
  usageListeners.forEach((listener) => listener());
}

export async function generateVideoPlan(
  config: AiProviderConfig,
  input: GeneratePlanInput,
  browserApiKey?: string,
  signal?: AbortSignal
): Promise<GeneratedVideoPlan> {
  validateProviderConfig(config);
  const candidates = retrieveEffects(input.topic);
  const response = await withRetry(() => callProvider(config, requestPayload(config, input, candidates), browserApiKey, signal), signal);
  if (response.status < 200 || response.status >= 300) throw new Error(providerError(response.body, response.status));
  const usage = extractTokenUsage(config.protocol, response.body, config);
  recordUsage(usage);
  const parsed = createAiVideoPlanSchema(candidates.map((effect) => effect.id), input.materials.map((material) => material.id)).parse(extractPlan(config.protocol, response.body));
  const plan = {
    ...parsed,
    scenes: parsed.scenes.map((scene) => ({
      ...scene,
      effectId: retrieveEffects(`${scene.title} ${scene.narration}`, 1)[0]?.id ?? scene.effectId
    }))
  };
  return {
    plan,
    usage
  };
}

async function listModelsFromBrowser(config: AiProviderConfig, apiKey: string, signal?: AbortSignal): Promise<ProviderResponse> {
  const response = await fetch(modelsEndpoint(config), { headers: providerHeaders(config, apiKey, false), signal });
  const body = await response.json().catch(() => ({ error: { message: response.statusText } }));
  return { status: response.status, body };
}

async function listModelsFromDesktop(config: AiProviderConfig, signal?: AbortSignal): Promise<ProviderResponse> {
  throwIfCancelled(signal);
  const requestId = crypto.randomUUID();
  const cancel = () => { void invoke("cancel_ai_request", { requestId }); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    return await invoke<ProviderResponse>("list_ai_models", { config, requestId });
  } catch (error) {
    if (signal?.aborted) throw cancellationError();
    throw normalizedError(error);
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

export async function listProviderModels(config: AiProviderConfig, browserKey?: string, signal?: AbortSignal): Promise<ProviderModelResult> {
  if (!config.baseUrl.trim()) throw new Error("请先填写 Base URL");
  const response = await withRetry(() => {
    if (isDesktopRuntime()) return listModelsFromDesktop(config, signal);
    if (!browserKey) throw new Error("浏览器预览需要临时输入 API Key");
    return listModelsFromBrowser(config, browserKey, signal);
  }, signal);
  if (response.status < 200 || response.status >= 300) throw new Error(providerError(response.body, response.status));
  const data = response.body && typeof response.body === "object" && "data" in response.body
    ? (response.body as { data?: unknown }).data
    : undefined;
  const models = Array.isArray(data)
    ? data.flatMap((item) => item && typeof item === "object" && "id" in item && typeof item.id === "string" ? [item.id] : []).sort()
    : [];
  return { models, message: models.length ? `连接成功，发现 ${models.length} 个模型` : "连接成功；服务未返回模型列表，可手动填写模型 ID" };
}

function connectionProbePayload(config: AiProviderConfig) {
  if (config.protocol === "openai-responses") {
    return { model: config.model, store: false, max_output_tokens: 16, input: "Reply with OK." };
  }
  if (config.protocol === "openai-chat") {
    return { model: config.model, max_tokens: 16, messages: [{ role: "user", content: "Reply with OK." }] };
  }
  return { model: config.model, max_tokens: 16, messages: [{ role: "user", content: "Reply with OK." }] };
}

export async function verifyProviderConfiguration(config: AiProviderConfig, browserKey?: string, signal?: AbortSignal): Promise<ProviderModelResult> {
  validateProviderConfig(config);
  let models: string[] = [];
  let listMessage = "服务未开放模型列表";
  try {
    const listed = await listProviderModels(config, browserKey, signal);
    models = listed.models;
    listMessage = listed.message;
  } catch (error) {
    if (signal?.aborted) throw error;
    listMessage = error instanceof Error ? `模型列表不可用：${error.message}` : "模型列表不可用";
  }
  const response = await withRetry(() => callProvider(config, connectionProbePayload(config), browserKey, signal), signal, 1);
  if (response.status < 200 || response.status >= 300) throw new Error(providerError(response.body, response.status));
  return {
    models,
    message: `配置有效，模型 ${config.model} 已完成实际请求。${listMessage}`
  };
}

export async function saveApiKey(apiKey: string): Promise<void> {
  if (isDesktopRuntime()) {
    await invoke("save_ai_api_key", { apiKey });
    return;
  }
  sessionStorage.setItem("bvideo:ai-api-key", apiKey);
}

export async function hasApiKey(): Promise<boolean> {
  if (isDesktopRuntime()) return await invoke<boolean>("has_ai_api_key");
  return Boolean(sessionStorage.getItem("bvideo:ai-api-key"));
}

export function browserApiKey(): string | undefined {
  return isDesktopRuntime() ? undefined : sessionStorage.getItem("bvideo:ai-api-key") ?? undefined;
}
