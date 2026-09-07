import type { EffectDef, EffectProps } from "../types";
import { useElapsed, useEnter } from "../useAnimation";
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

export interface OutlineTreeParams {
  theme: "dark" | "light";
  position: "left" | "right";
  root: string;
  kids: string; // 子项 | 分隔,*关键词* 高亮
  stepMs: number; // 每个子项间隔
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

function renderKid(text: string) {
  return text.split(/(\*[^*]+\*)/).map((seg, i) =>
    seg.startsWith("*") && seg.endsWith("*") ? (
      <span className="ot-key" key={i}>{seg.slice(1, -1)}</span>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

/** 总-分结构树:父级立住 → L 型连接线画出 → 子项缩进滑入 */
function OutlineTree({ params, playToken }: EffectProps<OutlineTreeParams>) {
  const { position, root, kids, stepMs, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useElapsed(playToken, 30000);
  const list = kids.split("|").map((s) => s.trim()).filter(Boolean);
  // 第 i 个子项在 600 + i*stepMs 后开始画线
  const liveCount = Math.max(0, Math.floor((elapsed - 600) / stepMs) + 1);

  return (
    <div
      className={`hud ${glassClass(params.glass)} ot hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="ot-root">{root}</div>
      <div className="ot-kids">
        {list.map((kid, i) => (
          <div className={`ot-kid ${i < liveCount ? "is-on" : ""}`} key={i}>
            <span className="ot-elbow" />
            <span className="ot-kid-text">{renderKid(kid)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const outlineTreeDef: EffectDef<OutlineTreeParams> = {
  id: "outline-tree",
  name: "OutlineTree",
  description: "结构树 · 连接线画出,子项逐层展开",
  tags: ["生长描画", "逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    root: "总-分结构放这里",
    kids: "原因 A:每条*逐级展开*|原因 B:关键词可以*高亮*|原因 C:讲一条,长一条",
    stepMs: 900,
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
      ],
    },
    { key: "root", label: "总(父级)", type: "text" },
    { key: "kids", label: "分(子项,| 分隔,*关键词*)", type: "text" },
    { key: "stepMs", label: "子项间隔", type: "range", min: 400, max: 2000, step: 100, unit: "ms" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: OutlineTree,
};
