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

export interface ConvergeParams {
  theme: "dark" | "light";
  core: string;
  nodes: string; // 用 | 分隔的能力/词
  line: string; // 收尾金句,*关键词* 高亮
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const CYCLE = ["blue", "teal", "violet", "pink"];
const BOX_W = 700;
const BOX_H = 430;

/** 收尾汇聚:散落的词从四周飞向中心核,金句落定 */
function Converge({ params, playToken }: EffectProps<ConvergeParams>) {
  const { core, nodes, line, accent } = params;
  const entered = useEnter(playToken);
  const list = nodes.split("|").map((s) => s.trim()).filter(Boolean);
  const n = list.length;

  const items = list.map((label, i) => {
    const ang = (-90 + i * (360 / n)) * (Math.PI / 180);
    // 起点:远离中心(在框外);终点:围着核一圈
    const x1 = 50 + 62 * Math.cos(ang);
    const y1 = 50 + 78 * Math.sin(ang);
    const x2 = 50 + 33 * Math.cos(ang);
    const y2 = 50 + 40 * Math.sin(ang);
    return { label, x1, y1, x2, y2, color: ACCENT_VAR[CYCLE[i % CYCLE.length]], delay: i * 130 };
  });

  const lineParts = line.split(/(\*[^*]+\*)/).map((seg, i) =>
    seg.startsWith("*") && seg.endsWith("*") ? (
      <span className="cv-key" key={i}>{seg.slice(1, -1)}</span>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );

  return (
    <div
      className={`hud cv hud-anchor hud-anchor--center ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="cv-box" style={{ width: BOX_W, height: BOX_H }}>
        {items.map((it, i) => (
          <div
            className="cv-node"
            key={i}
            style={{
              ["--x1" as string]: `${it.x1}%`,
              ["--y1" as string]: `${it.y1}%`,
              ["--x2" as string]: `${it.x2}%`,
              ["--y2" as string]: `${it.y2}%`,
              ["--cv-c" as string]: it.color,
              transitionDelay: `${it.delay}ms`,
            }}
          >
            {it.label}
          </div>
        ))}
        <div className="cv-core">{core}</div>
      </div>
      {line && (
        <div className="cv-line hud-fade" style={{ transitionDelay: `${n * 130 + 500}ms` }}>
          {lineParts}
        </div>
      )}
    </div>
  );
}

export const convergeDef: EffectDef<ConvergeParams> = {
  id: "converge",
  vTier: "half",
  name: "Converge",
  description: "汇聚结尾 · 能力飞向中心 + 金句落定",
  tags: ["聚散飞行"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    core: "结论",
    nodes: "观点|案例|数据|铺垫|情绪|悬念",
    line: "整期内容,*汇成这一句*。",
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "core", label: "中心", type: "text" },
    { key: "nodes", label: "汇聚的词(用 | 分隔)", type: "text" },
    { key: "line", label: "收尾金句(*关键词* 高亮)", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: Converge,
};
