import { describe, expect, it } from "vitest";
import type { CompositionDefinition } from "@/domain/effects";
import { BUILTIN_EFFECTS } from "@/domain/effects";
import { allowedAiMotionParameterKeys, compileAiMotionParams, hasReferenceMotionMatchingCard, motionLayerMarkers, motionMatchingProfile, motionUsage, referenceMotionMatchingCardCount, referenceMotionMatchingPolicy, referenceMotionTimingKeys } from "@/domain/motionMatching";
import { referenceMotionMatchingCards } from "@/domain/motionMatchingCatalog.generated";
import { importedOverlayStudioEffects } from "@/domain/overlayStudioCatalog";

describe("motion matching catalog", () => {
  it("preserves shared subtitle anchors for multiple items", () => {
    const effect = BUILTIN_EFFECTS.find((item) => item.id === "checklist")!;
    const params = compileAiMotionParams({ effect, baseParams: { items: "分析|提取|生成" }, overrides: [],
      timingCaptionIndices: [0, 0, 1], startCaptionIndex: 0, endCaptionIndex: 1,
      captions: [{ startSeconds: 0, endSeconds: 4 }, { startSeconds: 4, endSeconds: 8 }], text: "流程｜分析｜提取｜生成" });
    expect(params.revealTimesUs).toBe("0|0|4000000");
  });
  it("compiles non-uniform subtitle anchors as exact integer microseconds", () => {
    const effect = BUILTIN_EFFECTS.find((item) => item.id === "checklist")!;
    const params = compileAiMotionParams({ effect, baseParams: { items: "投入|位置|运营" }, overrides: [],
      timingCaptionIndices: [0, 1, 2], startCaptionIndex: 0, endCaptionIndex: 2,
      captions: [{ startSeconds: 10, endSeconds: 12 }, { startSeconds: 12.4, endSeconds: 19 }, { startSeconds: 19.7, endSeconds: 24 }],
      text: "风险｜投入｜位置｜运营" });
    expect(params.revealTimesUs).toBe("0|2400000|9700000");
  });
  it("keeps every replicated reference effect connected to its authored matching card", () => {
    expect(referenceMotionMatchingCardCount).toBe(102);
    expect(importedOverlayStudioEffects.filter((effect) => !hasReferenceMotionMatchingCard(effect.id))).toEqual([]);
  });

  it("provides actionable matching rules for every automatic builtin effect", () => {
    for (const effect of BUILTIN_EFFECTS) {
      const profile = motionMatchingProfile(effect);
      expect(profile.effectId).toBe(effect.id);
      expect(profile.purpose.length).toBeGreaterThan(2);
      expect(profile.triggerWhen.length).toBeGreaterThan(2);
      expect(profile.triggerWhen).not.toContain("待补");
    }
  });

  it("classifies backgrounds and subtitle-paced effects", () => {
    const background = motionMatchingProfile(BUILTIN_EFFECTS.find((effect) => effect.id === "glass-pane")!);
    const checklist = motionMatchingProfile(BUILTIN_EFFECTS.find((effect) => effect.id === "checklist")!);
    expect(background.layerRole).toBe("background");
    expect(checklist.rhythmKeys).toContain("stepMs");
  });

  it("derives cumulative card rhythm from real subtitle boundaries", () => {
    const effect = BUILTIN_EFFECTS.find((candidate) => candidate.id === "pain-points")!;
    const params = compileAiMotionParams({
      effect,
      baseParams: effect.defaultParams ?? {},
      overrides: [],
      timingCaptionIndices: [0, 1, 2],
      captions: [
        { startSeconds: 10, endSeconds: 11 },
        { startSeconds: 11, endSeconds: 12.5 },
        { startSeconds: 12.5, endSeconds: 13 }
      ],
      startCaptionIndex: 0,
      endCaptionIndex: 2,
      text: "痛点｜重复剪辑｜素材混乱｜交付太慢"
    });
    expect(params.stepMs).toBe(1250);
  });

  it("keeps the reference matching defaults as executable policy", () => {
    expect(referenceMotionMatchingPolicy).toEqual({
      densityPerMinute: { min: 8, max: 12 },
      newActionIntervalSeconds: { min: 2, max: 4 },
      typicalSegmentSeconds: { min: 10, max: 30 },
      openingHookDeadlineSeconds: 5,
      maxConcurrentContentLayers: 2,
      minContentEntryStaggerSeconds: 0.5
    });
  });

  it("covers every authored reference timing parameter", () => {
    expect(referenceMotionTimingKeys).toEqual(expect.arrayContaining([
      "times", "stepMs", "holdMs", "wordMs", "swapMs", "spinMs", "scrollMs", "countMs",
      "drawMs", "strikeAtMs", "strikeStepMs", "vetoAt", "moveSec", "tourSec", "pushMs",
      "oldAt", "newAt", "punchAt", "firstAt", "buildAt", "buildStepMs", "paradeAt",
      "paradeStepMs", "startAt", "staggerMs", "lockMs", "itemStepMs", "noteStepMs",
      "chipStepMs", "spotMs", "focusMs", "shiftAtMs", "badgesAt", "subAt", "stopsAt",
      "intoAt", "noteAt", "libAt", "deckAt", "payAt", "leftAt", "rightAt", "dockTimes",
      "cps", "acts"
    ]));
    const authoredTimingKeys = new Set(referenceMotionMatchingCards.flatMap((card) => (
      [...card.parameterGuide.matchAll(/`([A-Za-z][A-Za-z0-9]*)`/gu)]
        .map((match) => match[1])
        .filter((key) => key === "times" || key === "acts" || key === "cps" || /(?:At|Ms|Sec|Times)$/u.test(key))
    )));
    expect(referenceMotionTimingKeys).toEqual(expect.arrayContaining([...authoredTimingKeys]));
    for (const effect of BUILTIN_EFFECTS) {
      const profile = motionMatchingProfile(effect);
      const allowed = allowedAiMotionParameterKeys(effect);
      expect(profile.rhythmKeys.filter((key) => key !== "acts" && allowed.includes(key))).toEqual([]);
    }
  });

  it("allows reference-stage cards to receive their authored internal scale", () => {
    const infoBoard = BUILTIN_EFFECTS.find((effect) => effect.id === "info-board")!;
    expect(allowedAiMotionParameterKeys(infoBoard)).toContain("scale");
    expect(compileAiMotionParams({
      effect: infoBoard,
      baseParams: infoBoard.defaultParams ?? {},
      overrides: [{ key: "scale", value: 2.4 }],
      timingCaptionIndices: [],
      captions: [{ startSeconds: 0, endSeconds: 4 }],
      startCaptionIndex: 0,
      endCaptionIndex: 0,
      text: "核心结论"
    }).scale).toBe(1);
  });

  it("compiles multi-stage seconds, character pacing, and mixed action scripts from subtitle anchors", () => {
    const captions = [
      { startSeconds: 10, endSeconds: 11 },
      { startSeconds: 12.5, endSeconds: 14 },
      { startSeconds: 16, endSeconds: 20 }
    ];
    const studio = BUILTIN_EFFECTS.find((effect) => effect.id === "studio-build")!;
    const studioParams = compileAiMotionParams({
      effect: studio,
      baseParams: studio.defaultParams ?? {},
      overrides: [],
      timingCaptionIndices: [0, 1, 2],
      captions,
      startCaptionIndex: 0,
      endCaptionIndex: 2,
      text: "先建动效库｜再进入编辑台｜最后持续复用"
    });
    expect(studioParams).toMatchObject({ libAt: 0, deckAt: 2.5, payAt: 6 });

    const terminal = BUILTIN_EFFECTS.find((effect) => effect.id === "terminal-3d")!;
    const terminalParams = compileAiMotionParams({
      effect: terminal,
      baseParams: terminal.defaultParams ?? {},
      overrides: [{ key: "lines", value: "12345678901234567890" }],
      timingCaptionIndices: [0],
      captions,
      startCaptionIndex: 0,
      endCaptionIndex: 2,
      text: "运行命令"
    });
    expect(terminalParams.cps).toBe(8);

    const stick = BUILTIN_EFFECTS.find((effect) => effect.id === "stick-fall")!;
    const stickParams = compileAiMotionParams({
      effect: stick,
      baseParams: stick.defaultParams ?? {},
      overrides: [{ key: "acts", value: "9|跑+camera\n9|跪\n9|趴" }],
      timingCaptionIndices: [0, 1, 2],
      captions,
      startCaptionIndex: 0,
      endCaptionIndex: 2,
      text: "不断拍摄｜陷入困境｜彻底趴下"
    });
    expect(stickParams.acts).toBe("0|跑+camera\n2.5|跪\n6|趴");

    const costCut = BUILTIN_EFFECTS.find((effect) => effect.id === "cost-cut")!;
    const costParams = compileAiMotionParams({
      effect: costCut,
      baseParams: costCut.defaultParams ?? {},
      overrides: [],
      timingCaptionIndices: [0, 1, 2],
      captions,
      startCaptionIndex: 0,
      endCaptionIndex: 2,
      text: "原来三天｜现在三分钟｜效率大幅提升"
    });
    expect(costParams).toMatchObject({ oldAt: 0, newAt: 2.5, punchAt: 6 });
  });

  it("classifies every full-canvas composition as fullscreen", () => {
    const shotcraft = BUILTIN_EFFECTS.filter((effect) => effect.id.startsWith("shotcraft-"));
    expect(shotcraft).toHaveLength(216);
    expect(shotcraft.every((effect) => motionUsage(effect) === "fullscreen")).toBe(true);
    for (const id of ["poster-wall-3d", "image-duet-3d", "motion-zoom", "slide-gallery", "card-stack", "split-reveal", "still-image-motion"]) {
      expect(motionUsage(effectById(id))).toBe("fullscreen");
    }
  });

  it("keeps overlay cards that take over the frame in the fullscreen class", () => {
    const fullscreenOverlays = [
      "screen-demo", "demo-tour", "cam-pan", "focus-card", "focus-takeover", "demo-rail", "letter-glitch",
      "info-board", "column-stack", "flow-chart", "ecosystem-hub", "terminal-3d", "project-window"
    ];
    for (const id of fullscreenOverlays) expect([id, motionUsage(effectById(id))]).toEqual([id, "fullscreen"]);
    expect(fullscreenOverlays.filter((id) => motionLayerMarkers(effectById(id)).exclusive)).toEqual([
      "screen-demo", "demo-tour", "cam-pan", "focus-card", "focus-takeover", "demo-rail"
    ]);
  });

  it("treats backdrops and ambience as background layers usable in both contexts", () => {
    for (const id of ["background-stripes", "background-grid", "background-dots", "background-contours", "frost-screen", "ambient-wash", "dust-field"]) {
      expect(motionUsage(effectById(id))).toBe("both");
      expect(motionLayerMarkers(effectById(id)).layer).toBe("background");
    }
  });

  it("keeps presenter-anchored cards on the talking-head side", () => {
    for (const id of ["photo-halo", "icon-pop", "word-flank", "cam-frame", "punch-zoom", "cover-stack", "caption-track"]) {
      expect(motionUsage(effectById(id))).toBe("talking-head");
    }
  });

  it("falls back to both for effects without reference metadata", () => {
    const thirdParty: CompositionDefinition = {
      id: "custom-package-card", name: "第三方卡", category: "卡片", description: "未提供参考目录元数据",
      tags: ["第三方"], defaultDurationUs: 4_000_000, defaultText: "", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
      recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
    };
    expect(motionUsage(thirdParty)).toBe("both");
    expect(motionUsage({ ...thirdParty, id: "custom-presenter", slots: [{ id: "presenter", label: "人物视频", kind: "video", minItems: 1, maxItems: 1 }] })).toBe("talking-head");
  });

  it("splits the builtin catalog into talking-head, fullscreen, and both", () => {
    const counts: Record<string, number> = { "talking-head": 0, fullscreen: 0, both: 0 };
    for (const effect of BUILTIN_EFFECTS) counts[motionUsage(effect)] += 1;
    expect(counts).toEqual({ "talking-head": 42, fullscreen: 236, both: 51 });
  });
});

function effectById(id: string) {
  const effect = BUILTIN_EFFECTS.find((candidate) => candidate.id === id);
  if (!effect) throw new Error(`missing builtin effect ${id}`);
  return effect;
}
