import type { ChapterMarker, ChapterProgressSettings, SubtitleClip, SubtitleStyleSettings } from "@/domain/project";

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleSettings = {
  stylePreset: "classic",
  highlightWords: [],
  highlightColor: "#ffb84d",
  outlineColor: "#000000",
  outlineWidth: 3,
  backgroundOpacity: 0.72,
  borderRadius: 4
};

export const DEFAULT_CHAPTER_PROGRESS: ChapterProgressSettings = {
  enabled: false,
  backgroundColor: "#111316",
  activeColor: "#ffb84d",
  textColor: "#ffffff",
  height: 52,
  chapters: []
};

export function subtitleStyle(clip: SubtitleClip): SubtitleStyleSettings {
  return {
    stylePreset: clip.stylePreset ?? DEFAULT_SUBTITLE_STYLE.stylePreset,
    highlightWords: clip.highlightWords ?? [],
    highlightColor: clip.highlightColor ?? DEFAULT_SUBTITLE_STYLE.highlightColor,
    outlineColor: clip.outlineColor ?? DEFAULT_SUBTITLE_STYLE.outlineColor,
    outlineWidth: clip.outlineWidth ?? DEFAULT_SUBTITLE_STYLE.outlineWidth,
    backgroundOpacity: clip.backgroundOpacity ?? DEFAULT_SUBTITLE_STYLE.backgroundOpacity,
    borderRadius: clip.borderRadius ?? DEFAULT_SUBTITLE_STYLE.borderRadius
  };
}

export function displaySubtitleText(text: string) {
  const trimmed = text.trim();
  const cleaned = trimmed.replace(/[，。；、：,.;:]+([”’"'」』）】》〉〕〗〙〛\])]+)?$/u, "$1").trimEnd();
  return cleaned || trimmed;
}

export function autoChapterMarkers(
  subtitles: readonly Pick<SubtitleClip, "startUs" | "durationUs" | "text">[],
  durationUs: number,
  requestedCount?: number
): ChapterMarker[] {
  const ordered = [...subtitles].filter((item) => item.text.trim()).sort((left, right) => left.startUs - right.startUs);
  const count = Math.max(1, Math.min(6, requestedCount ?? Math.max(2, Math.round(Math.max(durationUs, 1) / 45_000_000) + 1)));
  if (!ordered.length) return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    title: `章节 ${index + 1}`,
    startUs: Math.round(durationUs * index / count)
  }));
  const actualCount = Math.min(count, ordered.length);
  const used = new Set<number>();
  return Array.from({ length: actualCount }, (_, index) => {
    let subtitleIndex = Math.min(ordered.length - 1, Math.round(index * ordered.length / actualCount));
    while (used.has(subtitleIndex) && subtitleIndex < ordered.length - 1) subtitleIndex += 1;
    used.add(subtitleIndex);
    const subtitle = ordered[subtitleIndex];
    return {
      id: crypto.randomUUID(),
      title: subtitle.text.trim().replace(/[，。！？、；：,.!?;:]+$/u, "").slice(0, 12),
      startUs: index === 0 ? 0 : subtitle.startUs
    };
  }).sort((left, right) => left.startUs - right.startUs);
}

export function chapterProgressAt(chapters: readonly ChapterMarker[], playheadUs: number, durationUs: number) {
  const ordered = [...chapters].sort((left, right) => left.startUs - right.startUs);
  if (!ordered.length) return { activeIndex: -1, localProgress: 0 };
  const timeUs = Math.max(0, Math.min(durationUs, playheadUs));
  let activeIndex = 0;
  for (let index = 1; index < ordered.length; index += 1) if (ordered[index].startUs <= timeUs) activeIndex = index;
  const startUs = ordered[activeIndex].startUs;
  const endUs = ordered[activeIndex + 1]?.startUs ?? durationUs;
  return { activeIndex, localProgress: Math.max(0, Math.min(1, (timeUs - startUs) / Math.max(1, endUs - startUs))) };
}

export function motionKeywordsForSubtitle(subtitle: string, candidates: readonly (string | null | undefined)[]): string[] {
  const compactSubtitle = subtitle.replace(/\s+/gu, "");
  const result: string[] = [];
  for (const candidate of candidates) {
    const keyword = candidate?.trim().replace(/^[，。！？、；：,.!?;:\s]+|[，。！？、；：,.!?;:\s]+$/gu, "");
    if (!keyword || keyword.length < 2 || keyword.length > 16 || !compactSubtitle.includes(keyword.replace(/\s+/gu, ""))) continue;
    if (!result.includes(keyword)) result.push(keyword);
    if (result.length >= 3) break;
  }
  return result;
}

export function highlightedTextParts(text: string, words: readonly string[]): Array<{ text: string; highlighted: boolean }> {
  const valid = [...new Set(words.map((word) => word.trim()).filter((word) => word.length >= 2 && text.includes(word)))]
    .sort((left, right) => right.length - left.length);
  if (!valid.length) return [{ text, highlighted: false }];
  const result: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const match = valid.map((word) => ({ word, index: text.indexOf(word, cursor) })).filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index || right.word.length - left.word.length)[0];
    if (!match) {
      result.push({ text: text.slice(cursor), highlighted: false });
      break;
    }
    if (match.index > cursor) result.push({ text: text.slice(cursor, match.index), highlighted: false });
    result.push({ text: match.word, highlighted: true });
    cursor = match.index + match.word.length;
  }
  return result;
}
