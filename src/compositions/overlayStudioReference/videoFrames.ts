export interface ReferenceVideoTiming {
  startSeconds: number;
  clipSeconds: number;
  rate: number;
  durationSeconds: number;
  loop: boolean;
}

export function referenceVideoTime(timelineSeconds: number, timing: ReferenceVideoTiming) {
  const startSeconds = Number.isFinite(timing.startSeconds) ? timing.startSeconds : 0;
  const clipSeconds = Number.isFinite(timing.clipSeconds) ? Math.max(0, timing.clipSeconds) : 0;
  const rate = Number.isFinite(timing.rate) && timing.rate > 0 ? timing.rate : 1;
  let target = clipSeconds + Math.max(0, timelineSeconds - startSeconds) * rate;
  if (!Number.isFinite(timing.durationSeconds) || timing.durationSeconds <= 0) return Math.max(0, target);
  if (timing.loop && target > timing.durationSeconds) {
    const span = Math.max(timing.durationSeconds - clipSeconds, 0.1);
    target = clipSeconds + ((target - clipSeconds) % span);
  }
  return Math.min(Math.max(target, 0), Math.max(0, timing.durationSeconds - 0.05));
}

function timingFor(video: HTMLVideoElement): Omit<ReferenceVideoTiming, "durationSeconds"> {
  return {
    startSeconds: Number(video.dataset.tStart) || 0,
    clipSeconds: Number(video.dataset.fxClip) || 0,
    rate: Number(video.dataset.fxRate) || 1,
    loop: video.hasAttribute("data-fx-loop")
  };
}

export function alignReferenceVideo(video: HTMLVideoElement, timelineSeconds: number) {
  video.pause();
  if (!Number.isFinite(video.duration) || video.duration <= 0) return false;
  const target = referenceVideoTime(timelineSeconds, { ...timingFor(video), durationSeconds: video.duration });
  if (Math.abs(video.currentTime - target) > 0.001) video.currentTime = target;
  return true;
}

function aborted(signal: AbortSignal) {
  return signal.reason instanceof Error ? signal.reason : new DOMException("操作已取消", "AbortError");
}

function waitForMedia(video: HTMLVideoElement, events: readonly string[], signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(aborted(signal));
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("动效内嵌视频帧读取超时，请检查视频路径或格式")), 5_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      for (const event of events) video.removeEventListener(event, ready);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", cancelled);
    };
    const finish = (error?: Error) => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const ready = () => finish();
    const failed = () => finish(new Error("动效内嵌视频无法读取，请检查视频路径或格式"));
    const cancelled = () => finish(signal ? aborted(signal) : undefined);
    for (const event of events) video.addEventListener(event, ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", cancelled, { once: true });
  });
}

async function prepareReferenceVideoFrame(video: HTMLVideoElement, timelineSeconds: number, signal?: AbortSignal) {
  video.pause();
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    const metadata = waitForMedia(video, ["loadedmetadata"], signal);
    video.load();
    await metadata;
  }
  const target = referenceVideoTime(timelineSeconds, { ...timingFor(video), durationSeconds: video.duration });
  if (Math.abs(video.currentTime - target) <= 0.001 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const decoded = waitForMedia(video, ["seeked", "loadeddata"], signal);
  video.currentTime = target;
  await decoded;
}

export async function prepareReferenceVideoFrames(host: HTMLElement, timelineSeconds: number, signal?: AbortSignal) {
  await Promise.all(Array.from(host.querySelectorAll<HTMLVideoElement>("video[data-fx-video]"), (video) => (
    prepareReferenceVideoFrame(video, timelineSeconds, signal)
  )));
}
