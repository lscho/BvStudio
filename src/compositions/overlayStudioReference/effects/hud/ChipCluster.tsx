import type { EffectDef, EffectProps } from "../types";
import { hasVecIcon, VecIcon } from "./vecIcons";
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

export interface ChipClusterParams {
  stepMs?: number;
  theme: "dark" | "light";
  position: "left" | "right";
  title: string;
  chips: string; // "图标,文字|图标,文字"
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

const STAGGER = 160;

function ChipCluster({ params, playToken }: EffectProps<ChipClusterParams>) {
  const { theme, position, title, chips, accent } = params;
  void theme;
  const entered = useEnter(playToken);
  const parsed = chips.split("|").map((c) => {
    const [ic, label] = c.split(",");
    return { ic: (ic ?? "").trim(), label: (label ?? "").trim() };
  });

  return (
    <div
      className={`hud ${glassClass(params.glass)} cc hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="hud-kicker hud-fade">{title}</div>
      <div className="cc-row">
        {parsed.map((chip, i) => (
          <div className="cc-chip" key={i} style={{ transitionDelay: `${i * (params.stepMs ?? STAGGER)}ms` }}>
            <div className="cc-ic">
              {hasVecIcon(chip.ic) ? <VecIcon name={chip.ic} size={54} /> : chip.ic}
            </div>
            <div className="cc-lb">{chip.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const chipClusterDef: EffectDef<ChipClusterParams> = {
  id: "chip-cluster",
  name: "ChipCluster",
  description: "胶囊组 · 图标标签逐个定格弹入",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    stepMs: 160,
    theme: "dark",
    position: "right",
    title: "并列的几个场景",
    chips: "pen,场景一|rocket,场景二|target,场景三",
    accent: "blue",
    ...GLASS_DEFAULTS,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "stepMs", label: "每条间隔(卡点用)", type: "range", min: 100, max: 8000, step: 100, unit: "ms" },
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "右侧", value: "right" },
        { label: "左侧", value: "left" },
      ],
    },
    { key: "title", label: "小标题", type: "text" },
    { key: "chips", label: "胶囊(图标,文字 用 | 分隔)", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: ChipCluster,
};
