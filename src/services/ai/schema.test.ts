import { describe, expect, it } from "vitest";
import { aiTimedScriptSchema, createAiMotionMatchesSchema, createMotionMatchesJsonSchema } from "@/services/ai/schema";

describe("two-stage AI schemas", () => {
  it("accepts an article with timed captions before motion matching", () => {
    const value = { title: "设计系统介绍", article: "文章正文", narration: "口播正文", captions: [{ startSeconds: 0, endSeconds: 3, text: "统一团队语言。" }] };
    expect(aiTimedScriptSchema.parse(value)).toEqual(value);
  });

  it("rejects empty or invalid timed captions", () => {
    expect(() => aiTimedScriptSchema.parse({ title: "标题", article: "正文", narration: "口播", captions: [] })).toThrow();
    expect(() => aiTimedScriptSchema.parse({ title: "标题", article: "正文", narration: "口播", captions: [{ startSeconds: -1, endSeconds: 0, text: "" }] })).toThrow();
  });

  it("only accepts active effects and imported media in motion matches", () => {
    const schema = createAiMotionMatchesSchema(["test-title-slide"], ["local-video"]);
    const valid = {
      captionIndex: 0, primaryEffectId: "test-title-slide", primaryText: "统一团队语言", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 28, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "push-in", primaryMediaAssetId: "local-video", primaryMediaSourceInSeconds: 2,
      secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full",
      videoLayers: [{ assetId: "local-video", role: "screen", sourceInSeconds: 2, layoutPreset: "full", shapePreset: "rectangle", transitionPreset: "fade", cameraPreset: "push-in", volume: 0, focus: { enabled: true, x: 50, y: 50, zoom: 1.8, startOffsetSeconds: 0.2, durationSeconds: 1.5 } }],
      backdropPreset: "dark", chart: null
    };
    expect(schema.parse({ matches: [valid] }).matches[0]).toEqual(valid);
    expect(() => schema.parse({ matches: [{ ...valid, primaryEffectId: "made-up-effect" }] })).toThrow("未知动效");
    expect(() => schema.parse({ matches: [{ ...valid, primaryMediaAssetId: "invented-video" }] })).toThrow("未知素材");
    expect(() => schema.parse({ matches: [{ ...valid, videoLayers: [{ ...valid.videoLayers[0], assetId: "invented-video" }] }] })).toThrow("未知素材");
    expect(schema.parse({ matches: [{ ...valid, scale: 0.3 }] }).matches[0].scale).toBe(0.65);
  });

  it("accepts real chart data only inside a matched effect", () => {
    const schema = createAiMotionMatchesSchema(["test-bar-chart"]);
    const match = {
      captionIndex: 0, primaryEffectId: "test-bar-chart", primaryText: "季度增长", secondaryEffectId: null, secondaryText: null,
      accentColor: "#47d7ac", x: 60, y: 45, scale: 0.8, secondaryX: 25, secondaryY: 30,
      cameraPreset: "none", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full",
      chart: { categories: ["Q1", "Q2"], series: [18, 42], unit: "%" }
    };
    expect(schema.parse({ matches: [match] }).matches[0].chart?.series).toEqual([18, 42]);
  });

  it("accepts a staged motion group that persists across later captions", () => {
    const schema = createAiMotionMatchesSchema(["test-title-slide"]);
    const match = {
      captionIndex: 4, motionGroupId: "charging-market", persistUntilCaptionIndex: 6,
      primaryEffectId: "test-title-slide", primaryText: "市场格局", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 24, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none", videoLayers: [], backdropPreset: "soft", chart: null
    };
    expect(schema.parse({ matches: [match] }).matches[0]).toMatchObject({
      motionGroupId: "charging-market",
      persistUntilCaptionIndex: 6
    });
    expect(() => schema.parse({ matches: [{ ...match, motionGroupId: "不合法的分组" }] })).toThrow();
  });

  it("forbids video layers without emitting an invalid empty asset enum", () => {
    const schema = createMotionMatchesJsonSchema(["test-title-slide"], []);
    const videoLayers = schema.properties.matches.items.properties.videoLayers;
    expect(videoLayers.maxItems).toBe(0);
    expect(videoLayers.items.properties.assetId).toEqual({ type: "string" });
    expect(schema.properties.matches.items.required).toEqual(expect.arrayContaining(["motionGroupId", "persistUntilCaptionIndex"]));
  });
});
