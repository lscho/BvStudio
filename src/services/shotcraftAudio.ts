import catalog from "@/domain/shotcraftLibrary/audioCatalog.json";
import type { MediaAsset } from "@/domain/project";
import { canUseSound, soundTier, soundTierMap } from "@/domain/soundAccess";
import { saveRecordedAudio } from "@/services/audio";
import { isDesktopRuntime } from "@/services/runtime";
import { localMediaUrl } from "@/services/media";

export const SHOTCRAFT_AUDIO = catalog;
const SHOTCRAFT_AUDIO_TIERS = soundTierMap(SHOTCRAFT_AUDIO);

export function canUseShotcraftAudio(id: string, isPro: boolean): boolean {
  const item = SHOTCRAFT_AUDIO.find((entry) => entry.id === id);
  return Boolean(item && canUseSound(soundTier(item, SHOTCRAFT_AUDIO_TIERS), isPro));
}

export function shotcraftAudioForAccess(isPro: boolean) {
  return SHOTCRAFT_AUDIO.filter((item) => canUseShotcraftAudio(item.id, isPro));
}
const cached = new Map<string, MediaAsset>();
let previewAudio: HTMLAudioElement | undefined;
let previewGeneration = 0;
let clearPreviewListeners: (() => void) | undefined;
export function stopShotcraftAudioPreview() {
  previewGeneration += 1;
  clearPreviewListeners?.(); clearPreviewListeners = undefined;
  previewAudio?.pause(); previewAudio = undefined;
}
export async function previewShotcraftAudio(id: string, signal?: AbortSignal, onEnded?: () => void) {
  stopShotcraftAudioPreview();
  const generation = previewGeneration;
  const asset = await loadShotcraftAudio(id, signal);
  signal?.throwIfAborted();
  if (generation !== previewGeneration) throw new DOMException("已取消试听", "AbortError");
  const audio = new Audio(asset.objectUrl);
  previewAudio = audio;
  const abort = () => { if (previewAudio === audio) stopShotcraftAudioPreview(); };
  const finish = () => { if (previewAudio === audio) { stopShotcraftAudioPreview(); onEnded?.(); } };
  audio.addEventListener("ended", finish, { once: true });
  signal?.addEventListener("abort", abort, { once: true });
  clearPreviewListeners = () => { audio.removeEventListener("ended", finish); signal?.removeEventListener("abort", abort); };
  try { await audio.play(); }
  catch (error) { abort(); throw error; }
}
export async function loadShotcraftAudio(id: string, signal?: AbortSignal): Promise<MediaAsset> {
  const item = catalog.find((entry) => entry.id === id);
  if (!item) throw new Error("未知的 Shotcraft 音频");
  signal?.throwIfAborted();
  const existing = cached.get(id);
  if (existing) return existing;
  const response = await fetch(`${import.meta.env.BASE_URL}shotcraft-audio/${item.file}`, { signal });
  if (!response.ok) throw new Error("音效素材未准备，请运行 npm run prepare:shotcraft-assets 准备素材（见 docs/03-Shotcraft镜头.md），或导入自己的音频");
  const bytes = await response.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
  if (digest !== item.sha256) throw new Error("音频素材缺失或版本不一致，请重新准备 Shotcraft 素材");
  signal?.throwIfAborted();
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const sourcePath = isDesktopRuntime() ? await saveRecordedAudio(blob) : undefined;
  const asset: MediaAsset = { id, name: item.name, kind: "audio", durationUs: item.durationUs, sourcePath, objectUrl: sourcePath ? localMediaUrl(sourcePath) : URL.createObjectURL(blob), missing: false, hasAudio: true };
  cached.set(id, asset);
  signal?.throwIfAborted();
  return asset;
}
