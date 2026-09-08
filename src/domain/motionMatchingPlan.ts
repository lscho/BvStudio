import { compositionSlots } from "@/domain/compositions";
import { allCompositions } from "@/domain/effects";
import { motionMatchingProfile, referenceMotionMatchingPolicy } from "@/domain/motionMatching";
import type { AiMotionMatch, AiMotionSelection } from "@/services/ai/schema";

export type MotionPlanIssueCode =
  | "duplicate-segment-id"
  | "segment-overlap"
  | "segment-coverage-gap"
  | "opening-hook-missing"
  | "adjacent-effect-kind"
  | "exclusive-overlap"
  | "multiple-backgrounds"
  | "duplicate-caption-match"
  | "match-outside-selection"
  | "effect-outside-selection"
  | "timing-outside-segment"
  | "timing-anchors-required"
  | "invalid-material-placeholder"
  | "duplicate-cumulative-state"
  | "duplicate-selected-effect"
  | "selected-effect-missing"
  | "segment-accent-mismatch"
  | "content-entry-stagger"
  | "too-many-content-layers"
  | "motion-group-mismatch"
  | "unsupported-chart-data"
  | "evidence-source-missing";

export interface MotionPlanIssue {
  code: MotionPlanIssueCode;
  path: string;
  message: string;
}

const effectsById = new Map(allCompositions().map((effect) => [effect.id, effect]));
const cumulativeEffectIds = new Set([
  "pin-board",
  "step-timeline",
  "checklist",
  "info-board",
  "pain-points",
  "action-band",
  "flow-chart",
  "stepper-flow"
]);

export interface MotionPlanCaption {
  startSeconds: number;
  endSeconds: number;
  text?: string;
}

function effectRole(effectId: string | null) {
  const effect = effectId ? effectsById.get(effectId) : undefined;
  return effect ? motionMatchingProfile(effect).layerRole : null;
}

function selectedEffectIds(segment: AiMotionSelection["segments"][number]) {
  return [segment.primaryEffectId, segment.secondaryEffectId].filter((effectId): effectId is string => Boolean(effectId));
}

function normalizedStateText(value: string | null | undefined) {
  return (value ?? "")
    .split(/[|｜\n]/u)
    .map((part) => part.trim().replace(/[\s，。！？、；：,.!?;:]+/gu, ""))
    .filter(Boolean)
    .join("|");
}

export function validateMotionSelectionPlan(selection: AiMotionSelection, captions: readonly MotionPlanCaption[] = []): MotionPlanIssue[] {
  const issues: MotionPlanIssue[] = [];
  const segmentIds = new Set<string>();
  const ordered = selection.segments
    .map((segment, index) => ({ segment, index }))
    .sort((left, right) => left.segment.startCaptionIndex - right.segment.startCaptionIndex || left.segment.endCaptionIndex - right.segment.endCaptionIndex);

  for (const { segment, index } of ordered) {
    const path = `segments.${index}`;
    if (segmentIds.has(segment.segmentId)) {
      issues.push({ code: "duplicate-segment-id", path: `${path}.segmentId`, message: `语义段 ID “${segment.segmentId}”重复` });
    }
    segmentIds.add(segment.segmentId);

    const effectIds = selectedEffectIds(segment);
    const roles = effectIds.map(effectRole);
    if (roles.includes("exclusive") && effectIds.length > 1) {
      issues.push({ code: "exclusive-overlap", path, message: `独占动效不能在语义段“${segment.title}”中与其他动效叠加` });
    }
    if (roles.filter((role) => role === "background").length > 1) {
      issues.push({ code: "multiple-backgrounds", path, message: `语义段“${segment.title}”只能选择一个背景动效` });
    }
  }

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (current.segment.startCaptionIndex <= previous.segment.endCaptionIndex) {
      issues.push({
        code: "segment-overlap",
        path: `segments.${current.index}.startCaptionIndex`,
        message: `语义段“${current.segment.title}”与“${previous.segment.title}”的字幕范围重叠`
      });
    }
  }

  let previousContentEffectId: string | null = null;
  for (const { segment, index } of ordered) {
    for (const effectId of selectedEffectIds(segment).filter((id) => {
      const role = effectRole(id);
      return role === "content" || role === "exclusive";
    })) {
      if (effectId === previousContentEffectId) {
        issues.push({
          code: "adjacent-effect-kind",
          path: `segments.${index}`,
          message: `相邻内容卡不能连续使用同一个动效 ${effectId}`
        });
      }
      previousContentEffectId = effectId;
    }
  }

  if (captions.length) {
    let expectedCaptionIndex = 0;
    for (const { segment, index } of ordered) {
      if (segment.startCaptionIndex > expectedCaptionIndex) {
        issues.push({
          code: "segment-coverage-gap",
          path: `segments.${index}.startCaptionIndex`,
          message: `语义分段遗漏了字幕 ${expectedCaptionIndex} 到 ${segment.startCaptionIndex - 1}`
        });
      }
      expectedCaptionIndex = Math.max(expectedCaptionIndex, segment.endCaptionIndex + 1);
    }
    if (expectedCaptionIndex < captions.length) {
      issues.push({
        code: "segment-coverage-gap",
        path: "segments",
        message: `语义分段遗漏了字幕 ${expectedCaptionIndex} 到 ${captions.length - 1}`
      });
    }

    const hasOpeningCaption = captions.some((caption) => caption.startSeconds < referenceMotionMatchingPolicy.openingHookDeadlineSeconds);
    const hasOpeningHook = ordered.some(({ segment }) => (
      segment.intent === "hook"
      && selectedEffectIds(segment).length > 0
      && (captions[segment.startCaptionIndex]?.startSeconds ?? Number.POSITIVE_INFINITY) < referenceMotionMatchingPolicy.openingHookDeadlineSeconds
    ));
    if (hasOpeningCaption && !hasOpeningHook) {
      issues.push({
        code: "opening-hook-missing",
        path: "segments",
        message: `开头 0-${referenceMotionMatchingPolicy.openingHookDeadlineSeconds} 秒必须有一段 intent=hook 且选择钩子动效`
      });
    }
  }
  return issues;
}

