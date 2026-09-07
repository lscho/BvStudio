import type { EditorProject, GeneratedBlock, SubtitleClip } from "@/domain/project";

export function narrationContext(project: EditorProject, selectedIds: readonly string[], playheadUs: number) {
  const clips = project.tracks.flatMap(track => track.clips);
  const blocks = clips.filter((clip): clip is GeneratedBlock => clip.kind === "generated");
  const selected = clips.filter(clip => selectedIds.includes(clip.id));
  const blockIds = new Set(selected.flatMap(clip => clip.kind === "generated" ? [clip.id] : clip.sourceBlockId ? [clip.sourceBlockId] : []));
  const explicit = blockIds.size > 0 || selected.some(clip => clip.kind === "subtitle");
  const hasIndependentSubtitle = selected.some(clip => clip.kind === "subtitle" && !clip.sourceBlockId);
  const active = blocks.filter(block => playheadUs >= block.startUs && playheadUs < block.startUs + block.durationUs);
  const block = explicit
    ? blockIds.size === 1 && !hasIndependentSubtitle ? blocks.find(block => blockIds.has(block.id)) : undefined
    : active.length === 1 ? active[0] : blocks.length === 1 ? blocks[0] : undefined;
  const subtitles = clips.filter((clip): clip is SubtitleClip => clip.kind === "subtitle" && (block ? clip.sourceBlockId === block.id : selectedIds.includes(clip.id)))
    .sort((a, b) => a.startUs - b.startUs);
  return {
    block, subtitles,
    text: subtitles.length ? subtitles.map(subtitle => subtitle.text).join("\n") : block?.narration ?? "",
    startUs: block?.startUs ?? subtitles[0]?.startUs ?? playheadUs
  };
}
