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

export interface StrikeFlipParams {
  theme: "dark" | "light";
  position: "center" | "top" | "bottom";
  aText: string; // 常识/错误认知(第 1 条)
  aText2?: string; // 第 2 条被划掉的话(可空)
  aText3?: string; // 第 3 条被划掉的话(可空)
  bText: string; // 反转真相(重锤)
  strikeAtMs: number; // 第 1 条何时划线否定
  strikeStepMs?: number; // 多条时,相邻两条划线的间隔
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

/**
 * 反转打脸卡:1-3 句常识先立住 → 红线逐条划掉 → B 句重锤砸下。
 * 完美匹配"不是A,也不是B——而是C"这类认知反转文案。
 */
function StrikeFlip({ params, playToken }: EffectProps<StrikeFlipParams>) {
  const { position, aText, aText2, aText3, bText, strikeAtMs, strikeStepMs, accent } = params;
  const elapsed = useElapsed(playToken, 20000);
  const lines = [aText, aText2, aText3].filter((t): t is string => Boolean(t && t.trim()));
  const step = strikeStepMs ?? 1400;
  // 每条独立卡点:第 i 条在 strikeAtMs + i*step 被划掉;最后一条划完 0.62s 后真相砸下
  const lastStrike = strikeAtMs + (lines.length - 1) * step;
  const showB = elapsed >= lastStrike + 620;

  return (
    <div
      className={`hud ${glassClass(params.glass)} sf ${showB ? "show-b" : ""} hud-anchor hud-anchor--${position} is-in`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      {lines.map((t, i) => (
        <div
          key={i}
          className={`sf-a ${elapsed >= 200 + i * 300 ? "is-up" : ""} ${
            elapsed >= strikeAtMs + i * step ? "is-struck" : ""
          }`}
        >
          {t}
        </div>
      ))}
      <div className="sf-b">{bText}</div>
    </div>
  );
}

export const strikeFlipDef: EffectDef<StrikeFlipParams> = {
  id: "strike-flip",
  vTier: "half",
  name: "StrikeFlip",
  description: "反转打脸卡 · 划掉常识,砸出真相",
  tags: ["翻转轮换"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    aText: "旧认知 = 理所当然",
    aText2: "",
    aText3: "",
    bText: "划掉它,砸出反转",
    strikeAtMs: 1400,
    strikeStepMs: 1400,
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
    { key: "aText", label: "被划掉的话 1(常识)", type: "text" },
    { key: "aText2", label: "被划掉的话 2(可空)", type: "text" },
    { key: "aText3", label: "被划掉的话 3(可空)", type: "text" },
    { key: "bText", label: "砸出的真相", type: "text" },
    { key: "strikeAtMs", label: "第 1 条何时划线", type: "range", min: 600, max: 8000, step: 100, unit: "ms" },
    { key: "strikeStepMs", label: "逐条划线间隔(卡点用)", type: "range", min: 400, max: 4000, step: 100, unit: "ms" },
    { key: "accent", label: "真相颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: StrikeFlip,
};
