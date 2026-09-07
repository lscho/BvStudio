import type { EffectDef, EffectProps } from "../types";
import { useElapsed } from "../useAnimation";
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

export interface KineticWordsParams {
  theme: "dark" | "light";
  position: "center" | "top" | "bottom";
  chunks: string; // 词块用 | 分隔,*关键词* 高亮
  holdMs: number; // 每块节奏(2026 趋势:600-900ms,慢而笃定)
  dimPast: boolean; // 已说过的块是否降调
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

/** *关键词* → 强调色 */
function renderChunk(text: string) {
  return text.split(/(\*[^*]+\*)/).map((seg, i) =>
    seg.startsWith("*") && seg.endsWith("*") ? (
      <span className="kw-key" key={i}>{seg.slice(1, -1)}</span>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

function KineticWords({ params, playToken }: EffectProps<KineticWordsParams>) {
  const { position, chunks, holdMs, dimPast, accent } = params;
  const elapsed = useElapsed(playToken, 20000);
  const list = chunks.split("|").map((s) => s.trim()).filter(Boolean);
  // 第 i 块在 400 + i*holdMs 时亮起
  const shown = Math.min(list.length, Math.max(0, Math.floor((elapsed - 200) / holdMs) + 1));

  return (
    <div
      className={`hud ${glassClass(params.glass)} kw hud-anchor hud-anchor--${position} is-in`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      {list.map((chunk, i) => {
        const on = i < shown;
        const isPast = dimPast && on && i < shown - 1;
        return (
          <div className={`kw-chunk ${on ? "is-on" : ""} ${isPast ? "is-past" : ""}`} key={i}>
            {renderChunk(chunk)}
          </div>
        );
      })}
    </div>
  );
}

export const kineticWordsDef: EffectDef<KineticWordsParams> = {
  id: "kinetic-words",
  vTier: "half",
  name: "KineticWords",
  description: "逐词大字钩子 · 词块按节奏砸出",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    chunks: "开场三秒|一句设问|把观众|*钉在屏幕上*",
    holdMs: 750,
    dimPast: true,
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
        { label: "居中", value: "center" },
        { label: "顶部", value: "top" },
        { label: "底部", value: "bottom" },
      ],
    },
    { key: "chunks", label: "词块(| 分隔,*关键词* 高亮)", type: "text" },
    { key: "holdMs", label: "每块节奏", type: "range", min: 300, max: 1500, step: 50, unit: "ms" },
    { key: "dimPast", label: "旧块降调", type: "toggle" },
    { key: "accent", label: "关键词颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: KineticWords,
};
