import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "@/services/runtime";

export interface SystemVoice {
  id: string;
  name: string;
  language: string;
}

export function listSystemVoices(): Promise<SystemVoice[]> {
  if (!isDesktopRuntime()) return Promise.resolve([]);
  return invoke("list_system_voices");
}

export function synthesizeSpeech(text: string, voice: string, rate: number): Promise<string> {
  if (!isDesktopRuntime()) return Promise.reject(new Error("系统配音需要在桌面客户端中运行"));
  return invoke("synthesize_speech", { text, voice, rate: Math.round(rate) });
}

function recordingExtension(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("无法读取录音数据"));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

export async function saveRecordedAudio(blob: Blob): Promise<string> {
  if (!isDesktopRuntime()) throw new Error("保存录音需要在桌面客户端中运行");
  return invoke("save_recording", { dataBase64: await blobBase64(blob), extension: recordingExtension(blob.type) });
}

export function preferredRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
}
