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

export interface WordSpinParams {
  theme: "dark" | "light";
  position: "center" | "top" | "bottom";
  prefix: string;
  words: string; // 轮换词,| 分隔
  suffix: string;
  spinMs: number; // 每个词停留
  loop: boolean;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

/** Apple 发布会式词槽:固定句式,槽位垂直翻滚换词 */
function WordSpin({ params, playToken }: EffectProps<WordSpinParams>) {
  const { position, prefix, words, suffix, spinMs, loop, accent } = params;
  const elapsed = useElapsed(playToken, 120000);
  const list = words.split("|").map((s) => s.trim()).filter(Boolean);
  const raw = Math.floor(Math.max(0, elapsed - 400) / spinMs);
  const idx = loop ? raw % list.length : Math.min(raw, list.length - 1);

  return (
    <div
      className={`hud ${glassClass(params.glass)} ws hud-anchor hud-anchor--${position}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <span className="ws-static">{prefix}</span>
      <span className="ws-slot">
        <span className="ws-reel" style={{ transform: `translateY(-${idx * 1.32}em)` }}>
          {list.map((w, i) => (
            <span className="ws-word" key={i}>{w}</span>
          ))}
        </span>
      </span>
      <span className="ws-static">{suffix}</span>
    </div>
  );
}

export const wordSpinDef: EffectDef<WordSpinParams> = {
  id: "word-spin",
  vTier: "half",
  name: "WordSpin",
  description: "词槽轮换 · 固定句式垂直翻滚换词",
  tags: ["翻转轮换"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    prefix: "一句话轮换",
    words: "多种能力|多个场景|一串亮点|不同人群",
    suffix: "",
    spinMs: 900,
    loop: true,
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
    { key: "prefix", label: "句式前半", type: "text" },
    { key: "words", label: "轮换词(| 分隔)", type: "text" },
    { key: "suffix", label: "句式后半(可空)", type: "text" },
    { key: "spinMs", label: "每词停留", type: "range", min: 400, max: 2400, step: 100, unit: "ms" },
    { key: "loop", label: "循环播放", type: "toggle" },
    { key: "accent", label: "槽位颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: WordSpin,
};
