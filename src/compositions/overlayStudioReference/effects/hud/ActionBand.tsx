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

export interface ActionBandParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 顶部 EN 等宽 kicker */
  kicker: string;
  /** 标题,\n 分行,*星号包住*的段变强调色 */
  title: string;
  /** 徽标前缀,自动编号成 "动作 1 / 动作 2 ..." */
  badge: string;
  /** 动作卡:"标题~正文" 用 | 分隔,正文里 *星号*=加粗 */
  cards: string;
  /** 分级色带:"文字 宽度 颜色" 用 | 分隔,宽度按总和归一化,颜色可用 var(--hud-*) 令牌 */
  band: string;
  bandCaption: string;
  /** 底注,*星号*=加粗 */
  foot: string;
  /** 5 拍点亮秒数(距卡片开始,| 分隔):标题|卡组|色带|色带说明|底注 */
  times: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const BEAT_FALLBACK = [0.3, 1.2, 3.6, 5.0, 6.2];

function boldSegs(s: string) {
  return s.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 }));
}

/**
 * 动作卡组(校准动作):编号白卡横排逐张进场,
 * 下方红绿灯分级色带逐段铺开,底注收"看到颜色就动手"。
 */
function ActionBand({ params, playToken }: EffectProps<ActionBandParams>) {
  const {
    position, kicker, title, badge, cards, band, bandCaption, foot,
    times, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const on = (i: number) => elapsed >= (Number.isFinite(ts[i]) ? ts[i] : BEAT_FALLBACK[i]);

  const lines = title.split("\n").map((ln) =>
    ln.split("*").map((seg, i) => ({ seg, acc: i % 2 === 1 })),
  );

  const cardList = cards
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [head, ...rest] = s.split("~");
      return { head: head.trim(), body: boldSegs(rest.join("~").trim()) };
    });

  const bandSegs = band
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const tokens = s.split(/\s+/);
      let color = "#888";
      let w = 1;
      const last = tokens[tokens.length - 1];
      if (tokens.length >= 2 && (last.startsWith("#") || last.startsWith("var("))) {
        color = tokens.pop() as string;
      }
      if (tokens.length >= 2 && Number.isFinite(parseFloat(tokens[tokens.length - 1]))) {
        w = parseFloat(tokens.pop() as string);
      }
      return { label: tokens.join(" "), w, color };
    });
  const totalW = bandSegs.reduce((a, b) => a + b.w, 0) || 1;

  const footSegs = boldSegs(foot);

  return (
    <div
      className={`hud acb hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...offsetVars(params),
      }}
    >
      <div className="acb-board">
        {kicker && (
          <div className="acb-kicker">
            <i />
            <span>{kicker}</span>
          </div>
        )}
        <div className={`acb-title ${on(0) ? "is-on" : ""}`}>
          {lines.map((lsegs, li) => (
            <div className="acb-title-line" key={li} style={{ transitionDelay: `${li * 160}ms` }}>
              {lsegs.map((s, si) =>
                s.acc ? <em key={si}>{s.seg}</em> : <span key={si}>{s.seg}</span>,
              )}
            </div>
          ))}
        </div>

        <div className={`acb-cards ${on(1) ? "is-on" : ""}`}>
          {cardList.map((c, i) => (
            <div className="acb-card" key={i} style={{ transitionDelay: `${i * 180}ms` }}>
              <span className="acb-badge">
                {badge} <b>{i + 1}</b>
              </span>
              <div className="acb-head">{c.head}</div>
              <div className="acb-body">
                {c.body.map((s, si) =>
                  s.acc ? <strong key={si}>{s.seg}</strong> : <span key={si}>{s.seg}</span>,
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="acb-bandcard">
          <div className={`acb-band ${on(2) ? "is-on" : ""}`}>
            {bandSegs.map((seg, i) => (
              <div
                className="acb-seg"
                key={i}
                style={{
                  width: `${(seg.w / totalW) * 100}%`,
                  background: seg.color,
                  transitionDelay: `${i * 200}ms`,
                }}
              >
                <span style={{ transitionDelay: `${i * 200 + 280}ms` }}>{seg.label}</span>
              </div>
            ))}
          </div>
          <div className={`acb-bandcaption ${on(3) ? "is-on" : ""}`}>{bandCaption}</div>
        </div>

        <div className={`acb-foot ${on(4) ? "is-on" : ""}`}>
          {footSegs.map((s, si) =>
            s.acc ? <strong key={si}>{s.seg}</strong> : <span key={si}>{s.seg}</span>,
          )}
        </div>
      </div>
    </div>
  );
}

export const actionBandDef: EffectDef<ActionBandParams> = {
  id: "action-band",
  vTier: "half",
  name: "ActionBand",
  description: "动作卡组 · 编号白卡×N + 红绿灯分级色带",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    kicker: "ACTION · 眉题写英文",
    title: "该怎么做",
    badge: "动作",
    cards:
      "第一件事~用「~」隔开:前面是卡片标题,后面是说明|第二件事~一张卡一个动作,讲到哪张亮哪张|第三件事~最多放三到四张",
    band: "绿 · 安全 50 var(--hud-green)|黄 · 注意 25 var(--hud-orange)|红 · 危险 25 var(--hud-alert)",
    bandCaption:
      "色带小注:说明这三档是怎么划分的",
    foot: "脚注:一句话给出行动指令,*重点词加星号*",
    times: "0.3|1.2|3.6|5.0|6.2",
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
    { key: "badge", label: "徽标前缀(自动编号)", type: "text" },
    { key: "cards", label: "动作卡(标题~正文,| 分隔,*星号*=加粗)", type: "textarea", rows: 4 },
    { key: "band", label: "色带(文字 宽度 颜色,| 分隔,可用 var(--hud-*))", type: "textarea", rows: 2 },
    { key: "bandCaption", label: "色带说明", type: "text" },
    { key: "foot", label: "底注(*星号*=加粗)", type: "text" },
    { key: "times", label: "5 拍秒数(标题|卡组|色带|说明|底注)", type: "text" },
    { key: "accent", label: "强调色(眉题/徽标)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: ActionBand,
};
