import { describe, expect, it, vi } from "vitest";
import { alignReferenceVideo, prepareReferenceVideoFrames, referenceVideoTime } from "@/compositions/overlayStudioReference/videoFrames";

describe("reference video timing", () => {
  it("aligns trim, playback rate, and looping to the composition playhead", () => {
    expect(referenceVideoTime(0.5, { startSeconds: 1, clipSeconds: 2, rate: 2, durationSeconds: 8, loop: true })).toBe(2);
    expect(referenceVideoTime(5, { startSeconds: 1, clipSeconds: 2, rate: 2, durationSeconds: 8, loop: true })).toBe(4);
    expect(referenceVideoTime(5, { startSeconds: 1, clipSeconds: 2, rate: 2, durationSeconds: 8, loop: false })).toBe(7.95);
  });

  it("waits for the requested frame to decode before export capture", async () => {
    const host = document.createElement("div");
    const video = document.createElement("video");
    let currentTime = 0;
    Object.defineProperties(video, {
      duration: { configurable: true, value: 8 },
      readyState: { configurable: true, value: HTMLMediaElement.HAVE_ENOUGH_DATA },
      currentTime: {
        configurable: true,
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
          queueMicrotask(() => video.dispatchEvent(new Event("seeked")));
        }
      }
    });
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    video.dataset.fxClip = "2";
    video.dataset.fxRate = "2";
    video.dataset.tStart = "1";
    video.setAttribute("data-fx-video", "");
    video.setAttribute("data-fx-loop", "1");
    host.append(video);

    await prepareReferenceVideoFrames(host, 5);

    expect(currentTime).toBe(4);
    expect(video.pause).toHaveBeenCalled();
  });

  it("reports unreadable embedded media instead of exporting a blank frame", async () => {
    const host = document.createElement("div");
    const video = document.createElement("video");
    Object.defineProperty(video, "readyState", { configurable: true, value: HTMLMediaElement.HAVE_NOTHING });
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    vi.spyOn(video, "load").mockImplementation(() => undefined);
    video.setAttribute("data-fx-video", "");
    host.append(video);

    const result = prepareReferenceVideoFrames(host, 1);
    video.dispatchEvent(new Event("error"));
    await expect(result).rejects.toThrow("动效内嵌视频无法读取");
  });

  it("can align a loaded preview video synchronously", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "duration", { configurable: true, value: 8 });
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    video.dataset.fxClip = "2";
    video.dataset.fxRate = "2";
    video.dataset.tStart = "1";
    video.setAttribute("data-fx-loop", "1");

    expect(alignReferenceVideo(video, 5)).toBe(true);
    expect(video.currentTime).toBe(4);
  });
});
