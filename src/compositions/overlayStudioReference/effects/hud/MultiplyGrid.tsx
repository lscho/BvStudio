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

export interface MultiplyGridParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 顶部 EN 等宽 kicker */
  kicker: string;
  /** 标题,\n 分行,*星号包住*的段变强调色 */
  title: string;
  /** 方块阵:列数 × 行数 = 乘法结果(方块颜色跟强调色) */
  gridCols: number;
  gridRows: number;
  /** 结果行(红色加粗),如 "= 6 倍成本" */
  result: string;
  factor1: string;
  factor2: string;
  gridCaption: string;
  /** 右卡大数字 + 角标 */
  statVal: string;
  statUnit: string;
  /** 右卡正文,*星号*=加粗 */
  statText: string;
  /** 5 拍点亮秒数(距卡片开始,| 分隔):标题|方块阵|结果行|大数字|正文 */
  times: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const BEAT_FALLBACK = [0.3, 1.4, 2.8, 4.4, 5.6];

/**
 * 乘法成本(相乘不是相加):左卡方块阵逐个落下(列×行),
 * 点出"= N 倍"结果;右卡大数字压阵 + 一句扎心正文。
 */
function MultiplyGrid({ params, playToken }: EffectProps<MultiplyGridParams>) {
  const {
    position, kicker, title, gridCols, gridRows, result,
    factor1, factor2, gridCaption, statVal, statUnit, statText,
    times, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const on = (i: number) => elapsed >= (Number.isFinite(ts[i]) ? ts[i] : BEAT_FALLBACK[i]);

  const lines = title.split("\n").map((ln) =>
    ln.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 })),
  );

  const cols = Math.max(1, Math.min(6, Math.round(gridCols)));
  const rows = Math.max(1, Math.min(6, Math.round(gridRows)));
  const count = cols * rows;

  const textSegs = statText.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 }));

  return (
    <div
      className={`hud mpg hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...offsetVars(params),
      }}
    >
      <div className="mpg-board">
        {kicker && (
          <div className="mpg-kicker">
            <i />
            <span>{kicker}</span>
          </div>
        )}
        <div className={`mpg-title ${on(0) ? "is-on" : ""}`}>
          {lines.map((lsegs, li) => (
            <div className="mpg-title-line" key={li} style={{ transitionDelay: `${li * 160}ms` }}>
              {lsegs.map((s, si) =>
                s.acc ? <em key={si}>{s.seg}</em> : <span key={si}>{s.seg}</span>,
              )}
            </div>
          ))}
        </div>

        <div className="mpg-row">
          <div className={`mpg-card mpg-cardL ${on(1) ? "is-on" : ""}`}>
            <div className="mpg-flex">
              <div
                className="mpg-grid"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {Array.from({ length: count }, (_, i) => (
                  <i key={i} style={{ transitionDelay: `${i * 110}ms` }} />
                ))}
              </div>
              <div className="mpg-facts">
                <b className={`mpg-result ${on(2) ? "is-on" : ""}`}>{result}</b>
                <span className="mpg-factor">{factor1}</span>
                <span className="mpg-factor">{factor2}</span>
              </div>
            </div>
            <div className="mpg-caption">{gridCaption}</div>
          </div>

          <div className={`mpg-card mpg-cardR ${on(3) ? "is-on" : ""}`}>
            <div className="mpg-stat">
              {statVal}
              <sub>{statUnit}</sub>
            </div>
            <div className={`mpg-text ${on(4) ? "is-on" : ""}`}>
              {textSegs.map((s, si) =>
                s.acc ? <strong key={si}>{s.seg}</strong> : <span key={si}>{s.seg}</span>,
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const multiplyGridDef: EffectDef<MultiplyGridParams> = {
  id: "multiply-grid",
  vTier: "half",
  name: "MultiplyGrid",
  description: "乘法成本 · 方块阵 列×行,两个乘数是相乘不是相加",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    kicker: "MULTIPLY · 眉题写英文",
    title: "两个因素叠在一起\n是*相乘*,不是相加",
    gridCols: 2,
    gridRows: 3,
    result: "= 6 倍",
    factor1: "因素一 2 倍",
    factor2: "× 因素二 3 倍",
    gridCaption: "一句话说明为什么相乘比相加狠",
    statVal: "54",
    statUnit: "%",
    statText: "补一个数字佐证:*27%* 的量,吃掉了 *54%* 的成本",
    times: "0.3|1.4|2.8|4.4|5.6",
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
    { key: "gridCols", label: "方块列数", type: "range", min: 1, max: 6, step: 1 },
    { key: "gridRows", label: "方块行数", type: "range", min: 1, max: 6, step: 1 },
    { key: "result", label: "结果行(强调色)", type: "text" },
    { key: "factor1", label: "乘数一", type: "text" },
    { key: "factor2", label: "乘数二", type: "text" },
    { key: "gridCaption", label: "左卡小字", type: "text" },
    { key: "statVal", label: "右卡大数字", type: "text" },
    { key: "statUnit", label: "右卡角标", type: "text" },
    { key: "statText", label: "右卡正文(*星号*=加粗)", type: "textarea", rows: 3 },
    { key: "times", label: "5 拍秒数(标题|方块|结果|大数|正文)", type: "text" },
    { key: "accent", label: "强调色(方块/大数字)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: MultiplyGrid,
};
