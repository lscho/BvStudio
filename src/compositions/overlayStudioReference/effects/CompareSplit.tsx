import type { EffectDef, EffectProps } from "./types";
import { useEnter, useProgress } from "./useAnimation";
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

export interface CompareSplitParams {
  theme: "dark" | "light";
  side: "left" | "right";
  title: string;
  aLabel: string;
  aValue: number;
  bLabel: string;
  bValue: number;
  suffix: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

function Row({
  variant,
  label,
  value,
  frac,
  suffix,
  progress,
  delay,
}: {
  variant: "a" | "b";
  label: string;
  value: number;
  frac: number;
  suffix: string;
  progress: number;
  delay: number;
}) {
  return (
    <div className="cp-row" data-variant={variant}>
      <div className="cp-head">
        <span className="cp-label">{label}</span>
        <span className="cp-num">
          {Math.round(value * progress).toLocaleString("en-US")}
          {suffix}
        </span>
      </div>
      <div className="cp-track">
        <div
          className="cp-fill"
          style={{ ["--cp-frac" as string]: frac, transitionDelay: `${delay}ms` }}
        />
      </div>
    </div>
  );
}

function CompareSplit({ params, playToken }: EffectProps<CompareSplitParams>) {
  const { side, title, aLabel, aValue, bLabel, bValue, suffix, accent } = params;
  const entered = useEnter(playToken);
  const progress = useProgress(1100, playToken);
  const max = Math.max(aValue, bValue, 1);

  return (
    <div
      className={`hud ${glassClass(params.glass)} cp hud-anchor hud-anchor--${side} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="cp-card hud-glass">
        <div className="hud-kicker">{title}</div>
        <Row
          variant="a"
          label={aLabel}
          value={aValue}
          frac={aValue / max}
          suffix={suffix}
          progress={progress}
          delay={140}
        />
        <div className="cp-vs hud-fade">VS</div>
        <Row
          variant="b"
          label={bLabel}
          value={bValue}
          frac={bValue / max}
          suffix={suffix}
          progress={progress}
          delay={320}
        />
      </div>
    </div>
  );
}

export const compareSplitDef: EffectDef<CompareSplitParams> = {
  id: "compare-split",
  name: "CompareSplit",
  description: "左右对比卡 · 双项条形对照",
  tags: ["对撞并置"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    side: "right",
    title: "前后对比",
    aLabel: "用了之后",
    aValue: 8600,
    bLabel: "用之前",
    bValue: 3200,
    suffix: "",
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
    { key: "title", label: "标题", type: "text" },
    { key: "aLabel", label: "A 名称(强调项)", type: "text" },
    { key: "aValue", label: "A 数值", type: "range", min: 0, max: 10000, step: 100 },
    { key: "bLabel", label: "B 名称(对照项)", type: "text" },
    { key: "bValue", label: "B 数值", type: "range", min: 0, max: 10000, step: 100 },
    { key: "suffix", label: "后缀单位", type: "text" },
    { key: "accent", label: "强调色(优胜项)", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: CompareSplit,
};
