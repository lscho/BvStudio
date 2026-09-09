import type { MediaAsset } from "@/domain/project";
import { musicAnalysisSchema, type MusicAnalysis } from "@/domain/musicBeats";

export async function analyseMusicAsset(asset: MediaAsset, signal?: AbortSignal): Promise<MusicAnalysis> {
  if (!asset.objectUrl || asset.missing) throw new Error("音乐素材缺失，请重新定位音乐文件");
  if (asset.durationUs < 2_000_000 || asset.durationUs > 1_800_000_000) throw new Error("请选择 2 秒至 30 分钟的音乐");
  signal?.throwIfAborted();
  const response = await fetch(asset.objectUrl, { signal });
  if (!response.ok) throw new Error("无法读取音乐，请重新导入文件");
  if (Number(response.headers.get("content-length")) > 200 * 1024 * 1024) throw new Error("音乐文件超过 200 MB，请裁剪后再分析");
  const encoded = await response.arrayBuffer();
  if (encoded.byteLength > 200 * 1024 * 1024) throw new Error("音乐文件超过 200 MB，请裁剪后再分析");
  const context = new OfflineAudioContext(1, 1, 22050);
  const buffer = await context.decodeAudioData(encoded);
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
