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

export interface StairBarsParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 顶部 EN 等宽 kicker */
  kicker: string;
  /** 标题,\n 分行,*星号包住*的段变强调色 */
  title: string;
  /** 柱值(数字,| 分隔,决定柱高) */
  vals: string;
  /** 柱顶数值文案(| 分隔,与 vals 对应) */
  valTexts: string;
  /** 柱底档位标签(| 分隔) */
  labels: string;
  /** 柱色(CSS 颜色,| 分隔,与 vals 对应,不够时循环;支持 var(--hud-green) 等令牌) */
  colors: string;
  /** 横向网格线数值(| 分隔) */
  grid: string;
  /** 网格线标签单位 */
  gridUnit: string;
  /** 柱下小字说明 */
  caption: string;
  /** 底注,*星号*=加粗 */
  foot: string;
  /** 4 拍点亮秒数(距卡片开始,| 分隔):标题|柱|说明|底注 */
  times: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const BEAT_FALLBACK = [0.3, 1.3, 3.4, 5.2];

/**
 * 分档对比柱(逐级恶化):几档同一指标从左到右升起,绿→橙→红,
 * 网格线打底,柱顶数值同色点名,底注收一句结论。
 */
function StairBars({ params, playToken }: EffectProps<StairBarsParams>) {
  const {
    position, kicker, title, vals, valTexts, labels, colors,
    grid, gridUnit, caption, foot, times, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const on = (i: number) => elapsed >= (Number.isFinite(ts[i]) ? ts[i] : BEAT_FALLBACK[i]);

  const lines = title.split("\n").map((ln) =>
    ln.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 })),
  );

  const vlist = vals.split("|").map((s) => parseFloat(s.trim())).filter((v) => Number.isFinite(v));
  const vtexts = valTexts.split("|").map((s) => s.trim());
  const llist = labels.split("|").map((s) => s.trim());
  const palette = colors.split("|").map((s) => s.trim()).filter(Boolean);
  const glist = grid.split("|").map((s) => parseFloat(s.trim())).filter((v) => Number.isFinite(v));
  const gMax = Math.max(...vlist, ...glist, 1) * 1.08;

  const footSegs = foot.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 }));

  return (
    <div
      className={`hud stb hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...offsetVars(params),
      }}
    >
      <div className="stb-board">
        {kicker && (
          <div className="stb-kicker">
            <i />
            <span>{kicker}</span>
          </div>
        )}
        <div className={`stb-title ${on(0) ? "is-on" : ""}`}>
          {lines.map((lsegs, li) => (
            <div className="stb-title-line" key={li} style={{ transitionDelay: `${li * 160}ms` }}>
              {lsegs.map((s, si) =>
                s.acc ? <em key={si}>{s.seg}</em> : <span key={si}>{s.seg}</span>,
              )}
            </div>
          ))}
        </div>

        <div className="stb-card">
          <div className={`stb-chart ${on(1) ? "is-on" : ""}`}>
            {glist.map((g, i) => (
              <div className="stb-grid" key={i} style={{ bottom: `${(g / gMax) * 100}%` }}>
                <span>{g}{gridUnit}</span>
              </div>
            ))}
            {vlist.map((v, i) => {
              const color = palette[i % Math.max(1, palette.length)] ?? "#999";
              return (
                <div className="stb-slot" key={i}>
                  <div className="stb-barwrap" style={{ height: `${(v / gMax) * 100}%` }}>
                    <b className="stb-val" style={{ color, transitionDelay: `${i * 220 + 420}ms` }}>
                      {vtexts[i] ?? v}
                    </b>
                    <i
                      className="stb-bar"
                      style={{ background: color, transitionDelay: `${i * 220}ms` }}
                    />
                  </div>
                  <span className="stb-label">{llist[i] ?? ""}</span>
                </div>
              );
            })}
          </div>
          <div className={`stb-caption ${on(2) ? "is-on" : ""}`}>{caption}</div>
        </div>

        <div className={`stb-foot ${on(3) ? "is-on" : ""}`}>
          {footSegs.map((s, si) =>
            s.acc ? <strong key={si}>{s.seg}</strong> : <span key={si}>{s.seg}</span>,
          )}
        </div>
      </div>
    </div>
  );
}

export const stairBarsDef: EffectDef<StairBarsParams> = {
  id: "stair-bars",
  vTier: "half",
  name: "StairBars",
  description: "分档对比柱 · 绿到红逐级恶化,同指标不同档",
  tags: ["对撞并置", "逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    kicker: "LEVELS · 眉题写英文",
    title: "同一件事\n从 3 变成 *9.3*",
    vals: "3|4.8|9.3",
    valTexts: "3s|4.8s|9.3s",
    labels: "第一档|第二档|第三档",
    colors: "var(--hud-green)|var(--hud-orange)|var(--hud-alert)",
    grid: "3|6|9",
    gridUnit: "s",
    caption: "小注写这三档是按什么分的",
    foot: "脚注写数据口径 · 星号包住的词会*变强调色*",
    times: "0.3|1.3|3.4|5.2",
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
    { key: "vals", label: "柱值(数字,| 分隔)", type: "text" },
    { key: "valTexts", label: "柱顶数值文案(| 分隔)", type: "text" },
    { key: "labels", label: "档位标签(| 分隔)", type: "text" },
    { key: "colors", label: "柱色(| 分隔,可用 var(--hud-*) 令牌)", type: "text" },
    { key: "grid", label: "网格线数值(| 分隔)", type: "text" },
    { key: "gridUnit", label: "网格线单位", type: "text" },
    { key: "caption", label: "柱下说明", type: "text" },
    { key: "foot", label: "底注(*星号*=加粗)", type: "text" },
    { key: "times", label: "4 拍秒数(标题|柱|说明|底注)", type: "text" },
    { key: "accent", label: "强调色(眉题/标题)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: StairBars,
};
