import { describe, expect, it } from "vitest";
import { aiTimedScriptSchema, createAiEffectSelectionSchema, createAiMotionMatchesSchema, createAiMotionSelectionSchema, createEffectSelectionJsonSchema, createMotionMatchesJsonSchema, createMotionSelectionJsonSchema } from "@/services/ai/schema";

describe("two-stage AI schemas", () => {
  it.each(["primary", "secondary"] as const)("reports actionable per-field %s parameter errors without accepting unsafe overrides", (slot) => {
    const match = { captionIndex: 0, primaryEffectId: "checklist", primaryText: "步骤｜分析｜完成", secondaryEffectId: "checklist", secondaryText: "步骤｜分析｜完成",
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null,
      [`${slot}Params`]: [{ key: "items", value: "分析|完成" }, { key: "items", value: "冲突内容" }, { key: "stepMs", value: 800 }, { key: "img", value: "private-media-value" }, { key: "inventedParam", value: true }] };
    const result = createAiMotionMatchesSchema(["checklist"]).safeParse({ matches: [match] });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issues = result.error.issues;
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["matches", 0, `${slot}Params`, 1, "key"], message: expect.stringContaining("重复") }),
      expect.objectContaining({ path: ["matches", 0, `${slot}Params`, 2, "key"], message: expect.stringContaining(`${slot}TimingCaptionIndices`) }),
      expect.objectContaining({ path: ["matches", 0, `${slot}Params`, 3, "key"], message: expect.stringContaining("img") }),
      expect.objectContaining({ path: ["matches", 0, `${slot}Params`, 4, "key"], message: expect.stringContaining("inventedParam") })
    ]));
    expect(issues.every((issue) => issue.message.includes("checklist"))).toBe(true);
    expect(issues.at(-1)?.message).toContain("允许字段");
    expect(JSON.stringify(issues)).not.toContain("private-media-value");
  });

  it("restricts generated parameter keys to the selected effects while retaining per-effect validation", () => {
    const schema = createMotionMatchesJsonSchema(["checklist", "quad-map"]);
    const params = schema.properties.matches.items.properties;
    for (const field of [params.primaryParams, params.secondaryParams]) {
      expect(field.items.properties.key).toMatchObject({ enum: expect.arrayContaining(["items", "cells"]) });
      expect(JSON.stringify(field.items.properties.key)).not.toContain('"stepMs"');
      expect(JSON.stringify(field.items.properties.key)).not.toContain('"img"');
    }
    expect(createMotionMatchesJsonSchema([]).properties.matches.items.properties.secondaryParams.maxItems).toBe(0);
    const match = { captionIndex: 0, primaryEffectId: "checklist", primaryText: "步骤｜分析｜完成", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null,
      primaryParams: [{ key: "cells", value: "||分析|完成" }] };
    expect(() => createAiMotionMatchesSchema(["checklist", "quad-map"]).parse({ matches: [match] })).toThrow("checklist 参数 cells");
    expect(createAiMotionMatchesSchema(["checklist", "quad-map"]).parse({ matches: [{ ...match, primaryParams: [{ key: "items", value: "分析|完成" }] }] }).matches[0].primaryParams).toEqual([{ key: "items", value: "分析|完成" }]);
  });
  it("grounds semantic segments and their effect choices to caption indexes", () => {
    const selection = {
      segments: [{ segmentId: "pain-and-fix", startCaptionIndex: 0, endCaptionIndex: 2, title: "痛点与方案", intent: "pain", evidenceKinds: ["process"], primaryEffectId: "pain-points", secondaryEffectId: null, materialNeed: "", selectionReason: "连续三条字幕在列举问题" }]
    };
    expect(createAiMotionSelectionSchema(["pain-points"], 2).parse(selection)).toEqual(selection);
    expect(() => createAiMotionSelectionSchema(["pain-points"], 2).parse({ ...selection, segments: [{ ...selection.segments[0], endCaptionIndex: 3 }] })).toThrow();
    expect(createMotionSelectionJsonSchema(["pain-points"], 2).properties.segments.items.required).toContain("selectionReason");
    expect(createMotionSelectionJsonSchema(["pain-points"], 2).properties.segments.items.required).not.toContain("roll");
    expect(createMotionSelectionJsonSchema(["pain-points"], 2, true).properties.segments.items.required).toContain("roll");
    expect(() => createAiMotionSelectionSchema(["pain-points"], 2, true).parse(selection)).toThrow("统一分镜");
  });

  it("selects a bounded effect palette from every allowed id", () => {
    const allowed = ["pain-points", "screen-demo", "flow-chart"];
    expect(createAiEffectSelectionSchema(allowed).parse({ effectIds: ["screen-demo", "pain-points"] }).effectIds).toEqual(["screen-demo", "pain-points"]);
    expect(() => createAiEffectSelectionSchema(allowed).parse({ effectIds: ["made-up"] })).toThrow("未知动效");
    expect(createEffectSelectionJsonSchema(allowed).properties.effectIds.items).toEqual({ type: "string", enum: allowed });
  });

  it("accepts mixed showcase inputs and input-free backgrounds but rejects unknown media", () => {
    const schema = createAiMotionMatchesSchema(["motion-zoom", "background-stripes"], ["video"], ["image"]);
    const match = { captionIndex: 0, primaryEffectId: "motion-zoom", primaryText: "", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null,
      compositionBindings: [{ slotId: "media", assetIds: ["image", "video"] }] };
    expect(schema.parse({ matches: [match] }).matches[0].compositionBindings).toEqual(match.compositionBindings);
    expect(() => schema.parse({ matches: [{ ...match, compositionBindings: [{ slotId: "media", assetIds: ["image", "audio"] }] }] })).toThrow();
    expect(schema.parse({ matches: [{ ...match, primaryEffectId: "background-stripes", compositionBindings: [] }] }).matches[0].compositionBindings).toEqual([]);
  });
  it("validates picture composition slots separately from video layers", () => {
    const schema = createAiMotionMatchesSchema(["poster-wall-3d"], ["video"], ["a", "b"]);
    const match = { captionIndex: 0, primaryEffectId: "poster-wall-3d", primaryText: "", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null,
      compositionBindings: [{ slotId: "posters", assetIds: ["b", "a"] }] };
    expect(schema.parse({ matches: [match] }).matches[0].compositionBindings).toEqual(match.compositionBindings);
    expect(() => schema.parse({ matches: [{ ...match, compositionBindings: [] }] })).toThrow("素材槽");
    expect(() => schema.parse({ matches: [{ ...match, compositionBindings: [{ slotId: "posters", assetIds: ["a", "video"] }] }] })).toThrow("图片槽不能绑定视频");
    expect(() => schema.parse({ matches: [{ ...match, secondaryEffectId: "poster-wall-3d" }] })).toThrow("主动效");
  });
  it("validates required React composition slots by material kind", () => {
    const schema = createAiMotionMatchesSchema(["screen-demo", "ghost-video"], ["screen-video"], ["reference-image"]);
    const match = { captionIndex: 0, primaryEffectId: "screen-demo", primaryText: "关键操作", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null,
      compositionBindings: [{ slotId: "recording", assetIds: ["screen-video"] }] };
    expect(schema.parse({ matches: [match] }).matches[0].compositionBindings).toEqual(match.compositionBindings);
    expect(() => schema.parse({ matches: [{ ...match, compositionBindings: [{ slotId: "recording", assetIds: ["reference-image"] }] }] })).toThrow("图片槽不能绑定视频");
    expect(schema.parse({ matches: [{ ...match, primaryEffectId: "ghost-video", compositionBindings: [{ slotId: "reference", assetIds: ["reference-image"] }] }] }).matches[0].primaryEffectId).toBe("ghost-video");
  });

  it("allows an empty binding only for an explicit material placeholder", () => {
    const schema = createAiMotionMatchesSchema(["screen-demo"], [], []);
    const match = {
      captionIndex: 0, subtitleKeywords: [], motionGroupId: null, persistUntilCaptionIndex: null,
      primaryEffectId: "screen-demo", primaryText: "操作演示", primaryParams: [], primaryTimingCaptionIndices: [],
      compositionBindings: [], materialPlaceholder: true, secondaryEffectId: null, secondaryText: null,
      secondaryParams: [], secondaryTimingCaptionIndices: [], accentColor: "#5fa8ff", x: 50, y: 50, scale: 1,
      secondaryX: 75, secondaryY: 60, cameraPreset: "none", soundEffectId: null, videoLayers: [], backdropPreset: "none", chart: null
    };
    expect(schema.parse({ matches: [match] }).matches[0].materialPlaceholder).toBe(true);
    expect(() => schema.parse({ matches: [{ ...match, materialPlaceholder: false }] })).toThrow("半透明占位");
  });
  it("accepts an article with timed captions before motion matching", () => {
    const value = { title: "设计系统介绍", article: "文章正文", narration: "口播正文", captions: [{ startSeconds: 0, endSeconds: 3, text: "统一团队语言。" }] };
    expect(aiTimedScriptSchema.parse(value)).toEqual(value);
  });

  it("rejects empty or invalid timed captions", () => {
    expect(() => aiTimedScriptSchema.parse({ title: "标题", article: "正文", narration: "口播", captions: [] })).toThrow();
    expect(() => aiTimedScriptSchema.parse({ title: "标题", article: "正文", narration: "口播", captions: [{ startSeconds: -1, endSeconds: 0, text: "" }] })).toThrow();
  });

  it("only accepts active effects and imported media in motion matches", () => {
    const soundId = "shotcraft-audio:sfx-camera-camera-lens-shutter";
    const schema = createAiMotionMatchesSchema(["test-title-slide"], ["local-video"], [], [soundId]);
    const valid = {
      captionIndex: 0, subtitleKeywords: ["团队语言"], primaryEffectId: "test-title-slide", primaryText: "协作从共识开始", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 28, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "push-in", primaryMediaAssetId: "local-video", primaryMediaSourceInSeconds: 2,
      secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full",
      videoLayers: [{ assetId: "local-video", role: "screen", sourceInSeconds: 2, layoutPreset: "full", shapePreset: "rectangle", transitionPreset: "fade", cameraPreset: "push-in", volume: 0, focus: { enabled: true, x: 50, y: 50, zoom: 1.8, startOffsetSeconds: 0.2, durationSeconds: 1.5 } }],
      backdropPreset: "dark", soundEffectId: soundId, chart: null
    };
    expect(schema.parse({ matches: [valid] }).matches[0]).toMatchObject(valid);
    expect(schema.parse({ matches: [valid] }).matches[0]).toMatchObject({ primaryParams: [], primaryTimingCaptionIndices: [], secondaryParams: [], secondaryTimingCaptionIndices: [] });
    expect(() => schema.parse({ matches: [{ ...valid, primaryEffectId: "made-up-effect" }] })).toThrow("未知动效");
    expect(() => schema.parse({ matches: [{ ...valid, primaryMediaAssetId: "invented-video" }] })).toThrow("未知素材");
    expect(() => schema.parse({ matches: [{ ...valid, videoLayers: [{ ...valid.videoLayers[0], assetId: "invented-video" }] }] })).toThrow("未知素材");
    expect(() => schema.parse({ matches: [{ ...valid, soundEffectId: "invented-sound" }] })).toThrow("未知音效");
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
    const shotcraftSounds = schema.properties.matches.items.properties.shotcraftSounds;
    expect(videoLayers.maxItems).toBe(0);
    expect(videoLayers.items.properties.assetId).toEqual({ type: "string" });
    expect(shotcraftSounds.maxItems).toBe(0);
    expect(shotcraftSounds.items.properties.soundId).toEqual({ type: "string" });
    expect(schema.properties.matches.items.required).toEqual(expect.arrayContaining(["subtitleKeywords", "motionGroupId", "persistUntilCaptionIndex", "soundEffectId"]));
    expect(schema.properties.matches.items.properties.soundEffectId).toEqual({ type: "null" });
  });
});
