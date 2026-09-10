import { describe, expect, it } from "vitest";
import { assertStoryboardMatches, assertStoryboardSelection, subtitleShotcraftEligible } from "@/services/ai/storyboard";
import { normalizeMotionMatches, type MatchTimelineMotionInput } from "@/services/ai/provider";
import type { AiMotionMatch, AiMotionSelection } from "@/services/ai/schema";

const input: MatchTimelineMotionInput = { topic: "改片", style: "简洁", captions: [{ startSeconds: 0, endSeconds: 4, text: "生成很快" }, { startSeconds: 4, endSeconds: 8, text: "改片很慢" }], timelineDurationSeconds: 8, materials: [], storyboard: { mode: "auto", prompt: "" } };
const selection: AiMotionSelection = { segments: [{ segmentId: "opening", startCaptionIndex: 0, endCaptionIndex: 1, title: "痛点", intent: "hook", evidenceKinds: ["none"], roll: "b-roll", primaryEffectId: "shotcraft-blur-slide", secondaryEffectId: null, materialNeed: "", selectionReason: "字幕对比生成和修改" }] };
const match: AiMotionMatch = { captionIndex: 0, motionGroupId: "opening", persistUntilCaptionIndex: 1, primaryEffectId: "shotcraft-blur-slide", primaryText: "生成很快｜改片很慢", secondaryEffectId: null, secondaryText: null, accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", videoLayers: [], backdropPreset: "none", chart: null };

describe("字幕与分镜内容关联", () => {
  it("同一组字幕与全屏镜头可通过验证，保留分行文字", () => {
    expect(() => assertStoryboardSelection(selection, input)).not.toThrow();
    expect(() => assertStoryboardMatches([match], selection, input)).not.toThrow();
    expect(normalizeMotionMatches([match], input.captions, 8)[0].primaryText).toBe(match.primaryText);
  });
  it("纯口播拒绝全屏动效和缺少主叙事素材", () => {
    const aRoll = { segments: [{ ...selection.segments[0], roll: "a-roll" as const }] };
    expect(() => assertStoryboardSelection(aRoll, { ...input, storyboard: { mode: "a-roll", prompt: "" } })).toThrow("A-roll");
    expect(() => assertStoryboardSelection(aRoll, { ...input, timelineVisuals: [{ assetId: "voice", role: "a-roll", startSeconds: 0, endSeconds: 8, description: "口播" }] })).toThrow("不适合");
  });
  it("指定时间要求强制拆段，拒绝未声明角色", () => {
    expect(() => assertStoryboardSelection(selection, { ...input, storyboard: { mode: "auto", prompt: "0-4 Aroll；4-8 Broll" } })).toThrow("拆分");
    expect(() => assertStoryboardSelection({ segments: [{ ...selection.segments[0], roll: undefined }] }, input)).toThrow("roll");
  });
  it("B-roll 必须有持续全屏画面，真实镜头不可占位", () => {
    expect(() => assertStoryboardMatches([{ ...match, primaryEffectId: null }], selection, input)).toThrow("全屏");
    expect(() => assertStoryboardMatches([{ ...match, materialPlaceholder: true }], selection, input)).toThrow("占位");
    expect(() => assertStoryboardMatches([{ ...match, primaryEffectId: "image-duet-3d" }], selection, input)).toThrow("全屏");
  });
  it("B-roll 不调用口播运镜，不能借旧字段插入人物", () => {
    expect(() => assertStoryboardMatches([{ ...match, cameraPreset: "push-in" }], selection, input)).toThrow("原口播");
    expect(() => assertStoryboardMatches([{ ...match, primaryMediaAssetId: "voice" }], selection, input)).toThrow("旧素材");
  });
  it("缺少文案或假强调词不进入工程", () => {
    const invalid = { ...match, primaryEffectId: "shotcraft-lead-word-zoom-assemble", primaryParams: [{ key: "copy0", value: "生成很快" }, { key: "copy1", value: "错误词" }] };
    expect(() => assertStoryboardMatches([invalid], selection, input)).toThrow("强调词");
  });
  it("第二阶段的强转场计入整套镜头冲击预算", () => {
    const captions = Array.from({ length: 5 }, (_, index) => ({ startSeconds: index * 4, endSeconds: index * 4 + 4, text: `第${index + 1}段内容` }));
    const segments = captions.map((_, index) => ({ ...selection.segments[0], segmentId: `segment-${index}`, startCaptionIndex: index, endCaptionIndex: index }));
    const matches = captions.map((_, index) => ({ ...match, captionIndex: index, motionGroupId: null, persistUntilCaptionIndex: null, shotcraftTransition: index ? "flash-cut" as const : "none" as const }));
    expect(() => assertStoryboardMatches(matches, { segments }, { ...input, captions, timelineDurationSeconds: 20 })).toThrow("最多三处");
  });
  it("拒绝没有相邻 Shotcraft 前镜的转场和关闭后的音效", () => {
    expect(() => assertStoryboardMatches([{ ...match, shotcraftTransition: "flash-cut" }], selection, input)).toThrow("直接相邻");
    expect(() => assertStoryboardMatches([{ ...match, shotcraftSounds: [{ event: "title", soundId: "shotcraft-audio:sfx-camera-camera-lens-shutter", volume: 0.3 }] }], selection, input)).toThrow("关闭动作音效");
    const gapCaptions = [{ startSeconds: 0, endSeconds: 4, text: "第一镜" }, { startSeconds: 4.1, endSeconds: 8, text: "第二镜" }];
    const gapSegments = gapCaptions.map((_, index) => ({ ...selection.segments[0], segmentId: `gap-${index}`, startCaptionIndex: index, endCaptionIndex: index }));
    const gapMatches = gapCaptions.map((_, index) => ({ ...match, captionIndex: index, motionGroupId: null, persistUntilCaptionIndex: null, shotcraftTransition: index ? "flash-cut" as const : "none" as const }));
    expect(() => assertStoryboardMatches(gapMatches, { segments: gapSegments }, { ...input, captions: gapCaptions })).toThrow("直接相邻");
  });
  it("字幕入口仅开放无需人工圈焦点且已通过适配的镜头", () => {
    expect(subtitleShotcraftEligible("shotcraft-blur-slide")).toBe(true);
    expect(subtitleShotcraftEligible("shotcraft-cursor-flyover")).toBe(false);
    expect(subtitleShotcraftEligible("shotcraft-scanline-annotate-focus")).toBe(false);
  });
});
