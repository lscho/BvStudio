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

export interface StackShareParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 顶部 EN 等宽 kicker */
  kicker: string;
  /** 标题,\n 分行,*星号包住*的段变强调色 */
  title: string;
  /** 分段:"占比 名称" 用 | 分隔,占比按总和归一化 */
  segs: string;
  /** 括号圈住前几段 */
  bracketN: number;
  bracketText: string;
  caption: string;
  /** 底部绿框批注,*星号*=绿色加粗 */
  note: string;
  /** 5 拍点亮秒数(距卡片开始,| 分隔):标题|条|括号|图例|批注 */
  times: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const BEAT_FALLBACK = [0.3, 1.4, 3.2, 4.6, 6.2];

/**
 * 占比拆解(钱花哪了):一根堆叠条按占比分段依次铺开,
 * 括号圈出"大头"合计,图例点名各段,绿框批注给出下限/结论。
 */
function StackShare({ params, playToken }: EffectProps<StackShareParams>) {
  const {
    position, kicker, title, segs, bracketN, bracketText,
    caption, note, times, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const on = (i: number) => elapsed >= (Number.isFinite(ts[i]) ? ts[i] : BEAT_FALLBACK[i]);

  const lines = title.split("\n").map((ln) =>
    ln.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 })),
  );

  const items = segs
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const sp = s.indexOf(" ");
      const pct = parseFloat(sp > 0 ? s.slice(0, sp) : s);
      return {
        pct: Number.isFinite(pct) ? pct : 0,
        label: sp > 0 ? s.slice(sp + 1).trim() : "",
      };
    });
  const total = items.reduce((a, b) => a + b.pct, 0) || 1;
  // 段色:强调色不透明度阶梯(95%→20%),换强调色/主题自动跟随
  const segAlpha = (i: number) =>
    Math.round(95 - (items.length <= 1 ? 0 : (i / (items.length - 1)) * 75));
  const segColor = (i: number) =>
    `color-mix(in srgb, var(--hud-acc) ${segAlpha(i)}%, transparent)`;
  const widths = items.map((it) => (it.pct / total) * 100);
  const bn = Math.max(0, Math.min(items.length, Math.round(bracketN)));
  const bracketW = widths.slice(0, bn).reduce((a, b) => a + b, 0);

  const noteSegs = note.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 }));

  return (
    <div
      className={`hud sst hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...offsetVars(params),
      }}
    >
      <div className="sst-board">
        {kicker && (
          <div className="sst-kicker">
            <i />
            <span>{kicker}</span>
          </div>
        )}
        <div className={`sst-title ${on(0) ? "is-on" : ""}`}>
          {lines.map((lsegs, li) => (
            <div className="sst-title-line" key={li} style={{ transitionDelay: `${li * 160}ms` }}>
              {lsegs.map((s, si) =>
                s.acc ? <em key={si}>{s.seg}</em> : <span key={si}>{s.seg}</span>,
              )}
            </div>
          ))}
        </div>

        <div className="sst-card">
          {bn > 0 && (
            <div className={`sst-bracket ${on(2) ? "is-on" : ""}`} style={{ width: `${bracketW}%` }}>
              <span className="sst-bracket-text">{bracketText}</span>
              <i className="sst-bracket-line" />
            </div>
          )}

          <div className={`sst-bar ${on(1) ? "is-on" : ""}`}>
            {items.map((it, i) => (
              <div
                className="sst-seg"
                key={i}
                style={{
                  width: `${widths[i]}%`,
                  background: segColor(i),
                  transitionDelay: `${i * 150}ms`,
                }}
              >
                {widths[i] >= 5 && (
                  <b
                    style={{
                      color: segAlpha(i) >= 60 ? "#fff" : "var(--hud-ink)",
                      transitionDelay: `${i * 150 + 340}ms`,
                    }}
                  >
                    {it.pct}%
                  </b>
                )}
              </div>
            ))}
          </div>

          <div className={`sst-legend ${on(3) ? "is-on" : ""}`}>
            {items.map((it, i) => (
              <span className="sst-key" key={i} style={{ transitionDelay: `${i * 110}ms` }}>
                <i style={{ background: segColor(i) }} />
                {it.label} {it.pct}%
              </span>
            ))}
          </div>
        </div>

        <div className={`sst-caption ${on(3) ? "is-on" : ""}`}>{caption}</div>

        <div className={`sst-note ${on(4) ? "is-on" : ""}`}>
          {noteSegs.map((s, si) =>
            s.acc ? <em key={si}>{s.seg}</em> : <span key={si}>{s.seg}</span>,
          )}
        </div>
      </div>
    </div>
  );
}

export const stackShareDef: EffectDef<StackShareParams> = {
  id: "stack-share",
  vTier: "half",
  name: "StackShare",
  description: "占比拆解 · 一根堆叠条看清钱花哪了",
  tags: ["堆叠累积"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    kicker: "SHARE · 眉题写英文",
    title: "最大的一块\n占了 *58.8%*",
    segs: "58.8 占比最大的一项|24.2 第二项|16.2 第三项|0.8 剩下的",
    bracketN: 2,
    bracketText: "前两项合计 83%",
    caption: "小注写口径:这组数字是怎么算出来的",
    note: "*还能再补一段:*这一行放更长的说明,星号包住的词会变成强调色。",
    times: "0.3|1.4|3.2|4.6|6.2",
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
    { key: "segs", label: "分段(占比 名称,| 分隔)", type: "textarea", rows: 2 },
    { key: "bracketN", label: "括号圈前几段", type: "range", min: 0, max: 6, step: 1 },
    { key: "bracketText", label: "括号文字", type: "text" },
    { key: "caption", label: "条下说明", type: "text" },
    { key: "note", label: "绿框批注(*星号*=绿色加粗)", type: "textarea", rows: 3 },
    { key: "times", label: "5 拍秒数(标题|条|括号|图例|批注)", type: "text" },
    { key: "accent", label: "强调色(标题/分段条)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: StackShare,
};
