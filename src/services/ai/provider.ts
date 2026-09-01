import { Channel, invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "@/services/runtime";
import { BUILTIN_EFFECTS, effectById } from "@/domain/effects";
import {
  aiTimedScriptSchema,
  createAiMotionMatchesSchema,
  createMotionMatchesJsonSchema,
  TIMED_SCRIPT_JSON_SCHEMA,
  type AiMotionMatch,
  type AiTimedScript,
  type AiVideoPlan
} from "@/services/ai/schema";
import type { EffectDefinition } from "@/domain/effects";
import { CAMERA_PRESETS } from "@/domain/camera";
import { mergeLeadingCaptionFragments } from "@/domain/captions";

export type AiProtocol = "openai-responses" | "openai-chat" | "anthropic";

export interface AiProviderConfig {
  protocol: AiProtocol;
  baseUrl: string;
  model: string;
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

export interface GeneratedTimedScript {
  script: AiTimedScript;
  usage: AiTokenUsage;
}

export interface MatchTimelineMotionInput {
  topic: string;
  style: string;
  article?: string;
  captions: AiTimedScript["captions"];
  timelineDurationSeconds: number;
  materials: AiMaterialCandidate[];
}

export interface MatchedTimelineMotion {
  matches: AiVideoPlan["matches"];
  usage: AiTokenUsage;
}

export interface ProviderModelResult {
  models: string[];
  message: string;
}

export interface AiRequestProgress {
  phase: "connecting" | "receiving" | "validating";
  message: string;
  receivedCharacters: number;
}

type AiProgressHandler = (progress: AiRequestProgress) => void;

interface AiTransportStreamEvent {
  requestId: string;
  phase: "connecting" | "connected" | "data" | "completed";
  message: string;
  data?: unknown;
}

interface ProviderStreamState {
  protocol: AiProtocol;
  text: string;
  toolInput: string;
  usage: Record<string, unknown>;
  completedBody?: unknown;
  error?: string;
}

class ProviderStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderStreamError";
  }
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
}

const EMPTY_USAGE: AiSessionUsage = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
let sessionUsage: AiSessionUsage = { ...EMPTY_USAGE };
const usageListeners = new Set<() => void>();

const ENDPOINT_SUFFIXES = ["/chat/completions", "/responses", "/messages"] as const;
const ANTHROPIC_REQUIRED_MAX_TOKENS = 8_192;
const MAX_STREAM_CHARACTERS = 32 * 1024 * 1024;
const MAX_STREAM_FRAME_CHARACTERS = 16 * 1024 * 1024;

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

