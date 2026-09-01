import { describe, expect, it } from "vitest";
import { captionSegments, fallbackSegments, type AsrTranscript } from "@/services/asr";

function transcript(segments: AsrTranscript["segments"], text = ""): AsrTranscript {
  return { language: "zh", text, segments, device: "cpu" };
}

describe("fallbackSegments", () => {
  it("splits text by punctuation and covers the complete duration", () => {
    const segments = fallbackSegments("第一句。第二句话！最后一句", 9_000_000);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ startSeconds: 0, text: "第一句。" });
    expect(segments.at(-1)?.endSeconds).toBe(9);
    expect(segments.every((segment) => segment.endSeconds > segment.startSeconds)).toBe(true);
  });

  it("returns no cues for empty recognition output", () => {
    expect(fallbackSegments("   ", 10_000_000)).toEqual([]);
  });

  it("returns no cues when the media duration is unusable", () => {
    expect(fallbackSegments("有内容。", 0)).toEqual([]);
  });
});

describe("captionSegments", () => {
  it("turns coarse cloud ASR chunks into readable timed sentence cues", () => {
    const cues = captionSegments({
      language: "zh",
      text: "第一句。第二句内容更长！",
      segments: [{ startSeconds: 10, endSeconds: 16, text: "第一句。第二句内容更长！" }],
      device: "cloud:mimo-v2.5-asr"
    }, 20_000_000);
    expect(cues.map((cue) => cue.text)).toEqual(["第一句。", "第二句内容更长！"]);
    expect(cues[0].startSeconds).toBe(10);
    expect(cues.at(-1)?.endSeconds).toBe(16);
  });

  it("merges Chinese character timestamps and flushes at sentence punctuation", () => {
    const segments = ["你", "好", "，", "世", "界", "。", "下", "句", "！"].map((text, index) => ({
      startSeconds: index * 0.2,
      endSeconds: (index + 1) * 0.2,
      text
    }));

    const cues = captionSegments(transcript(segments), 5_000_000);
    expect(cues.map((cue) => cue.text)).toEqual(["你好，世界。", "下句！"]);
    expect(cues[0]).toMatchObject({ startSeconds: 0 });
    expect(cues[0]?.endSeconds).toBeCloseTo(1.2);
    expect(cues[1]?.startSeconds).toBeCloseTo(1.2);
    expect(cues[1]?.endSeconds).toBeCloseTo(1.8);
  });

  it("adds spaces between English words without adding spaces around punctuation", () => {
    const segments = ["Hello", ",", "world", "!"].map((text, index) => ({
      startSeconds: index * 0.25,
      endSeconds: (index + 1) * 0.25,
      text
    }));

    expect(captionSegments(transcript(segments), 2_000_000)[0]?.text).toBe("Hello, world!");
  });

  it("starts a new cue after a long pause and sorts timestamp items", () => {
    const segments = [
      { startSeconds: 2.2, endSeconds: 2.5, text: "继续" },
      { startSeconds: 0, endSeconds: 0.4, text: "开头" },
      { startSeconds: Number.NaN, endSeconds: 1, text: "无效" }
    ];

    expect(captionSegments(transcript(segments), 4_000_000)).toEqual([
      { startSeconds: 0, endSeconds: 0.4, text: "开头" },
      { startSeconds: 2.2, endSeconds: 2.5, text: "继续" }
    ]);
  });

  it("bounds long cues by readable length and media duration", () => {
    const segments = Array.from("这是一个没有标点并且需要自动拆分成多条可读字幕的很长中文测试文本").map((text, index) => ({
      startSeconds: index * 0.2,
      endSeconds: (index + 1) * 0.2,
      text
    }));
    segments.push({ startSeconds: 9.8, endSeconds: 12, text: "结尾。" });

    const cues = captionSegments(transcript(segments), 10_000_000);
    expect(cues.length).toBeGreaterThan(2);
    expect(cues.every((cue) => Array.from(cue.text).length <= 24)).toBe(true);
    expect(cues.at(-1)).toMatchObject({ endSeconds: 10, text: "结尾。" });
  });

  it("falls back to proportional sentence timing when alignment is unavailable", () => {
    const cues = captionSegments(transcript([], "第一句。第二句！"), 4_000_000);
    expect(cues.map((cue) => cue.text)).toEqual(["第一句。", "第二句！"]);
    expect(cues.at(-1)?.endSeconds).toBe(4);
  });
});
