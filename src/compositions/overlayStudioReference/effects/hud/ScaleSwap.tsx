import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { VecIcon } from "./vecIcons";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface ScaleSwapParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 标题,\n 分行,*星号包住*的段变强调色 */
  title: string;
  labelA: string;
  /** 假进度条显示的百分比(旧刻度下的读数) */
  pctA: number;
  tagA: string;
  /** 真实窗口在旧刻度上的位置(%) */
  markPct: number;
  markNote: string;
  labelB: string;
  valB: string;
  warnB: string;
  foot: string;
  /** 5 拍点亮秒数(距卡片开始,| 分隔):标题|条A|虚线标记|条B|底注 */
  times: string;
  /** 白玻璃底板透明度 */
  bgAlpha?: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const BEAT_FALLBACK = [0.3, 1.2, 3.2, 5.2, 7.4];
const RULER_CELLS = 13;

/**
 * 尺子换对了(进度条假信号):同一数字、两把刻度。
 * 上条按旧刻度只填一小段"看起来还很空",虚线标出真实窗口早已满;
 * 下条把刻度换对,整根深红溢出 + 该换气警告。5 拍跟口播卡点走。
 */
function ScaleSwap({ params, playToken }: EffectProps<ScaleSwapParams>) {
  const {
    position, title, labelA, pctA, tagA, markPct, markNote,
    labelB, valB, warnB, foot, times, bgAlpha, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const on = (i: number) => elapsed >= (Number.isFinite(ts[i]) ? ts[i] : BEAT_FALLBACK[i]);

  // 标题按 \n 分行,行内 *强调段* 变红
  const lines = title.split("\n").map((ln) =>
    ln.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 })),
  );

  const pa = Math.max(2, Math.min(96, pctA));
  const mp = Math.max(2, Math.min(96, markPct));

  return (
    <div
      className={`hud ssw hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...(typeof bgAlpha === "number" ? { ["--ssw-alpha" as string]: bgAlpha } : {}),
        ...offsetVars(params),
      }}
    >
      <div className="ssw-board">
        <div className={`ssw-title ${on(0) ? "is-on" : ""}`}>
          {lines.map((segs, li) => (
            <div className="ssw-title-line" key={li} style={{ transitionDelay: `${li * 160}ms` }}>
              {segs.map((s, si) =>
                s.acc ? <em key={si}>{s.seg}</em> : <span key={si}>{s.seg}</span>,
              )}
            </div>
          ))}
        </div>

        <div className="ssw-card">
          {/* 条 A:旧刻度,读数看起来还很空 */}
          <div className={`ssw-row ${on(1) ? "is-on" : ""}`}>
            <div className="ssw-label">{labelA}</div>
            <div className="ssw-trackwrap">
              <div className="ssw-track">
                <i className="ssw-fillA" style={{ width: `${pa}%` }} />
                <span className="ssw-tagA" style={{ left: `calc(${pa}% + 28px)` }}>
                  {tagA}
                </span>
              </div>
              <div className={`ssw-mark ${on(2) ? "is-on" : ""}`} style={{ left: `${mp}%` }}>
                <i className="ssw-mark-line" />
                <span className="ssw-mark-note">{markNote}</span>
              </div>
            </div>
          </div>

          {/* 条 B:刻度换对,整根溢出 */}
          <div className={`ssw-row ssw-rowB ${on(3) ? "is-on" : ""}`}>
            <div className="ssw-label">{labelB}</div>
            <div className="ssw-track ssw-trackB">
              <i className="ssw-fillB" />
              <div className="ssw-bcontent">
                <b className="ssw-bval">{valB}</b>
                <span className="ssw-ruler">
                  {Array.from({ length: RULER_CELLS }, (_, i) => (
                    <i key={i} style={{ transitionDelay: `${420 + i * 45}ms` }} />
                  ))}
                </span>
                <span className="ssw-warn">
                  <VecIcon name="warn" size={24} />
                  {warnB}
                </span>
              </div>
            </div>
          </div>

          <div className={`ssw-foot ${on(4) ? "is-on" : ""}`}>{foot}</div>
        </div>
      </div>
    </div>
  );
}

export const scaleSwapDef: EffectDef<ScaleSwapParams> = {
  id: "scale-swap",
  vTier: "half",
  name: "ScaleSwap",
  description: "尺子换对了 · 同一数字两把刻度,假进度条现形",
  tags: ["对撞并置"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    title: "同一个数字\n换把尺子*结论就反了*",
    labelA: "尺子一 · 刻度画到 100 万",
    pctA: 30,
    tagA: "显示 30% · 看起来还很空",
    markPct: 20,
    markNote: "真正的临界点其实在这里",
    labelB: "尺子二 · 刻度改到 20 万",
    valB: "300K",
    warnB: "该动手了",
    foot: "同一个数字,只是把尺子换对了",
    times: "0.3|1.2|3.2|5.2|7.4",
    bgAlpha: 0.7,
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
        { label: "居中", value: "center" },
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "title", label: "标题(\\n 分行,*星号*=强调红)", type: "textarea", rows: 2 },
    { key: "labelA", label: "条A名目(旧刻度)", type: "text" },
    { key: "pctA", label: "条A读数(%)", type: "range", min: 5, max: 95, step: 1, unit: "%" },
    { key: "tagA", label: "条A旁注", type: "text" },
    { key: "markPct", label: "真实窗口位置(%)", type: "range", min: 5, max: 95, step: 1, unit: "%" },
    { key: "markNote", label: "虚线标记注释", type: "text" },
    { key: "labelB", label: "条B名目(新刻度)", type: "text" },
    { key: "valB", label: "条B大数字", type: "text" },
    { key: "warnB", label: "条B警告语", type: "text" },
    { key: "foot", label: "底注", type: "text" },
    { key: "times", label: "5 拍秒数(标题|条A|标记|条B|底注)", type: "text" },
    { key: "bgAlpha", label: "底板透明度(越小越透)", type: "range", min: 0.2, max: 1, step: 0.05, unit: "" },
    { key: "accent", label: "强调色(标题红/深红条)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: ScaleSwap,
};
