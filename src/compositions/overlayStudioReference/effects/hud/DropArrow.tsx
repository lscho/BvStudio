import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  GLASS_CONTROLS,
  GLASS_DEFAULTS,
  glassClass,
  glassVars,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface DropArrowParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 顶部 EN 等宽 kicker */
  kicker: string;
  /** 标题,\n 分行,*星号包住*的段变强调色 */
  title: string;
  fromLabel: string;
  fromVal: string;
  toLabel: string;
  toVal: string;
  /** 降幅大字,如 −88% */
  pct: string;
  pctNote: string;
  foot: string;
  /** 4 拍点亮秒数(距卡片开始,| 分隔):标题|前值|箭头+后值|降幅大字 */
  times: string;
  accent: string;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
  offsetX?: number;
  offsetY?: number;
}

const BEAT_FALLBACK = [0.3, 1.4, 2.8, 4.2];

function boldSegs(s: string) {
  return s.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 }));
}

/**
 * 降幅大箭头(压缩实测):前值立在左上,粗箭头大幅度俯冲画出、
 * 落点弹出后值,巨号"−88%"砸出收结论。4 拍跟口播卡点走。
 */
function DropArrow({ params, playToken }: EffectProps<DropArrowParams>) {
  const {
    position, kicker, title, fromLabel, fromVal, toLabel, toVal,
    pct, pctNote, foot, times, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const on = (i: number) => elapsed >= (Number.isFinite(ts[i]) ? ts[i] : BEAT_FALLBACK[i]);

  const lines = title.split("\n").map((ln) =>
    ln.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 })),
  );

  return (
    <div
      className={`hud ${glassClass(params.glass)} dpa hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...offsetVars(params),
        ...glassVars(params.glassAlpha),
      }}
    >
      {kicker && (
        <div className={`dpa-kicker ${on(0) ? "is-on" : ""}`}>
          <i className="dpa-bar" />
          {kicker}
        </div>
      )}
      <div className={`dpa-title ${on(0) ? "is-on" : ""}`}>
        {lines.map((segs, i) => (
          <div key={i}>
            {segs.map(({ seg, acc }, j) => (acc ? <b key={j}>{seg}</b> : <span key={j}>{seg}</span>))}
          </div>
        ))}
      </div>

      <div className="dpa-chart">
        {/* 前值:左上立起 */}
        <div className={`dpa-val dpa-val--from ${on(1) ? "is-on" : ""}`}>
          <div className="dpa-val-num">{fromVal}</div>
          <div className="dpa-val-lb">{fromLabel}</div>
        </div>

        {/* 暴跌之字箭头:折线笔画描出 + 错位阴影,大三角头收尾(颜色跟强调色) */}
        <svg className="dpa-svg" viewBox="0 0 620 400" aria-hidden="true">
          <g className={`dpa-arrow ${on(2) ? "is-on" : ""}`}>
            <g className="dpa-shadow">
              <path className="dpa-zig" d="M150 90 L245 195 L330 135 L420 240 L490 185 L540 250" />
              <polygon className="dpa-tip" points="581,218 589,313 499,282" />
            </g>
            <g className="dpa-main">
              <path className="dpa-zig" d="M150 90 L245 195 L330 135 L420 240 L490 185 L540 250" />
              <polygon className="dpa-tip" points="581,218 589,313 499,282" />
            </g>
          </g>
        </svg>

        {/* 后值:箭头落点弹出 */}
        <div className={`dpa-val dpa-val--to ${on(2) ? "is-on" : ""}`}>
          <div className="dpa-val-num">{toVal}</div>
          <div className="dpa-val-lb">{toLabel}</div>
        </div>

        {/* 降幅巨字 */}
        <div className={`dpa-pct ${on(3) ? "is-on" : ""}`}>
          <div className="dpa-pct-num">{pct}</div>
          {pctNote && <div className="dpa-pct-lb">{pctNote}</div>}
        </div>
      </div>

      {foot && (
        <div className={`dpa-foot ${on(3) ? "is-on" : ""}`}>
          {boldSegs(foot).map(({ seg, acc }, i) => (acc ? <b key={i}>{seg}</b> : <span key={i}>{seg}</span>))}
        </div>
      )}
    </div>
  );
}

export const dropArrowDef: EffectDef<DropArrowParams> = {
  id: "drop-arrow",
  vTier: "half",
  name: "DropArrow",
  description: "降幅大箭头 · 前值→俯冲箭头→后值,巨号降幅百分比砸出",
  tags: ["滚动计数"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    kicker: "DROP · 眉题写英文",
    title: "做了这件事\n*降幅很明显*",
    fromLabel: "改之前 · 中位数",
    fromVal: "52万",
    toLabel: "改之后",
    toVal: "6.6万",
    pct: "−88%",
    pctNote: "降幅",
    foot: "",
    times: "0.3|1.4|2.8|4.2",
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
        { label: "左侧", value: "left" },
        { label: "居中", value: "center" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "kicker", label: "EN 眉题(可空)", type: "text" },
    { key: "title", label: "标题(\\n 分行,*词*强调)", type: "text" },
    { key: "fromVal", label: "前值", type: "text" },
    { key: "fromLabel", label: "前值小注", type: "text" },
    { key: "toVal", label: "后值", type: "text" },
    { key: "toLabel", label: "后值小注", type: "text" },
    { key: "pct", label: "降幅大字(如 −88%)", type: "text" },
    { key: "pctNote", label: "降幅小注", type: "text" },
    { key: "foot", label: "底注(可空,*词*加粗)", type: "text" },
    { key: "times", label: "4 拍点亮秒数:标题|前值|箭头+后值|降幅", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: DropArrow,
};
