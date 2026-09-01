import { describe, expect, it } from "vitest";
import { createMediaPlaybackGate, mediaNeedsSeek, previewFrameIntervalMs, previewMediaTimeSeconds, syncMediaPlayback } from "@/domain/playback";

describe("preview playback", () => {
  it("limits global preview updates to at most 30 fps", () => {
    expect(previewFrameIntervalMs(60, 1)).toBeCloseTo(1000 / 30);
    expect(previewFrameIntervalMs(24, 1)).toBeCloseTo(1000 / 24);
  });

  it("lets playing media run freely until meaningful drift occurs", () => {
    expect(mediaNeedsSeek(2, 2.12, true)).toBe(false);
    expect(mediaNeedsSeek(2, 2.6, true)).toBe(true);
    expect(mediaNeedsSeek(2, 2.03, false)).toBe(true);
  });

  it("wraps looped source time without negative positions", () => {
    expect(previewMediaTimeSeconds(800_000, 500_000, 1, 1_000_000)).toBeCloseTo(0.3);
  });

  it("deduplicates media play requests across repeated preview updates", async () => {
    let paused = true;
    let playCalls = 0;
    let pauseCalls = 0;
    const media = {
      get paused() { return paused; },
      play: () => { playCalls += 1; paused = false; return Promise.resolve(); },
      pause: () => { pauseCalls += 1; paused = true; }
    };
    const gate = createMediaPlaybackGate();
    for (let index = 0; index < 5; index += 1) {
      syncMediaPlayback(media, true, gate);
      syncMediaPlayback(media, true, gate);
      const request = gate.pending;
      syncMediaPlayback(media, false, gate);
      await request;
      await Promise.resolve();
    }
    expect(playCalls).toBe(5);
    expect(pauseCalls).toBe(5);
  });

  it("does not accumulate play promises while startup is pending", () => {
    let playCalls = 0;
    const pending = new Promise<void>(() => undefined);
    const media = { paused: true, play: () => { playCalls += 1; return pending; }, pause: () => undefined };
    const gate = createMediaPlaybackGate();
    syncMediaPlayback(media, true, gate);
    syncMediaPlayback(media, true, gate);
    syncMediaPlayback(media, true, gate);
    expect(playCalls).toBe(1);
    expect(gate.pending).toBe(pending);
  });
});
