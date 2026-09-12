import type { TimelineClip, TimelineTrack } from "@/domain/project";

export interface TimelineRow {
  id: string;
  track: TimelineTrack;
  kind: "track" | "lane";
  label: string;
  clips: TimelineClip[];
  members: TimelineClip[];
  depth: number;
  expanded?: boolean;
}

export function clipGroupId(clip: TimelineClip) {
  return clip.kind === "composition" || clip.kind === "scene" ? clip.sceneGroupId : undefined;
}

export function minimumPixelsPerSecondForLanes(clips: readonly TimelineClip[], minimumClipWidthPx: number) {
  const laneEnds: number[] = [];
  const laneStarts: number[] = [];
  let requiredPixelsPerSecond = 0;
  for (const clip of [...clips].sort((a, b) => a.startUs - b.startUs || a.id.localeCompare(b.id))) {
    let lane = laneEnds.findIndex((endUs) => endUs <= clip.startUs);
    if (lane < 0) {
      lane = laneEnds.length;
    } else {
      const startDeltaUs = clip.startUs - laneStarts[lane];
      if (startDeltaUs > 0) {
        requiredPixelsPerSecond = Math.max(requiredPixelsPerSecond, Math.ceil(minimumClipWidthPx * 1_000_000 / startDeltaUs));
      }
    }
    laneStarts[lane] = clip.startUs;
    laneEnds[lane] = clip.startUs + clip.durationUs;
  }
  return requiredPixelsPerSecond;
}

// Account for minimum visible clip width as well as real duration, so short clips remain selectable.
export function packTimelineLanes(clips: readonly TimelineClip[], pixelsPerSecond: number): TimelineClip[][] {
  const lanes: TimelineClip[][] = [];
  const ends: number[] = [];
  for (const clip of [...clips].sort((a, b) => a.startUs - b.startUs || a.id.localeCompare(b.id))) {
    let lane = ends.findIndex((end) => end <= clip.startUs);
    if (lane < 0) { lane = lanes.length; lanes.push([]); }
    lanes[lane].push(clip);
    ends[lane] = clip.startUs + Math.max(clip.durationUs, 34 / pixelsPerSecond * 1_000_000);
  }
  return lanes;
}

export function timelineRows(tracks: readonly TimelineTrack[], collapsed: ReadonlySet<string>, pixelsPerSecond: number, focusedGroupId?: string): TimelineRow[] {
  return tracks.flatMap((track) => {
    if (track.kind === "generated") return [];
    const clips = track.clips.filter(clip => clip.kind !== "generated" && (!focusedGroupId || clipGroupId(clip) === focusedGroupId));
    if (focusedGroupId && !clips.length) return [];
    const lanes = packTimelineLanes(clips, pixelsPerSecond);
    const expandable = lanes.length > 1;
    const expanded = expandable && (Boolean(focusedGroupId) || !collapsed.has(track.id));
    const rows: TimelineRow[] = [{ id: track.id, track, kind: "track", label: track.name,
      clips: expandable && !expanded ? [] : lanes[0] ?? [], members: clips, depth: 0, expanded: expandable ? expanded : undefined }];
    if (expanded) lanes.slice(1).forEach((lane, index) => rows.push({ id: `${track.id}:lane:${index + 1}`, track, kind: "lane", label: `图层 ${index + 2}`, clips: lane, members: lane, depth: 1 }));
    return rows;
  });
}
