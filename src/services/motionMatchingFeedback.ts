import { Store } from "@tauri-apps/plugin-store";
import { z } from "zod";
import type { EditorProject, TimelineClip } from "@/domain/project";
import type { AiMotionSelection } from "@/services/ai/schema";
import { isDesktopRuntime } from "@/services/runtime";

const feedbackFile = "motion-matching-feedback.json";
const feedbackKey = "records";
const browserFeedbackKey = "bframe-studio:motion-matching-feedback";
const maximumFeedbackRecords = 50;
let memoryValue: unknown = [];

const selectionSnapshotSchema = z.object({
  segmentId: z.string().max(40),
  startCaptionIndex: z.number().int().min(0),
  endCaptionIndex: z.number().int().min(0),
  title: z.string().max(40),
  roll: z.enum(["a-roll", "b-roll"]).optional(),
  intent: z.string().max(24),
  primaryEffectId: z.string().nullable(),
  secondaryEffectId: z.string().nullable(),
  materialNeed: z.string().max(160)
});

const clipSnapshotSchema = z.object({
  clipId: z.string().min(1),
  sourceSubtitleId: z.string().min(1),
  kind: z.enum(["composition", "scene", "video"]),
  effectId: z.string().min(1),
  startUs: z.number().int().min(0),
  durationUs: z.number().int().positive(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  scale: z.number().finite().positive().optional(),
  bindingSignature: z.string().max(500).optional()
});

const reportSchema = z.object({
  retainedCount: z.number().int().min(0),
  removedCount: z.number().int().min(0),
  addedCount: z.number().int().min(0),
  replacedCount: z.number().int().min(0),
  retimedCount: z.number().int().min(0),
  movedCount: z.number().int().min(0),
  resizedCount: z.number().int().min(0),
  materialChangedCount: z.number().int().min(0),
  densityDelta: z.number().int()
});

const feedbackRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1).max(160),
  createdAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
  status: z.enum(["pending", "confirmed", "ignored"]),
  subtitleIds: z.array(z.string().min(1)).min(1).max(10_000),
  selection: z.array(selectionSnapshotSchema).max(80),
  initialClips: z.array(clipSnapshotSchema).max(4_000),
  finalClips: z.array(clipSnapshotSchema).max(4_000).optional(),
  report: reportSchema.optional()
});

export type MotionFeedbackClipSnapshot = z.infer<typeof clipSnapshotSchema>;
export type MotionFeedbackReport = z.infer<typeof reportSchema>;
export type MotionMatchingFeedbackRecord = z.infer<typeof feedbackRecordSchema>;

export interface MotionMatchingPreference {
  effectId: string;
  acceptedCount: number;
  removedCount: number;
  replacementEffectIds: string[];
  averageDurationRatio?: number;
  averageX?: number;
  averageY?: number;
  averageScale?: number;
}

function bindingSignature(clip: TimelineClip) {
  if (clip.kind !== "composition") return undefined;
  return (clip.bindings ?? [])
    .map((binding) => `${binding.slotId}:${binding.assetIds.length}`)
    .sort()
    .join("|");
}

function clipSnapshot(clip: TimelineClip): MotionFeedbackClipSnapshot | null {
  if (!clip.sourceSubtitleId || (clip.kind !== "composition" && clip.kind !== "scene" && clip.kind !== "video")) return null;
  if (clip.kind === "composition") {
    return {
      clipId: clip.id,
      sourceSubtitleId: clip.sourceSubtitleId,
      kind: clip.kind,
      effectId: clip.compositionId,
      startUs: clip.startUs,
      durationUs: clip.durationUs,
      x: clip.transform.x,
      y: clip.transform.y,
      scale: clip.transform.scale,
      bindingSignature: bindingSignature(clip)
    };
  }
  if (clip.kind === "scene") {
    return {
      clipId: clip.id,
      sourceSubtitleId: clip.sourceSubtitleId,
      kind: clip.kind,
      effectId: clip.compositionId,
      startUs: clip.startUs,
      durationUs: clip.durationUs
    };
  }
  return {
    clipId: clip.id,
    sourceSubtitleId: clip.sourceSubtitleId,
    kind: clip.kind,
    effectId: `video:${clip.role ?? "unspecified"}`,
    startUs: clip.startUs,
    durationUs: clip.durationUs,
    x: clip.transform?.x,
    y: clip.transform?.y,
    scale: clip.transform?.scale
  };
}

