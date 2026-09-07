import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface StrokeTitleParams {
  theme: "dark" | "light";
  position: "top" | "center" | "left" | "right" | "bottom";
  /** 前缀小标签(黄底黑字小牌,如 "太像模版?"),可空 */
  tag: string;
  /** 标题,| 分隔 = 多行逐行弹入;*词* = 换强调色 */
  text: string;
  /** 主填色 */
  fill: "yellow" | "cream" | "white";
  /** *词* 的强调色 */
  accent: string;
  /** 字号 */
  size: number;
  /** 多行时每行弹入间隔(卡点用) */
  stepMs: number;
  offsetX?: number;
  offsetY?: number;
}

const FILL_VAR: Record<string, string> = {
  yellow: "#ffd83d",
  cream: "#f7edd2",
  white: "#ffffff",
};

/** *词* → 强调色段 */
function renderLine(line: string) {
  return line.split(/(\*[^*]+\*)/).map((seg, i) =>
    seg.startsWith("*") && seg.endsWith("*") ? (
      <em className="stk-key" key={i}>
        {seg.slice(1, -1)}
      </em>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

/**
 * 综艺花字标题:粗字 + 黑描边 + 硬投影,短视频"花字"的标准件。
 * 前缀小标签抛出问题,大字给结论;多行按 stepMs 逐行砸出,
 * 想做"文字压人后面",在剪映里复制一层人物智能抠像盖上即可。
 */
function StrokeTitle({ params, playToken }: EffectProps<StrokeTitleParams>) {
  const { position, tag, text, fill, accent, size, stepMs } = params;
  const entered = useEnter(playToken);
  const lines = text
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div
      className={`hud stk hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--stk-fill" as string]: FILL_VAR[fill] ?? FILL_VAR.yellow,
        ["--stk-size" as string]: `${size}px`,
        ...offsetVars(params),
      }}
    >
      <div className="stk-col">
        {tag && <div className="stk-tag">{tag}</div>}
        {lines.map((line, i) => (
          <div
            className="stk-line"
            key={i}
            style={{ transitionDelay: `${120 + i * stepMs}ms` }}
          >
            {renderLine(line)}
          </div>
        ))}
      </div>
    </div>
  );
}

export const strokeTitleDef: EffectDef<StrokeTitleParams> = {
  id: "stroke-title",
  name: "StrokeTitle",
  description: "综艺花字 · 粗字黑描边大标题,前缀小标签+多行逐行砸出",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "top",
    tag: "小标签",
    text: "大标题*变色词*",
    fill: "yellow",
    accent: "blue",
    size: 96,
    stepMs: 900,
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
        { label: "居中", value: "center" },
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
        { label: "底部", value: "bottom" },
      ],
    },
    { key: "tag", label: "前缀小标签(可空)", type: "text" },
    { key: "text", label: "标题(| 换行,*词* 强调色)", type: "text" },
    {
      key: "fill",
      label: "主填色",
      type: "select",
      options: [
        { label: "综艺黄", value: "yellow" },
        { label: "奶油白", value: "cream" },
        { label: "纯白", value: "white" },
      ],
    },
    { key: "accent", label: "强调色(*词*)", type: "select", options: ACCENT_OPTIONS },
    { key: "size", label: "字号", type: "range", min: 48, max: 170, step: 2, unit: "px" },
    { key: "stepMs", label: "每行间隔(卡点用)", type: "range", min: 200, max: 6000, step: 100, unit: "ms" },
    ...OFFSET_CONTROLS,
  ],
  Component: StrokeTitle,
};
