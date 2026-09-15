import { isShotcraftComposition } from "@/domain/shotcraft";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alignMotionContentEntries, captionNumericData, compactMotionText, ensureSelectedMotionMatches, ensureStoryboardBaseLayers, extractTokenUsage, generateScriptCopy, generateSubtitleChapters, generateTimedScript, generateVideoPlan, groundMotionMatchesToSelection, listProviderModels, matchTimelineMotion, motionCaptionChunks, motionMatchesAccessIssue, normalizeMotionChart, normalizeMotionMatches, normalizeMotionSelection, normalizeMotionSelectionEvidenceKinds, normalizeTimedScript, providerEndpoint, selectMotionCandidates, truncateRepairOutput, verifyProviderConfiguration, type AiProviderConfig } from "@/services/ai/provider";
import { allCompositions } from "@/domain/effects";
import { validateMotionMatchPlan, validateMotionSelectionPlan } from "@/domain/motionMatchingPlan";
import type { AiMotionMatch } from "@/services/ai/schema";

const pricing = { inputCostPerMillion: 2.5, outputCostPerMillion: 10 };
const config: AiProviderConfig = {
  protocol: "openai-chat",
  baseUrl: "https://models.example.com",
  model: "test-model",
  ...pricing
};

function motionSelection(primaryEffectId: string | null, endCaptionIndex = 0, secondaryEffectId: string | null = null) {
  return {
    segments: [{
      segmentId: "segment-1",
      startCaptionIndex: 0,
      endCaptionIndex,
      title: "测试段落",
      intent: "hook" as const,
      evidenceKinds: ["none" as const],
      primaryEffectId,
      secondaryEffectId,
      materialNeed: "",
      selectionReason: "符合测试字幕的语义与结构"
    }]
  };
}

