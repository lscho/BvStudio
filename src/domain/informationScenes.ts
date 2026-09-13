import type { CompositionParams } from "@/domain/effects";

export const motionIconNames = [
  "chat", "pen", "mic", "bolt", "gear", "code", "terminal", "search", "key", "books", "doc", "folder", "bulb", "brain",
  "globe", "map", "mountain", "chain", "target", "rocket", "chart", "check", "x", "question", "clock", "aperture",
  "people", "phone", "trend-up", "train", "trend-down", "arrow-right", "arrow-down", "arrow-up", "arrow-turn",
  "upload", "download", "layers", "palette", "wand", "timer", "drag", "save", "sparkle", "film", "copy", "cut", "warn", "spin", "shield"
] as const;
const icons = new Set<string>(motionIconNames);
const aliases: Readonly<Record<string, string>> = { "trending-up": "trend-up", "trending-down": "trend-down", "shield-check": "shield", "check-circle": "check", "alert-triangle": "warn", "file-text": "doc", "lightbulb": "bulb", "users": "people" };

export function normalizeMotionIcon(value: string) {
  const name = value.trim().toLowerCase();
  return Object.hasOwn(aliases, name) ? aliases[name] : icons.has(name) ? name : "question";
}

export function informationSceneLayout(effectId: string, params: CompositionParams | undefined) {
  if (effectId === "glow-badges" && params?.sceneLayout === "columns") return "columns";
  if (effectId === "quad-map" && params?.sceneLayout === "matrix") return "matrix";
  return undefined;
}

export function informationSceneItems(effectId: string, params: CompositionParams | undefined) {
  const raw = effectId === "quad-map" ? params?.cells : params?.badges;
  if (typeof raw !== "string") return [];
  return raw.split(effectId === "quad-map" ? /\r?\n/u : /[|｜]/u).map((row) => row.trim()).filter(Boolean).slice(0, 4).map((row) => {
    if (effectId === "quad-map") {
      const [label = "", , title = "", detail = ""] = row.split("|").map((part) => part.trim());
      return { label, title, detail, icon: "" };
    }
    const [label = "", icon = "", title = "", detail = ""] = row.split(/[,，]/u).map((part) => part.trim());
    return { label, title, detail, icon: normalizeMotionIcon(icon) };
  }).filter((item) => item.title || item.detail);
}

export function normalizeBadgeIcons(params: CompositionParams): CompositionParams {
  if (typeof params.badges !== "string") return params;
  return { ...params, badges: params.badges.split(/[|｜]/u).map((row) => {
    const parts = row.split(/[,，]/u);
    parts[1] = normalizeMotionIcon(parts[1] ?? "");
    return parts.join(",");
  }).join("|") };
}

export function informationSceneContentIssue(effectId: string, params: CompositionParams): string | undefined {
  if (effectId !== "quad-map" && effectId !== "glow-badges") return undefined;
  const raw = effectId === "quad-map" ? params.cells : params.badges;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return "信息卡内容必须是结构化文字";
  const rows = raw.split(effectId === "quad-map" ? /\r?\n/u : /[|｜]/u).filter((row) => row.trim());
  if (!rows.length || rows.length > 4) return "信息卡必须包含 1–4 个实际项目；更多要点请分成语义子组，不能截断遗漏";
  if (rows.some((row) => !(row.split(effectId === "quad-map" ? "|" : /[,，]/u)[2] ?? "").trim())) return "每个项目必须填写中文短标题，不能使用空白或示例占位";
  return undefined;
}
