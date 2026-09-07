export interface SubtitleTheme {
  color: string;
  highlightColor: string;
}

export const DEFAULT_SUBTITLE_THEME: SubtitleTheme = { color: "#ffffff", highlightColor: "#ffb84d" };

export function normalizeSubtitleTheme(value: unknown): SubtitleTheme {
  const candidate = value && typeof value === "object" ? value : {};
  const color = "color" in candidate ? candidate.color : undefined;
  const highlightColor = "highlightColor" in candidate ? candidate.highlightColor : undefined;
  return {
    color: typeof color === "string" && /^#[0-9a-f]{6}$/iu.test(color) ? color.toLowerCase() : DEFAULT_SUBTITLE_THEME.color,
    highlightColor: typeof highlightColor === "string" && /^#[0-9a-f]{6}$/iu.test(highlightColor) ? highlightColor.toLowerCase() : DEFAULT_SUBTITLE_THEME.highlightColor
  };
}
