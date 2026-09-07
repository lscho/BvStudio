import { Fragment } from "react";
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

export interface FlowChartParams {
  stepMs?: number;
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  title: string;
  nodes: string; // 用 | 分隔各节点
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const STAGGER = 300;

function FlowChart({ params, playToken }: EffectProps<FlowChartParams>) {
  const { position, title, nodes, accent } = params;
  const entered = useEnter(playToken);
  const list = nodes.split("|").map((s) => s.trim()).filter(Boolean);

  return (
    <div
      className={`hud fc hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      {title && <div className="fc-kicker hud-fade">{title}</div>}
      {list.map((node, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div
              className="fc-link"
              style={{ transitionDelay: `${(i - 1) * (params.stepMs ?? STAGGER) + 170}ms` }}
            />
          )}
          <div className="fc-node" style={{ transitionDelay: `${i * (params.stepMs ?? STAGGER)}ms` }}>
            {node}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export const flowChartDef: EffectDef<FlowChartParams> = {
  id: "flow-chart",
  vTier: "full",
  name: "FlowChart",
  description: "自绘流程图 · 节点弹出 + 连线自绘",
  tags: ["生长描画"],
  selfPosition: true,
  defaults: {
    stepMs: 300,
    theme: "dark",
    position: "right",
    title: "流程链条",
    nodes: "起点|关键动作|下一步|拿到结果",
    accent: "blue",
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
        { label: "居中", value: "center" },
        { label: "左侧", value: "left" },
      ],
    },
    { key: "title", label: "小标题", type: "text" },
    { key: "nodes", label: "节点(用 | 分隔)", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: FlowChart,
};
