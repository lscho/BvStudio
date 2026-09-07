import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { ACCENT_OPTIONS, ACCENT_VAR, THEME_OPTIONS } from "./accent";

export interface AmbientWashParams {
  theme: "dark" | "light";
  /** 色晕方向 */
  style: "edges" | "left" | "right" | "top";
  /** 浓度(叠在亮调视频上建议 0.15-0.25,暗调 0.25-0.45) */
  strength: number;
  accent: string;
}

/**
 * 氛围色洗:整个画面的情绪层——边缘/侧面泛出语义色的柔和色晕,
 * 让画面情绪跟着章节走,像房间灯光随内容换色。
 * 用法:一章一张,颜色跟本章语义(绿=达成 红=痛点 紫=演示 蓝=数据),
 * 相邻两章换色,观众感觉不到但一直被带着。
 */
function AmbientWash({ params, playToken }: EffectProps<AmbientWashParams>) {
  const { style, strength, accent } = params;
  const entered = useEnter(playToken);

  return (
    <div
      className={`hud awh awh--${style} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--awh-str" as string]: strength,
      }}
    />
  );
}

export const ambientWashDef: EffectDef<AmbientWashParams> = {
  id: "ambient-wash",
  name: "AmbientWash",
  description: "氛围色洗 · 画面边缘泛语义色,情绪跟章节走",
  tags: ["光效发光"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    style: "edges",
    strength: 0.28,
    accent: "blue",
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "style",
      label: "色晕方向",
      type: "select",
      options: [
        { label: "四周", value: "edges" },
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
        { label: "顶部", value: "top" },
      ],
    },
    { key: "strength", label: "浓度", type: "range", min: 0.08, max: 0.6, step: 0.02, unit: "" },
    { key: "accent", label: "语义色", type: "select", options: ACCENT_OPTIONS },
  ],
  Component: AmbientWash,
};
