import { describe, expect, it } from "vitest";
import { BUILTIN_SOUND_EFFECTS } from "@/domain/soundEffects";
import { createBuiltinSoundWav } from "@/services/builtinSounds";

describe("built-in sound generation", () => {
  it("creates deterministic stereo PCM WAV files for every catalog entry", async () => {
    for (const sound of BUILTIN_SOUND_EFFECTS) {
      const blob = createBuiltinSoundWav(sound.id);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
      expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
      expect(blob.type).toBe("audio/wav");
      expect(new DataView(bytes.buffer).getUint16(22, true)).toBe(2);
      expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(48_000);
      expect(bytes.byteLength).toBeGreaterThan(44);
      const samples = new Int16Array(bytes.buffer, 44);
      const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
      const stereoDifference = Array.from({ length: Math.min(4_800, samples.length / 2) }, (_, index) => Math.abs(samples[index * 2] - samples[index * 2 + 1])).reduce((sum, difference) => sum + difference, 0);
      expect(peak).toBeGreaterThan(2_000);
      expect(peak).toBeLessThanOrEqual(32_767);
      expect(stereoDifference).toBeGreaterThan(0);
      expect(createBuiltinSoundWav(sound.id)).toBe(blob);
    }
  });
});
