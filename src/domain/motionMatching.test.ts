import { describe, expect, it } from "vitest";
import { BUILTIN_EFFECTS } from "@/domain/effects";
import { allowedAiMotionParameterKeys, compileAiMotionParams, hasReferenceMotionMatchingCard, motionMatchingProfile, referenceMotionMatchingCardCount, referenceMotionMatchingPolicy, referenceMotionTimingKeys } from "@/domain/motionMatching";
import { referenceMotionMatchingCards } from "@/domain/motionMatchingCatalog.generated";
import { importedOverlayStudioEffects } from "@/domain/overlayStudioCatalog";

describe("motion matching catalog", () => {
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
});
