import { analyseMusicPcm } from "@/domain/musicBeats";
self.onmessage = (event: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
  try { self.postMessage({ analysis: analyseMusicPcm(event.data.samples, event.data.sampleRate) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "音乐分析失败" }); }
};
