import type { MediaAsset } from "@/domain/project";
import { builtinSoundAssetId, builtinSoundEffectById, type BuiltinSoundEffectId } from "@/domain/soundEffects";
import { saveRecordedAudio } from "@/services/audio";
import { localMediaUrl } from "@/services/media";
import { isDesktopRuntime } from "@/services/runtime";

const sampleRate = 48_000;
const channelCount = 2;
const wavCache = new Map<BuiltinSoundEffectId, Blob>();
const assetCache = new Map<BuiltinSoundEffectId, Promise<MediaAsset>>();
const objectUrlCache = new Map<BuiltinSoundEffectId, string>();
let previewAudio: HTMLAudioElement | null = null;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function envelope(time: number, duration: number, attack = 0.02, release = 0.18) {
  return Math.min(1, time / attack, Math.max(0, (duration - time) / release));
}

function chirp(time: number, duration: number, startFrequency: number, endFrequency: number) {
  const frequencyRate = (endFrequency - startFrequency) / Math.max(0.001, duration);
  return Math.sin(2 * Math.PI * (startFrequency * time + frequencyRate * time * time / 2));
}

function bell(time: number, frequency: number, decay: number) {
  if (time < 0) return 0;
  return (
    Math.sin(2 * Math.PI * frequency * time)
    + Math.sin(2 * Math.PI * frequency * 2.01 * time) * 0.38
    + Math.sin(2 * Math.PI * frequency * 3.98 * time) * 0.16
  ) * Math.exp(-time * decay);
}

function panned(sample: number, pan: number, channel: number) {
  const angle = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  return sample * (channel === 0 ? Math.cos(angle) : Math.sin(angle)) * Math.SQRT2;
}

interface NoiseBands {
  low: number;
  mid: number;
  high: number;
}

function soundSample(soundId: BuiltinSoundEffectId, time: number, duration: number, noise: NoiseBands, channel: number) {
  const progress = time / duration;
  if (soundId === "soft-whoosh") {
    const body = noise.mid * 0.72 + noise.high * 0.22 + chirp(time, duration, 240, 1_300) * 0.14;
    return panned(body * Math.sin(Math.PI * progress) ** 0.7 * envelope(time, duration, 0.05, 0.18), -0.72 + progress * 1.44, channel);
  }
  if (soundId === "quick-swish") {
    const body = noise.high * 0.5 + noise.mid * 0.48 + chirp(time, duration, 2_100, 540) * 0.19;
    return panned(body * Math.sin(Math.PI * progress) ** 0.55 * envelope(time, duration, 0.012, 0.1), 0.85 - progress * 1.7, channel);
  }
  if (soundId === "intro-impact") {
    const localTime = Math.max(0, time - 0.035);
    const preHit = time < 0.035 ? noise.high * time / 0.035 * 0.28 : 0;
    const bass = chirp(localTime, 0.55, 105, 43) * Math.exp(-localTime * 5.2) * 0.86;
    const punch = Math.sin(2 * Math.PI * 185 * localTime) * Math.exp(-localTime * 12) * 0.28;
    const air = (noise.low * 0.72 + noise.high * 0.26) * Math.exp(-localTime * 6.5) * 0.55;
    return panned(preHit + bass + punch + air, channel === 0 ? -0.08 : 0.08, channel) * envelope(time, duration, 0.004, 0.22);
  }
  if (soundId === "clean-click") {
    const pop = chirp(time, 0.13, 480, 980) * Math.exp(-time * 19) * 0.56;
    const body = Math.sin(2 * Math.PI * 185 * time) * Math.exp(-time * 22) * 0.32;
    const snap = noise.high * Math.exp(-time * 38) * 0.24;
    return panned(pop + body + snap, channel === 0 ? -0.12 : 0.12, channel) * envelope(time, duration, 0.002, 0.06);
  }
  if (soundId === "soft-pop") {
    const bass = chirp(time, 0.38, 128, 52) * Math.exp(-time * 7.2) * 0.72;
    const knock = Math.sin(2 * Math.PI * 310 * time) * Math.exp(-time * 17) * 0.24;
    const snap = (noise.mid * 0.48 + noise.high * 0.18) * Math.exp(-time * 15);
    return panned(bass + knock + snap, 0, channel) * envelope(time, duration, 0.003, 0.13);
  }
  if (soundId === "notice-chime") {
    const notes = [[0, 880, -0.45], [0.12, 1_174.66, 0.45], [0.25, 1_567.98, 0]] as const;
    const shimmer = notes.reduce((sum, [start, frequency, pan]) => sum + panned(bell(time - start, frequency, 5.3) * 0.28, pan, channel), 0);
    return (shimmer + panned(noise.high * Math.exp(-time * 8) * 0.06, -0.5 + progress, channel)) * envelope(time, duration, 0.002, 0.2);
  }
  if (soundId === "suspense-rise") {
    const swell = progress ** 1.65 * envelope(time, duration, 0.08, 0.045);
    const pulse = 0.72 + Math.sin(2 * Math.PI * (5 + progress * 5) * time) * 0.28;
    const body = noise.mid * 0.62 + noise.high * 0.26 + chirp(time, duration, 125, 920) * 0.2;
    return panned(body * swell * pulse, -0.38 + progress * 0.76, channel);
  }
  if (soundId === "comic-bounce") {
    const first = chirp(time, 0.3, 520, 155) * Math.exp(-time * 5.8) * 0.56;
    const reboundTime = time - 0.19;
    const rebound = reboundTime > 0 ? chirp(reboundTime, 0.3, 175, 370) * Math.exp(-reboundTime * 7) * 0.38 : 0;
    const springTime = time - 0.34;
    const spring = springTime > 0 ? chirp(springTime, 0.2, 320, 210) * Math.exp(-springTime * 11) * 0.2 : 0;
    return panned(first + rebound + spring, -0.25 + progress * 0.5, channel) * envelope(time, duration, 0.003, 0.12);
  }
  const notes = [[0, 392, -0.32], [0.08, 493.88, 0.32], [0.16, 587.33, 0], [0.36, 783.99, 0.12]] as const;
  const resolve = notes.reduce((sum, [start, frequency, pan]) => sum + panned(bell(time - start, frequency, 3.8) * 0.2, pan, channel), 0);
  return resolve * envelope(time, duration, 0.004, 0.25);
}

