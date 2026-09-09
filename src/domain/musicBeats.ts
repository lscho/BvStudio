import { z } from "zod";

const timeUs = z.number().int().nonnegative().max(86_400_000_000);
export const musicAnalysisSchema = z.object({
  version: z.literal(1), durationUs: timeUs,
  bpm: z.number().finite().min(30).max(300), phaseUs: timeUs,
  reliableGrid: z.boolean(),
  candidates: z.array(z.object({ bpm: z.number().finite().positive(), match: z.number().min(0).max(1), meanErrorUs: timeUs, driftUs: z.number().int() }).strict()).max(6),
  beatsUs: z.array(timeUs).max(50_000),
  hits: z.array(z.object({ timeUs, strength: z.number().finite().min(0).max(1), kind: z.enum(["kick", "snare", "hihat", "onset"]) }).strict()).max(100_000),
  energy: z.array(z.object({ timeUs, rms: z.number().finite().min(0).max(1) }).strict()).max(100_000)
}).strict().refine((analysis) => analysis.beatsUs.every((time, i, all) => time <= analysis.durationUs && (i === 0 || time > all[i - 1])) && analysis.hits.every((hit) => hit.timeUs <= analysis.durationUs), "音乐拍点顺序或范围无效");
export type MusicAnalysis = z.infer<typeof musicAnalysisSchema>;

function fft(real: Float64Array, imaginary: Float64Array) {
  const count = real.length;
  for (let i = 1, j = 0; i < count; i += 1) {
    let bit = count >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [real[i], real[j]] = [real[j], real[i]]; [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]]; }
  }
  for (let length = 2; length <= count; length <<= 1) {
    const theta = -2 * Math.PI / length;
    for (let start = 0; start < count; start += length) {
      for (let i = 0; i < length / 2; i += 1) {
        const even = start + i, odd = even + length / 2;
        const c = Math.cos(theta * i), s = Math.sin(theta * i);
        const r = real[odd] * c - imaginary[odd] * s, im = real[odd] * s + imaginary[odd] * c;
        real[odd] = real[even] - r; imaginary[odd] = imaginary[even] - im;
        real[even] += r; imaginary[even] += im;
      }
    }
  }
}
function peaks(values: readonly number[], hopUs: number) {
  const result: { timeUs: number; strength: number }[] = [];
  const max = values.reduce((peak, value) => Math.max(peak, value), 1e-9);
  const radius = Math.max(2, Math.round(150_000 / hopUs));
  for (let i = 1; i < values.length - 1; i += 1) {
    if (values[i] < max * 0.06 || values[i] <= values[i - 1] || values[i] < values[i + 1]) continue;
    const local = values.slice(Math.max(0, i - radius), Math.min(values.length, i + radius));
    const mean = local.reduce((sum, value) => sum + value, 0) / local.length;
    if (values[i] < mean * 1.6) continue;
    const previous = result.at(-1);
    const hit = { timeUs: Math.round(i * hopUs), strength: Math.min(1, values[i] / max) };
    if (previous && hit.timeUs - previous.timeUs < 65_000) { if (hit.strength > previous.strength) result[result.length - 1] = hit; }
    else result.push(hit);
  }
  return result;
}
function nearest(sorted: readonly number[], time: number) {
  let low = 0, high = sorted.length;
  while (low < high) { const middle = (low + high) >> 1; if (sorted[middle] < time) low = middle + 1; else high = middle; }
  const a = sorted[Math.max(0, low - 1)], b = sorted[Math.min(sorted.length - 1, low)];
  return Math.abs(a - time) <= Math.abs(b - time) ? a : b;
}

