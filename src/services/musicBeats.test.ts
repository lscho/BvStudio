import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeMusicAudio } from "@/services/musicBeats";

afterEach(() => vi.unstubAllGlobals());

describe("decodeMusicAudio", () => {
  it("retries an MP3 without leading ID3 metadata when WebKit rejects the original bytes", async () => {
    const attempts: Uint8Array[] = [];
    class OfflineAudioContextProbe {
      decodeAudioData(encoded: ArrayBuffer) {
        const bytes = new Uint8Array(encoded);
        attempts.push(bytes);
        if (bytes[0] !== 0xff) return Promise.reject(new DOMException("Decoding failed", "EncodingError"));
        return Promise.resolve({ duration: 2, sampleRate: 22_050 });
      }
    }
    vi.stubGlobal("OfflineAudioContext", OfflineAudioContextProbe);
    const encoded = Uint8Array.from([
      0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xff, 0xfa, 0xd0, 0x6c, 0x00, 0x00
    ]);

    const decoded = await decodeMusicAudio(encoded.buffer);

    expect(decoded.duration).toBe(2);
    expect(attempts).toHaveLength(2);
    expect([...attempts[1].slice(0, 4)]).toEqual([0xff, 0xfa, 0xd0, 0x6c]);
  });

  it("returns an actionable Chinese error when the runtime cannot decode the file", async () => {
    class OfflineAudioContextProbe {
      decodeAudioData() {
        return Promise.reject(new DOMException("Decoding failed", "EncodingError"));
      }
    }
    vi.stubGlobal("OfflineAudioContext", OfflineAudioContextProbe);

    await expect(decodeMusicAudio(Uint8Array.from([1, 2, 3, 4]).buffer)).rejects.toThrow("当前运行环境无法解码该音乐");
  });
});