function structuredEntryCount(entry: { text: string | null; params: readonly { value: string | number | boolean }[] }) {
  const counts = [entry.text, ...entry.params.map((param) => typeof param.value === "string" ? param.value : "")]
    .map((value) => (value ?? "").split(/[|｜\n]/u).map((part) => part.trim()).filter(Boolean).length);
  return Math.max(0, ...counts);
}

const explicitSourceParameterKeys = new Set(["source", "caption", "captionEn", "title", "src", "footEn", "footZh"]);

function hasEvidenceSource(entry: { text: string | null; params: readonly { key: string; value: string | number | boolean }[] }) {
  const usableSource = (value: string) => value.trim().length >= 2 && !/(?:待补|占位|示例|写这里|placeholder)/iu.test(value);
  if (entry.params.some((param) => explicitSourceParameterKeys.has(param.key) && typeof param.value === "string" && usableSource(param.value))) return true;
  const visible = [entry.text, ...entry.params.map((param) => typeof param.value === "string" ? param.value : "")].join(" ");
  return usableSource(visible) && /(?:SOURCE|NEWS|CASE|来源|出处|官网|官方|报告|公告|原文|合同|新闻|媒体|采访|公开数据|统计口径|自述|《[^》]+》)/iu.test(visible);
}

export function validateMotionMatchPlan(matches: readonly AiMotionMatch[], selection: AiMotionSelection, captions: readonly MotionPlanCaption[] = []): MotionPlanIssue[] {
  const issues: MotionPlanIssue[] = [];
  const captionIndexes = new Set<number>();
  const segmentEffects = new Map<string, Array<{ effectId: string; path: string; captionIndex: number }>>();
  const cumulativeStates = new Map<string, string>();
  const segmentAccentColors = new Map<string, Set<string>>();

  matches.forEach((match, matchIndex) => {
    const path = `matches.${matchIndex}`;
    if (captionIndexes.has(match.captionIndex)) {
      issues.push({ code: "duplicate-caption-match", path: `${path}.captionIndex`, message: `字幕 ${match.captionIndex} 重复返回了多个匹配结果` });
    }
    captionIndexes.add(match.captionIndex);

    const segment = selection.segments.find((candidate) => (
      match.captionIndex >= candidate.startCaptionIndex && match.captionIndex <= candidate.endCaptionIndex
    ));
    if (!segment) {
      issues.push({ code: "match-outside-selection", path: `${path}.captionIndex`, message: `字幕 ${match.captionIndex} 不属于第一阶段的任何语义段` });
      return;
    }

    const multiCaption = segment.endCaptionIndex > segment.startCaptionIndex;
    const expectedGroupId = multiCaption ? segment.segmentId : null;
    const expectedPersistIndex = multiCaption ? segment.endCaptionIndex : null;
    if ((match.motionGroupId ?? null) !== expectedGroupId || (match.persistUntilCaptionIndex ?? null) !== expectedPersistIndex) {
      issues.push({
        code: "motion-group-mismatch",
        path: `${path}.motionGroupId`,
        message: `语义段“${segment.title}”必须保持同一分组并持续到字幕 ${segment.endCaptionIndex}`
      });
    }

    const allowedEffects = new Set(selectedEffectIds(segment));
    const entries = [
      { slot: "primary" as const, effectId: match.primaryEffectId, text: match.primaryText, timing: match.primaryTimingCaptionIndices ?? [] },
      { slot: "secondary" as const, effectId: match.secondaryEffectId, text: match.secondaryText, timing: match.secondaryTimingCaptionIndices ?? [] }
    ];
    for (const entry of entries) {
      if (!entry.effectId) continue;
      if (!allowedEffects.has(entry.effectId)) {
        issues.push({ code: "effect-outside-selection", path: `${path}.${entry.slot}EffectId`, message: `动效 ${entry.effectId} 不在语义段“${segment.title}”的第一阶段选型中` });
      }
      const invalidTiming = entry.timing.find((index) => index < segment.startCaptionIndex || index > segment.endCaptionIndex);
      if (invalidTiming !== undefined) {
        issues.push({ code: "timing-outside-segment", path: `${path}.${entry.slot}TimingCaptionIndices`, message: `节奏锚点 ${invalidTiming} 超出语义段“${segment.title}”的字幕范围` });
      }
      const current = segmentEffects.get(segment.segmentId) ?? [];
      current.push({ effectId: entry.effectId, path: `${path}.${entry.slot}EffectId`, captionIndex: match.captionIndex });
      segmentEffects.set(segment.segmentId, current);

      const effect = effectsById.get(entry.effectId);
      if (effect) {
        const profile = motionMatchingProfile(effect);
        const params = entry.slot === "primary" ? match.primaryParams ?? [] : match.secondaryParams ?? [];
        const itemCount = Math.max(
          structuredEntryCount({
            text: entry.text,
            params
          }),
          entry.slot === "primary" ? Math.max(0, ...(match.compositionBindings ?? []).map((binding) => binding.assetIds.length)) : 0
        );
        const anchorDrivenKeys = profile.rhythmKeys.filter((key) => ![
          "scrollMs", "countMs", "drawMs", "pushMs", "moveSec", "tourSec", "orbitSec", "periodSec", "cps", "lockMs", "flipMs"
        ].includes(key));
        const needsAnchors = anchorDrivenKeys.length > 0 && (itemCount > 1 || anchorDrivenKeys.length > 1 || anchorDrivenKeys.some((key) => ["times", "stopsAt", "dockTimes", "acts"].includes(key)));
        if (needsAnchors && entry.timing.length === 0) {
          issues.push({
            code: "timing-anchors-required",
            path: `${path}.${entry.slot}TimingCaptionIndices`,
            message: `逐项动效 ${entry.effectId} 必须提供真实字幕节奏锚点`
          });
        }
        if ((profile.purposeGroup === "证据实证" || entry.effectId === "quote-cite") && !hasEvidenceSource({ text: entry.text, params })) {
          issues.push({
            code: "evidence-source-missing",
            path: `${path}.${entry.slot}Params`,
            message: `证据动效 ${entry.effectId} 必须在可见文案或来源参数中写明真实出处`
          });
        }
      }

      if (cumulativeEffectIds.has(entry.effectId)) {
        const stateKey = `${segment.segmentId}:${entry.effectId}:${normalizedStateText(entry.text)}`;
        const existingPath = cumulativeStates.get(stateKey);
        if (existingPath) {
          issues.push({ code: "duplicate-cumulative-state", path: `${path}.${entry.slot}Text`, message: `累积动效 ${entry.effectId} 在同一语义段重复返回了相同状态` });
        } else {
          cumulativeStates.set(stateKey, `${path}.${entry.slot}Text`);
        }
      }
    }

    if (entries.some((entry) => entry.effectId)) {
      const colors = segmentAccentColors.get(segment.segmentId) ?? new Set<string>();
      colors.add(match.accentColor.toLocaleLowerCase());
      segmentAccentColors.set(segment.segmentId, colors);
    }

    if (match.materialPlaceholder) {
      const slots = match.primaryEffectId ? compositionSlots(match.primaryEffectId) : [];
      if (!slots.length || (match.compositionBindings?.length ?? 0) > 0) {
        issues.push({ code: "invalid-material-placeholder", path: `${path}.materialPlaceholder`, message: "素材占位只能用于有素材槽且 compositionBindings 为空的主动效" });
      }
    }
  });

  for (const segment of selection.segments) {
    const entries = segmentEffects.get(segment.segmentId) ?? [];
    const roles = entries.map((entry) => effectRole(entry.effectId));
    if (roles.includes("exclusive") && entries.length > 1) {
      issues.push({ code: "exclusive-overlap", path: entries.find((entry) => effectRole(entry.effectId) === "exclusive")?.path ?? "matches", message: `独占动效不能在语义段“${segment.title}”中与其他动效叠加` });
    }
    if (roles.filter((role) => role === "background").length > 1) {
      issues.push({ code: "multiple-backgrounds", path: entries.find((entry) => effectRole(entry.effectId) === "background")?.path ?? "matches", message: `语义段“${segment.title}”只能生成一个背景动效` });
    }
    const counts = new Map<string, Array<{ effectId: string; path: string; captionIndex: number }>>();
    for (const entry of entries) counts.set(entry.effectId, [...(counts.get(entry.effectId) ?? []), entry]);
    for (const selectedEffectId of selectedEffectIds(segment)) {
      const generated = counts.get(selectedEffectId) ?? [];
      if (generated.length === 0) {
        issues.push({ code: "selected-effect-missing", path: "matches", message: `第一阶段为语义段“${segment.title}”选择的动效 ${selectedEffectId} 没有落入时间线` });
      } else if (generated.length > 1) {
        issues.push({ code: "duplicate-selected-effect", path: generated[1].path, message: `第一阶段选择的动效 ${selectedEffectId} 在语义段“${segment.title}”中被重复生成` });
      }
    }

    if ((segmentAccentColors.get(segment.segmentId)?.size ?? 0) > 1) {
      issues.push({ code: "segment-accent-mismatch", path: "matches", message: `语义段“${segment.title}”中的所有动效必须使用同一个强调色` });
    }

    const contentEntries = entries
      .filter((entry) => effectRole(entry.effectId) === "content")
      .sort((left, right) => (captions[left.captionIndex]?.startSeconds ?? left.captionIndex) - (captions[right.captionIndex]?.startSeconds ?? right.captionIndex));
    if (contentEntries.length > referenceMotionMatchingPolicy.maxConcurrentContentLayers) {
      issues.push({
        code: "too-many-content-layers",
        path: contentEntries[referenceMotionMatchingPolicy.maxConcurrentContentLayers].path,
        message: `语义段“${segment.title}”同时最多保留 ${referenceMotionMatchingPolicy.maxConcurrentContentLayers} 个内容动效层`
      });
    }
    for (let index = 1; index < contentEntries.length; index += 1) {
      const previousStart = captions[contentEntries[index - 1].captionIndex]?.startSeconds ?? contentEntries[index - 1].captionIndex;
      const currentStart = captions[contentEntries[index].captionIndex]?.startSeconds ?? contentEntries[index].captionIndex;
      if (currentStart - previousStart < referenceMotionMatchingPolicy.minContentEntryStaggerSeconds) {
        issues.push({
          code: "content-entry-stagger",
          path: contentEntries[index].path,
          message: `语义段“${segment.title}”的内容动效进场至少错开 ${referenceMotionMatchingPolicy.minContentEntryStaggerSeconds} 秒`
        });
        break;
      }
    }
  }
  return issues;
}

export class MotionPlanValidationError extends Error {
  constructor(readonly issues: readonly MotionPlanIssue[]) {
    super(issues.map((issue) => `${issue.code} (${issue.path}): ${issue.message}`).join("；"));
    this.name = "MotionPlanValidationError";
  }
}

export function assertMotionSelectionPlan(selection: AiMotionSelection, captions: readonly MotionPlanCaption[] = []) {
  const issues = validateMotionSelectionPlan(selection, captions);
  if (issues.length) throw new MotionPlanValidationError(issues);
}

export function assertMotionMatchPlan(matches: readonly AiMotionMatch[], selection: AiMotionSelection, captions: readonly MotionPlanCaption[] = []) {
  const issues = validateMotionMatchPlan(matches, selection, captions);
  if (issues.length) throw new MotionPlanValidationError(issues);
}
