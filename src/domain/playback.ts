export const MAX_PREVIEW_FPS = 30;

export function previewFrameIntervalMs(fpsNumerator: number, fpsDenominator: number) {
  const fps = fpsDenominator > 0 ? fpsNumerator / fpsDenominator : MAX_PREVIEW_FPS;
  return 1000 / Math.max(12, Math.min(MAX_PREVIEW_FPS, Number.isFinite(fps) ? fps : MAX_PREVIEW_FPS));
}

export function previewMediaTimeSeconds(sourceInUs: number, localUs: number, playbackRate: number, loopDurationUs?: number) {
  const rawTimeUs = sourceInUs + localUs * playbackRate;
  const timeUs = loopDurationUs
    ? ((rawTimeUs % Math.max(1, loopDurationUs)) + loopDurationUs) % loopDurationUs
    : rawTimeUs;
  return Math.max(0, timeUs / 1_000_000);
}

export function mediaNeedsSeek(currentTime: number, targetTime: number, playing: boolean, playingToleranceSeconds = 0.45) {
  return Math.abs(currentTime - targetTime) > (playing ? playingToleranceSeconds : 0.02);
}

export interface MediaPlaybackGate {
  pending: Promise<void> | null;
  desired: boolean;
  failed: boolean;
}

export function createMediaPlaybackGate(): MediaPlaybackGate {
  return { pending: null, desired: false, failed: false };
}

export function syncMediaPlayback(media: Pick<HTMLMediaElement, "paused" | "play" | "pause">, playing: boolean, gate: MediaPlaybackGate) {
  gate.desired = playing;
  if (!playing) {
    gate.failed = false;
    if (!media.paused) media.pause();
    return;
  }
  if (!media.paused || gate.pending || gate.failed) return;
  let request: Promise<void>;
  try {
    request = Promise.resolve(media.play());
  } catch {
    gate.failed = true;
    return;
  }
  gate.pending = request;
  void request.catch(() => {
    gate.failed = true;
  }).finally(() => {
    if (gate.pending === request) gate.pending = null;
    if (!gate.desired && !media.paused) media.pause();
  });
}
