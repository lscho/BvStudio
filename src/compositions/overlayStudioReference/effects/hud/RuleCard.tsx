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

export interface RuleCardParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center" | "top-left";
  /** 大绿勾后面的主张(2-6 字的立场词) */
  text: string;
  /** EN 等宽小注 */
  subEn: string;
  /** 被划掉的禁区,| 分隔 */
  bans: string;
  /** 每个禁区标签弹入间隔(卡点用) */
  stepMs: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

/**
 * 规则卡:大绿勾主张 + 一排划掉的红色禁区标签。
 * "我坚持 X,绝不 A/B/C" 的立场时刻——允许与禁止同屏对照。
 */
function RuleCard({ params, playToken }: EffectProps<RuleCardParams>) {
  const { position, text, subEn, bans, stepMs, accent } = params;
  const entered = useEnter(playToken);
  const banList = bans.split("|").map((s) => s.trim()).filter(Boolean);

  return (
    <div
      className={`hud rlc hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="rlc-box">
        <div className="rlc-main">
          <span className="rlc-check">✓</span>
          <span className="rlc-text">{text}</span>
        </div>
        {subEn && <div className="rlc-sub">{subEn}</div>}
        {banList.length > 0 && (
          <div className="rlc-bans">
            {banList.map((b, i) => (
              <span
                className="rlc-ban"
                key={i}
                style={{ transitionDelay: `${600 + i * stepMs}ms` }}
              >
                <i>✗</i>
                <s>{b}</s>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const ruleCardDef: EffectDef<RuleCardParams> = {
  id: "rule-card",
  name: "RuleCard",
  description: "规则卡 · 大绿勾主张 + 划掉的红色禁区",
  tags: ["对撞并置"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    text: "绿勾写主张",
    subEn: "EN NOTE HERE",
    bans: "划掉项一|划掉项二|划掉项三",
    stepMs: 500,
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
        { label: "左上", value: "top-left" },
      ],
    },
    { key: "text", label: "主张(2-6 字)", type: "text" },
    { key: "subEn", label: "英文小注", type: "text" },
    { key: "bans", label: "禁区(| 分隔)", type: "text" },
    { key: "stepMs", label: "禁区弹入间隔(卡点用)", type: "range", min: 200, max: 3000, step: 100, unit: "ms" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: RuleCard,
};
