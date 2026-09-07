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

export interface CompareBarsParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 顶部 EN 等宽 kicker */
  kicker: string;
  /** 标题,\n 分行,*星号包住*的段变强调色 */
  title: string;
  /** 反例卡(粉徽标):"徽标~标题~正文",正文 *星号*=加粗 */
  cardBad: string;
  /** 正例卡(绿徽标):"徽标~标题~正文" */
  cardGood: string;
  /** 上条(红):名目 */
  barALabel: string;
  barAVal: string;
  /** 上条长度(%) */
  barAPct: number;
  /** 下条(绿):名目 */
  barBLabel: string;
  barBVal: string;
  barBPct: number;
  /** 下条旁的绿色结论,如 "轻约 5 倍" */
  barNote: string;
  /** 5 拍点亮秒数(距卡片开始,| 分隔):标题|反例卡|正例卡|条A|条B */
  times: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const BEAT_FALLBACK = [0.3, 1.2, 2.4, 4.0, 5.2];

function boldSegs(s: string) {
  return s.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 }));
}

function parseCard(s: string) {
  const [badge, head, ...rest] = s.split("~");
  return {
    badge: (badge ?? "").trim(),
    head: (head ?? "").trim(),
    body: boldSegs(rest.join("~").trim()),
  };
}

/**
 * 派与不派(量级对比):反例/正例两张徽标卡先后进场,
 * 下方两根横条一长一短,短条旁点出"轻约 N 倍"的结论。
 */
function CompareBars({ params, playToken }: EffectProps<CompareBarsParams>) {
  const {
    position, kicker, title, cardBad, cardGood,
    barALabel, barAVal, barAPct, barBLabel, barBVal, barBPct, barNote,
    times, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const on = (i: number) => elapsed >= (Number.isFinite(ts[i]) ? ts[i] : BEAT_FALLBACK[i]);

  const lines = title.split("\n").map((ln) =>
    ln.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 })),
  );

  const bad = parseCard(cardBad);
  const good = parseCard(cardGood);
  const pa = Math.max(4, Math.min(100, barAPct));
  const pb = Math.max(4, Math.min(100, barBPct));

  return (
    <div
      className={`hud cpb hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...offsetVars(params),
      }}
    >
      <div className="cpb-board">
        {kicker && (
          <div className="cpb-kicker">
            <i />
            <span>{kicker}</span>
          </div>
        )}
        <div className={`cpb-title ${on(0) ? "is-on" : ""}`}>
          {lines.map((lsegs, li) => (
            <div className="cpb-title-line" key={li} style={{ transitionDelay: `${li * 160}ms` }}>
              {lsegs.map((s, si) =>
                s.acc ? <em key={si}>{s.seg}</em> : <span key={si}>{s.seg}</span>,
              )}
            </div>
          ))}
        </div>

        <div className="cpb-cards">
          {[
            { c: bad, cls: "cpb-bad", beat: 1 },
            { c: good, cls: "cpb-good", beat: 2 },
          ].map(({ c, cls, beat }, i) => (
            <div className={`cpb-card ${cls} ${on(beat) ? "is-on" : ""}`} key={i}>
              <span className="cpb-badge">{c.badge}</span>
              <div className="cpb-head">{c.head}</div>
              <div className="cpb-body">
                {c.body.map((s, si) =>
                  s.acc ? <strong key={si}>{s.seg}</strong> : <span key={si}>{s.seg}</span>,
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="cpb-barcard">
          <div className={`cpb-row ${on(3) ? "is-on" : ""}`}>
            <div className="cpb-label">{barALabel}</div>
            <div className="cpb-track">
              <i className="cpb-fill cpb-fillA" style={{ width: `${pa}%` }}>
                <b>{barAVal}</b>
              </i>
            </div>
          </div>
          <div className={`cpb-row ${on(4) ? "is-on" : ""}`}>
            <div className="cpb-label">{barBLabel}</div>
            <div className="cpb-track">
              <i className="cpb-fill cpb-fillB" style={{ width: `${pb}%` }} />
              <span className="cpb-note" style={{ left: `calc(${pb}% + 24px)` }}>
                <b>{barBVal}</b>
                {barNote}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const compareBarsDef: EffectDef<CompareBarsParams> = {
  id: "compare-bars",
  vTier: "half",
  name: "CompareBars",
  description: "派与不派 · 反例/正例徽标卡 + 一长一短量级条",
  tags: ["对撞并置"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    kicker: "COMPARE · 眉题写英文",
    title: "两种做法,*差一个量级*",
    cardBad: "不这么做~问题写在这里~*后果*写在这里,星号会变色",
    cardGood: "这么做~做法写在这里~*好处*写在这里,星号会变色",
    barALabel: "做法 A · 每次平均",
    barAVal: "243K",
    barAPct: 100,
    barBLabel: "做法 B · 每次平均",
    barBVal: "52K",
    barBPct: 21,
    barNote: "轻约 5 倍",
    times: "0.3|1.2|2.4|4.0|5.2",
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
    { key: "cardBad", label: "反例卡(徽标~标题~正文)", type: "textarea", rows: 2 },
    { key: "cardGood", label: "正例卡(徽标~标题~正文)", type: "textarea", rows: 2 },
    { key: "barALabel", label: "条A名目(红长条)", type: "text" },
    { key: "barAVal", label: "条A数值", type: "text" },
    { key: "barAPct", label: "条A长度(%)", type: "range", min: 10, max: 100, step: 1, unit: "%" },
    { key: "barBLabel", label: "条B名目(绿短条)", type: "text" },
    { key: "barBVal", label: "条B数值", type: "text" },
    { key: "barBPct", label: "条B长度(%)", type: "range", min: 4, max: 100, step: 1, unit: "%" },
    { key: "barNote", label: "条B结论(绿)", type: "text" },
    { key: "times", label: "5 拍秒数(标题|反例|正例|条A|条B)", type: "text" },
    { key: "accent", label: "强调色(眉题/标题)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: CompareBars,
};
