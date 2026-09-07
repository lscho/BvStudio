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

export interface SteerHintParams {
  theme: "dark" | "light";
  position: "left" | "right";
  head: string;
  lead: string;
  points: string; // 用 | 分隔
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const STAGGER = 170;

function SteerHint({ params, playToken }: EffectProps<SteerHintParams>) {
  const { position, head, lead, points, accent } = params;
  const entered = useEnter(playToken);
  const list = points.split("|").map((s) => s.trim()).filter(Boolean);

  return (
    <div
      className={`hud sh hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="sh-card">
        <div className="sh-head">
          <span className="sh-ic">✦</span>
          {head}
        </div>
        <div className="sh-body">
          {lead && <div className="sh-lead">{lead}</div>}
          {list.map((p, i) => (
            <div
              className="sh-point"
              key={i}
              style={{ transitionDelay: `${240 + i * STAGGER}ms` }}
            >
              <span className="sh-check">✓</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const steerHintDef: EffectDef<SteerHintParams> = {
  id: "steer-hint",
  vTier: "half",
  name: "SteerHint",
  description: "引导提示卡 · 标题条 + 要点逐条滑入",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "right",
    head: "操作提示",
    lead: "教观众做一件事:标题条 + 一句引导 + 勾选要点。",
    points: "第一步这样做|第二步跟上|做完就打勾",
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
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
    { key: "head", label: "标题条", type: "text" },
    { key: "lead", label: "引导语(可空)", type: "text" },
    { key: "points", label: "要点(用 | 分隔)", type: "text" },
    { key: "accent", label: "标题条颜色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: SteerHint,
};
