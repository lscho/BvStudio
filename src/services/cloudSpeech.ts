import { Channel, invoke } from "@tauri-apps/api/core";
import type { AsrTranscript } from "@/services/asr";
import { isDesktopRuntime } from "@/services/runtime";
import type { CloudSpeechConfig } from "@/services/storage";
import { probeMedia } from "@/services/media";

export const MIMO_TTS_MODELS = [
  { value: "mimo-v2.5-tts", label: "MiMo V2.5 TTS · 预置音色" },
  { value: "mimo-v2.5-tts-voicedesign", label: "MiMo V2.5 TTS · 音色设计" }
] as const;

export const MIMO_TTS_VOICES = [
  { value: "mimo_default", label: "MiMo 默认" },
  { value: "冰糖", label: "冰糖 · 中文女声" },
  { value: "茉莉", label: "茉莉 · 中文女声" },
  { value: "苏打", label: "苏打 · 中文男声" },
  { value: "白桦", label: "白桦 · 中文男声" },
  { value: "Mia", label: "Mia · 英文女声" },
  { value: "Chloe", label: "Chloe · 英文女声" },
  { value: "Milo", label: "Milo · 英文男声" },
  { value: "Dean", label: "Dean · 英文男声" }
] as const;

export interface CloudSpeechProgressEvent {
  jobId: string;
  phase: "extracting" | "uploading" | "ready";
  message: string;
  progress: number;
}

export interface CloudSpeechJob<T> {
  jobId: string;
  result: Promise<T>;
}

export interface CloudSpeechTrackProgress {
  completed: number;
  total: number;
  message: string;
}

export interface CloudSpeechTrackResult {
  path: string;
  durationUs: number;
  segmentDurationsUs: number[];
}

const browserKeyName = "bvideo:speech-api-key";

function providerRoot(value: string) {
  const base = value.trim().replace(/\/+$/u, "");
  return base.endsWith("/chat/completions") ? base.slice(0, -"/chat/completions".length) : base;
}

export function cloudSpeechEndpoint(config: CloudSpeechConfig, resource: "chat/completions" | "models" = "chat/completions") {
  const root = providerRoot(config.baseUrl);
  return root.endsWith("/v1") ? `${root}/${resource}` : `${root}/v1/${resource}`;
}

export function validateCloudSpeechTtsConfig(config: CloudSpeechConfig): void {
  if (!config.ttsModel.trim()) throw new Error("TTS 模型 ID 不能为空");
  if (config.ttsModel === "mimo-v2.5-tts-voicedesign") {
    if (!config.ttsStyle.trim()) throw new Error("音色设计模型必须填写音色设计描述");
    return;
  }
  if (!config.ttsVoice.trim()) throw new Error("预置音色不能为空");
}

export async function saveSpeechApiKey(apiKey: string): Promise<void> {
  if (!apiKey.trim()) throw new Error("云端语音 API Key 不能为空");
  if (isDesktopRuntime()) {
    await invoke("save_speech_api_key", { apiKey: apiKey.trim() });
    return;
  }
  sessionStorage.setItem(browserKeyName, apiKey.trim());
}

export async function hasSpeechApiKey(): Promise<boolean> {
  if (isDesktopRuntime()) return invoke<boolean>("has_speech_api_key");
  return Boolean(sessionStorage.getItem(browserKeyName));
}

export async function verifyCloudSpeech(config: CloudSpeechConfig, browserKey?: string): Promise<string> {
  if (isDesktopRuntime()) return invoke("verify_cloud_speech", { config });
  const key = browserKey?.trim() || sessionStorage.getItem(browserKeyName);
  if (!key) throw new Error("请先填写云端语音 API Key");
  const response = await fetch(cloudSpeechEndpoint(config, "models"), { headers: { authorization: `Bearer ${key}` } });
  const body = await response.json().catch(() => ({})) as { data?: Array<{ id?: unknown }>; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `云端语音连接失败（HTTP ${response.status}）`);
  const models = new Set((body.data ?? []).map((item) => item.id).filter((id): id is string => typeof id === "string"));
  const missing = [config.ttsModel, config.asrModel].filter((model) => !models.has(model));
  if (missing.length) throw new Error(`服务端未返回配置的语音模型：${missing.join("、")}`);
  return `凭证与语音模型可用，共返回 ${models.size} 个模型；此检查不验证推理余额`;
}

