import { expect, it } from "vitest";
import { shotcraftAdaptationIssue, shotcraftContentIssues, shotcraftImpactCount } from "@/domain/shotcraftLibrary/aiPolicy";
import type { ShotcraftPlan } from "@/domain/shotcraftPlan";

const sceneFixture = (): ShotcraftPlan["scenes"][number] => ({ shotId: "shotcraft-blur-slide", text: "内容", copy: [], bindings: [], regions: [], sounds: [], durationSeconds: 5, transition: "none", reason: "开场" });

it.each(["shotcraft-spectrum-morph-ui", "shotcraft-scanline-annotate-focus", "shotcraft-title-demote-to-label", "shotcraft-reticle-lock-on", "shotcraft-crane-rise-reveal"])("自动选型排除未适配的 %s", (id) => {
  expect(shotcraftAdaptationIssue(id)).toBeTruthy();
});

it("空间步进必须提供三步与总览标签", () => {
  const scene = { ...sceneFixture(), shotId: "shotcraft-basic-3d", text: "只有两段｜缺少后两段" };
  expect(shotcraftContentIssues(scene).join(" ")).toContain("四段");
  expect(shotcraftContentIssues({ ...scene, text: "改文案｜换素材｜调节奏｜继续编辑" })).toEqual([]);
});

it("真实功能镜头需要可读说明，两态必须绑定不同图片", () => {
  const scene = { ...sceneFixture(), shotId: "shotcraft-brand-frame-snap", text: "", copy: [{ key: "copy0", value: "调整前" }, { key: "copy1", value: "调整后" }], bindings: [{ slotId: "images", assetIds: ["same", "same"] }] };
  expect(shotcraftContentIssues(scene).join(" ")).toMatch(/说明.*不同/u);
  expect(shotcraftContentIssues({ ...scene, text: "每个镜头都能继续修改", bindings: [{ slotId: "images", assetIds: ["a", "b"] }] })).toEqual([]);
});

it("强调词须在主句中，紧凑字段不能塞入长文", () => {
  const scene = { ...sceneFixture(), shotId: "shotcraft-lead-word-zoom-assemble", copy: [{ key: "copy0", value: "生成很快" }, { key: "copy1", value: "别的词" }, { key: "copy2", value: "很长".repeat(30) }] };
  expect(shotcraftContentIssues(scene).join(" ")).toMatch(/copy2.*强调词/u);
});

it("全画面冲击预算同时计入镜头内动作和转场", () => {
  const base = sceneFixture();
  expect(shotcraftImpactCount([{ ...base, shotId: "shotcraft-lead-word-zoom-assemble" }, { ...base, transition: "flash-cut" }, { ...base, transition: "shotcraft-light-leak-burn" }, { ...base, transition: "flash-cut" }])).toBe(4);
});

it("连续闪白按一次完整手法计数，多次使用与转场累计", () => {
  expect(shotcraftImpactCount([{ ...sceneFixture(), shotId: "shotcraft-paparazzi-flash" }])).toBe(1);
  expect(shotcraftImpactCount([{ ...sceneFixture(), shotId: "shotcraft-cel-flash-stomp" }, { ...sceneFixture(), shotId: "shotcraft-impact-burst-kit", transition: "flash-cut" }, { ...sceneFixture(), shotId: "shotcraft-drop-blackout-slam" }])).toBe(4);
});

it("固定按钮点击不参与真实截图自动选型", () => {
  expect(shotcraftAdaptationIssue("shotcraft-cursor-performance-punch-in")).toBeTruthy();
});
