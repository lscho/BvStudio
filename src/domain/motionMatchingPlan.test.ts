import { describe, expect, it } from "vitest";
import type { AiMotionMatch, AiMotionSelection } from "@/services/ai/schema";
import { validateMotionMatchPlan, validateMotionSelectionPlan } from "@/domain/motionMatchingPlan";

function selectionSegment(overrides: Partial<AiMotionSelection["segments"][number]> = {}): AiMotionSelection["segments"][number] {
  return {
    segmentId: "segment-1",
    startCaptionIndex: 0,
    endCaptionIndex: 2,
    title: "问题分析",
    intent: "pain",
    evidenceKinds: ["process"],
    primaryEffectId: "pain-points",
    secondaryEffectId: null,
    materialNeed: "",
    selectionReason: "字幕正在连续列举问题",
    ...overrides
  };
}

function motionMatch(overrides: Partial<AiMotionMatch> = {}): AiMotionMatch {
  return {
    captionIndex: 0,
    subtitleKeywords: [],
    motionGroupId: "segment-1",
    persistUntilCaptionIndex: 2,
    primaryEffectId: "pain-points",
    primaryText: "主要痛点｜重复剪辑｜素材混乱",
    primaryParams: [],
    primaryTimingCaptionIndices: [0, 1],
    compositionBindings: [],
    materialPlaceholder: false,
    secondaryEffectId: null,
    secondaryText: null,
    secondaryParams: [],
    secondaryTimingCaptionIndices: [],
    accentColor: "#5fa8ff",
    x: 50,
    y: 35,
    scale: 1,
    secondaryX: 75,
    secondaryY: 60,
    cameraPreset: "none",
    soundEffectId: null,
    videoLayers: [],
    backdropPreset: "none",
    primaryMediaAssetId: null,
    primaryMediaSourceInSeconds: 0,
    secondaryMediaAssetId: null,
    secondaryMediaSourceInSeconds: 0,
    mediaLayoutPreset: "full",
    chart: null,
    ...overrides
  };
}

