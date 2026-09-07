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

export interface NumberBeatsParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  points: string; // "标题,一句话|标题,一句话"
  holdMs: number; // 每点停留
  loop: boolean;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

/** 巨大幽灵数字 01→02→03 切换,分点讲述 */
function NumberBeats({ params, playToken }: EffectProps<NumberBeatsParams>) {
  const { position, points, holdMs, loop, accent } = params;
  const elapsed = useElapsed(playToken, 120000);
  const list = points.split("|").map((p) => {
    const [title, sub] = p.split(",");
    return { title: (title ?? "").trim(), sub: (sub ?? "").trim() };
  });
  const raw = Math.floor(elapsed / holdMs);
  const idx = loop ? raw % list.length : Math.min(raw, list.length - 1);
  // 兜底:参数异常/挂载瞬间竞态时不崩,退回第一点
  const cur = list[idx] ?? list[0] ?? { title: "", sub: "" };

  return (
    <div
      className={`hud ${glassClass(params.glass)} nb is-live hud-anchor hud-anchor--${position}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
      // key 变化 → 文字重新触发滑入
      key={`beat-${idx}-${playToken}`}
    >
      <div className="nb-num-box">
        <div className="nb-num is-on">{String(idx + 1).padStart(2, "0")}</div>
      </div>
      <div className="nb-texts">
        <div className="nb-title">{cur.title}</div>
        <div className="nb-rule" />
        {cur.sub && <div className="nb-sub">{cur.sub}</div>}
      </div>
    </div>
  );
}

export const numberBeatsDef: EffectDef<NumberBeatsParams> = {
  id: "number-beats",
  name: "NumberBeats",
  description: "大数字分点 · 幽灵数字切换讲要点",
  tags: ["翻转轮换", "滚动计数"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "right",
    points:
      "第一点,大数字滚出编号,短句跟上|第二点,每一条卡在你开口的瞬间|第三点,三条讲完正好收束",
    holdMs: 2600,
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
        { label: "右侧", value: "right" },
        { label: "左侧", value: "left" },
        { label: "居中", value: "center" },
      ],
    },
    { key: "points", label: "要点(标题,一句话 用 | 分隔)", type: "text" },
    { key: "holdMs", label: "每点停留", type: "range", min: 1200, max: 6000, step: 200, unit: "ms" },
    { key: "loop", label: "循环播放", type: "toggle" },
    { key: "accent", label: "数字颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: NumberBeats,
};