function motionSystemPrompt(candidates: EffectDefinition[], materials: AiMaterialCandidate[]) {
  const effects = candidates.map(({ id, name, description, tags, recipe, soundCues }) => ({ id, name, description, tags, chartKind: recipe.chart?.kind ?? null, has3d: Boolean(recipe.animation?.keyframes.some((frame) => frame.rotateX || frame.rotateY)), sceneBackground: recipe.sceneBackground?.preset ?? null, hasSound: Boolean(soundCues?.length) }));
  const media = materials.map(({ id, name, durationSeconds, width, height }) => ({ id, name, durationSeconds, width, height }));
  const cameras = CAMERA_PRESETS.map(({ id, name, description }) => ({ id, name, description }));
  return `你是视频时间线动效与多图层编排器。输入已经包含最终逐条时间字幕、绝对时间和所处阶段，请根据内容策略与时间轴策略选择动效、运镜和视频素材。只能使用这些动效：${JSON.stringify(effects)}。可用运镜：${JSON.stringify(cameras)}。可用本地视频素材：${JSON.stringify(media)}。严格遵守：每条字幕默认只用一个主动效；只有第二个动效承载不同且必要的信息时才选择辅助动效，否则 secondaryEffectId 必须为 null。hasSound 为 true 的动效会自动播放提示音，只用于章节切换、重要警告、关键结论或完成确认，不能连续选择，也不能作为辅助动效。动效文字不能照抄完整字幕：primaryText 和 secondaryText 只能是字幕中的关键词、数字、短标题或短结论，中文通常 2 到 12 个字，英文通常 2 到 6 个词；字幕已经承载完整信息，禁止在动效中重复整句。禁止输出模板示例、占位文字或虚构数字。只有字幕包含明确且有意义的数字时才使用图表，并在 chart 中返回字幕中真实出现的 categories、series 和 unit；只有一个数据值时必须使用 counter，line/bar 至少需要两个明确数据值，donut 至少需要两个明确占比，年份不能当作数据值。连续 2 到 5 条字幕表达同一主题、对比、流程或递进关系时，可以组成分阶段动效：同组的每条匹配使用相同的 motionGroupId（只能用小写字母、数字、横线），captionIndex 表示该层开始出现的字幕，persistUntilCaptionIndex 表示该层保持到哪条字幕；组内已有图层继续保留，新字幕只增加必要的新信息。普通单字幕动效的 motionGroupId 和 persistUntilCaptionIndex 必须都是 null。分组不能重叠，不能跨越无关主题，不能超过 5 条字幕。组内图表可以使用该组字幕中真实出现的数据，但仍禁止补全或推测数值。时间轴策略：opening 适合标题、主题建立和轻量推进；middle 适合关键词、数据、解释卡片和克制运镜；ending 适合结论、总结、收束或拉远，不要在连续字幕中重复同一种强动效。场景背景用于建立整段视觉环境，优先用于 opening、章节切换或 ending；选择 sceneBackground 非空的动效时，它必须作为主动效，文字字段留空，需要关键词卡片时才把不同的普通动效作为辅助动效。3D 动效只用于转场或重点强调。x/y 与 secondaryX/secondaryY 应根据画面语义分布在不同区域，避开底部字幕，并避让分组中仍在持续显示的全部已有图层。videoLayers 可以返回 0 到 6 个彼此独立的视频层；不要使用旧的 primary/secondary 素材字段。A-roll 是主叙事，B-roll 是补充画面，presenter 是讲解人，screen 是屏幕录制。教程字幕出现“点击、打开、设置、输入、选择”等操作时，可让 screen 全屏并启用 focus；没有准确鼠标坐标时焦点必须用画面中心 50/50，等待用户手动点选，不能虚构坐标。讲解人适合 presenter-bottom-right + circle；B-roll 默认 volume=0，让 A-roll 或讲解人声音继续。多个视频同屏时使用分屏、画中画或讲解人布局避免完全互相遮挡。形状、布局、转场和运镜只选择协议中的预设，由客户端生成关键帧。所有文字和图表默认使用客户端的半透明自适应背景；backdropPreset 用于选择背景强度。captionIndex 必须与输入字幕索引完全一致。`;
}

function scriptSystemPrompt() {
  return "你是中文视频文案与口播编辑。先生成完整文章与自然口播，再把口播切成连续、无重叠、覆盖目标时长的逐条时间字幕。字幕应适合屏幕阅读，每条只表达一个清晰语义。此阶段不要选择动效、镜头或视频素材。";
}

function structuredRequestPayload(config: AiProviderConfig, system: string, user: string, schema: object, name: string) {
  if (config.protocol === "openai-responses") {
    return {
      model: config.model,
      store: false,
      input: [
        { role: "developer", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] }
      ],
      text: { format: { type: "json_schema", name, strict: true, schema } }
    };
  }
  if (config.protocol === "openai-chat") {
    return {
      model: config.model,
      messages: [{ role: "system", content: `${system}\n必须只输出一个 JSON 对象，并严格满足这个 JSON Schema：${JSON.stringify(schema)}` }, { role: "user", content: user }],
      response_format: { type: "json_object" }
    };
  }
  return {
    model: config.model,
    // Anthropic Messages requires max_tokens; OpenAI-compatible protocols intentionally omit client caps.
    max_tokens: ANTHROPIC_REQUIRED_MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
    tools: [{ name, description: "返回结构化视频编辑数据", input_schema: schema }],
    tool_choice: { type: "tool", name }
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

function streamingPayload(config: AiProviderConfig, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  return config.protocol === "openai-chat"
    ? { ...payload, stream: true, stream_options: { include_usage: true } }
    : { ...payload, stream: true };
}

function streamErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as { error?: unknown; message?: unknown; response?: unknown };
  if (typeof record.message === "string") return record.message;
  if (record.error && typeof record.error === "object" && "message" in record.error && typeof record.error.message === "string") return record.error.message;
  if (record.response && typeof record.response === "object" && "error" in record.response) return streamErrorMessage(record.response);
  return null;
}

function createProviderStreamState(protocol: AiProtocol): ProviderStreamState {
  return { protocol, text: "", toolInput: "", usage: {} };
}

function mergeUsage(state: ProviderStreamState, usage: unknown) {
  if (usage && typeof usage === "object" && !Array.isArray(usage)) state.usage = { ...state.usage, ...usage };
}

