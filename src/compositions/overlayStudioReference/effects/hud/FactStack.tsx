import type { EffectDef, EffectProps } from "../types";
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

export interface FactStackParams {
  theme: "dark" | "light";
  position: "bottom-left" | "left" | "bottom-right";
  /** 事实胶囊,| 分隔,每颗「大字 小注」,如 "2名 全栈设计师|¥1万 每人报酬|2周 全部交付" */
  items: string;
  /** 每颗落地间隔(卡点:对齐你报出数字的时刻) */
  stepMs: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

interface Fact {
  value: string;
  label: string;
}

function parseFacts(raw: string): Fact[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => {
      const sp = seg.indexOf(" ");
      return sp > 0
        ? { value: seg.slice(0, sp), label: seg.slice(sp + 1).trim() }
        : { value: seg, label: "" };
    });
}

/**
 * 累积数字胶囊:故事里的数字逐颗落地、全程不消失 —
 * "2名设计师 → ¥1万/人 → 2周交付" 讲到哪颗弹哪颗,已弹的一直堆着。
 * 卡片时长应覆盖整段故事(10-40s),stepMs 对齐你报数字的时刻。
 */
function FactStack({ params, playToken }: EffectProps<FactStackParams>) {
  const { position, items, stepMs, accent } = params;
  const entered = useEnter(playToken);
  const facts = parseFacts(items);

  return (
    <div
      className={`hud ${glassClass(params.glass)} fst fst--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="fst-row">
        {facts.map((f, i) => (
          <span
            className="fst-pill"
            key={i}
            style={{ transitionDelay: `${300 + i * stepMs}ms` }}
          >
            <b>{f.value}</b>
            {f.label && <span>{f.label}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export const factStackDef: EffectDef<FactStackParams> = {
  id: "fact-stack",
  name: "FactStack",
  description: "累积数字胶囊 · 逐颗落地全程不消失",
  tags: ["堆叠累积", "滚动计数"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "bottom-left",
    items: "数字1 开头的胶囊|数字2 跟着讲述落地|数字3 全程不消失",
    stepMs: 2500,
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
        { label: "左下", value: "bottom-left" },
        { label: "左中", value: "left" },
        { label: "右下", value: "bottom-right" },
      ],
    },
    { key: "items", label: "胶囊(大字 小注,| 分隔)", type: "text" },
    { key: "stepMs", label: "每颗落地间隔(卡点用)", type: "range", min: 500, max: 10000, step: 100, unit: "ms" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: FactStack,
};
