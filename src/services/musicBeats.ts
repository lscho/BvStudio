import type { MediaAsset } from "@/domain/project";
import { musicAnalysisSchema, type MusicAnalysis } from "@/domain/musicBeats";

function mp3PayloadWithoutLeadingMetadata(encoded: ArrayBuffer): ArrayBuffer | undefined {
  const bytes = new Uint8Array(encoded);
  if (bytes.length < 14 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return undefined;
  const limit = Math.min(bytes.length - 4, 1024 * 1024);
  for (let index = 10; index <= limit; index += 1) {
    if (bytes[index] !== 0xff || (bytes[index + 1] & 0xe0) !== 0xe0) continue;
    const version = (bytes[index + 1] >> 3) & 0x03;
    const layer = (bytes[index + 1] >> 1) & 0x03;
    const bitrate = bytes[index + 2] >> 4;
    const sampleRate = (bytes[index + 2] >> 2) & 0x03;
    if (version !== 0x01 && layer !== 0 && bitrate !== 0 && bitrate !== 0x0f && sampleRate !== 0x03) return encoded.slice(index);
  }
  return undefined;
}

export async function decodeMusicAudio(encoded: ArrayBuffer): Promise<AudioBuffer> {
  const decode = (bytes: ArrayBuffer) => new OfflineAudioContext(1, 1, 22_050).decodeAudioData(bytes);
  try {
    return await decode(encoded.slice(0));
  } catch (error) {
    const payload = mp3PayloadWithoutLeadingMetadata(encoded);
    if (payload) {
      try {
        return await decode(payload);
      } catch {
        // 统一在下方给出可操作的中文错误，避免直接暴露 WebKit 的 Decoding failed。
      }
    }
    throw new Error("当前运行环境无法解码该音乐，请重新准备音频素材或换一首音乐后重试", { cause: error });
  }
}

export async function analyseMusicAsset(asset: MediaAsset, signal?: AbortSignal): Promise<MusicAnalysis> {
  if (!asset.objectUrl || asset.missing) throw new Error("音乐素材缺失，请重新定位音乐文件");
  if (asset.durationUs < 2_000_000 || asset.durationUs > 1_800_000_000) throw new Error("请选择 2 秒至 30 分钟的音乐");
  signal?.throwIfAborted();
  const response = await fetch(asset.objectUrl, { signal });
  if (!response.ok) throw new Error("无法读取音乐，请重新导入文件");
  if (Number(response.headers.get("content-length")) > 200 * 1024 * 1024) throw new Error("音乐文件超过 200 MB，请裁剪后再分析");
  const encoded = await response.arrayBuffer();
  if (encoded.byteLength > 200 * 1024 * 1024) throw new Error("音乐文件超过 200 MB，请裁剪后再分析");
  const buffer = await decodeMusicAudio(encoded);
  signal?.throwIfAborted();
  if (buffer.duration < 2 || buffer.duration > 1800) throw new Error("请选择 2 秒至 30 分钟的音乐");
  const samples = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) { const data = buffer.getChannelData(channel); for (let i = 0; i < data.length; i += 1) samples[i] += data[i] / buffer.numberOfChannels; }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./musicBeats.worker.ts", import.meta.url), { type: "module" });
    const stop = () => { worker.terminate(); signal?.removeEventListener("abort", abort); };
    const abort = () => { stop(); reject(new DOMException("已取消音乐分析", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.onerror = () => { stop(); reject(new Error("音乐分析失败，请重试")); };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      stop();
      const value = event.data;
      if (!value || typeof value !== "object") { reject(new Error("音乐分析结果无效")); return; }
      if ("error" in value && typeof value.error === "string") { reject(new Error(value.error)); return; }
      const result = musicAnalysisSchema.safeParse("analysis" in value ? value.analysis : undefined);
      if (!result.success) reject(new Error("音乐分析结果无效，请重新分析")); else resolve(result.data);
    };
    worker.postMessage({ samples, sampleRate: buffer.sampleRate }, [samples.buffer]);
  });
}
