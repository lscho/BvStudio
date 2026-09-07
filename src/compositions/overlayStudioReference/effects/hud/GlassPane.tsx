import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { THEME_OPTIONS } from "./accent";

export interface GlassPaneParams {
  theme: "dark" | "light";
  side: "left" | "right";
  /** 占画面宽度(%) */
  width: number;
  /** 最深处不透明度:亮视频建议 0.5-0.65 */
  strength: number;
  /** 背景虚化(px):0 = 纯渐变不虚化 */
  blur: number;
  /** 叠放层级:back = 垫在其他卡下面当背景(默认)/ front = 盖在其他卡上面 */
  layer?: "back" | "front";
}

/**
 * 玻璃底幕:画面一侧的黑玻璃渐变垫层(外缘深 → 内缘全透),
 * 给亮色口播画面垫出一块"暗底特效区",白字 HUD 叠上去就稳了。
 * 用法:当常驻层用(整段/整片拉通),特效都排在这一侧;宽度默认 1/3。
 */
function GlassPane({ params, playToken }: EffectProps<GlassPaneParams>) {
  const { side, width, strength, blur, layer } = params;
  const entered = useEnter(playToken);

  return (
    <div
      className={`hud gpn gpn--${side} ${layer === "front" ? "gpn--front" : "gpn--back"} ${entered ? "is-in" : ""}`}
      style={{
        ["--gpn-w" as string]: `${width}%`,
        ["--gpn-str" as string]: strength,
        ["--gpn-blur" as string]: `${blur}px`,
      }}
    />
  );
}

export const glassPaneDef: EffectDef<GlassPaneParams> = {
  id: "glass-pane",
  name: "GlassPane",
  description: "玻璃底幕 · 一侧黑玻璃渐变垫底,亮视频上给特效区压出暗底",
  tags: ["玻璃虚化"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    side: "left",
    width: 34,
    strength: 0.55,
    blur: 0,
    layer: "back",
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "layer",
      label: "叠放层级",
      type: "select",
      options: [
        { label: "置于底层(其他卡在它上面)", value: "back" },
        { label: "置于顶层(盖住其他卡)", value: "front" },
      ],
    },
    {
      key: "side",
      label: "落位",
      type: "select",
      options: [
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "width", label: "宽度", type: "range", min: 20, max: 60, step: 1, unit: "%" },
    { key: "strength", label: "浓度", type: "range", min: 0.2, max: 0.85, step: 0.05, unit: "" },
    { key: "blur", label: "背景虚化", type: "range", min: 0, max: 24, step: 2, unit: "px" },
  ],
  Component: GlassPane,
};
