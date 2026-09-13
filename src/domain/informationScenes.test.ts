import { expect, it } from "vitest";
import { informationSceneItems, informationSceneLayout, informationSceneContentIssue, normalizeMotionIcon } from "@/domain/informationScenes";

it("uses distinct, explicit layouts only for supported paired cards", () => {
  expect(informationSceneLayout("quad-map", { sceneLayout: "matrix" })).toBe("matrix");
  expect(informationSceneLayout("glow-badges", { sceneLayout: "columns" })).toBe("columns");
  expect(informationSceneLayout("quad-map", {})).toBeUndefined();
  expect(informationSceneLayout("checklist", { sceneLayout: "matrix" })).toBeUndefined();
});

it("preserves actual information instead of supplying demo content", () => {
  expect(informationSceneItems("quad-map", { cells: "||投入|增容和租金\n||选址|车流不是充电需求" })).toEqual([
    { title: "投入", detail: "增容和租金", label: "", icon: "" },
    { title: "选址", detail: "车流不是充电需求", label: "", icon: "" }
  ]);
  expect(informationSceneItems("glow-badges", { badges: "需求端,trending-up,需求旺盛,持续增长" })[0].icon).toBe("trend-up");
  expect(informationSceneItems("quad-map", {})).toEqual([]);
});

it("normalizes icon aliases and never renders unknown identifiers as copy", () => {
  expect(normalizeMotionIcon("trending-up")).toBe("trend-up");
  expect(normalizeMotionIcon("shield")).toBe("shield");
  expect(normalizeMotionIcon("unknown-icon-name")).toBe("question");
  expect(normalizeMotionIcon("__proto__")).toBe("question");
});

it("rejects oversized or malformed content instead of silently dropping items", () => {
  expect(informationSceneContentIssue("quad-map", { cells: "||一|\n||二|\n||三|\n||四|\n||五|" })).toBeTruthy();
  expect(informationSceneContentIssue("quad-map", { cells: "没有分隔字段" })).toBeTruthy();
  expect(informationSceneContentIssue("glow-badges", { badges: "需求,chart,增长,说明|政策,shield,支持,说明" })).toBeUndefined();
});
