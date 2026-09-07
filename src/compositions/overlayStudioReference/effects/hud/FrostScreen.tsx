import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";

export interface FrostScreenParams {
  theme: "dark" | "light";
  /** 玻璃底色:dark 黑玻璃 / light 白玻璃 */
  tone: "dark" | "light";
  /** 背景虚化程度(px) */
  blur: number;
  /** 玻璃底不透明度(0=只虚化不压色) */
  alpha: number;
  /** 顶部让开的高度(px):默认 48 = 章节条正身高度,毛玻璃的上沿正好压在它那道
      1px 底边线下面。填成 49+ 会在两者之间露出一条没虚化的原片,像一道亮线 */
  topSafe: number;
  /** 底部让开的高度(px):烧录字幕要露出来时填 */
  bottomSafe: number;
}

/**
 * 全屏毛玻璃:把整块画面(默认让开顶部进度条)虚化 + 压一层黑/白玻璃底。
 * 用途:讲某段内容时把 A-Roll / B-Roll 整个糊掉当背景板,前面的卡照常叠上去。
 *
 * ⚠️ 虚化是 backdrop-filter,吃的是"它下面那一层画面"。导出透明动效层时下面
 * 是透明的,没东西可虚化 —— 所以导出会自动退回"只有玻璃底、不虚化",并把
 * 底色加厚一档。要成片里真的糊,得在剪映给那一段的视频轨加模糊,这张卡负责
 * 上面那层玻璃色。
 */
function FrostScreen({ params, playToken }: EffectProps<FrostScreenParams>) {
  const { tone, blur, alpha, topSafe, bottomSafe } = params;
  const entered = useEnter(playToken);

  return (
    <div
      className={`hud frs frs--${tone} ${entered ? "is-in" : ""}`}
      style={{
        ["--frs-blur" as string]: `${blur}px`,
        ["--frs-a" as string]: alpha,
        ["--frs-top" as string]: `${topSafe}px`,
        ["--frs-bot" as string]: `${bottomSafe}px`,
      }}
    />
  );
}

export const frostScreenDef: EffectDef<FrostScreenParams> = {
  id: "frost-screen",
  name: "FrostScreen",
  description: "全屏毛玻璃 · 整块画面虚化+黑/白玻璃底,让开顶部进度条",
  tags: ["玻璃虚化"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    tone: "dark",
    blur: 18,
    alpha: 0.42,
    topSafe: 48,
    bottomSafe: 0,
  },
  controls: [
    {
      key: "tone",
      label: "玻璃底色",
      type: "select",
      options: [
        { label: "黑玻璃", value: "dark" },
        { label: "白玻璃", value: "light" },
      ],
    },
    { key: "blur", label: "虚化程度", type: "range", min: 0, max: 60, step: 2, unit: "px" },
    { key: "alpha", label: "玻璃底浓度", type: "range", min: 0, max: 0.95, step: 0.02, unit: "" },
    { key: "topSafe", label: "顶部让开(章节条 48px)", type: "range", min: 0, max: 200, step: 1, unit: "px" },
    { key: "bottomSafe", label: "底部让开(字幕)", type: "range", min: 0, max: 300, step: 4, unit: "px" },
  ],
  Component: FrostScreen,
};