export function createBuiltinSoundWav(soundId: BuiltinSoundEffectId): Blob {
  const cached = wavCache.get(soundId);
  if (cached) return cached;
  const definition = builtinSoundEffectById(soundId);
  if (!definition) throw new Error("未知的内置音效");
  const sampleCount = Math.round(definition.durationUs / 1_000_000 * sampleRate);
  const bytesPerFrame = channelCount * 2;
  const buffer = new ArrayBuffer(44 + sampleCount * bytesPerFrame);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * bytesPerFrame, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount * bytesPerFrame, true);
  const randomStates = [0x1a2b3c4d, 0x5f6e7d8c];
  const lowNoise = [0, 0];
  const midNoise = [0, 0];
  const duration = definition.durationUs / 1_000_000;
  for (let index = 0; index < sampleCount; index += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      let randomState = randomStates[channel];
      randomState ^= randomState << 13;
      randomState ^= randomState >>> 17;
      randomState ^= randomState << 5;
      randomStates[channel] = randomState;
      const whiteNoise = ((randomState >>> 0) / 0xffffffff) * 2 - 1;
      lowNoise[channel] += (whiteNoise - lowNoise[channel]) * 0.025;
      midNoise[channel] += (whiteNoise - midNoise[channel]) * 0.18;
      const noise = { low: lowNoise[channel], mid: midNoise[channel] - lowNoise[channel], high: whiteNoise - midNoise[channel] };
      const rawSample = soundSample(soundId, index / sampleRate, duration, noise, channel);
      const sample = Math.tanh(rawSample * 1.15) * 0.82;
      view.setInt16(44 + (index * channelCount + channel) * 2, Math.round(sample * 0x7fff), true);
    }
  }
  const blob = new Blob([buffer], { type: "audio/wav" });
  wavCache.set(soundId, blob);
  return blob;
}

export function builtinSoundObjectUrl(soundId: BuiltinSoundEffectId): string {
  const cached = objectUrlCache.get(soundId);
  if (cached) return cached;
  const objectUrl = URL.createObjectURL(createBuiltinSoundWav(soundId));
  objectUrlCache.set(soundId, objectUrl);
  return objectUrl;
}

export async function createBuiltinSoundAsset(soundId: BuiltinSoundEffectId, options: { refresh?: boolean } = {}): Promise<MediaAsset> {
  if (options.refresh) assetCache.delete(soundId);
  const cached = assetCache.get(soundId);
  if (cached) return cached;
  const request = (async () => {
    const definition = builtinSoundEffectById(soundId);
    if (!definition) throw new Error("未知的内置音效");
    const blob = createBuiltinSoundWav(soundId);
    const sourcePath = isDesktopRuntime() ? await saveRecordedAudio(blob) : undefined;
    return {
      id: builtinSoundAssetId(soundId),
      name: `${definition.name}.wav`,
      kind: "audio" as const,
      durationUs: definition.durationUs,
      sourcePath,
      objectUrl: sourcePath ? localMediaUrl(sourcePath) : builtinSoundObjectUrl(soundId),
      hasAudio: true,
      missing: false
    };
  })();
  assetCache.set(soundId, request);
  request.catch(() => assetCache.delete(soundId));
  return request;
}

export function previewBuiltinSound(soundId: BuiltinSoundEffectId): Promise<void> {
  previewAudio?.pause();
  previewAudio = new Audio(builtinSoundObjectUrl(soundId));
  return previewAudio.play();
}
