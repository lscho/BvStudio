import { effectById } from "@/domain/effects";
import { DEFAULT_MOTION_THEME, type EffectClip, type MotionColorRole, type MotionSkin, type MotionTheme } from "@/domain/project";
import { DEFAULT_EFFECT_BACKDROP } from "@/domain/videoPresentation";

export const MOTION_COLOR_ROLE_OPTIONS: readonly { value: MotionColorRole; label: string }[] = [
  { value: "data", label: "数据色" },
  { value: "opinion", label: "观点色" },
  { value: "warning", label: "警示色" },
  { value: "auxiliary", label: "辅助色" },
  { value: "custom", label: "单独设置" }
];

export const MOTION_ACCENT_COLOR_PRESETS = [
  { id: "sky", label: "天蓝", color: "#5fa8ff" },
  { id: "ocean", label: "深蓝", color: "#2563eb" },
  { id: "mint", label: "青绿", color: "#47d7ac" },
  { id: "amber", label: "琥珀", color: "#ffb84d" },
  { id: "coral", label: "珊瑚", color: "#ff7b72" },
  { id: "violet", label: "柔紫", color: "#9b8cff" }
] as const;

const motionAccentColorKeys = ["data", "opinion", "warning", "auxiliary"] as const;

export const MOTION_THEME_COLOR_PRESETS: Readonly<Record<MotionSkin, MotionTheme["colors"]>> = {
  dark: { ...DEFAULT_MOTION_THEME.colors },
  light: {
    text: "#1b1d21",
    surface: "#f7f8fa",
    data: "#2563eb",
    opinion: "#2563eb",
    warning: "#2563eb",
    auxiliary: "#2563eb"
  }
};

const roleKeywords: Record<Exclude<MotionColorRole, "custom">, readonly string[]> = {
  data: ["数据", "数字", "增长", "比例", "金额", "统计", "图表"],
  opinion: ["观点", "金句", "引用", "结论", "提问"],
  warning: ["警告", "风险", "误区", "注意"],
  auxiliary: ["步骤", "流程", "教程", "关键词", "标注"]
};

export function motionColorRoleForEffect(effectId: string): MotionColorRole {
  const definition = effectById(effectId);
  const searchable = [definition.category, definition.name, ...definition.tags].join(" ");
  for (const [role, keywords] of Object.entries(roleKeywords) as Array<[Exclude<MotionColorRole, "custom">, readonly string[]]>) {
    if (keywords.some((keyword) => searchable.includes(keyword))) return role;
  }
  return "auxiliary";
}

export function resolveEffectAppearance(
  clip: Pick<EffectClip, "color" | "accentColor" | "colorRole">,
  theme: MotionTheme
) {
  const role = clip.colorRole ?? "custom";
  return {
    color: role === "custom" ? clip.color : theme.colors.text,
    accentColor: role === "custom" ? clip.accentColor : theme.colors[role]
  };
}

export function effectColorRolePatch(
  clip: Pick<EffectClip, "color" | "accentColor" | "colorRole">,
  theme: MotionTheme,
  colorRole: MotionColorRole
): Pick<EffectClip, "colorRole"> & Partial<Pick<EffectClip, "color" | "accentColor">> {
  if (colorRole !== "custom") return { colorRole };
  return { colorRole, ...resolveEffectAppearance(clip, theme) };
}

export function motionThemeWithColorPreset(theme: MotionTheme, skin: MotionSkin): MotionTheme {
  return { ...theme, skin, colors: { ...MOTION_THEME_COLOR_PRESETS[skin] } };
}

export function motionThemeAccentColor(theme: MotionTheme): string {
  return theme.colors.opinion;
}

export function motionThemeUsesAccentColor(theme: MotionTheme, color: string): boolean {
  return motionAccentColorKeys.every((key) => theme.colors[key].toLowerCase() === color.toLowerCase());
}

export function motionThemeWithAccentColor(theme: MotionTheme, color: string): MotionTheme {
  return {
    ...theme,
    colors: motionAccentColorKeys.reduce<MotionTheme["colors"]>(
      (colors, key) => ({ ...colors, [key]: color }),
      { ...theme.colors }
    )
  };
}

export function effectBackdropUsesTheme(backdrop: Pick<NonNullable<EffectClip["backdrop"]>, "color"> | undefined): boolean {
  return !backdrop || backdrop.color === DEFAULT_EFFECT_BACKDROP.color;
}

export function resolveEffectBackdropColor(
  backdrop: Pick<NonNullable<EffectClip["backdrop"]>, "color"> | undefined,
  theme: MotionTheme
): string {
  if (!backdrop || effectBackdropUsesTheme(backdrop)) return theme.colors.surface;
  return backdrop.color;
}

export function motionFontFamily(theme: MotionTheme): string {
  return theme.font === "display"
    ? 'Impact, "Arial Black", "PingFang SC", sans-serif'
    : 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif';
}
