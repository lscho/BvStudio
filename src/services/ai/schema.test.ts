import { describe, expect, it } from "vitest";
import { aiVideoPlanSchema, createAiVideoPlanSchema } from "@/services/ai/schema";

describe("aiVideoPlanSchema", () => {
  const valid = {
    title: "设计系统介绍",
    article: "文章正文",
    narration: "口播正文",
    scenes: [{ title: "开场", narration: "内容", durationSeconds: 3, effectId: "title-highlight", color: "#ffb84d", cameraPreset: "push-in", mediaAssetId: null, mediaSourceInSeconds: 0 }]
  };

  it("accepts a plan that only references installed effects", () => {
    expect(aiVideoPlanSchema.parse(valid)).toEqual(valid);
  });

  it("rejects hallucinated effect ids", () => {
    expect(() => aiVideoPlanSchema.parse({ ...valid, scenes: [{ ...valid.scenes[0], effectId: "made-up-effect" }] })).toThrow("未知动效");
  });

  it("rejects invalid durations and colors", () => {
    expect(() => aiVideoPlanSchema.parse({ ...valid, scenes: [{ ...valid.scenes[0], durationSeconds: 0, color: "orange" }] })).toThrow();
  });

  it("only accepts material ids included in the local candidate set", () => {
    const schema = createAiVideoPlanSchema(["title-highlight"], ["local-video"]);
    expect(schema.parse({ ...valid, scenes: [{ ...valid.scenes[0], mediaAssetId: "local-video", mediaSourceInSeconds: 2 }] }).scenes[0].mediaAssetId).toBe("local-video");
    expect(() => schema.parse({ ...valid, scenes: [{ ...valid.scenes[0], mediaAssetId: "invented-video" }] })).toThrow("未知素材");
  });
});