describe("motion matching plan validation", () => {
  const captions = [
    { startSeconds: 0, endSeconds: 2, text: "先抛出问题。" },
    { startSeconds: 2, endSeconds: 4, text: "解释问题影响。" },
    { startSeconds: 4, endSeconds: 6, text: "给出解决方向。" }
  ];

  it("rejects overlapping semantic segments", () => {
    const issues = validateMotionSelectionPlan({
      segments: [
        selectionSegment({ endCaptionIndex: 2 }),
        selectionSegment({ segmentId: "segment-2", startCaptionIndex: 2, endCaptionIndex: 4 })
      ]
    });
    expect(issues.map((issue) => issue.code)).toContain("segment-overlap");
  });

  it("rejects exclusive effects combined with another effect", () => {
    const issues = validateMotionSelectionPlan({
      segments: [selectionSegment({ primaryEffectId: "screen-demo", secondaryEffectId: "pain-points" })]
    });
    expect(issues.map((issue) => issue.code)).toContain("exclusive-overlap");
  });

  it("rejects two backgrounds in one semantic segment", () => {
    const issues = validateMotionSelectionPlan({
      segments: [selectionSegment({ primaryEffectId: "background-grid", secondaryEffectId: "background-dots" })]
    });
    expect(issues.map((issue) => issue.code)).toContain("multiple-backgrounds");
  });

  it("rejects timing anchors outside the selected segment", () => {
    const selection: AiMotionSelection = { segments: [selectionSegment()] };
    const issues = validateMotionMatchPlan([
      motionMatch({ primaryTimingCaptionIndices: [0, 3] })
    ], selection);
    expect(issues.map((issue) => issue.code)).toContain("timing-outside-segment");
  });

  it("rejects material placeholders with bound assets", () => {
    const selection: AiMotionSelection = {
      segments: [selectionSegment({ primaryEffectId: "screen-demo" })]
    };
    const issues = validateMotionMatchPlan([
      motionMatch({
        primaryEffectId: "screen-demo",
        compositionBindings: [{ slotId: "recording", assetIds: ["screen-video"] }],
        materialPlaceholder: true
      })
    ], selection);
    expect(issues.map((issue) => issue.code)).toContain("invalid-material-placeholder");
  });

  it("rejects a repeated cumulative state in the same segment", () => {
    const selection: AiMotionSelection = { segments: [selectionSegment()] };
    const issues = validateMotionMatchPlan([
      motionMatch(),
      motionMatch({ captionIndex: 1, primaryTimingCaptionIndices: [1] })
    ], selection);
    expect(issues.map((issue) => issue.code)).toContain("duplicate-cumulative-state");
  });

  it("requires semantic segments to cover every caption without gaps and start with a hook motion", () => {
    const issues = validateMotionSelectionPlan({
      segments: [selectionSegment({ startCaptionIndex: 1, intent: "pain" })]
    }, captions);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "segment-coverage-gap",
      "opening-hook-missing"
    ]));
  });

  it("rejects the same adjacent content card kind", () => {
    const issues = validateMotionSelectionPlan({
      segments: [
        selectionSegment({ endCaptionIndex: 0, intent: "hook" }),
        selectionSegment({ segmentId: "segment-2", startCaptionIndex: 1, primaryEffectId: "pain-points" })
      ]
    });
    expect(issues.map((issue) => issue.code)).toContain("adjacent-effect-kind");
  });

  it("requires every selected effect to land exactly once", () => {
    const selection: AiMotionSelection = {
      segments: [selectionSegment({ primaryEffectId: "pain-points", secondaryEffectId: "punch-pill" })]
    };
    const issues = validateMotionMatchPlan([
      motionMatch(),
      motionMatch({ captionIndex: 1, primaryText: "另一个状态", primaryTimingCaptionIndices: [1] })
    ], selection, captions);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "duplicate-selected-effect",
      "selected-effect-missing"
    ]));
  });

  it("requires a segment to keep one accent and stagger content entries by at least half a second", () => {
    const selection: AiMotionSelection = {
      segments: [selectionSegment({ primaryEffectId: "pain-points", secondaryEffectId: "punch-pill" })]
    };
    const issues = validateMotionMatchPlan([
      motionMatch({ primaryEffectId: "pain-points", primaryTimingCaptionIndices: [0, 1] }),
      motionMatch({
        captionIndex: 1,
        primaryEffectId: null,
        primaryText: "",
        primaryTimingCaptionIndices: [],
        secondaryEffectId: "punch-pill",
        secondaryText: "问题必须解决",
        accentColor: "#ff7b72"
      })
    ], selection, [
      { startSeconds: 0, endSeconds: 0.2, text: "先抛出问题。" },
      { startSeconds: 0.4, endSeconds: 2, text: "问题必须解决。" },
      captions[2]
    ]);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "segment-accent-mismatch",
      "content-entry-stagger"
    ]));
  });

  it("requires subtitle anchors for staged effects", () => {
    const selection: AiMotionSelection = { segments: [selectionSegment()] };
    const issues = validateMotionMatchPlan([
      motionMatch({ primaryTimingCaptionIndices: [] })
    ], selection, captions);
    expect(issues.map((issue) => issue.code)).toContain("timing-anchors-required");
  });

  it("requires source information on evidence cards", () => {
    const selection: AiMotionSelection = {
      segments: [selectionSegment({ intent: "evidence", evidenceKinds: ["image"], primaryEffectId: "proof-shot" })]
    };
    const issues = validateMotionMatchPlan([
      motionMatch({
        primaryEffectId: "proof-shot",
        primaryText: "产品后台截图",
        primaryTimingCaptionIndices: [0],
        materialPlaceholder: true
      })
    ], selection, captions);
    expect(issues.map((issue) => issue.code)).toContain("evidence-source-missing");
  });

  it("accepts a match that leaves the motion group empty inside a multi-caption segment", () => {
    const selection: AiMotionSelection = { segments: [selectionSegment()] };
    const issues = validateMotionMatchPlan([
      motionMatch({ motionGroupId: null, persistUntilCaptionIndex: null })
    ], selection, captions);
    expect(issues).toEqual([]);
  });

  it("accepts an evidence source written as a structured note row", () => {
    const selection: AiMotionSelection = { segments: [selectionSegment({ primaryEffectId: "info-board" })] };
    const issues = validateMotionMatchPlan([
      motionMatch({
        primaryEffectId: "info-board",
        primaryText: "单桩回本周期 2-4 年",
        primaryParams: [{ key: "rows", value: "head|单桩回本周期\nnote|来源：公开数据" }]
      })
    ], selection, captions);
    expect(issues.map((issue) => issue.code)).not.toContain("evidence-source-missing");
  });

  it("keeps a real source when another row is only a placeholder", () => {
    const selection: AiMotionSelection = { segments: [selectionSegment({ primaryEffectId: "info-board" })] };
    const issues = validateMotionMatchPlan([
      motionMatch({
        primaryEffectId: "info-board",
        primaryText: "单桩回本周期 2-4 年",
        primaryParams: [{ key: "rows", value: "head|单桩回本周期\nnote|来源：公开数据\nimg||示例配图" }]
      })
    ], selection, captions);
    expect(issues.map((issue) => issue.code)).not.toContain("evidence-source-missing");
  });

  it("still requires a source on an evidence card that has a source field", () => {
    const selection: AiMotionSelection = { segments: [selectionSegment({ primaryEffectId: "stat-proof" })] };
    const withoutSource = validateMotionMatchPlan([
      motionMatch({ primaryEffectId: "stat-proof", primaryText: "42%｜核心指标增长", primaryParams: [] })
    ], selection, captions);
    expect(withoutSource.map((issue) => issue.code)).toContain("evidence-source-missing");
    const withSource = validateMotionMatchPlan([
      motionMatch({
        primaryEffectId: "stat-proof",
        primaryText: "42%｜核心指标增长",
        primaryParams: [{ key: "footZh", value: "来源：公开数据" }]
      })
    ], selection, captions);
    expect(withSource.map((issue) => issue.code)).not.toContain("evidence-source-missing");
  });

  it("does not require a source on a comparison card without a source field", () => {
    const selection: AiMotionSelection = { segments: [selectionSegment({ primaryEffectId: "win-lose" })] };
    const issues = validateMotionMatchPlan([
      motionMatch({
        primaryEffectId: "win-lose",
        primaryText: "选 A 不选 B",
        primaryParams: [{ key: "winName", value: "方案 A" }, { key: "loseName", value: "方案 B" }]
      })
    ], selection, captions);
    expect(issues.map((issue) => issue.code)).not.toContain("evidence-source-missing");
  });
});
