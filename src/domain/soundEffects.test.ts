import { describe, expect, it } from "vitest";
import { BUILTIN_SOUND_EFFECTS, builtinSoundAssetId, builtinSoundEffectById, builtinSoundIdFromAssetId } from "@/domain/soundEffects";

describe("built-in sound effects", () => {
  it("exposes a unique, searchable catalog with bounded durations", () => {
    expect(new Set(BUILTIN_SOUND_EFFECTS.map((sound) => sound.id)).size).toBe(BUILTIN_SOUND_EFFECTS.length);
    expect(new Set(BUILTIN_SOUND_EFFECTS.map((sound) => sound.category))).toEqual(new Set(["转场", "强调", "氛围"]));
    expect(BUILTIN_SOUND_EFFECTS.every((sound) => sound.tags.length >= 5 && sound.durationUs >= 100_000 && sound.durationUs <= 1_500_000)).toBe(true);
    expect(builtinSoundEffectById("clean-click")?.name).toBe("字幕弹出");
    expect(builtinSoundAssetId("clean-click")).toBe("builtin-sound:clean-click");
    expect(builtinSoundIdFromAssetId("builtin-sound:clean-click")).toBe("clean-click");
    expect(builtinSoundIdFromAssetId("builtin-sound:unknown")).toBeUndefined();
  });
});
