import { describe, expect, it } from "vitest";
import { buildSrtDocument, formatSrtTimestamp } from "@/domain/srt";
import type { SubtitleClip } from "@/domain/project";
import { cameraMotionForPreset } from "@/domain/camera";
const trackId = "subtitle-main";

function subtitle(id: string, startUs: number, durationUs: number, text: string): SubtitleClip {
  return { id, trackId, kind: "subtitle", label: id, startUs, durationUs, locked: false, text, color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88 };
}

describe("formatSrtTimestamp", () => {
  it("formats microseconds as SRT HH:MM:SS,mmm timestamps", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(1_234_567)).toBe("00:00:01,235");
    expect(formatSrtTimestamp(3_600_000_000 + 61_000_000 + 1_999)).toBe("01:01:01,002");
  });

  it("clamps negative timestamps to zero", () => {
    expect(formatSrtTimestamp(-1)).toBe("00:00:00,000");
  });
});

describe("buildSrtDocument", () => {
  it("numbers entries in timeline order with SRT timestamps", () => {
    const srt = buildSrtDocument([subtitle("b", 2_000_000, 1_500_000, "后出现"), subtitle("a", 0, 2_000_000, "先出现")]);
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:02,000\n先出现\n\n2\n00:00:02,000 --> 00:00:03,500\n后出现\n");
  });

  it("skips empty text and non-positive durations and keeps multi-line text", () => {
    const srt = buildSrtDocument([
      subtitle("empty", 0, 1_000_000, "   "),
      subtitle("zero", 0, 0, "零时长"),
      subtitle("multi", 500_000, 1_000_000, "第一行\n第二行")
    ]);
    expect(srt).toBe("1\n00:00:00,500 --> 00:00:01,500\n第一行\n第二行\n");
  });

  it("ignores non-subtitle clips and returns an empty document without subtitles", () => {
    const video = { id: "video", trackId: "video-main", kind: "video" as const, label: "视频", locked: false, startUs: 0, durationUs: 5_000_000, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "contain" as const, camera: cameraMotionForPreset("none") };
    expect(buildSrtDocument([video])).toBe("");
    expect(buildSrtDocument([])).toBe("");
  });
});
