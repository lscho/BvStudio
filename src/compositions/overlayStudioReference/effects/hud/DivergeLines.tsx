import type { CSSProperties } from "react";
import type { EffectDef, EffectProps } from "../types";
import { useEnter, useProgress } from "../useAnimation";
import { VecIcon } from "./vecIcons";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface DivergeLinesParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  /** split 一升一降(默认)/ gap 同起点一快一慢,红虚线量出差距 */
  mode?: "split" | "gap";
  /** gap 模式:差距标注文字(红,虚线旁),如 "效率差距 Δ" */
  gapLabel?: string;
  /** 顶部 EN 等宽 kicker(可空) */
  kicker: string;
  /** kicker 中文小注(可空) */
  kickerZh: string;
  /** 升线(绿)标签,如 "用户量" */
  aLabel: string;
  /** 降线(红)标签,如 "算力供给" */
  bLabel: string;
  /** 升线颜色(默认达成绿) */
  aColor?: string;
  /** 降线颜色(默认否定红) */
  bColor?: string;
  /** 两线画出时长(卡点用) */
  drawMs: number;
  /** 黑玻璃底板:dark / none */
  bg: "dark" | "none";
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

/**
 * 双线分叉图("用户量↑ / 算力供给↓"式):两个量从同一起点反向走——
 * 绿线上扬、红线下坠,同步画出,端点圆点亮起后标签带趋势箭头浮现。
 * 讲矛盾/失衡/此消彼长的时刻,一张图代替一段话。
 */
