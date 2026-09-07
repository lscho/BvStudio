import type { SubtitleClip } from "@/domain/project";

export interface TimedTextSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

const sentenceSegmenter = new Intl.Segmenter("zh", { granularity: "sentence" });
const wordSegmenter = new Intl.Segmenter("zh", { granularity: "word" });
const CLAUSE_END = /[，,；;：:](?:["'”’）》】」』\s]*)$/u;
const OPENING_PUNCTUATION = /^[（(\[《【「『“‘]+$/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function textUnits(text: string) {
  return Array.from(text).reduce((total, character) => total + (/\s/u.test(character) ? 0 : CJK.test(character) ? 1 : 0.5), 0);
}

function joinCaptionText(left: string, right: string) {
  const leading = left.trimEnd();
  const trailing = right.trimStart();
  if (!leading || !trailing) return leading || trailing;
  return /[A-Za-z0-9]$/u.test(leading) && /^[A-Za-z0-9]/u.test(trailing)
    ? `${leading} ${trailing}`
    : `${leading}${trailing}`;
}

export function mergeLeadingCaptionFragments(segments: readonly TimedTextSegment[], maxUnits = 8): TimedTextSegment[] {
  const merged: TimedTextSegment[] = [];
  let pending: TimedTextSegment | null = null;
  const isLeadingFragment = (segment: TimedTextSegment) => textUnits(segment.text) <= maxUnits && /[，,:：、]$/u.test(segment.text.trim());

  for (const segment of segments) {
    const current: TimedTextSegment = pending
      ? { startSeconds: pending.startSeconds, endSeconds: segment.endSeconds, text: joinCaptionText(pending.text, segment.text) }
      : { ...segment, text: segment.text.trim() };
    if (isLeadingFragment(current)) {
      pending = current;
    } else {
      merged.push(current);
      pending = null;
    }
  }
  if (pending) merged.push(pending);
  return merged;
}

function splitLongSentence(sentence: string, maxUnits: number) {
  const words: { text: string; units: number }[] = [];
  let opening = "";
  for (const token of wordSegmenter.segment(sentence.trim())) {
    if (token.isWordLike) {
      words.push({ text: opening + token.segment, units: textUnits(token.segment) });
      opening = "";
    } else if (OPENING_PUNCTUATION.test(token.segment) || opening || !words.length) {
      opening += token.segment;
    } else {
      words[words.length - 1].text += token.segment;
    }
  }
  if (opening) {
    if (words.length) words[words.length - 1].text += opening;
    else words.push({ text: opening, units: 0 });
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    let end = start;
    let units = 0;
    let clauseEnd = start;
    while (end < words.length) {
      const word = words[end];
      if (end > start && units + word.units > maxUnits) break;
      units += word.units;
      end += 1;
      if (CLAUSE_END.test(word.text)) clauseEnd = end;
    }
    // Prefer an existing clause break; a word and its closing punctuation stay intact.
    if (end < words.length && clauseEnd > start) end = clauseEnd;
    chunks.push(words.slice(start, end).map((word) => word.text).join("").trim());
    start = end;
  }
  return chunks;
}

export function splitCaptionText(text: string, maxUnits = 22) {
  return Array.from(sentenceSegmenter.segment(text))
    .flatMap(({ segment }) => splitLongSentence(segment, maxUnits))
    .filter(Boolean);
}

export function timedTextSegments(text: string, durationUs: number, maxUnits = 22): TimedTextSegment[] {
  const splitCues = splitCaptionText(text, maxUnits);
  if (!splitCues.length || !Number.isFinite(durationUs) || durationUs <= 0) return [];
  const totalDurationUs = Math.max(1, Math.round(durationUs));
  const cues = splitCues.length > totalDurationUs ? [splitCues.join("")] : splitCues;
  const weights = cues.map((cue) => Math.max(1, textUnits(cue)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const distributableUs = totalDurationUs - cues.length;
  const exactExtras = weights.map((weight) => distributableUs * weight / totalWeight);
  const allocations = exactExtras.map((value) => 1 + Math.floor(value));
  const remainderUs = totalDurationUs - allocations.reduce((sum, value) => sum + value, 0);
  const remainderOrder = exactExtras
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remainderUs; index += 1) allocations[remainderOrder[index].index] += 1;
  let cursorUs = 0;
  return cues.map((cue, index) => {
    const startSeconds = cursorUs / 1_000_000;
    cursorUs += allocations[index];
    return { startSeconds, endSeconds: cursorUs / 1_000_000, text: cue };
  });
}

export function subtitlesForMotionMatch(subtitles: readonly SubtitleClip[], selectedClipIds: readonly string[]): SubtitleClip[] {
  const ordered = [...subtitles].sort((left, right) => left.startUs - right.startUs);
  const selectedIds = new Set(selectedClipIds);
  const selected = ordered.filter((subtitle) => selectedIds.has(subtitle.id));
  return selected.length ? selected : ordered;
}
