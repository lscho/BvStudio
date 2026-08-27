import { describe, expect, it } from "vitest";
import { splitCaptionText, timedTextSegments } from "@/domain/captions";

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
});
