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

export interface EcosystemHubParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  hub: string;
  icons: string; // "图标,名称|..."
  accent: string; // hub 色
  offsetX?: number;
  offsetY?: number;
}

const CYCLE = ["blue", "teal", "violet", "pink"];
const SIZE = 640;
const CENTER = SIZE / 2;
const ORBIT = 234;
const STAGGER = 150;

function EcosystemHub({ params, playToken }: EffectProps<EcosystemHubParams>) {
  const { position, hub, icons, accent } = params;
  const entered = useEnter(playToken);
  const list = icons.split("|").map((c) => {
    const [ic, label] = c.split(",");
    return { ic: (ic ?? "").trim(), label: (label ?? "").trim() };
  });
  const n = list.length;

  const nodes = list.map((item, i) => {
    const ang = (-90 + i * (360 / n)) * (Math.PI / 180);
    const x = CENTER + ORBIT * Math.cos(ang);
    const y = CENTER + ORBIT * Math.sin(ang);
    const color = ACCENT_VAR[CYCLE[i % CYCLE.length]];
    const len = Math.hypot(x - CENTER, y - CENTER);
    return { ...item, x, y, color, len, delay: 200 + i * STAGGER };
  });

  return (
    <div
      className={`hud eh hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="eh-box" style={{ width: SIZE, height: SIZE }}>
        <svg className="eh-svg" viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {nodes.map((nd, i) => (
            <line
              key={i}
              className="eh-line"
              x1={CENTER}
              y1={CENTER}
              x2={nd.x}
              y2={nd.y}
              style={{
                ["--len" as string]: nd.len,
                ["--eh-c" as string]: nd.color,
                transitionDelay: `${nd.delay}ms`,
              }}
            />
          ))}
        </svg>

        <div className="eh-node" style={{ left: CENTER, top: CENTER }}>
          <div className="eh-hub">
            <span className="eh-hub-mark">◆</span>
            <span className="eh-hub-lb">{hub}</span>
          </div>
        </div>

        {nodes.map((nd, i) => (
          <div
            className="eh-node"
            key={i}
            style={{ left: nd.x, top: nd.y, transitionDelay: `${nd.delay}ms` }}
          >
            <div className="eh-icon" style={{ ["--eh-c" as string]: nd.color }}>
              <span className="ic">{nd.ic}</span>
              <span className="lb">{nd.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ecosystemHubDef: EffectDef<EcosystemHubParams> = {
  id: "ecosystem-hub",
  vTier: "full",
  name: "EcosystemHub",
  description: "生态连接图 · 外部工具连线接入中心",
  tags: ["生长描画", "聚散飞行"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    hub: "中心",
    icons: "🔗,工具一|✉,工具二|📄,工具三|◎,工具四|▲,工具五|✱,工具六",
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
        { label: "居中", value: "center" },
        { label: "右侧", value: "right" },
        { label: "左侧", value: "left" },
      ],
    },
    { key: "hub", label: "中心名称", type: "text" },
    { key: "icons", label: "外部工具(图标,名称 用 | 分隔)", type: "text" },
    { key: "accent", label: "中心色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: EcosystemHub,
};
