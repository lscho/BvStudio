import { describe, expect, it } from "vitest";
import { normalizeVideoMask, sourceVideoFrame, videoFrameMask, videoFrameSize } from "@/domain/videoFrame";
import { DEFAULT_VIDEO_MASK } from "@/domain/videoPresentation";

describe("video container framing", () => {
  it("falls back to legacy container dimensions when source dimensions are unavailable", () => {
    expect(videoFrameSize({ ...DEFAULT_VIDEO_MASK, widthPercent: 25, heightPercent: 80 }, 1920, 1080)).toEqual({ width: 480, height: 864 });
    expect(videoFrameSize({ ...DEFAULT_VIDEO_MASK, shape: "circle", widthPercent: 25 }, 1920, 1080)).toEqual({ width: 480, height: 480 });
    expect(videoFrameSize(DEFAULT_VIDEO_MASK, 1080, 1920)).toEqual({ width: 1080, height: 1920 });
  });

  it("derives the container from source dimensions and ignores legacy dimensions", () => {
    expect(videoFrameSize({ ...DEFAULT_VIDEO_MASK, widthPercent: 25, heightPercent: 80 }, 1920, 1080, 1080, 1920)).toEqual({ width: 607.5, height: 1080 });
    expect(videoFrameSize({ ...DEFAULT_VIDEO_MASK, shape: "circle", widthPercent: 25, heightPercent: 80 }, 1920, 1080, 1080, 1920)).toEqual({ width: 607.5, height: 607.5 });
    expect(videoFrameSize(DEFAULT_VIDEO_MASK, 1080, 1920, 1920, 1080)).toEqual({ width: 1080, height: 607.5 });
    expect(videoFrameMask({ ...DEFAULT_VIDEO_MASK, widthPercent: 25, heightPercent: 80 }, 1920, 1080, 1080, 1920)).toMatchObject({ widthPercent: 31.640625, heightPercent: 100 });
  });

  it("fits source dimensions inside the canvas", () => {
    expect(sourceVideoFrame(1080, 1920, 1920, 1080)).toEqual({ widthPercent: 31.640625, heightPercent: 100 });
    expect(sourceVideoFrame(1920, 1080, 1080, 1920)).toEqual({ widthPercent: 100, heightPercent: 31.640625 });
    expect(sourceVideoFrame(0, 1080, 1920, 1080)).toEqual({ widthPercent: 100, heightPercent: 100 });
  });

  it("normalizes untrusted dimensions and content positions", () => {
    expect(normalizeVideoMask({ widthPercent: "30", heightPercent: null, focusX: Infinity, focusY: -20 })).toMatchObject({ widthPercent: undefined, heightPercent: undefined, focusX: 50, focusY: 0 });
    expect(normalizeVideoMask({ widthPercent: 0, heightPercent: 400 })).toMatchObject({ widthPercent: 5, heightPercent: 100 });
  });
});
