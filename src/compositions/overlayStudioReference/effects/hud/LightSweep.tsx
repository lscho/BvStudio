import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { THEME_OPTIONS } from "./accent";

export interface LightSweepParams {
  theme: "dark" | "light";
}

/** 光扫转场:一道斜光从左到右扫过整个画面,用于切镜点缀 */
function LightSweep({ playToken }: EffectProps<LightSweepParams>) {
  const entered = useEnter(playToken);
  return (
    <div
      className={`hud ls ${entered ? "is-in" : ""}`}
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      <div className="ls-band" />
    </div>
  );
}

export const lightSweepDef: EffectDef<LightSweepParams> = {
  id: "light-sweep",
  name: "LightSweep",
  description: "光扫转场 · 一道斜光扫过画面",
  tags: ["扫过点亮", "光效发光"],
  selfPosition: true,
  defaults: {
    theme: "dark",
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
  ],
  Component: LightSweep,
};