function sseResponse(events: Array<unknown | "[DONE]">) {
  const body = events.map((event) => `data: ${event === "[DONE]" ? event : JSON.stringify(event)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractTokenUsage", () => {
  it("normalizes OpenAI Responses usage and estimates cost", () => {
    expect(extractTokenUsage("openai-responses", {
      usage: { input_tokens: 2_000, output_tokens: 500, total_tokens: 2_500 }
    }, pricing)).toEqual({
      inputTokens: 2_000,
      outputTokens: 500,
      totalTokens: 2_500,
      estimatedCostUsd: 0.01
    });
  });

  it("normalizes Chat Completions token field names", () => {
    expect(extractTokenUsage("openai-chat", {
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    }, pricing)).toMatchObject({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
  });

  it("derives Anthropic total tokens and tolerates missing usage", () => {
    expect(extractTokenUsage("anthropic", { usage: { input_tokens: 7, output_tokens: 9 } }, pricing).totalTokens).toBe(16);
    expect(extractTokenUsage("anthropic", {}, pricing)).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 });
  });
});

describe("truncateRepairOutput", () => {
  it("keeps the repair payload parseable by dropping trailing matches", () => {
    const value = {
      matches: Array.from({ length: 120 }, (_, captionIndex) => ({ captionIndex, primaryText: "很长的画面文案".repeat(30) }))
    };
    const text = truncateRepairOutput(value, 4_000);
    expect(text.length).toBeLessThanOrEqual(4_000);
    const parsed = JSON.parse(text) as { matches: unknown[] };
    expect(parsed.matches.length).toBeGreaterThan(0);
    expect(parsed.matches.length).toBeLessThan(120);
  });

  it("returns the serialized value unchanged when it fits", () => {
    expect(truncateRepairOutput({ matches: [{ captionIndex: 0 }] }, 4_000)).toBe('{"matches":[{"captionIndex":0}]}');
  });
});

describe("provider requests", () => {
  it("keeps unsafe or ambiguous bundled entries for model repair and does not duplicate media or sound when splitting", () => {
    const selection = { segments: [{ ...motionSelection("still-image-motion", 2, "checklist").segments[0], roll: "b-roll" as const }] };
    const captions = [{ startSeconds: 0, endSeconds: 0.3, text: "开场" }, { startSeconds: 0.3, endSeconds: 2, text: "导入图片" }, { startSeconds: 2, endSeconds: 5, text: "生成编排" }];
    const match: AiMotionMatch = { captionIndex: 0, primaryEffectId: "still-image-motion", primaryText: "", primaryTimingCaptionIndices: [],
      secondaryEffectId: "checklist", secondaryText: "生成编排", secondaryTimingCaptionIndices: [2], compositionBindings: [{ slotId: "image", assetIds: ["image"] }],
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 60, secondaryY: 40, cameraPreset: "push-in", soundEffectId: "sound", chart: null,
      videoLayers: [], backdropPreset: "none", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" };
    for (const anchors of [[], [0], [1], [99], [2, 1]]) {
      const source = [{ ...match, secondaryTimingCaptionIndices: anchors }];
      expect(alignMotionContentEntries(source, selection, captions)).toEqual(source);
      expect(validateMotionMatchPlan(source, selection, captions).map((issue) => issue.code)).toContain("content-entry-stagger");
    }
    const collision = [match, { ...match, captionIndex: 2, primaryEffectId: null, secondaryEffectId: null }];
    expect(alignMotionContentEntries(collision, selection, captions)).toEqual(collision);
    const original = structuredClone(match);
    const aligned = alignMotionContentEntries([match], selection, captions);
    expect(aligned).toHaveLength(2);
    expect(aligned[0]).toMatchObject({ captionIndex: 0, soundEffectId: "sound", compositionBindings: match.compositionBindings, cameraPreset: "push-in" });
    expect(aligned[1]).toMatchObject({ captionIndex: 2, primaryEffectId: "checklist", soundEffectId: null, compositionBindings: [], cameraPreset: "none" });
    expect(alignMotionContentEntries(aligned, selection, captions)).toEqual(aligned);
    expect(match).toEqual(original);
    const paired = { ...match, primaryEffectId: "shotcraft-glow-orb-ambient" };
    expect(alignMotionContentEntries([paired], { segments: [{ ...selection.segments[0], primaryEffectId: paired.primaryEffectId }] }, captions)).toEqual([paired]);
  });
  it.each(["still-image-motion", "slide-gallery"])("splits a bundled %s foreground card onto its first subtitle anchor", async (effectId) => {
    const selection = { segments: [{ ...motionSelection(effectId, 2, "checklist").segments[0], roll: "b-roll" }] };
    const matched = { captionIndex: 0, primaryEffectId: effectId, primaryText: "", secondaryEffectId: "checklist", secondaryText: "操作流程｜导入图片｜生成编排",
      primaryTimingCaptionIndices: [0, 1], secondaryTimingCaptionIndices: [1, 2], secondaryParams: [{ key: "items", value: "导入图片|生成编排" }],
      compositionBindings: [{ slotId: effectId === "still-image-motion" ? "image" : "media", assetIds: effectId === "still-image-motion" ? ["image-0"] : ["image-0", "image-1"] }], materialPlaceholder: false,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 62, secondaryY: 40, cameraPreset: "none", chart: null };
    const original = structuredClone(matched);
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response(selection)).mockResolvedValueOnce(response({ matches: [matched] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, { topic: "编排", style: "清晰", timelineDurationSeconds: 8, isPro: true,
      captions: [{ startSeconds: 0, endSeconds: 2, text: "场景编排功能。" }, { startSeconds: 2, endSeconds: 5, text: "导入图片。" }, { startSeconds: 5, endSeconds: 8, text: "生成编排。" }],
      materials: ["场景编排", "动效库"].map((name, index) => ({ id: `image-${index}`, name: `${name}.png`, kind: "image", durationSeconds: 0 })),
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toMatchObject({ captionIndex: 0, primaryEffectId: effectId, compositionBindings: matched.compositionBindings, secondaryEffectId: null, persistUntilCaptionIndex: 2 });
    expect(result.matches[1]).toMatchObject({ captionIndex: 1, primaryEffectId: "checklist", primaryText: matched.secondaryText, primaryParams: matched.secondaryParams, primaryTimingCaptionIndices: [1, 2], x: 62, y: 40, persistUntilCaptionIndex: 2, compositionBindings: [], cameraPreset: "none", videoLayers: [] });
    expect(matched).toEqual(original);
  });
  it("keeps a semantically ordered multi-image gallery through the complete storyboard pipeline", async () => {
    const names = ["场景编排", "动效库", "字幕生成", "AI 配音"];
    const selection = { segments: [{ ...motionSelection("slide-gallery").segments[0], roll: "b-roll", materialNeed: "展示字幕生成、AI 配音、场景编排、动效库", selectionReason: "按功能介绍顺序浏览相关截图" }] };
    const matched = { captionIndex: 0, primaryEffectId: "slide-gallery", primaryText: "", secondaryEffectId: null, secondaryText: null,
      compositionBindings: [{ slotId: "media", assetIds: ["image-2", "image-3", "image-0", "image-1"] }], materialPlaceholder: false,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null };
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response(selection)).mockResolvedValueOnce(response({ matches: [matched] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, { topic: "产品功能", style: "清晰", timelineDurationSeconds: 18, isPro: true,
      captions: [{ startSeconds: 0, endSeconds: 18, text: "依次介绍字幕生成、AI 配音、场景编排与动效库。" }],
      materials: names.map((name, index) => ({ id: `image-${index}`, name: `${name}.png`, kind: "image", durationSeconds: 0 })),
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.selection).toEqual(selection);
    expect(result.matches[0]).toMatchObject({ primaryEffectId: "slide-gallery", compositionBindings: matched.compositionBindings });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).messages[0].content).toContain("素材语义与运镜");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).messages[0].content).toContain("按语义出现顺序排列，不按导入顺序");
  });
  it("uses an unambiguous filename reference for missing still-image bindings, not import order", () => {
    const selection = { segments: [{ ...motionSelection("still-image-motion").segments[0], title: "字幕生成", roll: "b-roll" as const }] };
    const materials = [{ id: "wrong", name: "动效库.png", kind: "image" as const, durationSeconds: 0 }, { id: "right", name: "字幕生成.png", kind: "image" as const, durationSeconds: 0 }];
    const context = { materials, captions: [{ startSeconds: 0, endSeconds: 6, text: "展示字幕生成功能。" }] };
    const value = { matches: [{ captionIndex: 0, primaryEffectId: "still-image-motion", compositionBindings: [], materialPlaceholder: true }] };
    expect(ensureStoryboardBaseLayers(value, selection, ["wrong", "right"], context)).toMatchObject({ matches: [{ compositionBindings: [{ slotId: "image", assetIds: ["right"] }], materialPlaceholder: false }] });
    expect(ensureStoryboardBaseLayers(value, selection, ["right", "wrong"], context)).toMatchObject({ matches: [{ compositionBindings: [{ slotId: "image", assetIds: ["right"] }] }] });
    const unrelated = { ...context, materials: materials.slice(0, 1) };
    expect(ensureStoryboardBaseLayers(value, selection, ["wrong"], unrelated)).toEqual(value);
    const ambiguous = { ...context, materials: [...materials, { ...materials[1], id: "duplicate" }] };
    expect(ensureStoryboardBaseLayers(value, selection, ["wrong", "right", "duplicate"], ambiguous)).toEqual(value);
    const chosen = { matches: [{ ...value.matches[0], compositionBindings: [{ slotId: "image", assetIds: ["wrong"] }], materialPlaceholder: false }] };
    expect(ensureStoryboardBaseLayers(chosen, selection, ["wrong", "right"], context)).toEqual(chosen);
  });
  it.each(["motion-zoom", "slide-gallery", "card-stack", "split-reveal"])("preserves a usable %s image presentation instead of replacing it with the still-image fallback", (effectId) => {
    const input = { topic: "产品能力", style: "清晰", timelineDurationSeconds: 8, isPro: true, storyboard: { mode: "auto" as const, prompt: "" },
      captions: [{ startSeconds: 0, endSeconds: 8, text: "依次展示场景编排、动效库、字幕生成和 AI 配音。" }],
      materials: ["场景编排", "动效库", "字幕生成", "AI 配音"].map((name, index) => ({ id: `image-${index}`, name: `${name}.png`, kind: "image" as const, durationSeconds: 0 })) };
    const selection = { segments: [{ ...motionSelection(effectId).segments[0], roll: "b-roll" as const }] };
    expect(normalizeMotionSelection(selection, selectMotionCandidates(input), input)).toEqual(selection);
    expect(normalizeMotionSelection(selection, selectMotionCandidates(input), { ...input, materials: input.materials.slice(0, 1) }).segments[0].primaryEffectId).toBe("still-image-motion");
  });
  it("repairs secondary parameter fields with exact effect, key and timing guidance", async () => {
    const selected = { segments: [{ ...motionSelection("shotcraft-glow-orb-ambient", 0, "checklist").segments[0], roll: "b-roll" }] };
    const matched = { captionIndex: 0, primaryEffectId: "shotcraft-glow-orb-ambient", primaryText: "", secondaryEffectId: "checklist", secondaryText: "行动建议｜先核算成本｜再检查合同",
      secondaryParams: [{ key: "items", value: "先核算成本|再检查合同" }], secondaryTimingCaptionIndices: [0, 0],
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 72, secondaryY: 42, cameraPreset: "none", chart: null };
    const broken = { ...matched, secondaryParams: [...matched.secondaryParams, { key: "stepMs", value: 1000 }, { key: "inventedParam", value: true }, ...matched.secondaryParams] };
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response(selected)).mockResolvedValueOnce(response({ matches: [broken] })).mockResolvedValueOnce(response({ matches: [matched] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "行动建议", style: "简洁", timelineDurationSeconds: 6, isPro: true, materials: [],
      captions: [{ startSeconds: 0, endSeconds: 6, text: "先核算成本，再检查合同。" }],
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const repair = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(repair.messages.at(-1).content).toContain("secondaryParams.1.key");
    expect(repair.messages.at(-1).content).toContain("checklist 参数 stepMs");
    expect(repair.messages.at(-1).content).toContain("secondaryTimingCaptionIndices");
    expect(repair.messages.at(-1).content).toContain("允许字段");
    expect(repair.messages[0].content).toContain("缺少这些字段时使用默认落位");
    expect(result.matches[0]).toMatchObject({ secondaryParams: matched.secondaryParams, secondaryTimingCaptionIndices: [0, 0], secondaryText: matched.secondaryText });
    expect(result.usage.totalTokens).toBe(45);
  });
  it("repairs a missing Shotcraft card with selected images without rewriting a valid image scene", async () => {
    const opening = { ...motionSelection("shotcraft-glow-orb-ambient").segments[0], title: "开场钩子：AI 口播的三个问题", roll: "b-roll" };
    const imageScene = { ...motionSelection("still-image-motion").segments[0], segmentId: "image-scene", startCaptionIndex: 1, endCaptionIndex: 1, roll: "b-roll" };
    const shared = { accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 72, secondaryY: 42, cameraPreset: "none", chart: null };
    const matched = { ...shared, captionIndex: 0, primaryEffectId: opening.primaryEffectId, primaryText: "", secondaryEffectId: "checklist", secondaryText: "三个问题｜字幕分段｜配音节奏｜素材编排" };
    const imageMatch = { ...shared, captionIndex: 1, primaryEffectId: "still-image-motion", primaryText: "展示字幕生成", secondaryEffectId: null, secondaryText: null, compositionBindings: [{ slotId: "image", assetIds: ["captions-image"] }], materialPlaceholder: false };
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ segments: [opening, imageScene] }))
      .mockResolvedValueOnce(response({ repairs: [{ segmentId: opening.segmentId, pairId: "shotcraft-glow-orb-ambient::checklist" }] }))
      .mockResolvedValueOnce(response({ matches: [matched, imageMatch] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "AI 口播", style: "简洁", timelineDurationSeconds: 12, isPro: true,
      captions: [{ startSeconds: 0, endSeconds: 6, text: "三个问题：字幕分段、配音节奏、素材编排。" }, { startSeconds: 6, endSeconds: 12, text: "展示字幕生成。" }],
      materials: [{ id: "captions-image", name: "字幕生成.png", kind: "image", durationSeconds: 0 }],
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.selection.segments[0]).toMatchObject({ ...opening, secondaryEffectId: "checklist", selectionReason: expect.any(String) });
    expect(result.selection.segments[1]).toEqual(imageScene);
    expect(result.matches[0]).toMatchObject({ secondaryEffectId: "checklist", secondaryText: matched.secondaryText });
    expect(result.matches[1].compositionBindings).toEqual(imageMatch.compositionBindings);
    expect(result.usage.totalTokens).toBe(45);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).messages[0].content).toContain("pairId");
  });
  it("completes consecutive image scenes through both AI stages without a duplicate-card repair", async () => {
    const captions = ["展示场景编排。", "展示字幕生成。", "展示配音功能。"].map((text, index) => ({ startSeconds: index * 6, endSeconds: (index + 1) * 6, text }));
    const selection = { segments: captions.map((_, index) => ({
      ...motionSelection("still-image-motion").segments[0], segmentId: `image-${index}`, startCaptionIndex: index, endCaptionIndex: index, roll: "b-roll"
    })) };
    const matches = captions.map((caption, index) => ({ captionIndex: index, primaryEffectId: "still-image-motion", primaryText: caption.text,
      compositionBindings: [{ slotId: "image", assetIds: [`asset-${index}`] }], materialPlaceholder: false,
      secondaryEffectId: null, secondaryText: null, accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 72, secondaryY: 42, cameraPreset: "none", chart: null }));
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response(selection)).mockResolvedValueOnce(response({ matches }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "产品功能", style: "清晰", timelineDurationSeconds: 18, captions, isPro: true,
      materials: captions.map((caption, index) => ({ id: `asset-${index}`, name: `${caption.text}.png`, kind: "image", durationSeconds: 0 })),
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.matches).toHaveLength(3);
    result.matches.forEach((match, index) => expect(match).toMatchObject({ primaryEffectId: "still-image-motion", compositionBindings: [{ slotId: "image", assetIds: [`asset-${index}`] }], materialPlaceholder: false }));
    for (const call of fetchMock.mock.calls) expect(JSON.parse(String(call[1]?.body)).messages[0].content).toContain("图片底层例外");
  });
  it.each(["out-of-menu", "omitted", "duplicate"])("rejects a %s constrained pair repair without advancing to content generation", async (failure) => {
    const segment = { ...motionSelection("shotcraft-radial-wave", 0, "card-swap").segments[0], roll: "b-roll" };
    const second = { ...segment, segmentId: "second", startCaptionIndex: 1, endCaptionIndex: 1, primaryEffectId: "shotcraft-glow-orb-ambient", secondaryEffectId: "converge" };
    const firstRepair = { segmentId: segment.segmentId, pairId: "shotcraft-radial-wave::checklist" };
    const broken = { repairs: failure === "omitted" ? [firstRepair] : [firstRepair,
      { segmentId: failure === "duplicate" ? segment.segmentId : second.segmentId,
        pairId: failure === "out-of-menu" ? "shotcraft-glow-orb-ambient::converge" : "shotcraft-glow-orb-ambient::term-card" }] };
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ segments: [segment, second] }))
      .mockResolvedValueOnce(response(broken)).mockResolvedValueOnce(response(broken));
    vi.stubGlobal("fetch", fetchMock);
    await expect(matchTimelineMotion(config, {
      topic: "风险约束", style: "简洁", timelineDurationSeconds: 12,
      captions: [{ startSeconds: 0, endSeconds: 6, text: "选址、租金、增容、合同。" }, { startSeconds: 6, endSeconds: 12, text: "机会属于长期经营者。" }], materials: [], isPro: true,
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret")).rejects.toThrow("动效组合重选未通过本地校验");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].body).not.toContain("这是第二阶段");
  });
  it.each(["card-swap", "converge"])("repairs the incompatible %s pair from a bounded combination menu before writing card content", async (secondaryEffectId) => {
    const base = { ...motionSelection("shotcraft-radial-wave", 0, secondaryEffectId).segments[0], roll: "b-roll" };
    const matched = { captionIndex: 0, primaryEffectId: "shotcraft-radial-wave", primaryText: "", secondaryEffectId: "checklist", secondaryText: "四条约束｜选址｜租金｜增容｜合同", accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 45, cameraPreset: "none", chart: null };
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ segments: [base] }))
      .mockResolvedValueOnce(response({ repairs: [{ segmentId: base.segmentId, pairId: "shotcraft-radial-wave::checklist" }] }))
      .mockResolvedValueOnce(response({ matches: [matched] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "风险约束", style: "简洁", timelineDurationSeconds: 6,
      captions: [{ startSeconds: 0, endSeconds: 6, text: "四条约束：选址、租金、增容、合同。" }], materials: [], isPro: true,
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstRequest.messages[0].content).toMatch(new RegExp(`"id":"${secondaryEffectId}"[^\\n]*?"shotcraftOverlayEligible":false`));
    const repair = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repair.messages[0].content).toContain("完整组合");
    expect(repair.messages.at(-1).content).toContain("选址、租金、增容、合同");
    const repairSchema = JSON.parse(repair.messages[0].content.split("必须只输出一个 JSON 对象，并严格满足这个 JSON Schema：").at(-1));
    expect(repairSchema.properties.repairs.items.properties.pairId.enum).toContain("shotcraft-radial-wave::checklist");
    expect(repairSchema.properties.repairs.items.properties.pairId.enum.join(" ")).not.toContain(secondaryEffectId);
    expect(result.selection.segments[0]).toMatchObject({ segmentId: base.segmentId, title: base.title, startCaptionIndex: 0, endCaptionIndex: 0, secondaryEffectId: "checklist" });
    expect(result.matches[0].secondaryText).toBe(matched.secondaryText);
    expect(result.usage.totalTokens).toBe(45);
  });
  it("replaces a visually busy base while preserving its information card, and keeps authored text shots standalone", () => {
    const input = { topic: "流程", style: "简洁", timelineDurationSeconds: 6, materials: [], isPro: true,
      captions: [{ startSeconds: 0, endSeconds: 6, text: "先分析字幕，再提取事实。" }], storyboard: { mode: "auto" as const, prompt: "", shotcraftTextMode: "promo" as const } };
    const layered = { segments: [{ ...motionSelection("shotcraft-blur-slide", 0, "checklist").segments[0], roll: "b-roll" as const }] };
    expect(normalizeMotionSelection(layered, selectMotionCandidates(input), input).segments[0]).toMatchObject({ primaryEffectId: "shotcraft-glow-orb-ambient", secondaryEffectId: "checklist" });
    const standalone = { segments: [{ ...layered.segments[0], secondaryEffectId: null }] };
    expect(normalizeMotionSelection(standalone, selectMotionCandidates(input), input).segments[0].primaryEffectId).toBe("shotcraft-blur-slide");
  });
  it.each(["punch-pill", "still-image-motion", "shotcraft-orb-flyline-relay"])("repairs an invalid Shotcraft overlay %s using the licensed overlay whitelist", async (secondaryEffectId) => {
    const base = { ...motionSelection("shotcraft-glow-orb-ambient").segments[0], roll: "b-roll" };
    const matched = { captionIndex: 0, primaryEffectId: base.primaryEffectId, primaryText: "", secondaryEffectId: "checklist", secondaryText: "收入结构｜电费差价｜服务费｜广告", accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 72, secondaryY: 42, cameraPreset: "none", chart: null };
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ segments: [{ ...base, secondaryEffectId }] }))
      .mockResolvedValueOnce(response({ segments: [{ ...base, secondaryEffectId: "checklist" }] }))
      .mockResolvedValueOnce(response({ matches: [matched] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "收入结构", style: "简洁", timelineDurationSeconds: 6, captions: [{ startSeconds: 0, endSeconds: 6, text: "收入由电费差价、服务费和广告组成。" }], materials: [], isPro: true,
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const first = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const repair = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(first.messages[0].content.includes("Shotcraft 叠加卡白名单")).toBe(true);
    expect(first.messages[0].content.includes('"shotcraftOverlayEligible":true')).toBe(true);
    expect(repair.messages.at(-1).content).toContain("当前已是自动混合");
    expect(repair.messages.at(-1).content).toContain("checklist");
    expect(result.matches[0]).toMatchObject({ primaryEffectId: base.primaryEffectId, secondaryEffectId: "checklist" });
  });
  it.each(["shotcraft-glow-orb-ambient", "background-grid"])("asks the model to add a missing card after resolving %s and before the parameter stage", async (primaryEffectId) => {
    const bare = { segments: [{ ...motionSelection(primaryEffectId).segments[0], roll: "b-roll" }] };
    const repair = { repairs: [{ segmentId: bare.segments[0].segmentId, pairId: "shotcraft-glow-orb-ambient::checklist" }] };
    const matched = { captionIndex: 0, primaryEffectId: "shotcraft-glow-orb-ambient", primaryText: "", secondaryEffectId: "checklist", secondaryText: "收入结构｜电费差价｜服务费｜广告", accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 72, secondaryY: 42, cameraPreset: "none", chart: null };
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response(bare)).mockResolvedValueOnce(response(repair)).mockResolvedValueOnce(response({ matches: [matched] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "收入结构", style: "简洁", timelineDurationSeconds: 6, captions: [{ startSeconds: 0, endSeconds: 6, text: "收入由电费差价、服务费和广告组成。" }], materials: [], isPro: true,
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][1].body).toContain("pairId");
    expect(result.selection.segments[0]).toMatchObject({ primaryEffectId: "shotcraft-glow-orb-ambient", secondaryEffectId: "checklist" });
    expect(result.matches[0]).toMatchObject({ primaryEffectId: "shotcraft-glow-orb-ambient", secondaryEffectId: "checklist", secondaryText: matched.secondaryText });
  });
  it.each(["omitted", "deduplicated"])("asks the model to repair an information card that would be %s", async (failure) => {
    const selection = { segments: [{ ...motionSelection("shotcraft-glow-orb-ambient", 0, "checklist").segments[0], roll: "b-roll" }] };
    const matched = { captionIndex: 0, primaryEffectId: "shotcraft-glow-orb-ambient", primaryText: "", secondaryEffectId: "checklist", secondaryText: "收入结构｜电费差价｜服务费｜广告", accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 72, secondaryY: 42, cameraPreset: "none", chart: null };
    const broken = failure === "omitted" ? { ...matched, secondaryEffectId: null, secondaryText: null }
      : { ...matched, primaryText: "收入结构", secondaryText: "收入结构" };
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response(selection)).mockResolvedValueOnce(response({ matches: [broken] })).mockResolvedValueOnce(response({ matches: [matched] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "收入结构", style: "简洁", timelineDurationSeconds: 6, captions: [{ startSeconds: 0, endSeconds: 6, text: "收入由电费差价、服务费和广告组成。" }], materials: [], isPro: true,
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].body).toContain("信息卡未生成");
    expect(result.matches[0]).toMatchObject({ primaryEffectId: matched.primaryEffectId, secondaryEffectId: "checklist", secondaryText: matched.secondaryText });
  });
  it("fails without returning a bare Shotcraft plan when the model repeatedly omits the required card", async () => {
    const bare = { segments: [{ ...motionSelection("shotcraft-glow-orb-ambient").segments[0], roll: "b-roll" }] };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(bare) } }] }))));
    vi.stubGlobal("fetch", fetchMock);
    await expect(matchTimelineMotion(config, {
      topic: "收入结构", style: "简洁", timelineDurationSeconds: 6, captions: [{ startSeconds: 0, endSeconds: 6, text: "收入由电费差价、服务费和广告组成。" }], materials: [], isPro: true,
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret")).rejects.toThrow("动效组合重选未通过本地校验");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].body).not.toContain("这是第二阶段");
  });
  it("finishes a mixed narration storyboard with simultaneous Shotcraft cards and omitted secondary anchors", async () => {
    const cards = ["checklist", "glow-badges", "strike-flip"];
    const captions = [
      { startSeconds: 0, endSeconds: 6, text: "先核算投入，再估算收入。" },
      { startSeconds: 6, endSeconds: 12, text: "选择可靠品牌，检查退出条款。" },
      { startSeconds: 12, endSeconds: 18, text: "不是跑马圈地，而是精细运营。" }
    ];
    const segments = cards.map((id, index) => ({ ...motionSelection("shotcraft-glow-orb-ambient", index, id).segments[0], segmentId: `scene-${index}`, startCaptionIndex: index, roll: "b-roll" }));
    const matches = cards.map((id, captionIndex) => ({
      captionIndex, primaryEffectId: "shotcraft-glow-orb-ambient", primaryText: "", primaryParams: [], primaryTimingCaptionIndices: [],
      secondaryEffectId: id, secondaryText: captions[captionIndex].text.replace("，", "｜"), secondaryParams: [], secondaryTimingCaptionIndices: [],
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 72, secondaryY: 42, cameraPreset: "none", chart: null
    }));
    const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ segments })).mockImplementation(() => Promise.resolve(response({ matches })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "经营决策", style: "简洁", timelineDurationSeconds: 18, captions, materials: [], isPro: true,
      storyboard: { mode: "auto", prompt: "", shotcraftTextMode: "narration" }
    }, "secret");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.matches).toHaveLength(3);
    result.matches.forEach((match, index) => {
      expect(match).toMatchObject({ captionIndex: index, primaryEffectId: "shotcraft-glow-orb-ambient", secondaryEffectId: cards[index], secondaryTimingCaptionIndices: [index] });
    });
  });

  it("字幕分镜的两阶段共享角色、要求、素材和时间轴，并保持镜头到组尾", async () => {
    const selection = motionSelection("shotcraft-blur-slide", 1);
    const captions = [{ startSeconds: 0, endSeconds: 4, text: "生成很快" }, { startSeconds: 4, endSeconds: 8, text: "改片很慢" }];
    const matched = { captionIndex: 0, primaryEffectId: "shotcraft-blur-slide", primaryText: "生成很快｜改片很慢", secondaryEffectId: null, secondaryText: null, accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", chart: null };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ segments: selection.segments.map((s) => ({ ...s, roll: "b-roll" })) }) } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ matches: [matched] }) } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, { topic: "痛点", style: "简洁", captions, timelineDurationSeconds: 8, materials: [{ id: "screenshot", kind: "image", name: "产品时间线", durationSeconds: 0 }], storyboard: { mode: "b-roll", prompt: "0-8秒 B-roll 用柔焦标题对比生成和改片" }, timelineVisuals: [], isPro: true }, "secret");
    expect(result.matches[0]).toMatchObject({ primaryText: matched.primaryText, persistUntilCaptionIndex: 1, motionGroupId: "segment-1" });
    expect(result.selection.segments[0].roll).toBe("b-roll");
    for (const call of fetchMock.mock.calls) {
      const payload = JSON.parse(String(call[1]?.body));
      expect(payload.messages[0].content).toContain("0-8秒 B-roll");
      expect(payload.messages[0].content).toContain("产品时间线");
      expect(payload.messages.at(-1).content).toContain("改片很慢");
    }
  });
  it("assembles a streamed Responses API structured output and reports progress", async () => {
    const script = { title: "流式响应", article: "文章", narration: "口播", captions: [{ startSeconds: 0, endSeconds: 2, text: "逐步返回内容。" }] };
    const serialized = JSON.stringify(script);
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      { type: "response.created", response: { id: "response-1" } },
      { type: "response.output_text.delta", delta: serialized.slice(0, 20) },
      { type: "response.output_text.delta", delta: serialized.slice(20) },
      { type: "response.completed", response: { output: [{ content: [{ type: "output_text", text: serialized }] }], usage: { input_tokens: 8, output_tokens: 12, total_tokens: 20 } } }
    ]));
    vi.stubGlobal("fetch", fetchMock);
    const progress = vi.fn();

    await expect(generateTimedScript({ ...config, protocol: "openai-responses" }, {
      topic: "流式响应", durationSeconds: 2, style: "简洁"
    }, "secret", undefined, progress)).resolves.toMatchObject({ script: { title: "流式响应" }, usage: { totalTokens: 20 } });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.stream).toBe(true);
    expect(payload).not.toHaveProperty("stream_options");
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: "receiving" }));
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "validating", message: "正在校验文章与时间字幕" }));
  });

  it("assembles Chat Completions content split across SSE chunks", async () => {
    const script = { title: "兼容接口", article: "文章", narration: "口播", captions: [{ startSeconds: 0, endSeconds: 2, text: "兼容流式返回。" }] };
    const serialized = JSON.stringify(script);
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      { choices: [{ delta: { content: serialized.slice(0, 18) } }] },
      { choices: [{ delta: { content: serialized.slice(18) } }] },
      { choices: [], usage: { prompt_tokens: 11, completion_tokens: 13, total_tokens: 24 } },
      "[DONE]"
    ]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateTimedScript(config, {
      topic: "兼容接口", durationSeconds: 2, style: "简洁"
    }, "secret")).resolves.toMatchObject({ script: { title: "兼容接口" }, usage: { totalTokens: 24 } });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });

  it("generates editable copy without asking the model for timed captions", async () => {
    const script = { title: "独立文案", article: "完整文章", narration: "自然口播。" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(script) } }],
      usage: { prompt_tokens: 9, completion_tokens: 11, total_tokens: 20 }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateScriptCopy(config, {
      topic: "字幕两步生成", durationSeconds: 30, style: "专业清晰"
    }, "secret")).resolves.toMatchObject({ script, usage: { totalTokens: 20 } });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.messages[0].content).toContain("不生成字幕、时间码");
    expect(payload.messages[0].content).toContain('"required":["title","article","narration"]');
    expect(payload.messages[0].content).not.toContain('"captions"');
  });

  it("grounds AI chapter boundaries to subtitle indexes", async () => {
    const response = {
      chapters: [
        { captionIndex: 0, title: "开场背景" },
        { captionIndex: 2, title: "核心方法" },
        { captionIndex: 70, title: "越界章节" }
      ]
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(response) } }],
      usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateSubtitleChapters(config, {
      requestedCount: 3,
      timelineDurationSeconds: 9,
      captions: [
        { startSeconds: 0, endSeconds: 2, text: "先说明背景。" },
        { startSeconds: 2, endSeconds: 5, text: "接着解释问题。" },
        { startSeconds: 5, endSeconds: 9, text: "最后给出方法。" }
      ]
    }, "secret")).resolves.toMatchObject({
      chapters: [{ captionIndex: 0, title: "开场背景" }, { captionIndex: 2, title: "核心方法" }],
      usage: { totalTokens: 23 }
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.messages.at(-1)?.content).toContain('"startSeconds":5');
    expect(payload.messages.at(-1)?.content).toContain("章节起点必须引用字幕索引");
  });

  it("assembles streamed Anthropic tool input before schema validation", async () => {
    const script = { title: "工具调用", article: "文章", narration: "口播", captions: [{ startSeconds: 0, endSeconds: 2, text: "工具参数流式返回。" }] };
    const serialized = JSON.stringify(script);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([
      { type: "message_start", message: { usage: { input_tokens: 9 } } },
      { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: serialized.slice(0, 16) } },
      { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: serialized.slice(16) } },
      { type: "message_delta", usage: { output_tokens: 14 } },
      { type: "message_stop" }
    ])));

    await expect(generateTimedScript({ ...config, protocol: "anthropic" }, {
      topic: "工具调用", durationSeconds: 2, style: "简洁"
    }, "secret")).resolves.toMatchObject({ script: { title: "工具调用" }, usage: { inputTokens: 9, outputTokens: 14, totalTokens: 23 } });
  });

  it("surfaces an SSE error event without applying partial output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([
      { type: "response.output_text.delta", delta: "{\"title\":" },
      { type: "error", message: "upstream disconnected" }
    ])));

    await expect(generateTimedScript({ ...config, protocol: "openai-responses" }, {
      topic: "错误", durationSeconds: 2, style: "简洁"
    }, "secret")).rejects.toThrow("upstream disconnected");
  });

  it("surfaces an incomplete Responses stream as a terminal failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([
      { type: "response.output_text.delta", delta: "{\"title\":\"partial\"}" },
      { type: "response.incomplete", response: { incomplete_details: { reason: "max_output_tokens" } } }
    ])));

    await expect(generateTimedScript({ ...config, protocol: "openai-responses" }, {
      topic: "不完整", durationSeconds: 2, style: "简洁"
    }, "secret")).rejects.toThrow("模型未能完成流式响应");
  });

  it("keeps script generation and timeline motion matching as independent requests", async () => {
    const script = { title: "充电桩", article: "文章", narration: "口播", captions: [{ startSeconds: 0, endSeconds: 2, text: "市场份额增长达到42%。" }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(script) } }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateTimedScript(config, { topic: "充电桩", durationSeconds: 2, style: "专业" }, "secret")).resolves.toMatchObject({ script: { captions: [{ text: "市场份额增长达到42%。" }] } });
    expect(fetchMock).toHaveBeenCalledOnce();

    const matches = [
      { captionIndex: 0, motionGroupId: "segment-1", persistUntilCaptionIndex: 1, primaryEffectId: "stat-proof", primaryText: "市场份额增长达到42%。", primaryParams: [{ key: "footZh", value: "来源：公开数据" }], secondaryEffectId: null, secondaryText: null, accentColor: "#47d7ac", x: 50, y: 30, scale: 1, secondaryX: 75, secondaryY: 60, cameraPreset: "push-in", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", chart: null },
      { captionIndex: 1, motionGroupId: "segment-1", persistUntilCaptionIndex: 1, primaryEffectId: "quote-lockup", primaryText: "最后给出明确结论。", secondaryEffectId: null, secondaryText: null, accentColor: "#47d7ac", x: 50, y: 35, scale: 1, secondaryX: 75, secondaryY: 60, cameraPreset: "pull-out", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", chart: null }
    ];
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(motionSelection("stat-proof", 1, "quote-lockup")) } }], usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ matches }) } }], usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 } }), { status: 200 }));
    const result = await matchTimelineMotion(config, {
      topic: "充电桩", style: "专业", timelineDurationSeconds: 10, materials: [],
      captions: [{ startSeconds: 0, endSeconds: 2, text: "市场份额增长达到42%。" }, { startSeconds: 8.5, endSeconds: 10, text: "最后给出明确结论。" }],
      isPro: true
    }, "secret");
    expect(result.matches?.map((match) => match.primaryText)).toEqual(["份额增长达到42%", "明确结论"]);
    const selectionPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const timelinePayload = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(selectionPayload.messages.at(-1)?.content).toContain('"stage":"opening"');
    expect(selectionPayload.messages.at(-1)?.content).toContain('"stage":"ending"');
    expect(selectionPayload.messages.at(-1)?.content).toContain('"startSeconds":0');
    expect(selectionPayload.messages[0]?.content).toContain('"densityPerMinute":{"min":8,"max":12}');
    expect(selectionPayload.messages[0]?.content).toContain("0 到 5 秒必须建立 intent=hook");
    for (const effect of allCompositions().filter((candidate) => !["chapter-bar", "caption-track"].includes(candidate.id) && !isShotcraftComposition(candidate.id))) {
      expect(selectionPayload.messages[0]?.content).toContain(`"id":"${effect.id}"`);
    }
    expect(selectionPayload.messages[0]?.content).toContain('"purposeGroup":"证据实证"');
    expect(selectionPayload.messages[0]?.content).toContain('"referenceStage":true');
    expect(selectionPayload.messages[0]?.content).toContain('"usage":"fullscreen"');
    expect(selectionPayload.messages[0]?.content).toContain('"usage":"talking-head"');
    expect(selectionPayload.messages[0]?.content).toContain('"layer":"background"');
    expect(selectionPayload.messages[0]?.content).toContain('"exclusive":true');
    expect(timelinePayload.messages[0]?.content).toContain('"usage":"both"');
    expect(timelinePayload.messages[0]?.content).toContain("动效适用范围规则：每张卡的 usage");
    expect(timelinePayload.messages[0]?.content).toContain("roleHint=a-roll 或 presenter 时只能选 talking-head 和 both");
    expect(timelinePayload.messages[0]?.content).toContain('"id":"stat-proof"');
    expect(timelinePayload.messages[0]?.content).toContain('"category":"数据"');
    expect(timelinePayload.messages[0]?.content).toContain('"purposeGroup":"证据实证"');
    expect(timelinePayload.messages[0]?.content).toContain("证据出处规则");
    expect(timelinePayload.messages[0]?.content).toContain("本次已选动效中 stat-proof");
    expect(timelinePayload.messages[0]?.content).toContain("里程碑/成绩/金额");
    expect(timelinePayload.messages[0]?.content).toContain("referenceStage=true 时，外层 x=50、y=50、scale=1");
    for (const id of ["chapter-bar", "caption-track"]) expect(selectionPayload.messages[0]?.content).not.toContain(`"id":"${id}"`);
  });

  it("offers every automatic motion effect to the selection stage", () => {
    const candidates = selectMotionCandidates({
      topic: "AI 口播视频制作的痛点与解决方案",
      style: "专业",
      article: "先说明重复剪辑、素材整理和交付慢三类痛点，再给出自动化处理流程。",
      timelineDurationSeconds: 12,
      materials: [],
      isPro: true,
      captions: [
        { startSeconds: 0, endSeconds: 4, text: "口播制作有重复剪辑和素材整理两大痛点。" },
        { startSeconds: 4, endSeconds: 8, text: "这些问题会拖慢交付。" },
        { startSeconds: 8, endSeconds: 12, text: "解决方案是按三个步骤自动完成。" }
      ]
    });
    const expected = allCompositions().filter((candidate) => !["chapter-bar", "caption-track"].includes(candidate.id) && !isShotcraftComposition(candidate.id));
    expect(candidates.map((candidate) => candidate.id)).toEqual(expected.map((candidate) => candidate.id));
  });

  it("only offers text-free Shotcraft to narration storyboards", () => {
    const input = {
      topic: "产品介绍",
      style: "专业",
      timelineDurationSeconds: 8,
      materials: [
        { id: "image-a", name: "图片 A", kind: "image" as const, durationSeconds: 0 },
        { id: "image-b", name: "图片 B", kind: "image" as const, durationSeconds: 0 }
      ],
      captions: [{ startSeconds: 0, endSeconds: 8, text: "用画面辅助口播说明。" }],
      isPro: true
    };
    const narrationIds = selectMotionCandidates({ ...input, storyboard: { mode: "b-roll" as const, prompt: "", shotcraftTextMode: "narration" as const } }).map((candidate) => candidate.id);
    const promoIds = selectMotionCandidates({ ...input, storyboard: { mode: "b-roll" as const, prompt: "", shotcraftTextMode: "promo" as const } }).map((candidate) => candidate.id);

    expect(narrationIds).toContain("shotcraft-card-stack");
    expect(narrationIds).not.toContain("shotcraft-blur-slide");
    expect(narrationIds).not.toContain("shotcraft-lead-word-zoom-assemble");
    expect(promoIds).toContain("shotcraft-blur-slide");
    expect(promoIds).toContain("shotcraft-lead-word-zoom-assemble");
  });

  it("keeps a Shotcraft base and a grounded card together only in automatic mixed storyboards", () => {
    const baseSelection = motionSelection("shotcraft-glow-orb-ambient", 1, "checklist");
    const layeredSelection = { segments: [{ ...baseSelection.segments[0], roll: "b-roll" as const }] };
    const input = {
      topic: "产品说明", style: "专业", timelineDurationSeconds: 8, materials: [], isPro: true,
      captions: [{ startSeconds: 0, endSeconds: 4, text: "先分析字幕。" }, { startSeconds: 4, endSeconds: 8, text: "再提取事实生成卡片。" }],
      storyboard: { mode: "auto" as const, prompt: "", shotcraftTextMode: "promo" as const }
    };
    const normalized = normalizeMotionSelection(layeredSelection, allCompositions(), input);
    expect(normalized.segments[0]).toMatchObject({ primaryEffectId: "shotcraft-glow-orb-ambient", secondaryEffectId: "checklist" });

    const grounded = groundMotionMatchesToSelection([{
      captionIndex: 0, primaryEffectId: "shotcraft-glow-orb-ambient", primaryText: "", secondaryEffectId: "checklist",
      secondaryText: "处理流程｜分析字幕｜提取事实｜生成卡片", accentColor: "#5fa8ff", x: 50, y: 50, scale: 1,
      secondaryX: 74, secondaryY: 45, cameraPreset: "none", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", videoLayers: [], backdropPreset: "none", chart: null
    }], normalized, input.captions);
    expect(grounded[0]).toMatchObject({ primaryEffectId: "shotcraft-glow-orb-ambient", secondaryEffectId: "checklist" });

    const fallbackSelection = motionSelection("checklist", 1);
    const fallback = normalizeMotionSelection({ segments: [{ ...fallbackSelection.segments[0], roll: "b-roll" as const }] }, allCompositions(), input).segments[0];
    expect(isShotcraftComposition(fallback.primaryEffectId ?? "")).toBe(true);
    expect(fallback.secondaryEffectId).toBe("checklist");
  });

  it("preserves the selected information card when an unbound Shotcraft base is replaced", () => {
    const selection = { segments: [{ ...motionSelection("shotcraft-card-stack", 0, "checklist").segments[0], roll: "b-roll" as const }] };
    const input = {
      topic: "收入结构", style: "简洁", timelineDurationSeconds: 6, materials: [], isPro: true,
      captions: [{ startSeconds: 0, endSeconds: 6, text: "收入由电费差价、服务费和广告组成。" }],
      storyboard: { mode: "auto" as const, prompt: "", shotcraftTextMode: "narration" as const }
    };
    const normalized = normalizeMotionSelection(selection, selectMotionCandidates(input), input);
    expect(normalized.segments[0].primaryEffectId).not.toBe("shotcraft-card-stack");
    expect(isShotcraftComposition(normalized.segments[0].primaryEffectId ?? "")).toBe(true);
    expect(normalized.segments[0].secondaryEffectId).toBe("checklist");
    const pure = normalizeMotionSelection(selection, selectMotionCandidates(input), { ...input, storyboard: { ...input.storyboard, mode: "b-roll" } });
    expect(pure.segments[0].secondaryEffectId).toBeNull();
  });

  it("locally restores an ordinary selected card when the second stage omits it", () => {
    const baseSelection = motionSelection("shotcraft-blur-slide", 0, "strike-flip");
    const selection = { segments: [{ ...baseSelection.segments[0], roll: "b-roll" as const }] };
    const captions = [{ startSeconds: 0, endSeconds: 6, text: "真正决定结果的不是跑马圈地，而是精细运营。" }];
    const matches: AiMotionMatch[] = [{
      captionIndex: 0, subtitleKeywords: [], motionGroupId: null, persistUntilCaptionIndex: null,
      primaryEffectId: "shotcraft-blur-slide", primaryText: "从跑马圈地到精细运营", primaryParams: [], primaryTimingCaptionIndices: [],
      compositionBindings: [], materialPlaceholder: false, secondaryEffectId: null, secondaryText: null,
      secondaryParams: [], secondaryTimingCaptionIndices: [], accentColor: "#5fa8ff", x: 50, y: 50, scale: 1,
      secondaryX: 72, secondaryY: 42, cameraPreset: "none", soundEffectId: null, shotcraftTransition: "none",
      shotcraftSounds: [], videoLayers: [], backdropPreset: "none", chart: null,
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full"
    }];

    const completed = ensureSelectedMotionMatches(matches, selection, captions);
    expect(completed[0]).toMatchObject({
      primaryEffectId: "shotcraft-blur-slide",
      secondaryEffectId: "strike-flip",
      secondaryText: "跑马圈地｜精细运营",
      secondaryParams: expect.arrayContaining([
        { key: "aText", value: "跑马圈地" },
        { key: "bText", value: "精细运营" }
      ])
    });
    expect(validateMotionMatchPlan(completed, selection, captions).map((issue) => issue.code)).not.toContain("selected-effect-missing");
  });

  it("only offers licensed motion effects to Free users", () => {
    const input = {
      topic: "产品介绍",
      style: "专业",
      timelineDurationSeconds: 4,
      materials: [],
      captions: [{ startSeconds: 0, endSeconds: 4, text: "展示产品能力。" }]
    };
    expect(selectMotionCandidates({ ...input, isPro: false }).map((candidate) => candidate.id)).not.toContain("poster-wall-3d");
    expect(selectMotionCandidates({ ...input, isPro: false }).map((candidate) => candidate.id)).toContain("pain-points");
    expect(selectMotionCandidates({ ...input, isPro: true }).map((candidate) => candidate.id)).toContain("poster-wall-3d");
  });

  it("rechecks ordinary storyboard sounds against the current identity", () => {
    const match: AiMotionMatch = {
      captionIndex: 0, primaryEffectId: null, primaryText: "", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50,
      cameraPreset: "none", soundEffectId: "shotcraft-audio:sfx-camera-ui-zoom-in", videoLayers: [],
      backdropPreset: "none", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", chart: null
    };
    expect(motionMatchesAccessIssue([match], false)).toContain(match.soundEffectId);
    expect(motionMatchesAccessIssue([match], true)).toBeUndefined();
  });

  it("splits long subtitle lists only at stable boundaries without dropping indexes", () => {
    const captions = Array.from({ length: 161 }, (_, index) => ({
      startSeconds: index * 2,
      endSeconds: index * 2 + 1.5,
      text: index === 70 || index === 140 ? `第 ${index} 段结束。` : `第 ${index} 条字幕`
    }));
    const chunks = motionCaptionChunks(captions);
    expect(chunks.length).toBe(3);
    expect(chunks[0].start).toBe(0);
    expect(chunks.at(-1)?.end).toBe(captions.length);
    expect(chunks.every((chunk) => chunk.end > chunk.start && chunk.end - chunk.start <= 80)).toBe(true);
    expect(chunks.slice(1).every((chunk, index) => chunk.start === chunks[index].end)).toBe(true);
  });

  it("grounds second-stage matches to the selected semantic segment", () => {
    const base = {
      captionIndex: 1, primaryEffectId: "pain-points", primaryText: "痛点｜重复剪辑｜素材混乱", secondaryEffectId: "quote-lockup", secondaryText: "不允许的换卡",
      accentColor: "#5fa8ff", x: 50, y: 28, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none" as const, videoLayers: [], backdropPreset: "none" as const,
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null,
      primaryTimingCaptionIndices: [0, 1, 4], secondaryTimingCaptionIndices: []
    };
    const captions = Array.from({ length: 3 }, (_, index) => ({ startSeconds: index, endSeconds: index + 1, text: `字幕 ${index}` }));
    const selection = motionSelection("pain-points", 2);
    expect(groundMotionMatchesToSelection([base], selection, captions)[0]).toMatchObject({
      motionGroupId: "segment-1",
      persistUntilCaptionIndex: 2,
      primaryEffectId: "pain-points",
      primaryTimingCaptionIndices: [0, 1],
      secondaryEffectId: null,
      secondaryText: null
    });
  });

  it("preserves secondary copy, params, and timing when it is the only staggered entry", () => {
    const selection = motionSelection("pain-points", 2, "punch-pill");
    const captions = Array.from({ length: 3 }, (_, index) => ({ startSeconds: index, endSeconds: index + 1, text: `字幕 ${index}` }));
    const [grounded] = groundMotionMatchesToSelection([{
      captionIndex: 1,
      primaryEffectId: null,
      primaryText: "",
      primaryParams: [],
      primaryTimingCaptionIndices: [],
      secondaryEffectId: "punch-pill",
      secondaryText: "最终结论",
      secondaryParams: [{ key: "position", value: "bottom" }],
      secondaryTimingCaptionIndices: [1],
      accentColor: "#5fa8ff",
      x: 50,
      y: 30,
      scale: 1,
      secondaryX: 75,
      secondaryY: 60,
      cameraPreset: "none",
      videoLayers: [],
      backdropPreset: "none",
      primaryMediaAssetId: null,
      primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0,
      mediaLayoutPreset: "full",
      chart: null
    }], selection, captions);
    expect(grounded).toMatchObject({
      primaryEffectId: "punch-pill",
      primaryText: "最终结论",
      primaryParams: [{ key: "position", value: "bottom" }],
      primaryTimingCaptionIndices: [1],
      secondaryEffectId: null
    });
  });

  it("keeps material-driven effects visible in selection before material assignment", () => {
    const input = {
      topic: "软件录屏演示",
      style: "清晰",
      timelineDurationSeconds: 8,
      captions: [{ startSeconds: 0, endSeconds: 8, text: "展示软件操作流程并推近关键按钮。" }]
    };
    expect(selectMotionCandidates({ ...input, materials: [] }).map((candidate) => candidate.id)).toContain("screen-demo");
    expect(selectMotionCandidates({
      ...input,
      materials: [{ id: "screen", name: "产品录屏.mp4", kind: "video", durationSeconds: 8, roleHint: "screen" }]
    }).map((candidate) => candidate.id)).toContain("screen-demo");
  });

  it("replaces an image-only B-roll card with a full-frame still image motion", () => {
    const input = {
      topic: "产品能力", style: "清晰", timelineDurationSeconds: 6,
      storyboard: { mode: "b-roll" as const, prompt: "" },
      materials: [{ id: "screen", name: "产品截图.png", kind: "image" as const, durationSeconds: 0 }],
      captions: [{ startSeconds: 0, endSeconds: 6, text: "展示产品的字幕生成功能。" }]
    };
    const selection = { segments: [{
      ...motionSelection("pain-points").segments[0],
      roll: "b-roll" as const
    }] };
    expect(normalizeMotionSelection(selection, allCompositions(), input).segments[0]).toMatchObject({
      primaryEffectId: "still-image-motion",
      secondaryEffectId: "pain-points",
      evidenceKinds: ["none", "image"],
      materialNeed: "使用所选图片生成全屏静态图运镜"
    });
  });

  it.each(["auto", "b-roll"] as const)("keeps image-only %s fallback compatible with foreground deduplication", (mode) => {
    const input = {
      topic: "产品能力", style: "清晰", timelineDurationSeconds: 18,
      storyboard: { mode, prompt: "" },
      materials: ["编排", "字幕", "配音"].map((name, index) => ({ id: `image-${index}`, name: `${name}.png`, kind: "image" as const, durationSeconds: 0 })),
      captions: ["展示编排功能。", "展示字幕生成。", "展示配音功能。"].map((text, index) => ({ startSeconds: index * 6, endSeconds: (index + 1) * 6, text }))
    };
    const selection = { segments: ["pain-points", "term-card", "checklist"].map((effectId, index) => ({
      ...motionSelection(effectId).segments[0], segmentId: `scene-${index}`, startCaptionIndex: index, endCaptionIndex: index, roll: "b-roll" as const
    })) };
    expect(validateMotionSelectionPlan(selection, input.captions)).toEqual([]);
    const normalized = normalizeMotionSelection(selection, allCompositions(), input);
    expect(normalized.segments.map((segment) => segment.primaryEffectId)).toEqual(Array(3).fill("still-image-motion"));
    expect(normalized.segments.map((segment) => segment.secondaryEffectId)).toEqual(["pain-points", "term-card", "checklist"]);
    expect(validateMotionSelectionPlan(normalized, input.captions)).toEqual([]);
  });

  it.each([["pain", "quad-map"], ["list", "glow-badges"], ["process", "checklist"]] as const)("uses a semantic foreground for %s instead of always choosing a checklist", (intent, expected) => {
    const input = { topic: "信息结构", style: "清晰", timelineDurationSeconds: 12, isPro: true,
      storyboard: { mode: "auto" as const, prompt: "" }, materials: [],
      captions: [{ startSeconds: 0, endSeconds: 12, text: "第一项、第二项、第三项。" }] };
    const selection = { segments: [{ ...motionSelection("shotcraft-glow-orb-ambient", 0, "checklist").segments[0], roll: "b-roll" as const, intent }] };
    expect(normalizeMotionSelection(selection, selectMotionCandidates(input), input).segments[0].secondaryEffectId).toBe(expected);
    const restricted = selectMotionCandidates(input).filter((effect) => effect.id !== expected);
    if (expected !== "checklist") expect(normalizeMotionSelection(selection, restricted, input).segments[0].secondaryEffectId).toBe("checklist");
  });

  it("adds a full-frame animated background when B-roll has no visual materials", () => {
    const input = {
      topic: "字幕工作流", style: "清晰", timelineDurationSeconds: 6,
      storyboard: { mode: "b-roll" as const, prompt: "" }, materials: [],
      captions: [{ startSeconds: 0, endSeconds: 6, text: "字幕可以按语义组织成清晰的步骤。" }]
    };
    const selection = { segments: [{
      ...motionSelection("pain-points").segments[0],
      roll: "b-roll" as const
    }] };
    expect(normalizeMotionSelection(selection, allCompositions(), input).segments[0]).toMatchObject({
      primaryEffectId: "background-grid",
      secondaryEffectId: "pain-points",
      materialNeed: "无需额外素材；使用全屏动态图形背景承载该段"
    });
  });

  it("uses an eligible full-screen Shotcraft scene for Pro pure B-roll without visual materials", () => {
    const input = {
      topic: "字幕工作流", style: "清晰", timelineDurationSeconds: 6,
      storyboard: { mode: "b-roll" as const, prompt: "" }, materials: [], isPro: true,
      captions: [{ startSeconds: 0, endSeconds: 6, text: "字幕可以按语义组织成清晰的步骤。" }]
    };
    const selection = { segments: [{
      ...motionSelection("pain-points").segments[0],
      roll: "b-roll" as const
    }] };
    const normalized = normalizeMotionSelection(selection, allCompositions(), input).segments[0];
    expect(isShotcraftComposition(normalized.primaryEffectId ?? "")).toBe(true);
    expect(normalized.secondaryEffectId).toBeNull();
    expect(normalized.materialNeed).toBe("无需额外素材；使用全屏 Shotcraft 镜头承载该段");
  });

  it("does not keep an unbound material composition as a secondary effect", () => {
    const input = {
      topic: "字幕工作流", style: "清晰", timelineDurationSeconds: 6,
      storyboard: { mode: "b-roll" as const, prompt: "" }, materials: [],
      captions: [{ startSeconds: 0, endSeconds: 6, text: "这里需要展示一张证据截图。" }]
    };
    const selection = { segments: [{
      ...motionSelection("proof-shot").segments[0],
      roll: "b-roll" as const
    }] };
    expect(normalizeMotionSelection(selection, allCompositions(), input).segments[0]).toMatchObject({
      primaryEffectId: "background-grid",
      secondaryEffectId: null
    });
  });

  it("normalizes non-critical evidence kind aliases before strict selection validation", () => {
    const value = { segments: [
      { evidenceKinds: ["截图", "statistics", "流程", "文字图形", "unexpected-kind"] },
      { evidenceKinds: ["video", 42] }
    ] };
    expect(normalizeMotionSelectionEvidenceKinds(value)).toMatchObject({ segments: [
      { evidenceKinds: ["image", "number", "process", "none"] },
      { evidenceKinds: ["video", 42] }
    ] });
  });

  it("fills a named still-image binding without replacing a valid AI choice", () => {
    const selection = { segments: [
      { ...motionSelection("pain-points").segments[0], segmentId: "one", primaryEffectId: "still-image-motion", startCaptionIndex: 0, endCaptionIndex: 0 },
      { ...motionSelection("pain-points").segments[0], segmentId: "two", primaryEffectId: "still-image-motion", startCaptionIndex: 1, endCaptionIndex: 1 }
    ] };
    const value = { matches: [
      { captionIndex: 0, primaryEffectId: "pain-points", compositionBindings: [], materialPlaceholder: true },
      { captionIndex: 1, primaryEffectId: "still-image-motion", compositionBindings: [{ slotId: "image", assetIds: ["image-b"] }], materialPlaceholder: false }
    ] };
    expect(ensureStoryboardBaseLayers(value, selection, ["image-a", "image-b"], {
      materials: [{ id: "image-a", name: "字幕生成.png", kind: "image", durationSeconds: 0 }, { id: "image-b", name: "配音.png", kind: "image", durationSeconds: 0 }],
      captions: [{ startSeconds: 0, endSeconds: 3, text: "展示字幕生成" }, { startSeconds: 3, endSeconds: 6, text: "展示配音" }]
    })).toMatchObject({ matches: [
      { primaryEffectId: "still-image-motion", compositionBindings: [{ slotId: "image", assetIds: ["image-a"] }], materialPlaceholder: false },
      { primaryEffectId: "still-image-motion", compositionBindings: [{ slotId: "image", assetIds: ["image-b"] }], materialPlaceholder: false }
    ] });
  });

  it("promotes a generated full-frame background above its text card before validation", () => {
    const selection = { segments: [{
      ...motionSelection("pain-points").segments[0],
      roll: "b-roll" as const,
      primaryEffectId: "background-grid",
      secondaryEffectId: "pain-points"
    }] };
    const value = { matches: [{
      captionIndex: 0,
      primaryEffectId: "pain-points",
      primaryText: "字幕问题｜分段错误｜时间偏移｜需要修复",
      primaryParams: [{ key: "items", value: "分段错误|时间偏移" }],
      primaryTimingCaptionIndices: [0],
      secondaryEffectId: null,
      secondaryText: null,
      secondaryParams: [],
      secondaryTimingCaptionIndices: [],
      compositionBindings: [],
      materialPlaceholder: false
    }] };
    expect(ensureStoryboardBaseLayers(value, selection, [])).toMatchObject({ matches: [{
      primaryEffectId: "background-grid",
      primaryText: "",
      secondaryEffectId: "pain-points",
      secondaryText: "字幕问题｜分段错误｜时间偏移｜需要修复",
      secondaryParams: [{ key: "items", value: "分段错误|时间偏移" }]
    }] });
  });

  it("aligns a generated background and its staggered foreground to the same subtitle scene", () => {
    const selection = { segments: [{
      ...motionSelection("background-dots", 2, "pain-points").segments[0],
      roll: "b-roll" as const
    }] };
    const captions = Array.from({ length: 3 }, (_, index) => ({ startSeconds: index * 2, endSeconds: index * 2 + 2, text: `字幕 ${index}` }));
    const common = {
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50,
      cameraPreset: "none" as const, soundEffectId: null, videoLayers: [], backdropPreset: "none" as const,
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null
    };
    const grounded = groundMotionMatchesToSelection([
      {
        ...common, captionIndex: 0, primaryEffectId: "background-dots", primaryText: "", primaryParams: [],
        primaryTimingCaptionIndices: [], compositionBindings: [], materialPlaceholder: false,
        secondaryEffectId: null, secondaryText: null, secondaryParams: [], secondaryTimingCaptionIndices: []
      },
      {
        ...common, captionIndex: 1, primaryEffectId: "pain-points", primaryText: "三个关键问题｜成本｜效率｜风险",
        primaryParams: [{ key: "items", value: "成本|效率|风险" }], primaryTimingCaptionIndices: [1],
        compositionBindings: [], materialPlaceholder: false, secondaryEffectId: null, secondaryText: null,
        secondaryParams: [], secondaryTimingCaptionIndices: []
      }
    ], selection, captions);

    expect(grounded[0]).toMatchObject({
      captionIndex: 0,
      primaryEffectId: "background-dots",
      secondaryEffectId: "pain-points",
      secondaryText: "三个关键问题｜成本｜效率｜风险",
      persistUntilCaptionIndex: 2
    });
    expect(grounded[1]).toMatchObject({ captionIndex: 1, primaryEffectId: null, secondaryEffectId: null });
  });

  it("asks the model to repair an invalid selection once and includes both usages", async () => {
    const invalidSelection = motionSelection("pain-points", 1);
    invalidSelection.segments.push({
      ...invalidSelection.segments[0],
      segmentId: "segment-2",
      startCaptionIndex: 1
    });
    const repairedSelection = motionSelection("pain-points", 1);
    const matches = [{
      captionIndex: 0, subtitleKeywords: [], motionGroupId: "segment-1", persistUntilCaptionIndex: 1,
      primaryEffectId: "pain-points", primaryText: "主要痛点｜重复剪辑｜素材混乱", primaryParams: [], primaryTimingCaptionIndices: [0, 1],
      compositionBindings: [], materialPlaceholder: false, secondaryEffectId: null, secondaryText: null, secondaryParams: [], secondaryTimingCaptionIndices: [],
      accentColor: "#5fa8ff", x: 50, y: 35, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none", soundEffectId: null, videoLayers: [], backdropPreset: "none", chart: null
    }];
    const response = (value: unknown, totalTokens: number) => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(value) } }],
      usage: { prompt_tokens: totalTokens - 2, completion_tokens: 2, total_tokens: totalTokens }
    }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(invalidSelection, 10))
      .mockResolvedValueOnce(response(repairedSelection, 12))
      .mockResolvedValueOnce(response({ matches }, 18));
    vi.stubGlobal("fetch", fetchMock);

    const result = await matchTimelineMotion(config, {
      topic: "制作痛点分析", style: "专业", timelineDurationSeconds: 6, materials: [],
      captions: [
        { startSeconds: 0, endSeconds: 3, text: "重复剪辑浪费了大量时间。" },
        { startSeconds: 3, endSeconds: 6, text: "素材混乱继续拖慢交付。" }
      ]
    }, "secret");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.usage.totalTokens).toBe(40);
    const repairPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairPayload.messages.at(-1)?.content).toContain("segment-overlap");
    expect(repairPayload.messages.at(-1)?.content).toContain("只返回修正后的完整 JSON");
  });

  it("asks the model to repair invalid second-stage timing anchors once", async () => {
    const selection = motionSelection("pain-points", 1);
    const baseMatch = {
      captionIndex: 0, subtitleKeywords: [], motionGroupId: "segment-1", persistUntilCaptionIndex: 1,
      primaryEffectId: "pain-points", primaryText: "主要痛点｜重复剪辑｜素材混乱", primaryParams: [],
      compositionBindings: [], materialPlaceholder: false, secondaryEffectId: null, secondaryText: null, secondaryParams: [], secondaryTimingCaptionIndices: [],
      accentColor: "#5fa8ff", x: 50, y: 35, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none", soundEffectId: null, videoLayers: [], backdropPreset: "none", chart: null
    };
    const response = (value: unknown, totalTokens: number) => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(value) } }],
      usage: { prompt_tokens: totalTokens - 2, completion_tokens: 2, total_tokens: totalTokens }
    }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(selection, 10))
      .mockResolvedValueOnce(response({ matches: [{ ...baseMatch, primaryTimingCaptionIndices: [0, 3] }] }, 14))
      .mockResolvedValueOnce(response({ matches: [{ ...baseMatch, primaryTimingCaptionIndices: [0, 1] }] }, 16));
    vi.stubGlobal("fetch", fetchMock);

    const result = await matchTimelineMotion(config, {
      topic: "制作痛点分析", style: "专业", timelineDurationSeconds: 6, materials: [],
      captions: [
        { startSeconds: 0, endSeconds: 3, text: "重复剪辑浪费了大量时间。" },
        { startSeconds: 3, endSeconds: 6, text: "素材混乱继续拖慢交付。" }
      ]
    }, "secret");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.usage.totalTokens).toBe(40);
    const repairPayload = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(repairPayload.messages.at(-1)?.content).toContain("timing-outside-segment");
    expect(result.matches[0].primaryTimingCaptionIndices).toEqual([0, 1]);
  });

  it("sends required Overlay Studio slots and keeps returned React bindings", async () => {
    const matches = [{
      captionIndex: 0, subtitleKeywords: ["录屏演示"], motionGroupId: null, persistUntilCaptionIndex: null,
      primaryEffectId: "screen-demo", primaryText: "关键操作", compositionBindings: [{ slotId: "recording", assetIds: ["screen"] }],
      secondaryEffectId: null, secondaryText: null, accentColor: "#47d7ac", x: 50, y: 50, scale: 1,
      secondaryX: 75, secondaryY: 60, cameraPreset: "none", soundEffectId: null, videoLayers: [], backdropPreset: "none", chart: null
    }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(motionSelection("screen-demo")) } }], usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ matches }) } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchTimelineMotion(config, {
      topic: "软件录屏演示", style: "专业", timelineDurationSeconds: 6,
      materials: [{ id: "screen", name: "screen.mp4", kind: "video", durationSeconds: 6, roleHint: "screen" }],
      captions: [{ startSeconds: 0, endSeconds: 6, text: "用录屏演示关键操作。" }]
    }, "secret");
    expect(result.matches[0]).toMatchObject({ primaryEffectId: "screen-demo", compositionBindings: matches[0].compositionBindings });
    expect(result.usage.totalTokens).toBe(30);
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(payload.messages[0]?.content).toContain('"id":"screen-demo"');
    expect(payload.messages[0]?.content).toContain('"id":"recording","label":"演示录屏","kind":"video","minItems":1');
  });

  it("keeps useful divergent motion copy while shortening full-caption repetition", () => {
    expect(compactMotionText("市场份额增长达到42%。", "市场份额增长达到42%。")).toBe("份额增长达到42%");
    expect(compactMotionText("最后给出明确结论。", "最后给出明确结论。")).toBe("明确结论");
    expect(compactMotionText("增长逻辑正在切换", "行业正在进入精细化运营阶段。")).toBe("增长逻辑正在切换");
    expect(compactMotionText("增长达到99%", "市场份额增长达到42%。")).toBe("份额增长达到42%");
    expect(compactMotionText("空气受热｜密度降低｜形成对流", "因为空气受热上升，密度降低，最终形成对流。")).toBe("空气受热｜密度降低｜形成对流");
    expect(compactMotionText("旧数据42%｜新数据99%", "旧数据为42%，随后发生变化。")).not.toBe("旧数据42%｜新数据99%");
    expect(compactMotionText("标题｜第一行内容｜第二行内容｜第三行内容｜第四行内容", "第一行内容，第二行内容，第三行内容，第四行内容。")).not.toContain("｜");
    expect(compactMotionText("标题｜第一行内容｜第二行内容｜第三行内容｜第四行内容", "第一行内容，第二行内容，第三行内容，第四行内容。", true)).toContain("第四行内容");
  });

  it("separates exact subtitle highlights from divergent motion copy", () => {
    const [match] = normalizeMotionMatches([{
      captionIndex: 0,
      subtitleKeywords: ["技术效率", "不存在的词"],
      primaryEffectId: "test-title-slide",
      primaryText: "竞争进入综合能力赛",
      secondaryEffectId: null,
      secondaryText: null,
      accentColor: "#5fa8ff",
      x: 50,
      y: 28,
      scale: 1,
      secondaryX: 75,
      secondaryY: 60,
      cameraPreset: "none",
      videoLayers: [],
      backdropPreset: "soft",
      primaryMediaAssetId: null,
      primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0,
      mediaLayoutPreset: "full",
      chart: null
    }], [{ startSeconds: 0, endSeconds: 4, text: "未来的竞争，将看技术效率、品牌能力和全生命周期服务。" }], 4);
    expect(match.subtitleKeywords).toEqual(["技术效率"]);
    expect(match.primaryText).toBe("竞争进入综合能力赛");
  });

  it("keeps an ungrouped middle title effect instead of downgrading it", () => {
    const [match] = normalizeMotionMatches([{
      captionIndex: 0, primaryEffectId: "duo-title", primaryText: "效率提升｜交付更快｜核心方案",
      secondaryEffectId: null, secondaryText: null, accentColor: "#5fa8ff", x: 50, y: 35, scale: 1,
      secondaryX: 75, secondaryY: 60, cameraPreset: "none", videoLayers: [], backdropPreset: "none",
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", chart: null
    }], [{ startSeconds: 5, endSeconds: 8, text: "核心方案让效率提升，交付更快。" }], 12);
    expect(match.primaryEffectId).toBe("duo-title");
  });

  it("merges fragmented generated captions before fitting them to the target duration", () => {
    const script = normalizeTimedScript({
      title: "市场分析",
      article: "文章",
      narration: "口播",
      captions: [
        { startSeconds: 0, endSeconds: 1, text: "未来，" },
        { startSeconds: 1, endSeconds: 4, text: "行业将进入精细化运营阶段。" }
      ]
    }, 6);
    expect(script.captions).toEqual([
      { startSeconds: 0, endSeconds: 6, text: "未来，行业将进入精细化运营阶段。" }
    ]);
  });

  it("removes duplicate layers without degrading a repeated specialized effect", () => {
    const base = {
      captionIndex: 0, primaryEffectId: "type-shift", primaryText: "开场主题", secondaryEffectId: "type-shift", secondaryText: "开场主题",
      accentColor: "#5fa8ff", x: 50, y: 28, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none" as const, videoLayers: [], backdropPreset: "none" as const,
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null
    };
    const captions = [
      { startSeconds: 0, endSeconds: 1, text: "先介绍开场主题。" },
      { startSeconds: 4, endSeconds: 6, text: "行业进入精细化运营阶段。" },
      { startSeconds: 6, endSeconds: 8, text: "运营效率成为竞争重点。" }
    ];
    const matches = normalizeMotionMatches([
      base,
      { ...base, captionIndex: 1, primaryText: "精细化运营" },
      { ...base, captionIndex: 2, primaryEffectId: "punch-pill", primaryText: "运营效率", secondaryEffectId: null, secondaryText: null }
    ], captions, 10);
    expect(matches[0]).toMatchObject({ primaryEffectId: "type-shift", secondaryEffectId: null, secondaryText: null });
    expect(matches[1]).toMatchObject({ primaryEffectId: "type-shift", primaryText: "精细化运营" });
    expect(matches[2]).toMatchObject({ primaryEffectId: "punch-pill", primaryText: "运营效率" });
  });

  it("keeps scene backgrounds text-free", () => {
    const matches = normalizeMotionMatches([{
      captionIndex: 0, primaryEffectId: "scene-dark-grid", primaryText: "不应出现的重复字幕", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none", videoLayers: [], backdropPreset: "none",
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", chart: null
    }], [{ startSeconds: 0, endSeconds: 3, text: "行业进入精细化运营阶段。" }], 3);
    expect(matches[0]).toMatchObject({ primaryEffectId: "scene-dark-grid", primaryText: "" });
  });

  it("keeps only one repeated background effect in the same motion scene", () => {
    const captions = [
      { startSeconds: 0, endSeconds: 2, text: "先说明问题背景。" },
      { startSeconds: 2, endSeconds: 5, text: "再说明对应解决方案。" }
    ];
    const base = {
      captionIndex: 0, motionGroupId: "problem-solution", persistUntilCaptionIndex: 1,
      primaryEffectId: "scene-dark-grid", primaryText: "", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 50, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none" as const, videoLayers: [], backdropPreset: "none" as const,
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null
    };

    const matches = normalizeMotionMatches([
      base,
      { ...base, captionIndex: 1 }
    ], captions, 5);

    expect(matches.map((match) => match.primaryEffectId)).toEqual(["scene-dark-grid", null]);
  });

  it.each(["pin-board", "step-timeline", "checklist", "pain-points", "action-band", "flow-chart"] as const)(
    "collapses cumulative %s states into the first scene layer with the fullest text",
    (compositionId) => {
      const captions = [
        { startSeconds: 0, endSeconds: 2, text: "先明确问题。" },
        { startSeconds: 2, endSeconds: 4, text: "再分析原因。" },
        { startSeconds: 4, endSeconds: 6, text: "最后给出解决方案。" }
      ];
      const base = {
        captionIndex: 0, motionGroupId: "problem-solution", persistUntilCaptionIndex: 0,
        primaryEffectId: compositionId, primaryText: "核心方法｜明确问题", secondaryEffectId: null, secondaryText: null,
        accentColor: "#5fa8ff", x: 50, y: 35, scale: 1, secondaryX: 75, secondaryY: 60,
        cameraPreset: "none" as const, videoLayers: [], backdropPreset: "none" as const,
        primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
        secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null
      };

      const matches = normalizeMotionMatches([
        base,
        { ...base, captionIndex: 1, persistUntilCaptionIndex: 1, primaryText: "核心方法｜明确问题｜分析原因" },
        { ...base, captionIndex: 2, persistUntilCaptionIndex: 2, primaryText: "核心方法｜明确问题｜分析原因｜解决方案" }
      ], captions, 6);

      expect(matches[0]).toMatchObject({
        captionIndex: 0,
        primaryEffectId: compositionId,
        primaryText: "核心方法｜明确问题｜分析原因｜解决方案",
        persistUntilCaptionIndex: 2
      });
      expect(matches.slice(1).map((match) => match.primaryEffectId)).toEqual([null, null]);
    }
  );

  it("keeps independent stateful cards in the same fallback scene", () => {
    const captions = [
      { startSeconds: 0, endSeconds: 2, text: "先完成发布准备。" },
      { startSeconds: 2, endSeconds: 4, text: "随后检查运营数据。" }
    ];
    const base = {
      captionIndex: 0, motionGroupId: "independent-cards", persistUntilCaptionIndex: 1,
      primaryEffectId: "checklist", primaryText: "发布准备｜校对文案", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 35, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none" as const, videoLayers: [], backdropPreset: "none" as const,
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null
    };

    const matches = normalizeMotionMatches([
      base,
      { ...base, captionIndex: 1, primaryText: "运营检查｜查看转化" }
    ], captions, 4);

    expect(matches.map((match) => match.primaryEffectId)).toEqual(["checklist", "checklist"]);
    expect(matches.map((match) => match.primaryText)).toEqual(["发布准备｜校对文案", "运营检查｜查看转化"]);
  });

  it("keeps a grounded staged motion group across multiple captions", () => {
    const captions = [
      { startSeconds: 11.36, endSeconds: 12.8, text: "市场格局上，" },
      { startSeconds: 12.8, endSeconds: 16, text: "公共充电桩占60%，私人充电桩占40%。" },
      { startSeconds: 16, endSeconds: 17.76, text: "头部运营商占据主导。" }
    ];
    const base = {
      captionIndex: 0, motionGroupId: "charging-market", persistUntilCaptionIndex: 2,
      primaryEffectId: "test-title-slide", primaryText: "市场格局", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 24, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none" as const, videoLayers: [], backdropPreset: "soft" as const,
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null
    };
    const matches = normalizeMotionMatches([
      base,
      {
        ...base,
        captionIndex: 1,
        primaryEffectId: "test-bar-chart",
        primaryText: "充电桩构成",
        chart: { categories: ["公共", "私人"], series: [60, 40], unit: "%" }
      },
      { ...base, captionIndex: 2, primaryEffectId: "test-keyword-underline", primaryText: "头部运营商占据主导" }
    ], captions, 30);

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ captionIndex: 0, motionGroupId: "charging-market", persistUntilCaptionIndex: 2, primaryEffectId: "test-title-slide" }),
      expect.objectContaining({ captionIndex: 1, motionGroupId: "charging-market", chart: expect.objectContaining({ series: [60, 40], unit: "%" }) }),
      expect.objectContaining({ captionIndex: 2, motionGroupId: "charging-market", persistUntilCaptionIndex: 2, primaryEffectId: null })
    ]));
  });

  it("keeps a long scene stable while capping text layers and repeated B-roll", () => {
    const captions = ["背景说明", "核心问题", "影响范围", "第一方法", "第二方法", "案例结果", "场景结论"].map((text, index) => ({
      startSeconds: index * 2,
      endSeconds: index * 2 + 2,
      text: `${text}。`
    }));
    const base = {
      captionIndex: 0,
      motionGroupId: "stable-scene",
      persistUntilCaptionIndex: 6,
      primaryEffectId: "test-callout-panel",
      primaryText: "背景说明",
      secondaryEffectId: "test-keyword-underline",
      secondaryText: "内容提示",
      accentColor: "#5fa8ff",
      x: 35,
      y: 28,
      scale: 1,
      secondaryX: 70,
      secondaryY: 58,
      cameraPreset: "none" as const,
      videoLayers: [{
        assetId: "supporting-video",
        role: "supporting" as const,
        sourceInSeconds: 0,
        layoutPreset: "picture-in-picture-top-right" as const,
        shapePreset: "rounded" as const,
        transitionPreset: "zoom" as const,
        cameraPreset: "push-in" as const,
        volume: 0.6,
        focus: null
      }],
      backdropPreset: "soft" as const,
      primaryMediaAssetId: null,
      primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0,
      mediaLayoutPreset: "full" as const,
      chart: null
    };
    const matches = normalizeMotionMatches(captions.map((caption, index) => ({
      ...base,
      captionIndex: index,
      primaryText: caption.text,
      secondaryText: `${caption.text}提示`
    })), captions, 14);

    expect(matches.every((match) => match.motionGroupId === "stable-scene" && match.persistUntilCaptionIndex === 6)).toBe(true);
    expect(matches.reduce((count, match) => count + Number(Boolean(match.primaryEffectId)) + Number(Boolean(match.secondaryEffectId)), 0)).toBe(2);
    expect(matches.flatMap((match) => match.videoLayers)).toEqual([expect.objectContaining({
      assetId: "supporting-video",
      role: "b-roll",
      layoutPreset: "full",
      shapePreset: "rectangle",
      transitionPreset: "fade",
      volume: 0
    })]);
  });

  it("creates bounded fallback scenes when a model matches every caption independently", () => {
    const captions = ["开场背景", "问题表现", "原因分析", "解决步骤", "最终结果"].map((text, index) => ({
      startSeconds: index * 3,
      endSeconds: index * 3 + 3,
      text: `${text}。`
    }));
    const matches = normalizeMotionMatches(captions.map((caption, index) => ({
      captionIndex: index,
      primaryEffectId: "test-callout-panel",
      primaryText: caption.text,
      secondaryEffectId: null,
      secondaryText: null,
      accentColor: "#5fa8ff",
      x: 50,
      y: 35,
      scale: 1,
      secondaryX: 70,
      secondaryY: 58,
      cameraPreset: "none" as const,
      videoLayers: [],
      backdropPreset: "soft" as const,
      primaryMediaAssetId: null,
      primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0,
      mediaLayoutPreset: "full" as const,
      chart: null
    })), captions, 15);

    expect(matches.every((match) => match.motionGroupId === "auto-scene-0" && match.persistUntilCaptionIndex === 4)).toBe(true);
    expect(matches.filter((match) => match.primaryEffectId || match.secondaryEffectId)).toHaveLength(2);
  });

  it("discards sound choices from visual motion matching", () => {
    const captions = ["章节开始。", "继续说明。", "操作完成。"].map((text, index) => ({ startSeconds: index * 3, endSeconds: index * 3 + 3, text }));
    const base = {
      ...{
        captionIndex: 0, primaryEffectId: null, primaryText: "", secondaryEffectId: null, secondaryText: null,
        accentColor: "#5fa8ff", x: 50, y: 35, scale: 1, secondaryX: 70, secondaryY: 58,
        cameraPreset: "none" as const, videoLayers: [], backdropPreset: "none" as const,
        primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
        secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null
      }
    };
    const matches = normalizeMotionMatches([
      { ...base, captionIndex: 0, motionGroupId: "chapter", persistUntilCaptionIndex: 1, soundEffectId: "shotcraft-audio:sfx-camera-camera-lens-shutter" },
      { ...base, captionIndex: 1, motionGroupId: "chapter", persistUntilCaptionIndex: 1, soundEffectId: "shotcraft-audio:sfx-camera-camera-shutter-hard" },
      { ...base, captionIndex: 2, soundEffectId: "shotcraft-audio:sfx-camera-camera-autofocus" }
    ], captions, 9);
    expect(matches.map((match) => match.soundEffectId)).toEqual([null, null, null]);
  });

  it("keeps one shared sound and Shotcraft action plan in storyboard mode", () => {
    const captions = [{ startSeconds: 0, endSeconds: 4, text: "标题落版。" }];
    const [match] = normalizeMotionMatches([{
      captionIndex: 0, primaryEffectId: "shotcraft-blur-slide", primaryText: "标题落版", primaryParams: [], primaryTimingCaptionIndices: [],
      secondaryEffectId: null, secondaryText: null, secondaryParams: [], secondaryTimingCaptionIndices: [], accentColor: "#5fa8ff",
      x: 50, y: 50, scale: 1, secondaryX: 50, secondaryY: 50, cameraPreset: "none", videoLayers: [], backdropPreset: "none",
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0,
      mediaLayoutPreset: "full", chart: null, soundEffectId: null, shotcraftTransition: "flash-cut",
      shotcraftSounds: [{ event: "title", soundId: "shotcraft-audio:sfx-camera-camera-lens-shutter", volume: 0.3 }]
    }], captions, 4, [], true);
    expect(match).toMatchObject({ shotcraftTransition: "flash-cut", shotcraftSounds: [{ event: "title", volume: 0.3 }] });
  });

  it("keeps an imported A-roll on its existing track while preserving the requested camera move", () => {
    const [match] = normalizeMotionMatches([{
      captionIndex: 0,
      primaryEffectId: "test-keyword-underline",
      primaryText: "核心操作",
      secondaryEffectId: null,
      secondaryText: null,
      accentColor: "#5fa8ff",
      x: 50,
      y: 35,
      scale: 1,
      secondaryX: 70,
      secondaryY: 58,
      cameraPreset: "none",
      videoLayers: [{
        assetId: "main-video",
        role: "a-roll",
        sourceInSeconds: 0,
        layoutPreset: "full",
        shapePreset: "rectangle",
        transitionPreset: "fade",
        cameraPreset: "push-in",
        volume: 1,
        focus: null
      }],
      backdropPreset: "soft",
      primaryMediaAssetId: null,
      primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0,
      mediaLayoutPreset: "full",
      chart: null
    }], [{ startSeconds: 0, endSeconds: 3, text: "先完成这一项核心操作。" }], 3, [{
      id: "main-video",
      name: "main.mp4",
      durationSeconds: 30,
      roleHint: "a-roll"
    }]);

    expect(match).toMatchObject({ cameraPreset: "push-in", videoLayers: [] });
  });

  it("keeps semantic motion groups up to the reference-aligned caption limit", () => {
    const captions = Array.from({ length: 9 }, (_, index) => ({ startSeconds: index, endSeconds: index + 1, text: `第${index + 1}条字幕。` }));
    const match = {
      captionIndex: 0, motionGroupId: "too-long", persistUntilCaptionIndex: 8,
      primaryEffectId: "test-title-slide", primaryText: "第一条字幕", secondaryEffectId: null, secondaryText: null,
      accentColor: "#5fa8ff", x: 50, y: 24, scale: 1, secondaryX: 75, secondaryY: 60,
      cameraPreset: "none" as const, videoLayers: [], backdropPreset: "none" as const,
      primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null,
      secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const, chart: null
    };
    expect(normalizeMotionMatches([match], captions, 9)[0]).toMatchObject({ motionGroupId: "too-long", persistUntilCaptionIndex: 8 });
  });

  it("extracts real Arabic and Chinese numeric facts without treating years as values", () => {
    expect(captionNumericData("据统计，2025年市场规模已突破千亿元。")).toEqual([{ value: 1_000, unit: "亿元" }]);
    expect(captionNumericData("份额从18%提升至42%。")).toEqual([{ value: 18, unit: "%" }, { value: 42, unit: "%" }]);
  });

  it("drops an unsupported trend chart without substituting an unselected simple card", () => {
    const match = {
      captionIndex: 0, primaryEffectId: "test-line-chart", primaryText: "突破千亿", secondaryEffectId: null, secondaryText: null,
      accentColor: "#47d7ac", x: 50, y: 30, scale: 1, secondaryX: 75, secondaryY: 60, cameraPreset: "none" as const,
      videoLayers: [], backdropPreset: "soft" as const, primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const,
      chart: { categories: ["2023", "2025"], series: [100, 200], unit: "亿元" }
    };
    expect(normalizeMotionChart(match, "预计2025年市场规模将超过两千亿元。")).toMatchObject({ primaryEffectId: null, chart: null });
  });

  it("removes chart templates when the caption contains no supporting data", () => {
    const match = {
      captionIndex: 0, primaryEffectId: "test-bar-chart", primaryText: "稳定增长", secondaryEffectId: null, secondaryText: null,
      accentColor: "#47d7ac", x: 50, y: 30, scale: 1, secondaryX: 75, secondaryY: 60, cameraPreset: "none" as const,
      videoLayers: [], backdropPreset: "soft" as const, primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0,
      secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full" as const,
      chart: null
    };
    expect(normalizeMotionChart(match, "充电桩已经成为稳定可持续的优质资产。")).toMatchObject({ primaryEffectId: null, chart: null });
  });

  it("normalizes service roots, v1 roots, and full compatible endpoints", () => {
    expect(providerEndpoint(config)).toBe("https://models.example.com/v1/chat/completions");
    expect(providerEndpoint({ ...config, baseUrl: "https://opencode.ai/zen/v1" })).toBe("https://opencode.ai/zen/v1/chat/completions");
    expect(providerEndpoint({ ...config, baseUrl: "https://models.example.com/v1/chat/completions" })).toBe("https://models.example.com/v1/chat/completions");
    expect(providerEndpoint({ ...config, protocol: "openai-responses", baseUrl: "https://models.example.com/v1/chat/completions" })).toBe("https://models.example.com/v1/responses");
  });

  it("loads and sorts an OpenAI-compatible model list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "z-model" }, { id: "a-model" }] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listProviderModels(config, "secret")).resolves.toEqual({ models: ["a-model", "z-model"], message: "连接成功，发现 2 个模型" });
    expect(fetchMock).toHaveBeenCalledWith("https://models.example.com/v1/models", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer secret" }) }));
  });

  it("retries a transient provider failure with exponential backoff", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "busy" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "ready" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = listProviderModels(config, "secret");
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toMatchObject({ models: ["ready"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight browser provider request", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })));
    const controller = new AbortController();
    const result = listProviderModels(config, "secret", controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow("模型请求已取消");
  });

  it("sends only local material metadata and accepts a matched material id", async () => {
    const script = { title: "开篇", article: "文章", narration: "口播", captions: [{ startSeconds: 0, endSeconds: 3, text: "口播" }] };
    const match = { captionIndex: 0, primaryEffectId: "type-shift", primaryText: "口播", secondaryEffectId: null, secondaryText: null, accentColor: "#ffb84d", x: 50, y: 28, scale: 1, secondaryX: 75, secondaryY: 60, cameraPreset: "push-in", primaryMediaAssetId: "local-video", primaryMediaSourceInSeconds: 2, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", chart: null };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(script) } }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(motionSelection("type-shift")) } }], usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 } }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ matches: [match] }) } }], usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateVideoPlan(config, {
      topic: "制作开篇",
      durationSeconds: 3,
      style: "简洁",
      materials: [{ id: "local-video", name: "office.mp4", durationSeconds: 12, width: 1920, height: 1080, roleHint: "a-roll", transcriptExcerpt: "这是主讲人的口播内容" }]
    }, "secret")).resolves.toMatchObject({ plan: { title: "开篇", captions: [{ text: "口播" }], matches: [expect.objectContaining({ primaryEffectId: "type-shift", primaryMediaAssetId: "local-video" })] }, usage: { totalTokens: 80 } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const motionPayload = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(motionPayload.messages[0].content).toContain('"roleHint":"a-roll"');
    expect(motionPayload.messages[0].content).toContain('"transcriptExcerpt":"这是主讲人的口播内容"');
    expect(motionPayload.messages[0].content).toContain("不要按每条字幕机械切换动效");
    const scriptPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const matchPayload = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(JSON.stringify(matchPayload)).toContain("office.mp4");
    expect(matchPayload.messages.at(-1)?.content).toContain('"captionIndex":0');
    expect(JSON.stringify(matchPayload)).not.toContain("/Users/");
    expect(scriptPayload).not.toHaveProperty("max_tokens");
  });

  it("does not limit Responses API plan output tokens", async () => {
    const script = { title: "开篇", article: "文章", narration: "口播", captions: [{ startSeconds: 0, endSeconds: 3, text: "口播" }] };
    const match = { captionIndex: 0, primaryEffectId: "type-shift", primaryText: "口播", primaryTimingCaptionIndices: [0], secondaryEffectId: null, secondaryText: null, accentColor: "#5fa8ff", x: 50, y: 30, scale: 1, secondaryX: 75, secondaryY: 60, cameraPreset: "none", primaryMediaAssetId: null, primaryMediaSourceInSeconds: 0, secondaryMediaAssetId: null, secondaryMediaSourceInSeconds: 0, mediaLayoutPreset: "full", chart: null };
    const response = (data: unknown) => new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify(data) }] }], usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } }), { status: 200, headers: { "content-type": "application/json" } });
    const fetchMock = vi.fn().mockResolvedValueOnce(response(script)).mockResolvedValueOnce(response(motionSelection("type-shift"))).mockResolvedValueOnce(response({ matches: [match] }));
    vi.stubGlobal("fetch", fetchMock);

    await generateVideoPlan({ ...config, protocol: "openai-responses" }, {
      topic: "制作开篇",
      durationSeconds: 3,
      style: "简洁",
      materials: []
    }, "secret");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("max_output_tokens");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).not.toHaveProperty("max_output_tokens");
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).not.toHaveProperty("max_output_tokens");
  });

  it("probes with a small real request", async () => {
    const compatibleConfig = { ...config, baseUrl: "https://opencode.ai/zen/v1" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyProviderConfiguration(compatibleConfig, "secret")).resolves.toMatchObject({ models: [], message: expect.stringContaining("配置有效") });
    expect(fetchMock.mock.calls[0][0]).toBe("https://opencode.ai/zen/v1/models");
    expect(fetchMock.mock.calls[1][0]).toBe("https://opencode.ai/zen/v1/chat/completions");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ model: "test-model", max_tokens: 16 });
  });

  it("surfaces a failed inference probe even when model listing works", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "test-model" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "model is not available" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyProviderConfiguration(config, "secret")).rejects.toThrow("model is not available");
  });
});