function appendStreamText(state: ProviderStreamState, value: unknown) {
  if (typeof value !== "string") return;
  if (state.text.length + value.length > MAX_STREAM_CHARACTERS) throw new ProviderStreamError("模型流式文本超过 32MB 限制");
  state.text += value;
}

function appendToolInput(state: ProviderStreamState, value: unknown) {
  if (typeof value !== "string") return;
  if (state.toolInput.length + value.length > MAX_STREAM_CHARACTERS) throw new ProviderStreamError("模型流式工具参数超过 32MB 限制");
  state.toolInput += value;
}

function receivedStreamCharacters(state: ProviderStreamState) {
  return state.text.length + state.toolInput.length;
}

function acceptProviderStreamEvent(state: ProviderStreamState, value: unknown) {
  if (!value || typeof value !== "object") return;
  const event = value as Record<string, unknown>;
  const type = typeof event.type === "string" ? event.type : "";
  if (type === "error" || type === "response.failed" || type === "response.incomplete") {
    state.error = streamErrorMessage(event) ?? (type === "response.incomplete" ? "模型未能完成流式响应" : "模型流式响应失败");
    return;
  }

  if (state.protocol === "openai-responses") {
    if (type === "response.output_text.delta") appendStreamText(state, event.delta);
    if (type === "response.output_text.done" && !state.text) appendStreamText(state, event.text);
    if (type === "response.completed" && event.response) state.completedBody = event.response;
    if ("output" in event) state.completedBody = event;
    return;
  }

  if (state.protocol === "openai-chat") {
    const choices = Array.isArray(event.choices) ? event.choices : [];
    const first = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : undefined;
    const delta = first?.delta && typeof first.delta === "object" ? first.delta as Record<string, unknown> : undefined;
    const message = first?.message && typeof first.message === "object" ? first.message as Record<string, unknown> : undefined;
    appendStreamText(state, delta?.content);
    if (!state.text) appendStreamText(state, message?.content);
    mergeUsage(state, event.usage);
    return;
  }

  if (type === "message_start" && event.message && typeof event.message === "object") {
    mergeUsage(state, (event.message as Record<string, unknown>).usage);
  } else if (type === "content_block_delta" && event.delta && typeof event.delta === "object") {
    const delta = event.delta as Record<string, unknown>;
    if (delta.type === "text_delta") appendStreamText(state, delta.text);
    if (delta.type === "input_json_delta") appendToolInput(state, delta.partial_json);
  } else if (type === "message_delta") {
    mergeUsage(state, event.usage);
  }
}

function completedProviderStreamBody(state: ProviderStreamState) {
  if (state.error) throw new ProviderStreamError(state.error);
  if (state.completedBody) return state.completedBody;
  if (state.protocol === "openai-responses") {
    if (!state.text) throw new ProviderStreamError("OpenAI 流式响应中没有结构化文本");
    return { output: [{ content: [{ type: "output_text", text: state.text }] }], usage: state.usage };
  }
  if (state.protocol === "openai-chat") {
    if (!state.text) throw new ProviderStreamError("OpenAI 兼容流式响应中没有文本");
    return { choices: [{ message: { content: state.text } }], usage: state.usage };
  }
  if (state.toolInput) {
    try {
      return { content: [{ type: "tool_use", input: JSON.parse(state.toolInput) }], usage: state.usage };
    } catch {
      throw new ProviderStreamError("Anthropic 流式工具参数不是完整 JSON");
    }
  }
  if (!state.text) throw new ProviderStreamError("Anthropic 流式响应中没有方案数据");
  return { content: [{ type: "text", text: state.text }], usage: state.usage };
}

function streamFrame(buffer: string) {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf < 0 && crlf < 0) return null;
  const useCrlf = crlf >= 0 && (lf < 0 || crlf < lf);
  const index = useCrlf ? crlf : lf;
  const delimiterLength = useCrlf ? 4 : 2;
  return { frame: buffer.slice(0, index), rest: buffer.slice(index + delimiterLength) };
}

function streamFrameData(frame: string) {
  const lines = frame.split(/\r?\n/u).flatMap((line) => line.startsWith("data:") ? [line.slice(5).replace(/^ /u, "")] : []);
  return lines.length ? lines.join("\n") : null;
}

function parseProviderStreamData(data: string) {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    throw new ProviderStreamError("模型返回了无法解析的 SSE 事件");
  }
}

