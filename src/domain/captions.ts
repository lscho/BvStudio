import type { SubtitleClip } from "@/domain/project";

export interface TimedTextSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

const SENTENCE_BOUNDARY = /(?<=[。！？!?；;])/u;
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
  const chunks: string[] = [];
  let chunk = "";
  for (const character of Array.from(sentence.trim())) {
    const candidate = chunk + character;
    if (chunk && textUnits(candidate) > maxUnits) {
      chunks.push(chunk.trim());
      chunk = character;
    } else {
      chunk = candidate;
    }
  }
  if (chunk.trim()) chunks.push(chunk.trim());
  return chunks;
}

export function splitCaptionText(text: string, maxUnits = 22) {
  return text
    .split(SENTENCE_BOUNDARY)
    .flatMap((sentence) => splitLongSentence(sentence, maxUnits))
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
