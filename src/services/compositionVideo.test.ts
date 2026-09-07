import { afterEach, describe, expect, it, vi } from "vitest";
import { seekCompositionVideo, waitForVideo } from "@/services/compositionVideo";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("composition video decoding", () => {
  it("subscribes before starting work and clears listeners after success", async () => {
    const video = document.createElement("video");
    const remove = vi.spyOn(video, "removeEventListener");
    await waitForVideo(video, "loadeddata", () => video.dispatchEvent(new Event("loadeddata")));
    expect(remove).toHaveBeenCalledWith("loadeddata", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("reports unsupported codecs and times out without hanging export", async () => {
    const video = document.createElement("video");
    await expect(waitForVideo(video, "loadeddata", () => video.dispatchEvent(new Event("error")))).rejects.toThrow("H.264");
    vi.useFakeTimers();
    const result = expect(waitForVideo(video, "seeked", () => {})).rejects.toThrow("超时");
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels pending work and never starts already-aborted work", async () => {
    const video = document.createElement("video");
    const controller = new AbortController();
    const result = expect(waitForVideo(video, "seeked", () => {}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await result;
    const action = vi.fn();
    await expect(waitForVideo(video, "loadeddata", action, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(action).not.toHaveBeenCalled();
  });

  it("holds short videos at their last decodable frame and clamps negative time", async () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "duration", { value: 2 });
    const lastFrame = seekCompositionVideo(video, 10_000_000);
    expect(video.currentTime).toBe(1.95);
    video.dispatchEvent(new Event("seeked"));
    await lastFrame;
    const firstFrame = seekCompositionVideo(video, -1_000_000);
    expect(video.currentTime).toBe(0);
    video.dispatchEvent(new Event("seeked"));
    await firstFrame;
    await seekCompositionVideo(video, 0);
  });
});