function createProgressReporter(handler?: AiProgressHandler) {
  let lastCharacters = 0;
  let lastPhase: AiRequestProgress["phase"] | null = null;
  return (phase: AiRequestProgress["phase"], message: string, receivedCharacters: number, force = false) => {
    if (!handler) return;
    if (!force && phase === lastPhase && receivedCharacters - lastCharacters < 512) return;
    lastPhase = phase;
    lastCharacters = receivedCharacters;
    handler({ phase, message, receivedCharacters });
  };
}

async function readBrowserStream(
  response: Response,
  protocol: AiProtocol,
  report: ReturnType<typeof createProgressReporter>
): Promise<ProviderResponse> {
  const status = response.status;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/event-stream") || !(status >= 200 && status < 300)) {
    const body = await response.json().catch(() => ({ error: { message: response.statusText || "服务返回了非 JSON 响应" } }));
    return { status, body };
  }
  if (!response.body) throw new Error("模型服务没有返回可读取的流");
  report("receiving", "模型已响应，正在接收结果", 0, true);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = createProviderStreamState(protocol);
  let buffer = "";
  let done = false;
  try {
    while (!done) {
      const result = await reader.read();
      done = result.done;
      buffer += decoder.decode(result.value, { stream: !done });
      if (buffer.length > MAX_STREAM_FRAME_CHARACTERS) throw new ProviderStreamError("模型单个流式事件超过 16MB 限制");
      let parsed = streamFrame(buffer);
      while (parsed) {
        buffer = parsed.rest;
        const data = streamFrameData(parsed.frame);
        if (data === "[DONE]") {
          done = true;
          break;
        }
        if (data) acceptProviderStreamEvent(state, parseProviderStreamData(data));
        const receivedCharacters = receivedStreamCharacters(state);
        report("receiving", `正在接收模型结果 · ${Math.max(1, Math.ceil(receivedCharacters / 1024))} KB`, receivedCharacters);
        parsed = streamFrame(buffer);
      }
    }
  } catch (error) {
    if (receivedStreamCharacters(state) > 0 && !(error instanceof ProviderStreamError)) {
      throw new ProviderStreamError("模型流式响应在接收过程中中断，请重新匹配");
    }
    throw error;
  }
  const remaining = streamFrameData(buffer);
  if (remaining && remaining !== "[DONE]") acceptProviderStreamEvent(state, parseProviderStreamData(remaining));
  return { status, body: completedProviderStreamBody(state) };
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

async function callFromBrowser(config: AiProviderConfig, payload: unknown, apiKey: string, signal?: AbortSignal, onProgress?: AiProgressHandler): Promise<ProviderResponse> {
  const report = createProgressReporter(onProgress);
  report("connecting", "正在连接模型服务", 0, true);
  const response = await fetch(providerEndpoint(config), { method: "POST", headers: providerHeaders(config, apiKey), body: JSON.stringify(streamingPayload(config, payload)), signal });
  return await readBrowserStream(response, config.protocol, report);
}

