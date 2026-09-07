import { allCompositions } from "@/domain/effects";
import { compositionBindingIssues } from "@/domain/compositions";
import type { EditorProject, CompositionClip, SceneClip, TimelineClip } from "@/domain/project";

export interface MotionLintIssue {
  ruleId: string;
  severity: "error" | "warning";
  clipId?: string;
  message: string;
}

function ignores(clip: TimelineClip, ruleId: string) {
  return (clip.kind === "composition" || clip.kind === "scene") && clip.lintOff?.includes(ruleId);
}

function issue(issues: MotionLintIssue[], clip: TimelineClip, ruleId: string, severity: MotionLintIssue["severity"], message: string) {
  if (!ignores(clip, ruleId)) issues.push({ ruleId, severity, clipId: clip.id, message });
}

function motionClips(project: EditorProject): Array<CompositionClip | SceneClip> {
  return project.tracks.flatMap((track) => track.clips).filter((clip): clip is CompositionClip | SceneClip => clip.kind === "composition" || clip.kind === "scene");
}

export function lintMotionProject(project: EditorProject): MotionLintIssue[] {
  const issues: MotionLintIssue[] = [];
  const registered = new Set(allCompositions().map((effect) => effect.id));
  const clips = project.tracks.flatMap((track) => track.clips);
  for (const clip of clips) {
    if (!Number.isInteger(clip.startUs) || !Number.isInteger(clip.durationUs) || clip.startUs < 0 || clip.durationUs <= 0) {
      issue(issues, clip, "invalid-time", "error", `“${clip.label}”的时间范围无效`);
    }
    if (clip.kind !== "composition") continue;
    if (!project.tracks.find((track) => track.id === clip.trackId)?.hidden) {
      for (const message of compositionBindingIssues(clip, project.assets)) issues.push({ ruleId: "composition-input", severity: "error", clipId: clip.id, message: `${clip.label}：${message}` });
    }
    if (!registered.has(clip.compositionId) && !clip.recipe) issue(issues, clip, "unknown-effect", "error", `“${clip.label}”引用了不可用的动效 ${clip.compositionId}`);
    if (clip.transform.x < 5 || clip.transform.x > 95 || clip.transform.y < 5 || clip.transform.y > 95 || clip.transform.scale > 2.5) {
      issue(issues, clip, "unsafe-bounds", "warning", `“${clip.label}”接近或超出画布安全边界`);
    }
    const chart = clip.recipe?.chart;
    const facts = chart?.kind === "counter" ? [chart.endValue] : chart?.series;
    if (facts?.length && clip.matchQuery) {
      const source = `${clip.matchQuery} ${clip.text}`.replaceAll(",", "");
      const unsupported = facts.filter((value) => value !== undefined && !source.includes(String(value)));
      if (unsupported.length) issue(issues, clip, "unsupported-chart-fact", "warning", `“${clip.label}”的图表数据未在字幕原文中出现`);
    }
  }

  const groups = new Map<string, Array<CompositionClip | SceneClip>>();
  for (const clip of motionClips(project)) {
    if (!clip.sceneGroupId) continue;
    groups.set(clip.sceneGroupId, [...(groups.get(clip.sceneGroupId) ?? []), clip]);
  }
  for (const group of groups.values()) {
    const ordered = [...group].sort((left, right) => left.startUs - right.startUs);
    let coveredUntilUs = ordered[0]?.startUs ?? 0;
    for (const clip of ordered) {
      if (clip.startUs - coveredUntilUs > 250_000) issue(issues, clip, "group-gap", "warning", `场景组“${clip.label}”之前存在时间空档`);
      coveredUntilUs = Math.max(coveredUntilUs, clip.startUs + clip.durationUs);
    }
    const events = ordered.flatMap((clip) => clip.kind === "composition" && !clip.recipe?.sceneBackground ? [
      { timeUs: clip.startUs, delta: 1, clip },
      { timeUs: clip.startUs + clip.durationUs, delta: -1, clip }
    ] : []).sort((left, right) => left.timeUs - right.timeUs || left.delta - right.delta);
    let active = 0;
    for (const event of events) {
      active += event.delta;
      if (active > 4) {
        issue(issues, event.clip, "too-many-layers", "error", `场景组“${event.clip.label}”同时显示超过 4 个动效层`);
        break;
      }
    }
  }

  const strong = motionClips(project).filter((clip) => {
    if (clip.soundCues?.length) return true;
    if (clip.kind !== "composition") return false;
    return Boolean(clip.recipe?.animation?.keyframes.some((frame) => frame.rotateX || frame.rotateY));
  }).sort((left, right) => left.startUs - right.startUs);
  for (let index = 1; index < strong.length; index += 1) {
    if (strong[index].startUs - strong[index - 1].startUs < 2_000_000) {
      issue(issues, strong[index], "strong-effect-density", "warning", `“${strong[index].label}”与前一个强动效间隔不足 2 秒`);
    }
  }
  return issues;
}

export function blockingMotionIssues(project: EditorProject) {
  return lintMotionProject(project).filter((item) => item.severity === "error");
}
