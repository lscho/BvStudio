import type { TimelineClip } from "@/domain/project";
import type { TimedTextSegment } from "@/domain/captions";

const SRT_TIMESTAMP = /^(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})(?:\s+.*)?$/u;
const MAX_SRT_CUES = 2_000;

function timestampSeconds(hours: string, minutes: string, seconds: string, milliseconds: string) {
  const values = [hours, minutes, seconds, milliseconds].map(Number);
  if (values.some((value) => !Number.isFinite(value)) || values[1] > 59 || values[2] > 59) return null;
  return values[0] * 3_600 + values[1] * 60 + values[2] + values[3] / 10 ** milliseconds.length;
}

export function parseSrtDocument(document: string): TimedTextSegment[] {
  const normalized = document.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n").trim();
  if (!normalized) throw new Error("SRT 文件没有字幕内容");
  if (normalized.includes("\uFFFD")) throw new Error("SRT 文件不是有效的 UTF-8 编码，请转换编码后重试");
  const blocks = normalized.split(/\n{2,}/u);
  if (blocks.length > MAX_SRT_CUES) throw new Error(`SRT 最多支持 ${MAX_SRT_CUES} 条字幕`);

  const cues = blocks.map((block, blockIndex) => {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    const match = timingIndex >= 0 ? lines[timingIndex].trim().match(SRT_TIMESTAMP) : null;
    if (!match) throw new Error(`SRT 第 ${blockIndex + 1} 段的时间码无效`);
    const startSeconds = timestampSeconds(match[1], match[2], match[3], match[4]);
    const endSeconds = timestampSeconds(match[5], match[6], match[7], match[8]);
    if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
      throw new Error(`SRT 第 ${blockIndex + 1} 段的结束时间必须晚于开始时间`);
    }
    const text = lines.slice(timingIndex + 1).join("\n").trim();
    if (!text) throw new Error(`SRT 第 ${blockIndex + 1} 段缺少字幕文字`);
    if (text.length > 500) throw new Error(`SRT 第 ${blockIndex + 1} 段文字超过 500 个字符`);
    return { startSeconds, endSeconds, text };
  }).sort((left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds);

  return cues;
}

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
