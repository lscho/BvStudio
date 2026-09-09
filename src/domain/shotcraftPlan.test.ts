import { describe, expect, it } from "vitest";
import { compileShotcraftSequence, SHOTCRAFT_ANCHORS, validateShotcraftPlan, type ShotcraftPlan } from "@/domain/shotcraftPlan";
import type { MediaAsset } from "@/domain/project";
import type { MusicAnalysis } from "@/domain/musicBeats";
import { defaultShotcraftSettings, shotcraftEventTimeUs, shotcraftFrame, shotcraftFrameTimeUs, shotcraftTransitionCutRatio } from "@/domain/shotcraft";
import { libraryShot } from "@/domain/shotcraftLibrary/catalog";
import audioCatalog from "@/domain/shotcraftLibrary/audioCatalog.json";

export const planFixture = (): ShotcraftPlan => ({ title: "验证", scenes: Array.from({ length: 3 }, (_, i) => ({ shotId: "shotcraft-blur-slide", durationSeconds: 4.8, text: "内容", copy: [], bindings: [], regions: [], transition: i ? "flash-cut" : "none", sounds: [], reason: "标题展示" })) });
export const musicFixture: MediaAsset = { id: "music-test", kind: "audio", name: "音乐", durationUs: 30_000_000, hasAudio: true };
export const analysisFixture: MusicAnalysis = { version: 1, durationUs: 30_000_000, bpm: 100, phaseUs: 0, reliableGrid: true, candidates: [], beatsUs: Array.from({ length: 50 }, (_, i) => i * 600_000), hits: [], energy: [] };
export const optionsFixture = { startUs: 1_000_000, musicAssetId: musicFixture.id, musicSourceInUs: 0, musicVolume: 0.2, beatSync: true, analysis: analysisFixture, soundEnabled: false };
let id = 0; const newId = () => `id-${++id}`;

