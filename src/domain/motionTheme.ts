import { effectById } from "@/domain/effects";
import type { EffectClip, MotionColorRole, MotionTheme } from "@/domain/project";

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

export function motionFontFamily(theme: MotionTheme): string {
  return theme.font === "display"
    ? 'Impact, "Arial Black", "PingFang SC", sans-serif'
    : 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif';
}
