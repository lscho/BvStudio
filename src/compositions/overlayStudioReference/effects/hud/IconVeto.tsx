import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { hasVecIcon, VecIcon } from "./vecIcons";
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

export interface IconVetoParams {
  theme: "dark" | "light";
  position: "left" | "right" | "top-left" | "top-right" | "center";
  /** 概念图标(矢量名:train/rocket/clock…) */
  icon: string;
  /** 概念文字,如 "末班车?" */
  text: string;
  /** 打叉时刻(距卡片 start 的秒数,卡点:否定句开口那一刻) */
  vetoAt: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
  __t?: number;
  __start?: number;
}

/**
 * 图标打叉卡(图形化否定,"末班车?✗"式):
 * 图标徽章 + 概念文字先立起来,到 vetoAt 一个红✗划过整体、概念压暗——
 * 破除迷思/"你以为的X"时刻,比划掉文字高级,一眼懂不用读。
 */
function IconVeto({ params, playToken }: EffectProps<IconVetoParams>) {
  const { position, icon, text, vetoAt, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const vetoed = elapsed >= Math.max(vetoAt ?? 1, 0.1);

  return (
    <div
      className={`hud ${glassClass(params.glass)} ivt hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""} ${vetoed ? "is-vetoed" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="ivt-body">
        <span className="ivt-badge">
          {hasVecIcon(icon) ? <VecIcon name={icon} size={30} /> : <b>{icon}</b>}
        </span>
        <span className="ivt-text">{text}</span>
        <svg className="ivt-cross" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="ivt-x1" d="M8 10 92 90" pathLength={1} />
          <path className="ivt-x2" d="M92 10 8 90" pathLength={1} />
        </svg>
      </div>
    </div>
  );
}

export const iconVetoDef: EffectDef<IconVetoParams> = {
  id: "icon-veto",
  name: "IconVeto",
  description: "图标打叉 · 概念立起来,红✗划过图形化否定",
  tags: ["扫过点亮"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    icon: "train",
    text: "被否定的概念?",
    vetoAt: 1.2,
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
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
        { label: "左上", value: "top-left" },
        { label: "右上", value: "top-right" },
        { label: "居中", value: "center" },
      ],
    },
    { key: "icon", label: "概念图标(矢量名:train/rocket/clock…)", type: "text" },
    { key: "text", label: "概念文字", type: "text" },
    { key: "vetoAt", label: "打叉时刻(否定句开口那一刻,卡点)", type: "range", min: 0.1, max: 15, step: 0.1, unit: "s" },
    { key: "accent", label: "图标徽章色(✗固定红)", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: IconVeto,
};
