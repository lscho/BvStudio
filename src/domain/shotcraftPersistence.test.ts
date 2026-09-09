import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "@/domain/project";
import { parseProject, serializeProject } from "@/domain/projectFile";
import { appendShotcraftSequence } from "@/domain/shotcraftPlan";
import { normalizeShotcraftSettings, defaultShotcraftSettings } from "@/domain/shotcraft";

describe("Shotcraft 32 版工程", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-09T00:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("序列、音频分析与卡点时钟可往返保存", () => {
    const project = createEmptyProject();
    const music = { id: "bgm", name: "音乐", kind: "audio" as const, durationUs: 20_000_000, sourcePath: "/fixture/music.mp3" };
    const analysis = { version: 1 as const, durationUs: music.durationUs, bpm: 120, phaseUs: 0, reliableGrid: true, candidates: [], beatsUs: Array.from({ length: 40 }, (_, i) => i * 500_000), hits: [], energy: [] };
    let id = 0;
    appendShotcraftSequence(project, { title: "测试", scenes: [{ shotId: "shotcraft-blur-slide", text: "标题", durationSeconds: 4, copy: [], bindings: [], regions: [], transition: "none", sounds: [], reason: "开场" }] }, [music], { startUs: 0, musicAssetId: music.id, musicSourceInUs: 0, musicVolume: 0.2, beatSync: true, analysis, soundEnabled: false }, () => `generated-${id++}`);
    const restored = parseProject(serializeProject(project));
    expect(restored.schemaVersion).toBe(32);
    expect(restored.musicAnalyses).toEqual(project.musicAnalyses);
    expect(parseProject(serializeProject(restored))).toEqual(restored);
    expect(restored.tracks.flatMap((t) => t.clips).find((c) => c.kind === "composition")).toMatchObject({ shotcraft: { timeMap: expect.any(Array), holdUs: 500_000 } });
  });
  it("31 版无需音乐字段即可迁移，未知版本和畸形分析拒绝", () => {
    const project = createEmptyProject();
    expect(parseProject(JSON.stringify({ ...project, schemaVersion: 31 })).schemaVersion).toBe(32);
    expect(() => parseProject(JSON.stringify({ ...project, schemaVersion: 33 }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...project, musicAnalyses: [{ assetId: "x", analysis: { version: 9 } }] }))).toThrow();
  });
  it("拒绝重复时点、倒退帧、越界区域与畸形转场预备时间", () => {
    const settings = defaultShotcraftSettings("shotcraft-blur-slide");
    for (const timeMap of [[{ timeUs: 0, frame: 0 }, { timeUs: 0, frame: 114 }], [{ timeUs: 0, frame: 0 }, { timeUs: 10, frame: 120 }, { timeUs: 20, frame: 114 }]]) {
      expect(() => normalizeShotcraftSettings({ ...settings, timeMap }, "shotcraft-blur-slide")).toThrow();
    }
    expect(() => normalizeShotcraftSettings({ ...settings, leadInUs: -1 }, "shotcraft-blur-slide")).toThrow();
  });
});