function matchingClipSnapshots(project: EditorProject, subtitleIds: readonly string[]) {
  const selected = new Set(subtitleIds);
  return project.tracks
    .flatMap((track) => track.clips)
    .flatMap((clip) => {
      const snapshot = clipSnapshot(clip);
      return snapshot && selected.has(snapshot.sourceSubtitleId) ? [snapshot] : [];
    })
    .sort((left, right) => left.startUs - right.startUs || left.clipId.localeCompare(right.clipId));
}

function changed(left: number | undefined, right: number | undefined, tolerance = 0.01) {
  if (left === undefined || right === undefined) return left !== right;
  return Math.abs(left - right) > tolerance;
}

export function createMotionMatchingFeedbackRecord(
  project: EditorProject,
  subtitleIds: readonly string[],
  selection: AiMotionSelection,
  createdAt = new Date().toISOString()
): MotionMatchingFeedbackRecord {
  return {
    id: crypto.randomUUID(),
    projectId: project.id,
    projectName: project.name.slice(0, 160) || "未命名工程",
    createdAt,
    status: "pending",
    subtitleIds: [...new Set(subtitleIds)],
    selection: selection.segments.map((segment) => ({
      segmentId: segment.segmentId,
      startCaptionIndex: segment.startCaptionIndex,
      endCaptionIndex: segment.endCaptionIndex,
      title: segment.title,
      roll: segment.roll,
      intent: segment.intent,
      primaryEffectId: segment.primaryEffectId,
      secondaryEffectId: segment.secondaryEffectId,
      materialNeed: segment.materialNeed
    })),
    initialClips: matchingClipSnapshots(project, subtitleIds)
  };
}

export function buildMotionFeedbackReport(record: MotionMatchingFeedbackRecord, project: EditorProject): MotionFeedbackReport {
  const currentClips = matchingClipSnapshots(project, record.subtitleIds);
  const currentById = new Map(currentClips.map((clip) => [clip.clipId, clip]));
  const initialIds = new Set(record.initialClips.map((clip) => clip.clipId));
  let retainedCount = 0;
  let removedCount = 0;
  let replacedCount = 0;
  let retimedCount = 0;
  let movedCount = 0;
  let resizedCount = 0;
  let materialChangedCount = 0;

  for (const initial of record.initialClips) {
    const current = currentById.get(initial.clipId);
    if (!current) {
      removedCount += 1;
      continue;
    }
    retainedCount += 1;
    if (current.kind !== initial.kind || current.effectId !== initial.effectId) replacedCount += 1;
    if (current.startUs !== initial.startUs || current.durationUs !== initial.durationUs) retimedCount += 1;
    if (changed(current.x, initial.x) || changed(current.y, initial.y)) movedCount += 1;
    if (changed(current.scale, initial.scale)) resizedCount += 1;
    if (current.bindingSignature !== initial.bindingSignature) materialChangedCount += 1;
  }
  const addedCount = currentClips.filter((clip) => !initialIds.has(clip.clipId)).length;
  return {
    retainedCount,
    removedCount,
    addedCount,
    replacedCount,
    retimedCount,
    movedCount,
    resizedCount,
    materialChangedCount,
    densityDelta: currentClips.length - record.initialClips.length
  };
}

export function finalizeMotionMatchingFeedbackRecord(
  record: MotionMatchingFeedbackRecord,
  project: EditorProject,
  status: "confirmed" | "ignored",
  reviewedAt = new Date().toISOString()
): MotionMatchingFeedbackRecord {
  return {
    ...record,
    status,
    reviewedAt,
    finalClips: matchingClipSnapshots(project, record.subtitleIds),
    report: buildMotionFeedbackReport(record, project)
  };
}

