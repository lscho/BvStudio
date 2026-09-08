import { describe, expect, it } from "vitest";
import { createEmptyProject, type CompositionClip, type EditorProject, type SubtitleClip } from "@/domain/project";
import type { AiMotionSelection } from "@/services/ai/schema";
import {
  buildMotionFeedbackReport,
  createMotionMatchingFeedbackRecord,
  finalizeMotionMatchingFeedbackRecord,
  motionPreferencesFromRecords
} from "@/services/motionMatchingFeedback";

function projectWithMatchedClips(): EditorProject {
  const project = createEmptyProject();
  project.name = "匹配反馈";
  project.assets.push({
    id: "private-media",
    name: "录屏.mp4",
    kind: "video",
    durationUs: 10_000_000,
    sourcePath: "/private/demo.mp4",
    objectUrl: "blob:private-preview"
  });
  const subtitleTrack = project.tracks.find((track) => track.kind === "subtitle")!;
  const subtitle: SubtitleClip = {
    id: "subtitle-1",
    trackId: subtitleTrack.id,
    kind: "subtitle",
    label: "字幕",
    startUs: 0,
    durationUs: 3_000_000,
    locked: false,
    text: "三个制作痛点。",
    color: "#ffffff",
    backgroundColor: "#000000",
    fontSize: 52,
    positionY: 86
  };
  subtitleTrack.clips.push(subtitle);
  const compositionTrack = project.tracks.find((track) => track.kind === "composition")!;
  const clips: CompositionClip[] = [
    {
      id: "effect-1",
      trackId: compositionTrack.id,
      kind: "composition",
      label: "AI 动效 · 痛点清单卡",
      startUs: 0,
      durationUs: 3_000_000,
      locked: false,
      sourceSubtitleId: subtitle.id,
      compositionId: "pain-points",
      text: "主要痛点｜重复剪辑｜素材混乱",
      color: "#ffffff",
      accentColor: "#5fa8ff",
      fontSize: 48,
      speed: 1,
      bindings: [],
      transform: { x: 40, y: 35, scale: 1, rotation: 0, opacity: 1 }
    },
    {
      id: "effect-2",
      trackId: compositionTrack.id,
      kind: "composition",
      label: "AI 动效 · 重点强调",
      startUs: 1_000_000,
      durationUs: 2_000_000,
      locked: false,
      sourceSubtitleId: subtitle.id,
      compositionId: "punch-pill",
      text: "拖慢交付",
      color: "#ffffff",
      accentColor: "#5fa8ff",
      fontSize: 48,
      speed: 1,
      bindings: [],
      transform: { x: 70, y: 45, scale: 1, rotation: 0, opacity: 1 }
    }
  ];
  compositionTrack.clips.push(...clips);
  return project;
}

const selection: AiMotionSelection = {
  segments: [{
    segmentId: "segment-1",
    startCaptionIndex: 0,
    endCaptionIndex: 0,
    title: "制作痛点",
    intent: "pain",
    evidenceKinds: ["process"],
    primaryEffectId: "pain-points",
    secondaryEffectId: "punch-pill",
    materialNeed: "",
    selectionReason: "列举多个制作痛点"
  }]
};

describe("motion matching feedback", () => {
  it("records AI selection and applied clips without material paths or preview URLs", () => {
    const record = createMotionMatchingFeedbackRecord(projectWithMatchedClips(), ["subtitle-1"], selection, "2026-09-08T00:00:00.000Z");
    expect(record.selection[0]).toMatchObject({ primaryEffectId: "pain-points", secondaryEffectId: "punch-pill" });
    expect(record.initialClips).toHaveLength(2);
    expect(JSON.stringify(record)).not.toContain("/private/demo.mp4");
    expect(JSON.stringify(record)).not.toContain("blob:private-preview");
  });

  it("reports deletion, timing and transform edits against the AI baseline", () => {
    const initial = projectWithMatchedClips();
    const record = createMotionMatchingFeedbackRecord(initial, ["subtitle-1"], selection);
    const edited = structuredClone(initial);
    const track = edited.tracks.find((candidate) => candidate.kind === "composition")!;
    track.clips = track.clips.filter((clip) => clip.id !== "effect-1");
    const remaining = track.clips.find((clip): clip is CompositionClip => clip.kind === "composition" && clip.id === "effect-2")!;
    remaining.durationUs = 1_500_000;
    remaining.transform.x = 62;
    remaining.transform.scale = 1.2;

    expect(buildMotionFeedbackReport(record, edited)).toMatchObject({
      removedCount: 1,
      retimedCount: 1,
      movedCount: 1,
      resizedCount: 1,
      densityDelta: -1
    });
  });

  it("forms soft preferences only from confirmed feedback", () => {
    const initial = projectWithMatchedClips();
    const pending = createMotionMatchingFeedbackRecord(initial, ["subtitle-1"], selection);
    const edited = structuredClone(initial);
    const clip = edited.tracks.flatMap((track) => track.clips).find((candidate): candidate is CompositionClip => candidate.kind === "composition" && candidate.id === "effect-1")!;
    clip.compositionId = "info-board";
    const confirmed = finalizeMotionMatchingFeedbackRecord(pending, edited, "confirmed", "2026-09-08T01:00:00.000Z");
    const ignored = finalizeMotionMatchingFeedbackRecord({ ...pending, id: "ignored" }, initial, "ignored");

    const preferences = motionPreferencesFromRecords([confirmed, ignored]);
    expect(preferences.find((preference) => preference.effectId === "pain-points")).toMatchObject({
      acceptedCount: 0,
      removedCount: 0,
      replacementEffectIds: ["info-board"]
    });
    expect(preferences.find((preference) => preference.effectId === "punch-pill")?.acceptedCount).toBe(1);
  });
});
