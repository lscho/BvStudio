import type { EffectDef, EffectProps } from "../types";
import { useElapsed } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface CardSwapParams {
  theme: "dark" | "light";
  position: "right" | "left" | "center";
  cards: string; // "标签,标题,描述|..."
  swapMs: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

/** 堆叠位形态:0=最前,依次向右后方退 */
function stackStyle(pos: number, n: number) {
  const back = Math.min(pos, 3);
  return {
    transform: `translate(${back * 34}px, ${-back * 26}px) scale(${1 - back * 0.06})`,
    opacity: pos >= 3 ? 0 : 1,
    zIndex: n - pos,
  };
}

/** React Bits「Card Swap」风格:堆叠卡片定时把最前一张换到最后 */
function CardSwap({ params, playToken }: EffectProps<CardSwapParams>) {
  const { position, cards, swapMs, accent } = params;
  const elapsed = useElapsed(playToken, 120000);
  const list = cards.split("|").map((c) => {
    const [tag, title, desc] = c.split(",");
    return { tag: (tag ?? "").trim(), title: (title ?? "").trim(), desc: (desc ?? "").trim() };
  });
  const n = list.length;
  const order = n === 0 ? 0 : Math.floor(Math.max(0, elapsed - 500) / swapMs) % n;

  return (
    <div
      className={`hud cs hud-anchor hud-anchor--${position}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="cs-box">
        {list.map((card, i) => {
          const pos = (i - order + n) % n;
          return (
            <div
              className="cs-card"
              key={i}
              style={{ ...stackStyle(pos, n), ["--cs-c" as string]: ACCENT_VAR[accent] }}
            >
              <div className="cs-tag">{card.tag}</div>
              <div className="cs-title">{card.title}</div>
              <div className="cs-desc">{card.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const cardSwapDef: EffectDef<CardSwapParams> = {
  id: "card-swap",
  vTier: "half",
  name: "CardSwap",
  description: "卡片轮换 · 堆叠卡定时换面",
  tags: ["翻转轮换"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "right",
    cards:
      "01 · 要点,标题放这里,轮到它就滑到最前面|02 · 要点,第二张卡,堆叠着轮流上前|03 · 要点,第三张卡,切换节奏跟着讲述走",
    swapMs: 2400,
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
        { label: "居中", value: "center" },
      ],
    },
    { key: "cards", label: "卡片(标签,标题,描述 用 | 分隔)", type: "text" },
    { key: "swapMs", label: "换面间隔", type: "range", min: 1200, max: 6000, step: 200, unit: "ms" },
    { key: "accent", label: "标签颜色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: CardSwap,
};