export function motionPreferencesFromRecords(records: readonly MotionMatchingFeedbackRecord[]): MotionMatchingPreference[] {
  const accumulators = new Map<string, {
    acceptedCount: number;
    removedCount: number;
    replacements: Map<string, number>;
    durationRatios: number[];
    positions: Array<{ x: number; y: number; scale: number }>;
  }>();
  for (const record of records) {
    if (record.status !== "confirmed" || !record.finalClips) continue;
    const finalById = new Map(record.finalClips.map((clip) => [clip.clipId, clip]));
    for (const initial of record.initialClips) {
      if (initial.kind === "video") continue;
      const accumulator = accumulators.get(initial.effectId) ?? {
        acceptedCount: 0,
        removedCount: 0,
        replacements: new Map<string, number>(),
        durationRatios: [],
        positions: []
      };
      const final = finalById.get(initial.clipId);
      if (!final) {
        accumulator.removedCount += 1;
      } else if (final.effectId !== initial.effectId) {
        accumulator.replacements.set(final.effectId, (accumulator.replacements.get(final.effectId) ?? 0) + 1);
      } else {
        accumulator.acceptedCount += 1;
      }
      if (final && initial.durationUs > 0) accumulator.durationRatios.push(final.durationUs / initial.durationUs);
      if (final?.x !== undefined && final.y !== undefined && final.scale !== undefined) {
        accumulator.positions.push({ x: final.x, y: final.y, scale: final.scale });
      }
      accumulators.set(initial.effectId, accumulator);
    }
  }
  return [...accumulators.entries()].map(([effectId, value]) => {
    const average = (values: readonly number[]) => values.length ? values.reduce((total, item) => total + item, 0) / values.length : undefined;
    return {
      effectId,
      acceptedCount: value.acceptedCount,
      removedCount: value.removedCount,
      replacementEffectIds: [...value.replacements.entries()].sort((left, right) => right[1] - left[1]).map(([id]) => id).slice(0, 3),
      averageDurationRatio: average(value.durationRatios),
      averageX: average(value.positions.map((position) => position.x)),
      averageY: average(value.positions.map((position) => position.y)),
      averageScale: average(value.positions.map((position) => position.scale))
    };
  }).sort((left, right) => (right.acceptedCount + right.removedCount) - (left.acceptedCount + left.removedCount)).slice(0, 24);
}

function normalizeRecords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maximumFeedbackRecords).flatMap((entry) => {
    const parsed = feedbackRecordSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

async function readRecords() {
  if (!isDesktopRuntime()) {
    if (typeof window === "undefined") return normalizeRecords(memoryValue);
    try {
      const value = window.localStorage.getItem(browserFeedbackKey);
      return value ? normalizeRecords(JSON.parse(value)) : normalizeRecords(memoryValue);
    } catch {
      return normalizeRecords(memoryValue);
    }
  }
  const store = await Store.load(feedbackFile, { defaults: {}, autoSave: false });
  return normalizeRecords(await store.get<unknown>(feedbackKey));
}

async function writeRecords(records: readonly MotionMatchingFeedbackRecord[]) {
  const normalized = normalizeRecords(records.slice(0, maximumFeedbackRecords));
  if (!isDesktopRuntime()) {
    memoryValue = normalized;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(browserFeedbackKey, JSON.stringify(normalized));
    } catch {
      // 内存副本仍可供当前会话使用。
    }
    return;
  }
  const store = await Store.load(feedbackFile, { defaults: {}, autoSave: false });
  await store.set(feedbackKey, normalized);
  await store.save();
}

export async function saveMotionMatchingFeedback(record: MotionMatchingFeedbackRecord) {
  const records = await readRecords();
  await writeRecords([record, ...records.filter((candidate) => candidate.id !== record.id)]);
}

export async function readMotionMatchingFeedback(projectId?: string) {
  const records = await readRecords();
  return projectId ? records.filter((record) => record.projectId === projectId) : records;
}

export async function reviewMotionMatchingFeedback(recordId: string, project: EditorProject, status: "confirmed" | "ignored") {
  const records = await readRecords();
  const record = records.find((candidate) => candidate.id === recordId);
  if (!record || record.projectId !== project.id) throw new Error("匹配记录不存在或不属于当前工程");
  const reviewed = finalizeMotionMatchingFeedbackRecord(record, project, status);
  await writeRecords(records.map((candidate) => candidate.id === recordId ? reviewed : candidate));
  return reviewed;
}

export async function readConfirmedMotionPreferences(projectId: string) {
  return motionPreferencesFromRecords((await readRecords()).filter((record) => record.projectId === projectId));
}
