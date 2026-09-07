import type { EffectDef, EffectProps } from "../types";
import { useElapsed, useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface MagicBentoParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  cells: string; // "标签,标题,描述|..." 第一格自动加大
  spotMs: number; // 高亮巡游节奏
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const STAGGER = 130;

/** React Bits「Magic Bento」风格:便当格卡片墙,高亮框逐格巡游(替代鼠标 spotlight) */
function MagicBento({ params, playToken }: EffectProps<MagicBentoParams>) {
  const { position, cells, spotMs, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useElapsed(playToken, 120000);
  const list = cells.split("|").map((c) => {
    const [tag, title, desc] = c.split(",");
    return { tag: (tag ?? "").trim(), title: (title ?? "").trim(), desc: (desc ?? "").trim() };
  });
  const n = list.length;
  const enterDone = 400 + n * STAGGER;
  const spot = n === 0 || elapsed < enterDone ? -1 : Math.floor((elapsed - enterDone) / spotMs) % n;

  return (
    <div
      className={`hud mb hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="mb-grid">
        {list.map((cell, i) => (
          <div
            className={`mb-cell ${i === 0 ? "is-big" : ""} ${i === spot ? "is-spot" : ""}`}
            key={i}
            style={{ transitionDelay: entered && elapsed < enterDone ? `${i * STAGGER}ms` : "0ms" }}
          >
            <div className="mb-tag">{cell.tag}</div>
            <div className="mb-title">{cell.title}</div>
            {cell.desc && <div className="mb-desc">{cell.desc}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export const magicBentoDef: EffectDef<MagicBentoParams> = {
  id: "magic-bento",
  vTier: "half",
  name: "MagicBento",
  description: "便当格卡片墙 · 高亮逐格巡游",
  tags: ["扫过点亮"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    cells:
      "CORE,主打亮点,第一格最大,放最重要的|02,亮点二,一句话说明|03,亮点三,一句话说明|04,亮点四,一句话说明|05,亮点五,高亮会挨个巡游",
    spotMs: 1100,
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
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "cells", label: "格子(标签,标题,描述 用 | 分隔;第1格自动加大)", type: "text" },
    { key: "spotMs", label: "巡游节奏", type: "range", min: 500, max: 3000, step: 100, unit: "ms" },
    { key: "accent", label: "高亮颜色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: MagicBento,
};
