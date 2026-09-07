import { Fragment } from "react";
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

export interface StepperFlowParams {
  theme: "dark" | "light";
  position: "center" | "top" | "bottom";
  steps: string; // 步骤名,| 分隔
  stepMs: number;
  loop: boolean;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

/** React Bits「Stepper」风格:编号圆点 + 连线注水,自动逐步推进 */
function StepperFlow({ params, playToken }: EffectProps<StepperFlowParams>) {
  const { position, steps, stepMs, loop, accent } = params;
  const elapsed = useElapsed(playToken, 120000);
  const list = steps.split("|").map((s) => s.trim()).filter(Boolean);
  const n = list.length;
  const raw = Math.floor(Math.max(0, elapsed - 400) / stepMs);
  const act = n === 0 ? 0 : loop ? raw % n : Math.min(raw, n - 1);

  return (
    <div
      className={`hud ${glassClass(params.glass)} sp hud-anchor hud-anchor--${position}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      <div className="sp-row">
        {list.map((label, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className={`sp-link ${i <= act ? "is-done" : ""}`}>
                <div className="sp-link-fill" />
              </div>
            )}
            <div className={`sp-node ${i < act ? "is-done" : ""} ${i === act ? "is-act" : ""}`}>
              <div className="sp-dot">{i < act ? "✓" : i + 1}</div>
              <div className="sp-lb">{label}</div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export const stepperFlowDef: EffectDef<StepperFlowParams> = {
  id: "stepper-flow",
  name: "StepperFlow",
  description: "步骤指示 · 编号圆点自动推进",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    steps: "第一步|第二步|第三步|完成",
    stepMs: 1400,
    loop: false,
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
    { key: "steps", label: "步骤(| 分隔)", type: "text" },
    { key: "stepMs", label: "每步时长", type: "range", min: 600, max: 4000, step: 100, unit: "ms" },
    { key: "loop", label: "循环播放", type: "toggle" },
    { key: "accent", label: "推进颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: StepperFlow,
};