export function fitBeatGrid(hits: readonly { timeUs: number; strength: number }[], durationUs: number) {
  if (hits.length < 4) throw new Error("音乐中没有足够清晰的拍点，请换一段有节奏的音乐或关闭卡点");
  const times = hits.map((hit) => hit.timeUs).sort((a, b) => a - b);
  const histogram = new Map<number, number>();
  for (let i = 0; i < hits.length; i += 1) {
    for (let j = i + 1; j < Math.min(hits.length, i + 9); j += 1) {
      let interval = hits[j].timeUs - hits[i].timeUs;
      if (interval <= 0 || interval > 4_000_000) continue;
      while (interval < 300_000) interval *= 2;
      while (interval > 1_000_000) interval /= 2;
      const bin = Math.round(interval / 2000) * 2000;
      histogram.set(bin, (histogram.get(bin) ?? 0) + Math.sqrt(hits[i].strength * hits[j].strength) / (j - i));
    }
  }
  const periods = [...histogram].sort((a, b) => b[1] - a[1]).slice(0, 3).flatMap(([period]) => [period / 2, period, period * 2]).filter((period) => period >= 200_000 && period <= 2_000_000);
  const candidates = periods.map((initialPeriod) => {
    let phase = times[0], period = initialPeriod, best = -Infinity;
    for (const hit of hits.slice(0, 80)) {
      const candidatePhase = hit.timeUs % period;
      const score = hits.reduce((sum, item) => { const residual = Math.abs(item.timeUs - (candidatePhase + Math.round((item.timeUs - candidatePhase) / period) * period)); return sum + item.strength * Math.exp(-(residual ** 2) / (2 * 20_000 ** 2)); }, 0);
      if (score > best) { phase = candidatePhase; best = score; }
    }
    // Fit only matched attacks; a quiet intro never becomes a fictional first beat.
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const pairs = hits.map((hit) => ({ x: Math.round((hit.timeUs - phase) / period), y: hit.timeUs })).filter((pair) => Math.abs(pair.y - phase - pair.x * period) < 40_000);
      const n = pairs.length, sx = pairs.reduce((sum, p) => sum + p.x, 0), sy = pairs.reduce((sum, p) => sum + p.y, 0);
      const sxx = pairs.reduce((sum, p) => sum + p.x * p.x, 0), sxy = pairs.reduce((sum, p) => sum + p.x * p.y, 0);
      if (n < 4 || n * sxx === sx * sx) break;
      period = (n * sxy - sx * sy) / (n * sxx - sx * sx); phase = (sy - period * sx) / n;
    }
    while (phase < times[0] - 20_000) phase += period;
    const beats: number[] = [], residuals: number[] = [];
    for (let time = phase; time <= times.at(-1)! + 20_000; time += period) {
      const error = nearest(times, time) - time;
      beats.push(Math.round(Math.max(0, time))); residuals.push(error);
    }
    const match = residuals.filter((error) => Math.abs(error) < 20_000).length / Math.max(1, residuals.length);
    const meanErrorUs = Math.round(residuals.reduce((sum, error) => sum + Math.abs(error), 0) / Math.max(1, residuals.length));
    const quarter = Math.max(1, Math.floor(residuals.length / 4));
    const avg = (list: number[]) => list.reduce((sum, n) => sum + n, 0) / Math.max(1, list.length);
    const driftUs = Math.round(avg(residuals.slice(-quarter)) - avg(residuals.slice(0, quarter)));
    const coverage = hits.filter((hit) => Math.abs(nearest(beats, hit.timeUs) - hit.timeUs) < 20_000).length / hits.length;
    return { bpm: 60_000_000 / period, phaseUs: Math.round(Math.max(0, phase)), beatsUs: beats.filter((time) => time <= durationUs), match, meanErrorUs, driftUs, score: match + coverage * 0.7 - meanErrorUs / 200_000 };
  }).filter((candidate) => Number.isFinite(candidate.bpm) && candidate.beatsUs.length > 1).sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  if (!winner) throw new Error("无法拟合音乐拍点，请换一段音乐");
  return { ...winner, reliableGrid: winner.match >= 0.98 && winner.meanErrorUs < 10_000 && Math.abs(winner.driftUs) < 5_000,
    candidates: candidates.slice(0, 6).map(({ bpm, match, meanErrorUs, driftUs }) => ({ bpm, match, meanErrorUs, driftUs })) };
}

// PCM stays in the service/worker boundary; this pure analyser never accesses audio or DOM APIs.
export function analyseMusicPcm(samples: Float32Array, sampleRate: number): MusicAnalysis {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || samples.length < sampleRate * 2 || samples.length > sampleRate * 1800) throw new Error("请选择 2 秒至 30 分钟的音乐");
  const size = 1024, hop = 128, hopUs = hop / sampleRate * 1_000_000;
  const spectra = [[], [], [], []] as number[][];
  const previous = new Float64Array(size / 2), energy: MusicAnalysis["energy"] = [];
  for (let start = 0; start + size <= samples.length; start += hop) {
    const real = new Float64Array(size), imaginary = new Float64Array(size);
    let square = 0;
    for (let i = 0; i < size; i += 1) { const sample = Number.isFinite(samples[start + i]) ? samples[start + i] : 0; real[i] = sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1))); square += sample * sample; }
    fft(real, imaginary);
    const bands = [0, 0, 0, 0];
    for (let i = 1; i < size / 2; i += 1) {
      const hz = i * sampleRate / size, magnitude = Math.hypot(real[i], imaginary[i]);
      const flux = Math.max(0, magnitude - previous[i]); previous[i] = magnitude;
      if (hz >= 40 && hz <= 160) bands[0] += flux;
      if (hz >= 150 && hz <= 500) bands[1] += flux;
      if (hz >= 1000 && hz <= 3000) bands[2] += flux;
      if (hz >= 6000 && hz <= 14000) bands[3] += flux;
    }
    bands.forEach((value, i) => spectra[i].push(value));
    if (start % (hop * 20) === 0) energy.push({ timeUs: Math.round(start / sampleRate * 1_000_000), rms: Math.min(1, Math.sqrt(square / size)) });
  }
  const snare = spectra[1].map((value, i) => Math.sqrt(value * spectra[2][i]));
  const onset = spectra[0].map((value, i) => value + snare[i] + spectra[3][i] * 0.3);
  const durationUs = Math.round(samples.length / sampleRate * 1_000_000);
  // Flux windows look ahead; restore the window-centre clock before fitting.
  const offsetUs = Math.round(size / 2 / sampleRate * 1_000_000);
  const typed = ([spectra[0], snare, spectra[3], onset] as const).flatMap((values, i) => peaks(values, hopUs).map((hit) => ({ ...hit, timeUs: Math.min(durationUs, hit.timeUs + offsetUs), kind: (["kick", "snare", "hihat", "onset"] as const)[i] })));
  const primary = typed.filter((hit) => hit.kind === "kick");
  const grid = fitBeatGrid(primary.length >= 4 ? primary : typed.filter((hit) => hit.kind === "onset"), durationUs);
  return musicAnalysisSchema.parse({ version: 1, durationUs, bpm: grid.bpm, phaseUs: grid.phaseUs, reliableGrid: grid.reliableGrid, candidates: grid.candidates, beatsUs: grid.beatsUs, hits: typed.sort((a, b) => a.timeUs - b.timeUs), energy });
}

export function musicCutPoints(analysis: MusicAnalysis) {
  const points = analysis.reliableGrid ? analysis.beatsUs : analysis.hits.filter((hit) => hit.kind === "kick" || hit.kind === "snare").map((hit) => hit.timeUs);
  return [...new Set(points)].sort((a, b) => a - b);
}
