import { describe, expect, it } from "vitest";
import { mergeLeadingCaptionFragments, splitCaptionText, subtitlesForMotionMatch, timedTextSegments } from "@/domain/captions";
import type { SubtitleClip } from "@/domain/project";

describe("timedTextSegments", () => {
  it("splits punctuation-aware captions and covers the requested duration exactly", () => {
    const segments = timedTextSegments("第一句很短。第二句内容更长一些！最后一句。", 6_000_000, 10);
    expect(segments.length).toBeGreaterThan(2);
    expect(segments[0].startSeconds).toBe(0);
    expect(segments.at(-1)?.endSeconds).toBe(6);
    expect(segments.every((segment, index) => index === 0 || segment.startSeconds === segments[index - 1].endSeconds)).toBe(true);
  });

  it("keeps every cue for very short but representable timelines", () => {
    const segments = timedTextSegments("甲。乙。丙。", 3, 22);
    expect(segments.map((segment) => segment.text)).toEqual(splitCaptionText("甲。乙。丙。"));
    expect(segments.map((segment) => Math.round((segment.endSeconds - segment.startSeconds) * 1_000_000))).toEqual([1, 1, 1]);
  });

  it("returns no cues for empty text or a non-positive duration", () => {
    expect(timedTextSegments("", 1_000_000)).toEqual([]);
    expect(timedTextSegments("有内容", 0)).toEqual([]);
  });

  it("matches every subtitle unless one subtitle is explicitly selected", () => {
    const subtitle = (id: string, startUs: number): SubtitleClip => ({ id, trackId: "subtitle-main", kind: "subtitle", label: id, startUs, durationUs: 1_000_000, locked: false, text: id, color: "#fff", backgroundColor: "#000", fontSize: 44, positionY: 88 });
    const subtitles = [subtitle("later", 3_000_000), subtitle("first", 0), subtitle("middle", 1_500_000)];
    expect(subtitlesForMotionMatch(subtitles, []).map((clip) => clip.id)).toEqual(["first", "middle", "later"]);
    expect(subtitlesForMotionMatch(subtitles, ["later", "middle"]).map((clip) => clip.id)).toEqual(["middle", "later"]);
    expect(subtitlesForMotionMatch(subtitles, ["not-a-subtitle"]).map((clip) => clip.id)).toEqual(["first", "middle", "later"]);
  });
});

describe("mergeLeadingCaptionFragments", () => {
  it("merges short leading clauses into the following complete caption", () => {
    expect(mergeLeadingCaptionFragments([
      { startSeconds: 0, endSeconds: 1, text: "市场格局上，" },
      { startSeconds: 1, endSeconds: 3, text: "头部运营商正在加速扩张。" },
      { startSeconds: 3, endSeconds: 3.5, text: "未来，" },
      { startSeconds: 3.5, endSeconds: 6, text: "行业将进入精细化运营阶段。" }
    ])).toEqual([
      { startSeconds: 0, endSeconds: 3, text: "市场格局上，头部运营商正在加速扩张。" },
      { startSeconds: 3, endSeconds: 6, text: "未来，行业将进入精细化运营阶段。" }
    ]);
  });

  it("keeps complete and long comma-ended captions separate", () => {
    const captions = [
      { startSeconds: 0, endSeconds: 2, text: "这是完整的一句话。" },
      { startSeconds: 2, endSeconds: 5, text: "随着市场规模持续扩大并进入成熟阶段，" },
      { startSeconds: 5, endSeconds: 7, text: "竞争重点发生变化。" }
    ];
    expect(mergeLeadingCaptionFragments(captions)).toEqual(captions);
  });
});
