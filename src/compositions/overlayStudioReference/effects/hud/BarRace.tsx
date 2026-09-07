import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface BarRaceParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center" | "top";
  /** 顶部 EN kicker,如 "VIRAL CHANCE · BY FREQUENCY" */
  kicker: string;
  /** kicker 中文小注 */
  kickerZh: string;
  /** 数据行,| 分隔,每行「标签 数值」,如 "1/周 12|5/周 48|75/天 96" */
  rows: string;
  /** 数值后缀 */
  unit: string;
  /** 每条开跑间隔(卡点用) */
  stepMs: number;
  /** 布局:h 横条赛跑 / v 竖柱(数值顶在柱头,标签在底,周活跃数式) */
  layout?: "h" | "v";
  /** 竖柱模式最高柱颜色(默认达成绿) */
  topAccent?: string;
  /** 结论盖章,如 "✓ 频率优先"(空 = 不盖章;条形跑完后弹出) */
  verdict: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

interface Row {
  label: string;
  value: number;
}

function parseRows(raw: string): Row[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => {
      const m = seg.match(/^(.*?)\s+([\d.]+)$/);
      return m
        ? { label: m[1].trim(), value: parseFloat(m[2]) }
        : { label: seg, value: 0 };
    });
}

/**
 * 条形赛跑卡:横向条形逐条开跑,最大值那条自动换橙色高亮 —
 * "一周 1 条 12% vs 一天 75 条 96%" 式的量级对比一眼见分晓。
 */
function BarRace({ params, playToken }: EffectProps<BarRaceParams>) {
  const { position, kicker, kickerZh, rows, unit, stepMs, verdict, accent, layout, topAccent } = params;
  const entered = useEnter(playToken);
  const parsed = parseRows(rows);
  const max = Math.max(...parsed.map((r) => r.value), 1);
  const vertical = layout === "v";

  return (
    <div
      className={`hud brc hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--brc-top" as string]: ACCENT_VAR[topAccent ?? ""] ?? "#46d07c",
        ...offsetVars(params),
      }}
    >
      <div className="brc-box">
        {kicker && (
          <div className="brc-kicker">
            <i className="brc-bar" />
            <span>{kicker}</span>
          </div>
        )}
        {kickerZh && <div className="brc-kicker-zh">{kickerZh}</div>}
        {vertical ? (
          <div className="brc-cols">
            {parsed.map((r, i) => (
              <div className="brc-col" key={i}>
                <span
                  className={`brc-cval ${r.value === max ? "is-top" : ""}`}
                  style={{ transitionDelay: `${400 + i * stepMs + 450}ms` }}
                >
                  {r.value}
                  {unit}
                </span>
                <span className="brc-ctrack">
                  <i
                    className={`brc-cfill ${r.value === max ? "is-top" : ""}`}
                    style={{
                      height: entered ? `${(r.value / max) * 100}%` : "0%",
                      transitionDelay: `${400 + i * stepMs}ms`,
                    }}
                  />
                </span>
                <span className="brc-clb">{r.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="brc-rows">
            {parsed.map((r, i) => (
              <div className="brc-row" key={i}>
                <span className="brc-lb">{r.label}</span>
                <span className="brc-track">
                  <i
                    className={`brc-fill ${r.value === max ? "is-top" : ""}`}
                    style={{
                      width: entered ? `${(r.value / max) * 100}%` : "0%",
                      transitionDelay: `${400 + i * stepMs}ms`,
                    }}
                  />
                </span>
                <span
                  className={`brc-val ${r.value === max ? "is-top" : ""}`}
                  style={{ transitionDelay: `${400 + i * stepMs + 500}ms` }}
                >
                  {r.value}
                  {unit}
                </span>
              </div>
            ))}
          </div>
        )}
        {verdict && (
          <div
            className="brc-verdict"
            style={{ transitionDelay: `${400 + parsed.length * stepMs + 900}ms` }}
          >
            {verdict}
          </div>
        )}
      </div>
    </div>
  );
}

export const barRaceDef: EffectDef<BarRaceParams> = {
  id: "bar-race",
  name: "BarRace",
  description: "条形赛跑 · 逐条开跑,最大值自动橙色高亮",
  tags: ["生长描画", "滚动计数"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    kicker: "EN KICKER · HERE",
    kickerZh: "对比什么写在这",
    rows: "条目一 12|条目二 48|条目三 96",
    unit: "%",
    stepMs: 600,
    layout: "h",
    topAccent: "green",
    verdict: "✓ 结论写在这",
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
        { label: "右侧", value: "right" },
        { label: "居中", value: "center" },
        { label: "顶部", value: "top" },
      ],
    },
    {
      key: "layout",
      label: "布局",
      type: "select",
      options: [
        { label: "横条赛跑", value: "h" },
        { label: "竖柱(数值在柱头,气势足)", value: "v" },
      ],
    },
    { key: "topAccent", label: "最高柱颜色(竖柱模式)", type: "select", options: ACCENT_OPTIONS },
    { key: "kicker", label: "kicker(英文等宽)", type: "text" },
    { key: "kickerZh", label: "kicker 中文小注", type: "text" },
    { key: "rows", label: "数据行(标签 数值,| 分隔)", type: "text" },
    { key: "unit", label: "数值后缀(%/万)", type: "text" },
    { key: "stepMs", label: "每条开跑间隔(卡点用)", type: "range", min: 200, max: 3000, step: 100, unit: "ms" },
    { key: "verdict", label: "结论盖章(空 = 不盖)", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: BarRace,
};
