import { describe, expect, it } from "vitest";
import { analyseMusicPcm, fitBeatGrid, musicAnalysisSchema, musicCutPoints } from "@/domain/musicBeats";

describe("音乐拍点分析", () => {
  it.each([73, 100, 127.3, 180])("拟合 %s BPM 与非零相位，不误选半速或倍速", (bpm) => {
    const hits = Array.from({ length: 50 }, (_, i) => ({ timeUs: Math.round(123_000 + i * 60_000_000 / bpm), strength: 1 }));
    const grid = fitBeatGrid(hits, 60_000_000);
    expect(grid.bpm).toBeCloseTo(bpm, 2);
    expect(grid.phaseUs).toBeCloseTo(123_000, 0);
    expect(grid.reliableGrid).toBe(true);
  });
  it("PCM 真实攻击点与合成鼓声误差不超过一帧", () => {
    const sr = 22050, pcm = new Float32Array(sr * 8);
    for (let beat = 0; beat < 14; beat += 1) {
      const start = Math.round((0.3 + beat * 0.5) * sr);
      for (let i = 0; i < 2205; i += 1) pcm[start + i] = Math.sin(i / sr * 2 * Math.PI * 90) * Math.exp(-i / 350);
    }
    const result = analyseMusicPcm(pcm, sr);
    expect(result.bpm).toBeCloseTo(120, 0);
    expect(Math.abs(result.phaseUs - 300_000)).toBeLessThan(33_333);
    expect(result.hits.filter((h) => h.kind === "kick")).toHaveLength(14);
  });
  it("静音和过短输入给出可操作的错误", () => {
    expect(() => analyseMusicPcm(new Float32Array(100), 22050)).toThrow("2 秒");
    expect(() => analyseMusicPcm(new Float32Array(22050 * 4), 22050)).toThrow("拍点");
  });
  it("不可靠网格只提供实际鼓点并拒绝乱序或越界", () => {
    const data = { version: 1, durationUs: 4_000_000, bpm: 120, phaseUs: 0, reliableGrid: false, candidates: [], beatsUs: [0, 500_000], hits: [{ timeUs: 200_000, strength: 1, kind: "kick" }], energy: [] };
    expect(musicCutPoints(musicAnalysisSchema.parse(data))).toEqual([200_000]);
    expect(musicAnalysisSchema.safeParse({ ...data, beatsUs: [500_000, 0] }).success).toBe(false);
  });
});
