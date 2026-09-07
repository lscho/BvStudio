import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
  GLASS_CONTROLS,
  GLASS_DEFAULTS,
  glassClass,
  glassVars,
} from "./accent";

export interface MarkerHighlightParams {
  theme: "dark" | "light";
  position: "top" | "bottom" | "left" | "right";
  style: "marker" | "underline" | "circle";
  text: string; // 用 *...* 标记要圈注的关键词
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

/** 把 *关键词* 包成 mk-key,马克笔/下划线扫过;红笔模式额外画一圈手绘椭圆 */
function render(text: string, circle: boolean) {
  return text.split(/(\*[^*]+\*)/).map((seg, i) =>
    seg.startsWith("*") && seg.endsWith("*") ? (
      <span className="mk-key" key={i}>
        {seg.slice(1, -1)}
        {circle && (
          <svg className="mk-ring" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">
            {/* 起笔在右上、收笔越过起点:像真人随手画的圈 */}
            <path pathLength={100} d="M74,7 C33,3 8,13 8,30 C8,47 34,56 62,56 C92,56 113,46 113,29 C113,13 92,5 56,8" />
          </svg>
        )}
      </span>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

function MarkerHighlight({ params, playToken }: EffectProps<MarkerHighlightParams>) {
  const { theme, position, style, text, accent } = params;
  void theme;
  const entered = useEnter(playToken);
  return (
    <div
      className={`hud ${glassClass(params.glass)} mk ${style === "underline" ? "is-underline" : ""} ${style === "circle" ? "is-circle" : ""} hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="mk-line">
        {/* 空格或 | = 手动换行,敲几个空格就分几行 */}
        {text
          .split(/[|\s]+/)
          .filter(Boolean)
          .map((line, li) => (
            <div className="mk-row" key={li}>
              {render(line, style === "circle")}
            </div>
          ))}
      </div>
    </div>
  );
}

export const markerHighlightDef: EffectDef<MarkerHighlightParams> = {
  id: "marker-highlight",
  name: "MarkerHighlight",
  description: "关键词圈注 · 马克笔/下划线扫过重点",
  tags: ["扫过点亮"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "top",
    style: "marker",
    text: "一整句话里,用马克笔圈出*最重要的那几个字*。",
    accent: "blue",
    ...GLASS_DEFAULTS,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "顶部留白", value: "top" },
        { label: "底部居中", value: "bottom" },
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    {
      key: "style",
      label: "圈注样式",
      type: "select",
      options: [
        { label: "马克笔", value: "marker" },
        { label: "下划线", value: "underline" },
        { label: "红笔画圈", value: "circle" },
      ],
    },
    { key: "text", label: "文字(*关键词* 圈注,敲空格 = 换行)", type: "text" },
    { key: "accent", label: "圈注色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: MarkerHighlight,
};
