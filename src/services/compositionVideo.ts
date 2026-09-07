export function waitForVideo(video: HTMLVideoElement, event: "loadeddata" | "seeked", action: () => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      video.removeEventListener(event, ready);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve();
    };
    const ready = () => finish();
    const failed = () => finish(new Error("视频无法解码，请使用 H.264 MP4 或 WebM 文件"));
    const aborted = () => finish(new DOMException("已取消", "AbortError"));
    const timer = setTimeout(() => finish(new Error("视频读取超时，请检查素材并重试")), 15_000);
    video.addEventListener(event, ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted();
    else { try { action(); } catch { failed(); } }
  });
}

export async function loadCompositionVideo(url: string, signal?: AbortSignal) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  try {
    await waitForVideo(video, "loadeddata", () => { video.src = url; video.load(); }, signal);
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) throw new Error("视频时长或尺寸无效");
    return video;
  } catch (error) { releaseCompositionVideo(video); throw error; }
}

export function releaseCompositionVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

export async function seekCompositionVideo(video: HTMLVideoElement, timeUs: number, signal?: AbortSignal) {
  const time = Math.max(0, Math.min(Math.max(0, video.duration - 0.05), timeUs / 1_000_000));
  if (Math.abs(video.currentTime - time) < 0.001 && !video.seeking) return;
  await waitForVideo(video, "seeked", () => { video.currentTime = time; }, signal);
}
