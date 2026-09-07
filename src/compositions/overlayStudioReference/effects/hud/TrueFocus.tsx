import { useLayoutEffect, useRef, useState } from "react";
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

export interface TrueFocusParams {
  theme: "dark" | "light";
  position: "center" | "top" | "bottom";
  words: string; // 词块 | 分隔
  focusMs: number; // 每词聚焦时长
  loop: boolean;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

/** React Bits「True Focus」风格:四角对焦框逐词跳跃,其余虚化 */
function TrueFocus({ params, playToken }: EffectProps<TrueFocusParams>) {
  const { position, words, focusMs, loop, accent } = params;
  const elapsed = useElapsed(playToken, 120000);
  const list = words.split("|").map((s) => s.trim()).filter(Boolean);
  const raw = Math.floor(Math.max(0, elapsed - 250) / focusMs);
  const idx = list.length === 0 ? 0 : loop ? raw % list.length : Math.min(raw, list.length - 1);

  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 0, height: 0 });

  // 量取当前聚焦词的位置,驱动对焦框滑动(offsetLeft 不受画布缩放影响)
  useLayoutEffect(() => {
    const el = wordRefs.current[idx];
    if (!el) return;
    setFrame({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });
  }, [idx, words, playToken]);

  return (
    <div
      className={`hud ${glassClass(params.glass)} tf hud-anchor hud-anchor--${position}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="tf-box">
        <div className="tf-line">
          {list.map((w, i) => (
            <span
              className={`tf-w ${i === idx ? "is-focus" : ""}`}
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
              key={i}
            >
              {w}
            </span>
          ))}
        </div>
        <div
          className="tf-frame"
          style={{
            left: frame.left - 10,
            top: frame.top - 6,
            width: frame.width + 20,
            height: frame.height + 12,
          }}
        >
          <span className="tf-c tl" />
          <span className="tf-c tr" />
          <span className="tf-c bl" />
          <span className="tf-c br" />
        </div>
      </div>
    </div>
  );
}

export const trueFocusDef: EffectDef<TrueFocusParams> = {
  id: "true-focus",
  name: "TrueFocus",
  description: "焦点扫词 · 对焦框逐词跳,其余虚化",
  tags: ["扫过点亮", "玻璃虚化"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    words: "逐词|咀嚼|强调",
    focusMs: 900,
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
    { key: "words", label: "词块(| 分隔)", type: "text" },
    { key: "focusMs", label: "每词聚焦", type: "range", min: 300, max: 2500, step: 50, unit: "ms" },
    { key: "loop", label: "循环播放", type: "toggle" },
    { key: "accent", label: "对焦框颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: TrueFocus,
};
