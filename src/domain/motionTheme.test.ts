import { describe, expect, it } from "vitest";
import {
  effectBackdropUsesTheme,
  effectColorRolePatch,
  motionThemeAccentColor,
  motionThemeUsesAccentColor,
  motionThemeWithAccentColor,
  motionThemeWithColorPreset,
  resolveEffectAppearance,
  resolveEffectBackdropColor
} from "@/domain/motionTheme";
import { createEmptyProject } from "@/domain/project";
import { DEFAULT_EFFECT_BACKDROP } from "@/domain/videoPresentation";

describe("motionTheme", () => {
  it("resolves semantic colors from the project theme and preserves custom colors", () => {
    const theme = createEmptyProject().motionTheme;
    theme.colors.text = "#121212";
    theme.colors.data = "#0099cc";

    expect(resolveEffectAppearance({ color: "#ffffff", accentColor: "#ff0000", colorRole: "data" }, theme)).toEqual({
      color: "#121212",
      accentColor: "#0099cc"
    });
    expect(resolveEffectAppearance({ color: "#eeeeee", accentColor: "#123456", colorRole: "custom" }, theme)).toEqual({
      color: "#eeeeee",
      accentColor: "#123456"
    });
  });

  it("snapshots resolved theme colors when an effect switches to custom", () => {
    const theme = createEmptyProject().motionTheme;
    theme.colors.text = "#202124";
    theme.colors.opinion = "#3456d1";
    const clip = { color: "#ffffff", accentColor: "#ff0000", colorRole: "opinion" as const };

    expect(effectColorRolePatch(clip, theme, "custom")).toEqual({
      colorRole: "custom",
      color: "#202124",
      accentColor: "#3456d1"
    });
    expect(effectColorRolePatch(clip, theme, "warning")).toEqual({ colorRole: "warning" });
  });

  it("applies a color preset without replacing the selected style or font", () => {
    const theme = { ...createEmptyProject().motionTheme, style: "editorial" as const, font: "display" as const };
    const light = motionThemeWithColorPreset(theme, "light");

    expect(light).toMatchObject({ skin: "light", style: "editorial", font: "display" });
    expect(light.colors).toEqual({
      text: "#1b1d21",
      surface: "#f7f8fa",
      data: "#2563eb",
      opinion: "#2563eb",
      warning: "#2563eb",
      auxiliary: "#2563eb"
    });
  });

  it("applies one accent color to every semantic role without replacing other theme settings", () => {
    const theme = {
      ...createEmptyProject().motionTheme,
      skin: "light" as const,
      style: "editorial" as const,
      font: "display" as const,
      colors: { ...createEmptyProject().motionTheme.colors, text: "#202124", surface: "#f7f8fa" }
    };
    const updated = motionThemeWithAccentColor(theme, "#47d7ac");

    expect(updated).toMatchObject({ skin: "light", style: "editorial", font: "display" });
    expect(updated.colors).toEqual({
      text: "#202124",
      surface: "#f7f8fa",
      data: "#47d7ac",
      opinion: "#47d7ac",
      warning: "#47d7ac",
      auxiliary: "#47d7ac"
    });
    expect(motionThemeAccentColor(updated)).toBe("#47d7ac");
    expect(motionThemeUsesAccentColor(updated, "#47D7AC")).toBe(true);
    expect(motionThemeUsesAccentColor({ ...updated, colors: { ...updated.colors, warning: "#ff0000" } }, "#47d7ac")).toBe(false);
  });

  it("uses the theme surface for default backdrops and preserves individual overrides", () => {
    const theme = createEmptyProject().motionTheme;
    theme.colors.surface = "#f0f1f2";

    expect(effectBackdropUsesTheme({ color: DEFAULT_EFFECT_BACKDROP.color })).toBe(true);
    expect(resolveEffectBackdropColor({ color: DEFAULT_EFFECT_BACKDROP.color }, theme)).toBe("#f0f1f2");
    expect(effectBackdropUsesTheme({ color: "#223344" })).toBe(false);
    expect(resolveEffectBackdropColor({ color: "#223344" }, theme)).toBe("#223344");
  });
});