describe("AI 分镜编译", () => {
  it("音效锚点区分实际源帧与持续时间、尺寸和归一化倍率", () => {
    expect(SHOTCRAFT_ANCHORS["shotcraft-anime-impact"]).toContainEqual({ key: "impact", frame: 30, category: "impact" });
    expect(SHOTCRAFT_ANCHORS["shotcraft-neon-frame-forerun-orbit"]).toContainEqual({ key: "land", frame: 66.16, category: "impact" });
    expect(SHOTCRAFT_ANCHORS["shotcraft-autolayout-gap-dial"].some((anchor) => anchor.key === "block_h")).toBe(false);
  });
  it("把实际转场切换帧钉到拍点，入场动作等转场结束再开始", () => {
    const result = compileShotcraftSequence(planFixture(), [musicFixture], optionsFixture, newId);
    const clips = result.tracks[0].clips;
    for (const clip of clips.slice(1)) {
      if (clip.kind !== "composition") throw new Error("镜头类型错误");
      const transition = clip.shotcraft!.transition;
      const cut = clip.startUs - optionsFixture.startUs + Math.round(shotcraftTransitionCutRatio(transition.preset) * transition.durationUs);
      expect(Math.min(...analysisFixture.beatsUs.map((beat) => Math.abs(beat - cut)))).toBeLessThan(2);
      expect(shotcraftFrameTimeUs(0, clip.shotcraft!)).toBe(transition.durationUs);
    }
  });
  it("拒绝重复槽、超限素材和未知镜头", () => {
    const plan = planFixture();
    plan.scenes[0] = { ...plan.scenes[0], shotId: "shotcraft-card-stack", bindings: [{ slotId: "cards", assetIds: ["a", "a"] }, { slotId: "cards", assetIds: ["a", "a"] }] };
    const asset: MediaAsset = { id: "a", kind: "image", name: "图片", durationUs: 0 };
    expect(() => validateShotcraftPlan(plan, [asset])).toThrow("重复");
    expect(() => validateShotcraftPlan({ ...plan, scenes: [{ ...plan.scenes[0], shotId: "unknown" }] }, [])).toThrow();
  });
  it("没有有效拍点时明确拒绝，不宣称已卡点", () => {
    expect(() => compileShotcraftSequence(planFixture(), [musicFixture], { ...optionsFixture, analysis: { ...analysisFixture, reliableGrid: false, beatsUs: [], hits: [] } }, newId)).toThrow("拍点");
  });
  it("拒绝缺失的镜头文案，防止把演示内容带入 AI 分镜", () => {
    const plan = planFixture();
    plan.scenes[0].shotId = "shotcraft-marker-underline-title";
    expect(() => validateShotcraftPlan(plan, [])).toThrow("文案");
    plan.scenes[0].copy = libraryShot(plan.scenes[0].shotId)!.texts.map((field) => ({ key: field.key, value: "用户提供的内容" }));
    expect(validateShotcraftPlan(plan, []).scenes[0].copy).toHaveLength(3);
  });
  it("一次报告各镜头的文案问题和允许字段，让云端能完整修复", () => {
    const plan = planFixture();
    plan.scenes[0] = { ...plan.scenes[0], shotId: "shotcraft-spectrum-morph-ui", copy: [{ key: "copy0", value: "节奏" }, { key: "copy1", value: "多余" }] };
    plan.scenes[1] = { ...plan.scenes[1], shotId: "shotcraft-marker-underline-title", copy: [{ key: "copy0", value: "标题" }, { key: "copy0", value: "重复" }] };
    expect(() => validateShotcraftPlan(plan, [])).toThrow(/scenes[\s\S]*0[\s\S]*shotcraft-spectrum-morph-ui[\s\S]*copy1[\s\S]*copy0[\s\S]*1[\s\S]*shotcraft-marker-underline-title[\s\S]*重复[\s\S]*copy1, copy2/u);
  });
  it("素材、区域与声音校验错误包含镜头位置和具体约束", () => {
    const plan = planFixture();
    plan.scenes[0].shotId = "shotcraft-cursor-flyover";
    plan.scenes[1].sounds = [{ event: "unknown", soundId: audioCatalog.find((item) => item.kind === "sound" && item.autoEligible)!.id, volume: 0.2 }];
    expect(() => validateShotcraftPlan(plan, [])).toThrow(/bindings[\s\S]*regions[\s\S]*4[\s\S]*sounds[\s\S]*unknown[\s\S]*title/u);
  });
  it("停留之后的音效事件使用包含转场和停留的实际时钟", () => {
    const settings = { ...defaultShotcraftSettings("shotcraft-spotlight-hero-card"), leadInUs: 600_000, holdUs: 500_000, timeMap: [{ timeUs: 0, frame: 0 }, { timeUs: 4_000_000, frame: 145 }] };
    const eventUs = shotcraftEventTimeUs("shotcraft-spotlight-hero-card", 130, settings);
    expect(eventUs).toBe(shotcraftFrameTimeUs(130, settings) + 500_000);
    expect(shotcraftFrame("shotcraft-spotlight-hero-card", eventUs, settings)).toBe(130);
    expect(shotcraftEventTimeUs("shotcraft-spotlight-hero-card", 112, settings)).toBe(shotcraftFrameTimeUs(112, settings));
  });
  it("音乐源入点计入实际切点，不把原曲的零点当成片段零点", () => {
    const offset = 230_000;
    const result = compileShotcraftSequence(planFixture(), [musicFixture], { ...optionsFixture, musicSourceInUs: offset }, newId);
    for (const clip of result.tracks[0].clips.slice(1)) {
      if (clip.kind !== "composition") throw new Error("镜头类型错误");
      const transition = clip.shotcraft!.transition;
      const sourceCut = clip.startUs - optionsFixture.startUs + offset + Math.round(shotcraftTransitionCutRatio(transition.preset) * transition.durationUs);
      expect(Math.min(...analysisFixture.beatsUs.map((beat) => Math.abs(beat - sourceCut)))).toBeLessThan(2);
    }
  });
  it("短音乐片段的淡入淡出仍为整数微秒", () => {
    const plan = planFixture();
    plan.scenes = [{ ...plan.scenes[0], durationSeconds: 1.000003 }];
    const result = compileShotcraftSequence(plan, [musicFixture], { ...optionsFixture, beatSync: false }, newId);
    const music = result.tracks.at(-1)!.clips[0];
    if (music.kind !== "audio") throw new Error("音频类型错误");
    expect(Number.isInteger(music.fadeInUs)).toBe(true);
    expect(Number.isInteger(music.fadeOutUs)).toBe(true);
  });
  it("音乐分析必须匹配素材时长，音乐源起点不足时拒绝", () => {
    expect(() => compileShotcraftSequence(planFixture(), [musicFixture], { ...optionsFixture, analysis: { ...analysisFixture, durationUs: 60_000_000 } }, newId)).toThrow("分析");
    expect(() => compileShotcraftSequence(planFixture(), [musicFixture], { ...optionsFixture, musicSourceInUs: 29_000_000 }, newId)).toThrow();
  });
  it("音效的实际峰值与镜头动作对齐，并保留尾音", () => {
    const info = audioCatalog.find((item) => item.id.endsWith("impact-cine-big"))!;
    const sound: MediaAsset = { id: info.id, kind: "audio", name: info.name, durationUs: info.durationUs };
    const plan = planFixture();
    plan.scenes[0].sounds = [{ event: "title", soundId: info.id, volume: 0.3 }];
    const result = compileShotcraftSequence(plan, [sound], { ...optionsFixture, musicAssetId: undefined, beatSync: false, soundEnabled: true }, newId);
    const clip = result.tracks[0].clips[0], audio = result.tracks[1].clips[0];
    if (clip.kind !== "composition" || audio.kind !== "audio" || !("sourcePeakUs" in info)) throw new Error("缺少音频攻击元数据");
    expect(audio.startUs + info.sourcePeakUs! - audio.sourceInUs).toBe(clip.startUs + shotcraftFrameTimeUs(14, clip.shotcraft!));
    expect(audio.durationUs).toBeGreaterThan(100_000);
  });
});
