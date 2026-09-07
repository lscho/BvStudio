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

export interface KaraokeLineParams {
  theme: "dark" | "light";
  position: "bottom" | "top" | "center";
  words: string; // 词块用 | 分隔
  wordMs: number; // 每个词的点亮时长
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

function KaraokeLine({ params, playToken }: EffectProps<KaraokeLineParams>) {
  const { position, words, wordMs, accent } = params;
  const elapsed = useElapsed(playToken, 30000);
  const list = words.split("|").map((s) => s.trim()).filter(Boolean);
  // 当前点亮到第几个词(全部说完后整句保持 ink)
  const now = Math.floor((elapsed - 300) / wordMs);

  return (
    <div
      className={`hud ${glassClass(params.glass)} kl hud-anchor hud-anchor--${position} is-in`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="kl-line">
        {list.map((w, i) => {
          const cls = i < now ? "is-past" : i === now ? "is-now" : "";
          return (
            <span className={`kl-w ${cls}`} key={i}>
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const karaokeLineDef: EffectDef<KaraokeLineParams> = {
  id: "karaoke-line",
  name: "KaraokeLine",
  description: "跟读高亮句 · 说到哪个词点亮哪个",
  tags: ["扫过点亮"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "bottom",
    words: "关键的话|逐词点亮|让观众|跟着你|读完|这一句",
    wordMs: 420,
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
        { label: "底部", value: "bottom" },
        { label: "顶部", value: "top" },
        { label: "居中", value: "center" },
      ],
    },
    { key: "words", label: "词块(| 分隔,跟语速对齐)", type: "text" },
    { key: "wordMs", label: "每词时长", type: "range", min: 150, max: 1000, step: 30, unit: "ms" },
    { key: "accent", label: "点亮颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: KaraokeLine,
};