async function callFromDesktop(config: AiProviderConfig, payload: unknown, signal?: AbortSignal, onProgress?: AiProgressHandler): Promise<ProviderResponse> {
  throwIfCancelled(signal);
  const requestId = crypto.randomUUID();
  const state = createProviderStreamState(config.protocol);
  const report = createProgressReporter(onProgress);
  const onEvent = new Channel<AiTransportStreamEvent>();
  onEvent.onmessage = (event) => {
    if (event.data) acceptProviderStreamEvent(state, event.data);
    const receivedCharacters = receivedStreamCharacters(state);
    if (event.phase === "connecting") report("connecting", event.message, receivedCharacters, true);
    else if (event.phase === "connected") report("receiving", event.message, receivedCharacters, true);
    else if (event.phase === "data") report("receiving", `正在接收模型结果 · ${Math.max(1, Math.ceil(receivedCharacters / 1024))} KB`, receivedCharacters);
  };
  const cancel = () => { void invoke("cancel_ai_request", { requestId }); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const response = await invoke<ProviderResponse>("invoke_ai_provider", { config, payload: streamingPayload(config, payload), requestId, onEvent });
    if (response.body && typeof response.body === "object" && "streamed" in response.body) {
      return { ...response, body: completedProviderStreamBody(state) };
    }
    return response;
  } catch (error) {
    if (signal?.aborted) throw cancellationError();
    if (receivedStreamCharacters(state) > 0 && !(error instanceof ProviderStreamError)) {
      throw new ProviderStreamError("模型流式响应在接收过程中中断，请重新匹配");
    }
    throw normalizedError(error);
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

async function callProvider(config: AiProviderConfig, payload: unknown, browserApiKey?: string, signal?: AbortSignal, onProgress?: AiProgressHandler) {
  if (isDesktopRuntime()) {
    return await callFromDesktop(config, payload, signal, onProgress);
  }
  if (!browserApiKey) throw new Error("浏览器预览需要临时输入 API Key");
  return await callFromBrowser(config, payload, browserApiKey, signal, onProgress);
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
      if (error instanceof ProviderStreamError) throw error;
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

function combinedUsage(left: AiTokenUsage, right: AiTokenUsage): AiTokenUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    estimatedCostUsd: left.estimatedCostUsd + right.estimatedCostUsd
  };
}

export function normalizeTimedScript(script: AiTimedScript, durationSeconds: number): AiTimedScript {
  const total = Math.max(0.1, durationSeconds);
  const ordered = mergeLeadingCaptionFragments([...script.captions].sort((left, right) => left.startSeconds - right.startSeconds));
  const weights = ordered.map((caption) => Math.max(0.1, caption.endSeconds - caption.startSeconds));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  const captions = ordered.map((caption, index) => {
    const startSeconds = cursor;
    cursor = index === ordered.length - 1 ? total : Math.min(total, cursor + total * weights[index] / weightTotal);
    return { startSeconds, endSeconds: Math.max(startSeconds + 0.001, cursor), text: caption.text.trim() };
  });
  return { ...script, captions };
}

function timelineStage(startSeconds: number, endSeconds: number, durationSeconds: number) {
  const total = Math.max(0.1, durationSeconds);
  if (startSeconds / total <= 0.1) return "opening";
  if (endSeconds / total >= 0.9) return "ending";
  return "middle";
}

function compactWords(value: string, maximum: number) {
  return value.trim().split(/\s+/u).filter(Boolean).slice(0, maximum).join(" ");
}

export function compactMotionText(candidate: string | null | undefined, caption: string): string {
  const source = (candidate?.trim() || caption.trim()).replace(/^[，。！？、；：,.!?;:\s]+|[，。！？、；：,.!?;:\s]+$/gu, "");
  const normalizedCaption = caption.trim().replace(/[，。！？、；：,.!?;:\s]/gu, "");
  const normalizedSource = source.replace(/[，。！？、；：,.!?;:\s]/gu, "");
  const groundedSource = normalizedSource && normalizedCaption.includes(normalizedSource) ? source : "";
  const containsCjk = /[\p{Script=Han}]/u.test(caption);
  if (groundedSource && normalizedSource !== normalizedCaption && (containsCjk ? groundedSource.length <= 12 : groundedSource.split(/\s+/u).length <= 6)) return groundedSource;
  const quoted = caption.match(/[“「『"]([^”」』"]{2,16})[”」』"]/u)?.[1];
  if (quoted) return quoted.slice(0, 12);
  const numeric = caption.match(/[\p{Script=Han}A-Za-z]{0,6}\s*\d+(?:\.\d+)?\s*[%％万亿年月日元个项倍]?/u)?.[0]?.trim();
  if (numeric) return numeric.slice(0, 14);
  if (!containsCjk) return compactWords(groundedSource || caption, 6).slice(0, 48);
  const chunks = caption
    .replace(/^(随着|通过|因此|但是|目前|现在|未来|同时|最后|最终|接下来|我们|这意味着|可以看到)/u, "")
    .split(/[，。！？、；：,.!?;:\s]|(?:的|了|是|在|与|和|为|将|能够|可以|作为|通过|需要|一个|这种|这个|达到|进入|成为|实现|给出|说明|介绍|包括|采用)/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  const best = chunks.sort((left, right) => Math.min(right.length, 12) - Math.min(left.length, 12))[0];
  const result = (best || groundedSource || caption).slice(0, 12).replace(/[，。！？、；：,.!?;:\s]+$/gu, "");
  return result.replace(/[，。！？、；：,.!?;:\s]/gu, "") === normalizedCaption && result.length > 8 ? result.slice(-8) : result;
}

function comparableMotionText(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase().replace(/[，。！？、；：,.!?;:\s]/gu, "");
}

interface CaptionDatum {
  value: number;
  unit: string;
}

const chineseDigits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const chineseUnits: Record<string, number> = { 十: 10, 百: 100, 千: 1_000, 万: 10_000 };

function chineseNumber(value: string): number | null {
  let section = 0;
  let digit = 0;
  for (const character of value) {
    if (character in chineseDigits) {
      digit = chineseDigits[character];
      continue;
    }
    const unit = chineseUnits[character];
    if (!unit) return null;
    if (unit === 10_000) {
      section = (section + digit) * unit;
      digit = 0;
    } else {
      section += (digit || 1) * unit;
      digit = 0;
    }
  }
  const result = section + digit;
  return Number.isFinite(result) && result > 0 ? result : null;
}

export function captionNumericData(caption: string): CaptionDatum[] {
  const results: CaptionDatum[] = [];
  const occupied = new Set<number>();
  const push = (value: number, unit: string, start: number, length: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    for (let index = start; index < start + length; index += 1) occupied.add(index);
    results.push({ value, unit: unit === "％" ? "%" : unit });
  };
  const arabic = /(\d+(?:\.\d+)?)\s*(万亿元|千亿元|百亿元|十亿元|亿元|万元|万亿|千亿|百亿|十亿|亿|千万|百万|十万|万|千|百|%|％|倍|元|个|项|座|台)?/gu;
  for (const match of caption.matchAll(arabic)) {
    const start = match.index;
    const tail = caption.slice(start + match[0].length, start + match[0].length + 1);
    if (!match[2] && /[年月日时分秒]/u.test(tail)) continue;
    push(Number(match[1]), match[2] ?? "", start, match[0].length);
  }
  const written = /([零〇一二两三四五六七八九十百千万]+)\s*(亿元|万元|万亿|千亿|百亿|十亿|亿|%|％|倍|元|个|项|座|台)?/gu;
  for (const match of caption.matchAll(written)) {
    const start = match.index;
    if (Array.from({ length: match[0].length }, (_, offset) => occupied.has(start + offset)).some(Boolean)) continue;
    if (!match[2] && !/[十百千万]/u.test(match[1])) continue;
    const value = chineseNumber(match[1]);
    if (value !== null) push(value, match[2] ?? "", start, match[0].length);
  }
  return results;
}

function chartEffectKind(effectId: string | null): "counter" | "bar" | "donut" | "line" | null {
  return effectId ? effectById(effectId).recipe.chart?.kind ?? null : null;
}

function chartSeriesMatchesCaption(series: readonly number[], facts: readonly CaptionDatum[]) {
  return series.every((value) => facts.some((fact) => Math.abs(fact.value - value) <= Math.max(0.001, Math.abs(fact.value) * 0.001)));
}

export function normalizeMotionChart(match: AiMotionMatch, caption: string): AiMotionMatch {
  const primaryKind = chartEffectKind(match.primaryEffectId);
  const secondaryKind = chartEffectKind(match.secondaryEffectId);
  const kind = primaryKind ?? secondaryKind;
  if (!kind) return { ...match, chart: null };

  const facts = captionNumericData(caption);
  const chart = match.chart;
  const validSeries = Boolean(chart)
    && chart!.series.length === chart!.categories.length
    && chartSeriesMatchesCaption(chart!.series, facts);
  const valid = kind === "counter"
    ? facts.length >= 1
    : kind === "donut"
      ? validSeries && chart!.series.length >= 2 && chart!.series.every((value) => value >= 0) && /[%％占比比例份额构成]/u.test(caption)
      : validSeries && chart!.series.length >= 2;

  if (valid && chart) {
    const unit = facts.find((fact) => fact.unit)?.unit ?? chart.unit;
    return { ...match, chart: kind === "counter" ? { categories: [chart.categories[0] ?? match.primaryText], series: [facts[0].value], unit: facts[0].unit || unit } : { ...chart, unit } };
  }

  if (primaryKind && facts.length) {
    return {
      ...match,
      primaryEffectId: "test-number-counter",
      chart: { categories: [match.primaryText || "数据"], series: [facts.at(-1)!.value], unit: facts.at(-1)!.unit },
      secondaryEffectId: secondaryKind ? null : match.secondaryEffectId,
      secondaryText: secondaryKind ? null : match.secondaryText
    };
  }
  if (primaryKind) return { ...match, primaryEffectId: "test-keyword-underline", chart: null };
  return { ...match, secondaryEffectId: null, secondaryText: null, chart: null };
}

export function normalizeMotionMatches(
  matches: readonly AiMotionMatch[],
  captions: readonly AiTimedScript["captions"][number][],
  timelineDurationSeconds: number
): AiMotionMatch[] {
  const ordered = [...matches].sort((left, right) => left.captionIndex - right.captionIndex);
  const groupCandidates = new Map<string, { start: number; end: number; invalid: boolean }>();
  for (const match of ordered) {
    if (!match.motionGroupId) continue;
    const end = match.persistUntilCaptionIndex ?? match.captionIndex;
    const current = groupCandidates.get(match.motionGroupId) ?? { start: match.captionIndex, end, invalid: false };
    current.start = Math.min(current.start, match.captionIndex);
    current.end = Math.max(current.end, end);
    current.invalid ||= end < match.captionIndex || end >= captions.length;
    groupCandidates.set(match.motionGroupId, current);
  }
  const validGroups = new Map<string, { start: number; end: number }>();
  let occupiedUntil = -1;
  for (const [groupId, range] of [...groupCandidates].sort((left, right) => left[1].start - right[1].start || left[1].end - right[1].end)) {
    const length = range.end - range.start + 1;
    if (range.invalid || length < 2 || length > 5 || range.start <= occupiedUntil) continue;
    validGroups.set(groupId, { start: range.start, end: range.end });
    occupiedUntil = range.end;
  }

  let previousPrimaryEffectId: string | null = null;
  let previousMotionGroupId: string | null = null;
  return ordered.map((candidate) => {
    const caption = captions[candidate.captionIndex];
    if (!caption) return candidate;
    const group = candidate.motionGroupId ? validGroups.get(candidate.motionGroupId) : undefined;
    const motionGroupId = group ? candidate.motionGroupId! : null;
    const persistUntilCaptionIndex = group
      ? Math.min(group.end, Math.max(candidate.captionIndex, candidate.persistUntilCaptionIndex ?? group.end))
      : null;
    const evidenceText = group
      ? captions.slice(group.start, group.end + 1).map((item) => item.text).join(" ")
      : caption.text;
    let match = normalizeMotionChart(candidate, evidenceText);
    let primaryEffectId = match.primaryEffectId;
    let secondaryEffectId = match.secondaryEffectId;
    let primaryText = primaryEffectId && !effectById(primaryEffectId).recipe.sceneBackground
      ? compactMotionText(match.primaryText, evidenceText)
      : "";
    let secondaryText = secondaryEffectId && !effectById(secondaryEffectId).recipe.sceneBackground
      ? compactMotionText(match.secondaryText, evidenceText)
      : null;

    if (primaryEffectId && effectById(primaryEffectId).category === "标题"
      && !motionGroupId
      && timelineStage(caption.startSeconds, caption.endSeconds, timelineDurationSeconds) === "middle") {
      primaryEffectId = "test-keyword-underline";
      match = { ...match, chart: null };
    }

    if (primaryEffectId && primaryEffectId === previousPrimaryEffectId
      && (!motionGroupId || motionGroupId !== previousMotionGroupId)
      && effectById(primaryEffectId).category !== "数据") {
      primaryEffectId = primaryEffectId === "test-keyword-underline" ? null : "test-keyword-underline";
      primaryText = primaryEffectId ? compactMotionText(primaryText, evidenceText) : "";
      match = { ...match, chart: null };
    }

    if (secondaryEffectId && (effectById(secondaryEffectId).recipe.sceneBackground
      || secondaryEffectId === primaryEffectId
      || (comparableMotionText(secondaryText) && comparableMotionText(secondaryText) === comparableMotionText(primaryText)))) {
      secondaryEffectId = null;
      secondaryText = null;
    }

    previousPrimaryEffectId = primaryEffectId;
    previousMotionGroupId = motionGroupId;
    return {
      ...match,
      motionGroupId,
      persistUntilCaptionIndex,
      primaryEffectId,
      primaryText: primaryEffectId ? primaryText : "",
      secondaryEffectId,
      secondaryText,
      chart: primaryEffectId || secondaryEffectId ? match.chart : null
    };
  });
}

export async function generateTimedScript(
  config: AiProviderConfig,
  input: Omit<GeneratePlanInput, "materials">,
  browserApiKey?: string,
  signal?: AbortSignal,
  onProgress?: AiProgressHandler
): Promise<GeneratedTimedScript> {
  validateProviderConfig(config);
  const user = `主题：${input.topic}\n目标时长：约 ${input.durationSeconds} 秒\n表达风格：${input.style}\n请生成文章、口播和精确时间字幕。`;
  const payload = structuredRequestPayload(config, scriptSystemPrompt(), user, TIMED_SCRIPT_JSON_SCHEMA, "create_timed_script");
  const response = await withRetry(() => callProvider(config, payload, browserApiKey, signal, onProgress), signal);
  if (response.status < 200 || response.status >= 300) throw new Error(providerError(response.body, response.status));
  onProgress?.({ phase: "validating", message: "正在校验文章与时间字幕", receivedCharacters: 0 });
  const usage = extractTokenUsage(config.protocol, response.body, config);
  recordUsage(usage);
  const script = normalizeTimedScript(aiTimedScriptSchema.parse(extractPlan(config.protocol, response.body)), input.durationSeconds);
  return { script, usage };
}

export async function matchTimelineMotion(
  config: AiProviderConfig,
  input: MatchTimelineMotionInput,
  browserApiKey?: string,
  signal?: AbortSignal,
  onProgress?: AiProgressHandler
): Promise<MatchedTimelineMotion> {
  validateProviderConfig(config);
  const candidates = [...BUILTIN_EFFECTS];
  const mediaIds = input.materials.map((material) => material.id);
  const schema = createMotionMatchesJsonSchema(candidates.map((effect) => effect.id), mediaIds);
  const timedCaptions = input.captions.map((caption, captionIndex) => ({
    captionIndex,
    ...caption,
    stage: timelineStage(caption.startSeconds, caption.endSeconds, input.timelineDurationSeconds)
  }));
  const user = `主题或来源：${input.topic}\n表达风格：${input.style}\n内容语义参考：${input.article ?? "无"}\n视频总时长：${input.timelineDurationSeconds} 秒\n最终时间字幕（必须逐条匹配）：${JSON.stringify(timedCaptions)}\n请按内容关键词与时间轴阶段返回动效规划。`;
  const payload = structuredRequestPayload(config, motionSystemPrompt(candidates, input.materials), user, schema, "match_timeline_motion");
  const response = await withRetry(() => callProvider(config, payload, browserApiKey, signal, onProgress), signal);
  if (response.status < 200 || response.status >= 300) throw new Error(providerError(response.body, response.status));
  onProgress?.({ phase: "validating", message: "正在校验动效、分组和字幕数据", receivedCharacters: 0 });
  const usage = extractTokenUsage(config.protocol, response.body, config);
  recordUsage(usage);
  const parsed = createAiMotionMatchesSchema(candidates.map((effect) => effect.id), mediaIds).parse(extractPlan(config.protocol, response.body)).matches;
  const seen = new Set<number>();
  const matches = parsed.filter((match) => {
    if (match.captionIndex >= input.captions.length || seen.has(match.captionIndex)) return false;
    seen.add(match.captionIndex);
    return true;
  });
  return { matches: normalizeMotionMatches(matches, input.captions, input.timelineDurationSeconds), usage };
}

export async function generateVideoPlan(
  config: AiProviderConfig,
  input: GeneratePlanInput,
  browserApiKey?: string,
  signal?: AbortSignal,
  onProgress?: AiProgressHandler
): Promise<GeneratedVideoPlan> {
  const generated = await generateTimedScript(config, input, browserApiKey, signal, onProgress);
  const script = generated.script;
  const matched = await matchTimelineMotion(config, {
    topic: input.topic,
    style: input.style,
    article: script.article,
    captions: script.captions,
    timelineDurationSeconds: input.durationSeconds,
    materials: input.materials
  }, browserApiKey, signal, onProgress);
  const matches = matched.matches ?? [];
  const matchByCaption = new Map(matches.map((match) => [match.captionIndex, match]));
  const scenes: AiVideoPlan["scenes"] = script.captions.map((caption, index) => {
    const match = matchByCaption.get(index);
    return {
      title: caption.text.slice(0, 80), narration: caption.text,
      durationSeconds: caption.endSeconds - caption.startSeconds,
      effectIds: [match?.primaryEffectId, match?.secondaryEffectId].filter((id): id is string => Boolean(id)),
      color: match?.accentColor ?? "#5fa8ff", cameraPreset: match?.cameraPreset ?? "none",
      mediaAssetId: match?.primaryMediaAssetId ?? null, mediaSourceInSeconds: match?.primaryMediaSourceInSeconds ?? 0,
      secondaryMediaAssetId: match?.secondaryMediaAssetId ?? null, secondaryMediaSourceInSeconds: match?.secondaryMediaSourceInSeconds ?? 0,
      mediaLayoutPreset: match?.mediaLayoutPreset ?? "full"
    };
  });
  return { plan: { ...script, matches, scenes }, usage: combinedUsage(generated.usage, matched.usage) };
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