export function synthesizeCloudSpeech(config: CloudSpeechConfig, text: string): Promise<string> {
  validateCloudSpeechTtsConfig(config);
  if (!isDesktopRuntime()) return Promise.reject(new Error("云端配音需要在桌面客户端中运行"));
  return invoke("synthesize_cloud_speech", { config, text });
}

export function mergeCloudSpeechSegments(paths: string[]): Promise<string> {
  if (!isDesktopRuntime()) return Promise.reject(new Error("逐句配音合并需要在桌面客户端中运行"));
  return invoke("merge_cloud_speech_segments", { paths });
}

function reconcileSegmentDurations(durationsUs: readonly number[], totalDurationUs: number): number[] {
  const normalized = durationsUs.map((durationUs) => Math.max(1, Math.round(durationUs)));
  if (!normalized.length) return [];
  const expectedDurationUs = normalized.reduce((sum, durationUs) => sum + durationUs, 0);
  const deltaUs = Math.round(totalDurationUs) - expectedDurationUs;
  const toleranceUs = Math.max(250_000, normalized.length * 20_000);
  if (Math.abs(deltaUs) > toleranceUs) {
    throw new Error("合并后的配音时长异常，部分字幕语音可能缺失，请重新生成");
  }
  normalized[normalized.length - 1] = Math.max(1, normalized[normalized.length - 1] + deltaUs);
  return normalized;
}

export async function synthesizeCloudSpeechTrack(
  config: CloudSpeechConfig,
  segmentTexts: readonly string[],
  onProgress?: (progress: CloudSpeechTrackProgress) => void
): Promise<CloudSpeechTrackResult> {
  const texts = segmentTexts.map((text) => text.trim());
  if (!texts.length || texts.some((text) => !text)) throw new Error("字幕配音文本不能为空");
  if (texts.length > 100) throw new Error("单次最多生成 100 条字幕配音");
  const paths: string[] = [];
  const durationsUs: number[] = [];
  for (let index = 0; index < texts.length; index += 1) {
    onProgress?.({ completed: index, total: texts.length, message: `正在生成第 ${index + 1}/${texts.length} 条字幕` });
    const path = await synthesizeCloudSpeech(config, texts[index]);
    const metadata = await probeMedia(path);
    if (!metadata.hasAudio || metadata.durationUs <= 0) throw new Error(`第 ${index + 1} 条字幕没有生成有效音频`);
    paths.push(path);
    durationsUs.push(metadata.durationUs);
  }
  onProgress?.({ completed: texts.length, total: texts.length, message: texts.length > 1 ? "正在合并字幕配音" : "字幕配音已生成" });
  if (paths.length === 1) {
    return { path: paths[0], durationUs: durationsUs[0], segmentDurationsUs: durationsUs };
  }
  const path = await mergeCloudSpeechSegments(paths);
  const metadata = await probeMedia(path);
  if (!metadata.hasAudio || metadata.durationUs <= 0) throw new Error("合并后的字幕配音无效");
  return {
    path,
    durationUs: metadata.durationUs,
    segmentDurationsUs: reconcileSegmentDurations(durationsUs, metadata.durationUs)
  };
}

export function startCloudMediaTranscription(
  path: string,
  durationUs: number,
  config: CloudSpeechConfig,
  onProgress: (event: CloudSpeechProgressEvent) => void
): CloudSpeechJob<AsrTranscript> {
  if (!isDesktopRuntime()) return { jobId: "", result: Promise.reject(new Error("云端字幕识别需要在桌面客户端中运行")) };
  const jobId = crypto.randomUUID();
  const channel = new Channel<CloudSpeechProgressEvent>();
  channel.onmessage = onProgress;
  return { jobId, result: invoke("transcribe_cloud_media", { path, durationUs, config, jobId, onEvent: channel }) };
}

export function cancelCloudSpeechRequest(jobId: string): Promise<boolean> {
  if (!jobId || !isDesktopRuntime()) return Promise.resolve(false);
  return invoke("cancel_cloud_speech_request", { jobId });
}
