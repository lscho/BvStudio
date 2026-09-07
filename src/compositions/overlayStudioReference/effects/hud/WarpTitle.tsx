import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { ACCENT_OPTIONS, ACCENT_VAR } from "./accent";

export interface WarpTitleParams {
  title: string;
  /** 副题(如"大揭秘"),用强调色大字,晚半拍砸入;留空不显示 */
  sub: string;
  accent: string;
  /** 穿梭速度倍率(星轨飞行快慢) */
  speed: number;
}

/** 星轨参数表:黄金角散布 + 素数取模抖动,确定性伪随机(导出可复现) */
const RAYS = Array.from({ length: 42 }, (_, i) => ({
  ang: (i * 137.5) % 360,
  /** 相位 0~1:负延迟错开,让星轨一直在飞而不是齐步走 */
  phase: ((i * 173) % 100) / 100,
  len: 90 + ((i * 53) % 150),
  thick: i % 5 === 0 ? 3 : 2,
  tinted: i % 9 === 0,
}));

function WarpTitle({ params, playToken }: EffectProps<WarpTitleParams>) {
  const { title, sub, accent, speed } = params;
  const entered = useEnter(playToken);
  const dur = 1.7 / (speed > 0 ? speed : 1);

  return (
    <div
      className={`hud wpt ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent] }}
    >
      <div className="wpt-rays">
        {RAYS.map((r, i) => (
          <div key={i} className="wpt-ray" style={{ transform: `rotate(${r.ang}deg)` }}>
            <i
              className={`wpt-line ${r.tinted ? "is-tint" : ""}`}
              style={{
                width: `${r.len}px`,
                height: `${r.thick}px`,
                animationDuration: `${dur}s`,
                animationDelay: `${(-r.phase * dur).toFixed(3)}s`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="wpt-flash" />
      <div className="wpt-title">{title}</div>
      {sub && <div className="wpt-sub">{sub}</div>}
    </div>
  );
}

export const warpTitleDef: EffectDef<WarpTitleParams> = {
  id: "warp-title",
  name: "WarpTitle",
  description: "星空穿梭标题 · 黑底星轨飞驰,大标题闪现微震(章节转场)",
  tags: ["粒子流场", "推近定格"],
  selfPosition: true,
  defaults: {
    title: "《标题写在这里》",
    sub: "副标题",
    accent: "blue",
    speed: 1,
  },
  controls: [
    { key: "title", label: "主标题", type: "text" },
    { key: "sub", label: "副题(留空不显示)", type: "text" },
    { key: "accent", label: "强调色(副题/星轨点缀)", type: "select", options: ACCENT_OPTIONS },
    { key: "speed", label: "穿梭速度", type: "range", min: 0.5, max: 2.5, step: 0.1, unit: "×" },
  ],
  Component: WarpTitle,
};
