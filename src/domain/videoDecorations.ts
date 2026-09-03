import type { ChapterMarker, ChapterProgressPreset, ChapterProgressSettings, SubtitleClip, SubtitleStyleSettings } from "@/domain/project";

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
  preset: "top-dark",
  position: "top",
  style: "segments",
  backgroundColor: "#111316",
  backgroundOpacity: 0.9,
  activeColor: "#ffb84d",
  inactiveColor: "#7d8793",
  textColor: "#ffffff",
  height: 80,
  showTitles: true,
  chapters: []
};

export type ChapterProgressPresetDefinition = Omit<ChapterProgressSettings, "enabled" | "chapters" | "preset"> & {
  id: Exclude<ChapterProgressPreset, "custom">;
  name: string;
  description: string;
};

export const CHAPTER_PROGRESS_PRESETS: readonly ChapterProgressPresetDefinition[] = [
  { id: "top-dark", name: "顶部深色分段", description: "深色底栏，适合浅色和复杂画面", position: "top", style: "segments", backgroundColor: "#111316", backgroundOpacity: 0.9, activeColor: "#ffb84d", inactiveColor: "#7d8793", textColor: "#ffffff", height: 80, showTitles: true },
  { id: "bottom-light", name: "底部浅色分段", description: "浅色底栏，适合深色画面", position: "bottom", style: "segments", backgroundColor: "#f5f7fa", backgroundOpacity: 0.92, activeColor: "#1677ff", inactiveColor: "#8a94a3", textColor: "#171a1f", height: 80, showTitles: true },
  { id: "top-minimal", name: "顶部极简线", description: "低占用的细线进度，标题保持可见", position: "top", style: "line", backgroundColor: "#111316", backgroundOpacity: 0.56, activeColor: "#47d7ac", inactiveColor: "#8b949e", textColor: "#ffffff", height: 60, showTitles: true },
  { id: "bottom-steps", name: "底部步骤点", description: "节点式章节状态，适合教程步骤", position: "bottom", style: "steps", backgroundColor: "#111316", backgroundOpacity: 0.76, activeColor: "#ffb84d", inactiveColor: "#89929e", textColor: "#ffffff", height: 96, showTitles: true },
  { id: "bottom-labels", name: "底部章节标签", description: "突出当前章节，弱化其他章节", position: "bottom", style: "labels", backgroundColor: "#111316", backgroundOpacity: 0.72, activeColor: "#5fa8ff", inactiveColor: "#89929e", textColor: "#ffffff", height: 84, showTitles: true }
] as const;

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

const subtitleKeywordNoise = /^(?:这一步|下一步|首先|其次|然后|接下来|最后|目前|现在|未来(?:的)?|同时|因此|但是|从全球看|可以看到|这意味着|正在|正从|将看|将从|需要|通过|进入|转向|包括|已经|仍然|仍|也)+/u;
const genericSubtitleKeywords = new Set(["内容", "问题", "结果", "结论", "行业", "市场", "竞争", "未来", "目前", "现在"]);

function cleanSubtitleKeyword(value: string) {
  return value
    .trim()
    .replace(/^[，。！？、；：,.!?;:\s]+|[，。！？、；：,.!?;:\s]+$/gu, "")
    .replace(subtitleKeywordNoise, "")
    .replace(/(?:正在|已经|仍然|仍|也|等)$/u, "")
    .trim();
}

export function subtitleKeywordsForText(subtitle: string, candidates: readonly (string | null | undefined)[]): string[] {
  const result: string[] = [];
  const accept = (value: string | null | undefined) => {
    const keyword = cleanSubtitleKeyword(value ?? "");
    if (!keyword || keyword.length < 2 || keyword.length > 16 || genericSubtitleKeywords.has(keyword) || !subtitle.includes(keyword)) return;
    if (result.some((current) => current === keyword || current.includes(keyword) || keyword.includes(current))) return;
    if (!result.includes(keyword)) result.push(keyword);
  };
  candidates.forEach(accept);
  if (result.length < 3) {
    subtitle
      .split(/[，。！？、；：,.!?;:]|(?:以及|或者|并且|而且|和|与|及)/u)
      .map(cleanSubtitleKeyword)
      .filter((keyword) => keyword.length >= 2 && keyword.length <= 16)
      .forEach((keyword) => {
        if (result.length < 3) accept(keyword);
      });
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