/** 三次贝塞尔取点:里程碑亮点要落在曲线上 */
function bez(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function DivergeLines({ params, playToken }: EffectProps<DivergeLinesParams>) {
  const { position, kicker, kickerZh, aLabel, bLabel, aColor, bColor, drawMs, bg } = params;
  const gap = params.mode === "gap";
  const entered = useEnter(playToken);
  const draw = useProgress(Math.max(400, drawMs), playToken);
  const lineVars = {
    "--djv-a": ACCENT_VAR[aColor ?? ""] ?? "#46d07c",
    "--djv-b": ACCENT_VAR[bColor ?? ""] ?? "#ef5350",
  } as CSSProperties;

  const W = 520;
  const H = 260;
  const sx = 42;
  const ex = W - 120;
  const labelOn = draw > 0.82;

  if (gap) {
    // 差距模式(参考片"效率差距 Δ"式):同起点都在涨,A 指数上扬发光、B 几乎平走,
    // 终点红虚线把差距竖着量出来。里程碑亮点随画出进度逐个点亮。
    const sy0 = H - 36;
    const aY = 30;
    const bY = sy0 - 40;
    // A:先缓后陡(指数感);B:浅浅上坡
    const aP = { p1x: W * 0.46, p1y: sy0 - 8, p2x: W * 0.6, p2y: H * 0.52, p3y: aY };
    const lineA = `M ${sx} ${sy0} C ${aP.p1x} ${aP.p1y}, ${aP.p2x} ${aP.p2y}, ${ex} ${aP.p3y}`;
    const lineB = `M ${sx} ${sy0} C ${W * 0.42} ${sy0 - 4}, ${W * 0.66} ${sy0 - 20}, ${ex} ${bY}`;
    // 里程碑点(沿 A 线):画出进度扫过才亮
    const miles = [0.5, 0.78].map((t) => ({
      t,
      x: bez(t, sx, aP.p1x, aP.p2x, ex),
      y: bez(t, sy0, aP.p1y, aP.p2y, aP.p3y),
    }));
    return (
      <div
        className={`hud djv djv--gap hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
        style={{ ["--hud-acc" as string]: ACCENT_VAR[params.accent], ...lineVars, ...offsetVars(params) }}
      >
        <div className={`djv-box ${bg === "none" ? "is-bare" : ""}`}>
          {(kicker || kickerZh) && (
            <div className="djv-head">
              {kicker && (
                <div className="djv-kicker">
                  <i />
                  <span>{kicker}</span>
                </div>
              )}
              {kickerZh && <div className="djv-kicker-zh">{kickerZh}</div>}
            </div>
          )}
          <div className="djv-plot">
            <svg width={W} height={H} style={{ overflow: "visible" }}>
              <path className="djv-line djv-line--b djv-line--flat" d={lineB} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <path className="djv-line djv-line--a djv-line--glow" d={lineA} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <circle className="djv-start" cx={sx} cy={sy0} r={7} />
              {miles.map((m) => (
                <circle key={m.t} className={`djv-mile ${draw > m.t ? "is-on" : ""}`} cx={m.x} cy={m.y} r={6} />
              ))}
              <circle className="djv-dot djv-dot--a" cx={ex} cy={aY} r={8} opacity={labelOn ? 1 : 0} />
              <line
                className={`djv-gapline ${labelOn ? "is-on" : ""}`}
                x1={ex} y1={aY + 14} x2={ex} y2={bY - 8}
              />
            </svg>
            <div className={`djv-tag djv-tag--a ${labelOn ? "is-on" : ""}`} style={{ left: ex + 16, top: aY }}>
              <span>{aLabel}</span>
              <VecIcon name="trend-up" size={22} />
            </div>
            <div className={`djv-tag djv-tag--flat ${labelOn ? "is-on" : ""}`} style={{ left: ex + 16, top: bY }}>
              <span>{bLabel}</span>
            </div>
            {params.gapLabel && (
              <div className={`djv-gaplabel ${labelOn ? "is-on" : ""}`} style={{ left: ex + 16, top: (aY + bY) / 2 }}>
                {params.gapLabel}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const sy = H / 2;
  // 先平走一小段再分叉:与参考片的"起初一样,后来拉开"叙事一致
  const lineA = `M ${sx} ${sy} C ${W * 0.34} ${sy}, ${W * 0.5} ${sy - 60}, ${ex} ${sy - 88}`;
  const lineB = `M ${sx} ${sy} C ${W * 0.34} ${sy}, ${W * 0.5} ${sy + 62}, ${ex} ${sy + 96}`;

  return (
    <div
      className={`hud djv hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[params.accent], ...lineVars, ...offsetVars(params) }}
    >
      <div className={`djv-box ${bg === "none" ? "is-bare" : ""}`}>
        {(kicker || kickerZh) && (
          <div className="djv-head">
            {kicker && (
              <div className="djv-kicker">
                <i />
                <span>{kicker}</span>
              </div>
            )}
            {kickerZh && <div className="djv-kicker-zh">{kickerZh}</div>}
          </div>
        )}
        <div className="djv-plot">
          <svg width={W} height={H} style={{ overflow: "visible" }}>
            <path className="djv-line djv-line--a" d={lineA} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
            <path className="djv-line djv-line--b" d={lineB} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
            <circle className="djv-start" cx={sx} cy={sy} r={7} />
            <circle className="djv-dot djv-dot--a" cx={ex} cy={sy - 88} r={8} opacity={labelOn ? 1 : 0} />
            <circle className="djv-dot djv-dot--b" cx={ex} cy={sy + 96} r={8} opacity={labelOn ? 1 : 0} />
          </svg>
          <div className={`djv-tag djv-tag--a ${labelOn ? "is-on" : ""}`} style={{ left: ex + 16, top: sy - 88 }}>
            <span>{aLabel}</span>
            <VecIcon name="trend-up" size={22} />
          </div>
          <div className={`djv-tag djv-tag--b ${labelOn ? "is-on" : ""}`} style={{ left: ex + 16, top: sy + 96 }}>
            <span>{bLabel}</span>
            <VecIcon name="trend-down" size={22} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const divergeLinesDef: EffectDef<DivergeLinesParams> = {
  id: "diverge-lines",
  name: "DivergeLines",
  description: "双线分叉图 · 一升一降此消彼长;gap 模式一快一慢,红虚线量差距",
  tags: ["生长描画"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    mode: "split",
    gapLabel: "",
    kicker: "",
    kickerZh: "",
    aLabel: "升的量写这",
    bLabel: "降的量写这",
    aColor: "green",
    bColor: "alert",
    drawMs: 1600,
    bg: "dark",
    accent: "blue",
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
    {
      key: "mode",
      label: "图形模式",
      type: "select",
      options: [
        { label: "分叉(一升一降)", value: "split" },
        { label: "差距(一快一慢+红虚线)", value: "gap" },
      ],
    },
    { key: "gapLabel", label: "差距标注(gap 模式,如 效率差距 Δ)", type: "text" },
    { key: "kicker", label: "EN 眉题(可空)", type: "text" },
    { key: "kickerZh", label: "中文小注(可空)", type: "text" },
    { key: "aLabel", label: "升线标签(自带↗)", type: "text" },
    { key: "bLabel", label: "降线标签(自带↘)", type: "text" },
    { key: "aColor", label: "升线颜色", type: "select", options: ACCENT_OPTIONS },
    { key: "bColor", label: "降线颜色", type: "select", options: ACCENT_OPTIONS },
    { key: "drawMs", label: "画出时长(卡点用)", type: "range", min: 400, max: 6000, step: 100, unit: "ms" },
    {
      key: "bg",
      label: "底板",
      type: "select",
      options: [
        { label: "黑玻璃", value: "dark" },
        { label: "无底板", value: "none" },
      ],
    },
    { key: "accent", label: "点缀色(眉题)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: DivergeLines,
};
