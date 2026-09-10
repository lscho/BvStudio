import { expect, it } from "vitest";
import { parseStoryboardCues, storyboardRoleAt, storyboardEffectAllowed } from "@/domain/storyboard";

it("读取时间段角色要求并按字幕中点匹配", () => {
  const cues = parseStoryboardCues("0-5秒 A-roll 口播；00:05–00:12 B-roll 展示产品", 20);
  expect(cues).toEqual([{ startSeconds: 0, endSeconds: 5, role: "a-roll" }, { startSeconds: 5, endSeconds: 12, role: "b-roll" }]);
  expect(storyboardRoleAt({ startSeconds: 4, endSeconds: 8 }, { mode: "auto", prompt: "" }, cues)).toBe("b-roll");
  expect(storyboardRoleAt({ startSeconds: 4, endSeconds: 8 }, { mode: "a-roll", prompt: "" }, [])).toBe("a-roll");
});

it("拒绝重叠、倒序、越界及纯模式冲突", () => {
  expect(() => parseStoryboardCues("0-8 Aroll；5-10 Broll", 20)).toThrow("重叠");
  expect(() => parseStoryboardCues("8-5 B-roll", 20)).toThrow("时间");
  expect(() => parseStoryboardCues("0-30 B-roll", 20)).toThrow("时长");
  expect(() => storyboardRoleAt({ startSeconds: 0, endSeconds: 4 }, { mode: "a-roll", prompt: "" }, [{ startSeconds: 0, endSeconds: 4, role: "b-roll" }])).toThrow("冲突");
});

it("口播不可被全屏 Shotcraft 覆盖", () => {
  expect(storyboardEffectAllowed("shotcraft-blur-slide", "a-roll")).toBe(false);
  expect(storyboardEffectAllowed("shotcraft-blur-slide", "b-roll")).toBe(true);
});
