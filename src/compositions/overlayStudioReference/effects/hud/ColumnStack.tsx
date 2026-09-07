import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface ColumnStackParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 顶部 EN 等宽 kicker */
  kicker: string;
  /** 标题,\n 分行,*星号包住*的段变强调色 */
  title: string;
  /** 柱子根数 */
  rounds: number;
  /** 增长曲线指数,1=线性,越大越"后程发力" */
  pow: number;
  /** 顶部薄盖层图例(常量部分) */
  legendA: string;
  /** 底部厚底层图例(逐轮长高部分,颜色跟强调色) */
  legendB: string;
  /** 横轴刻度,| 分隔,首/中/尾均匀铺开 */
  ticks: string;
  foot: string;
  /** 4 拍点亮秒数(距卡片开始,| 分隔):标题|柱阵|图例|底注 */
  times: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const BEAT_FALLBACK = [0.3, 1.2, 3.4, 5.4];
const BODY_MIN = 6;
const BODY_MAX = 86;

/**
 * 逐轮堆叠柱(历史重付):每根柱=薄盖层(这轮的新增)+厚底层(逐轮长高的历史),
 * 从左到右依次升起,一眼看出"底越垫越厚,新东西只有薄薄一层"。
 */
function ColumnStack({ params, playToken }: EffectProps<ColumnStackParams>) {
  const {
    position, kicker, title, rounds, pow, legendA, legendB,
    ticks, foot, times, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const on = (i: number) => elapsed >= (Number.isFinite(ts[i]) ? ts[i] : BEAT_FALLBACK[i]);

  const lines = title.split("\n").map((ln) =>
    ln.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 })),
  );

  const n = Math.max(3, Math.min(20, Math.round(rounds)));
  const heights = Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 1 : i / (n - 1);
    return BODY_MIN + (BODY_MAX - BODY_MIN) * Math.pow(t, pow);
  });
  const tickList = ticks.split("|").map((s) => s.trim()).filter(Boolean);

  return (
    <div
      className={`hud cst hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...offsetVars(params),
      }}
    >
      <div className="cst-board">
        {kicker && (
          <div className="cst-kicker">
            <i />
            <span>{kicker}</span>
          </div>
        )}
        <div className={`cst-title ${on(0) ? "is-on" : ""}`}>
          {lines.map((lsegs, li) => (
            <div className="cst-title-line" key={li} style={{ transitionDelay: `${li * 160}ms` }}>
              {lsegs.map((s, si) =>
                s.acc ? <em key={si}>{s.seg}</em> : <span key={si}>{s.seg}</span>,
              )}
            </div>
          ))}
        </div>

        <div className="cst-card">
          <div className={`cst-legend ${on(2) ? "is-on" : ""}`}>
            <span><i className="cst-sw cst-swA" />{legendA}</span>
            <span><i className="cst-sw cst-swB" />{legendB}</span>
          </div>

          <div className={`cst-cols ${on(1) ? "is-on" : ""}`}>
            {heights.map((h, i) => (
              <div className="cst-col" key={i}>
                <i className="cst-cap" style={{ transitionDelay: `${i * 90 + 300}ms` }} />
                <i
                  className="cst-body"
                  style={{ height: `${h}%`, transitionDelay: `${i * 90}ms` }}
                />
              </div>
            ))}
          </div>

          <div className={`cst-ticks ${on(1) ? "is-on" : ""}`}>
            {tickList.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>

        <div className={`cst-foot ${on(3) ? "is-on" : ""}`}>{foot}</div>
      </div>
    </div>
  );
}

export const columnStackDef: EffectDef<ColumnStackParams> = {
  id: "column-stack",
  vTier: "full",
  name: "ColumnStack",
  description: "逐轮堆叠柱 · 底层越垫越厚,新增只有薄薄一层",
  tags: ["堆叠累积"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    kicker: "STACK · 眉题写英文",
    title: "底下越垫越厚\n新增只有*薄薄一层*",
    rounds: 12,
    pow: 1.15,
    legendA: "每轮新增的部分",
    legendB: "一直累积下来的部分",
    ticks: "第 1 轮|第 6 轮|第 12 轮",
    foot: "脚注写这张图在说明什么",
    times: "0.3|1.2|3.4|5.4",
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
    { key: "kicker", label: "眉题(EN 等宽)", type: "text" },
    { key: "title", label: "标题(\\n 分行,*星号*=强调色)", type: "textarea", rows: 2 },
    { key: "rounds", label: "柱子根数", type: "range", min: 4, max: 20, step: 1 },
    { key: "pow", label: "增长曲线(1=线性,大=后程发力)", type: "range", min: 0.6, max: 2, step: 0.05, unit: "" },
    { key: "legendA", label: "图例·薄盖层(绿)", type: "text" },
    { key: "legendB", label: "图例·厚底层(跟强调色)", type: "text" },
    { key: "ticks", label: "横轴刻度(| 分隔均匀铺开)", type: "text" },
    { key: "foot", label: "底注", type: "text" },
    { key: "times", label: "4 拍秒数(标题|柱阵|图例|底注)", type: "text" },
    { key: "accent", label: "强调色(标题/柱身)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: ColumnStack,
};
