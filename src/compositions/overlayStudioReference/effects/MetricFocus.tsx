import type { EffectDef, EffectProps } from "./types";
import { useCountUp, useEnter } from "./useAnimation";
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
} from "./hud/accent";

export interface MetricFocusParams {
  theme: "dark" | "light";
  side: "left" | "right";
  kicker: string;
  value: number;
  decimals: number;
  suffix: string;
  caption: string;
  duration: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

function MetricFocus({ params, playToken }: EffectProps<MetricFocusParams>) {
  const { side, kicker, value, decimals, suffix, caption, duration, accent } = params;
  const entered = useEnter(playToken);
  const current = useCountUp(value, duration, playToken);

  const display = current.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <div
      className={`hud ${glassClass(params.glass)} mf hud-anchor hud-anchor--${side} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="mf-card hud-glass">
        <div className="hud-kicker">{kicker}</div>
        <div className="mf-value">
          <span>{display}</span>
          {suffix && <span className="mf-suffix">{suffix}</span>}
        </div>
        <div className="mf-bar" />
        {caption && (
          <div className="mf-caption hud-fade" style={{ transitionDelay: "260ms" }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}

export const metricFocusDef: EffectDef<MetricFocusParams> = {
  id: "metric-focus",
  vTier: "half",
  name: "MetricFocus",
  description: "核心数字动效 · 数字滚动聚焦",
  tags: ["滚动计数"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    side: "left",
    kicker: "核心数字",
    value: 92.4,
    decimals: 1,
    suffix: "%",
    caption: "大数字滚动定格,一行小字说明它为什么重要。",
    duration: 1600,
    accent: "blue",
    ...GLASS_DEFAULTS,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "side",
      label: "落位",
      type: "select",
      options: [
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "kicker", label: "小标签", type: "text" },
    { key: "value", label: "数值", type: "range", min: 0, max: 10000, step: 0.1 },
    { key: "decimals", label: "小数位", type: "range", min: 0, max: 2, step: 1 },
    { key: "suffix", label: "后缀单位", type: "text" },
    { key: "caption", label: "说明文字", type: "text" },
    { key: "duration", label: "滚动时长", type: "range", min: 400, max: 3000, step: 100, unit: "ms" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: MetricFocus,
};
