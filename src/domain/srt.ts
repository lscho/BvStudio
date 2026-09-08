import type { TimelineClip } from "@/domain/project";

export function formatSrtTimestamp(us: number): string {
  const totalMs = Math.max(0, Math.round(us / 1000));
  const pad = (value: number, width: number) => String(value).padStart(width, "0");
  const seconds = Math.floor(totalMs / 1000);
  return `${pad(Math.floor(seconds / 3600), 2)}:${pad(Math.floor(seconds / 60) % 60, 2)}:${pad(seconds % 60, 2)},${pad(totalMs % 1000, 3)}`;
}

export function buildSrtDocument(clips: readonly TimelineClip[]): string {
  const entries = clips
    .filter((clip): clip is Extract<TimelineClip, { kind: "subtitle" }> => clip.kind === "subtitle" && clip.durationUs > 0 && clip.text.trim().length > 0)
    .slice()
    .sort((left, right) => left.startUs - right.startUs);
  if (!entries.length) return "";
  return entries
    .map((clip, index) => `${index + 1}\n${formatSrtTimestamp(clip.startUs)} --> ${formatSrtTimestamp(clip.startUs + clip.durationUs)}\n${clip.text.trim()}`)
    .join("\n\n") + "\n";
}
