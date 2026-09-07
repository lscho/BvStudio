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

export interface StudioBuildParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  /** 眉题(EN · 中文) */
  kicker: string;
  /** ① 动效库这一拍 */
  libZh: string;
  libEn: string;
  /** ② 编辑台这一拍 */
  deckZh: string;
  deckEn: string;
  /** ③ 收益那一句(药丸) */
  payZh: string;
  payEn: string;
  /** 库里铺几张小卡 */
  chips: number;
  /** 小卡逐张飞入的间隔(ms) */
  chipStepMs: number;
  /** ① 第一张小卡飞进来的秒数(距卡片 start,卡点用) */
  libAt: number;
  /** ② 编辑台这一拍开始的秒数(距卡片 start,卡点用) */
  deckAt: number;
  /** ③ 收益那一拍开始的秒数 */
  payAt: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  __t?: number;
  __start?: number;
}

/** 小卡里的图形:轮着来五种,一眼看出"库里躺的是各式各样的动效" */
function ChipGlyph({ i }: { i: number }) {
  switch (i % 5) {
    case 0:
      return (
        <span className="sbd-g sbd-g-bars">
          <i style={{ width: "72%" }} />
          <i style={{ width: "46%" }} />
          <i style={{ width: "88%" }} />
        </span>
      );
    case 1:
      return (
        <span className="sbd-g sbd-g-ring">
          <svg viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="14" className="sbd-ring-bg" />
            <circle cx="20" cy="20" r="14" className="sbd-ring-fg" />
          </svg>
        </span>
      );
    case 2:
      return (
        <span className="sbd-g sbd-g-dots">
          {Array.from({ length: 9 }, (_, k) => (
            <i key={k} className={k < 6 ? "is-on" : ""} />
          ))}
        </span>
      );
    case 3:
      return (
        <span className="sbd-g sbd-g-spark">
          <svg viewBox="0 0 56 28" aria-hidden>
            <path d="M2 22 L14 14 L24 18 L36 6 L54 3" />
          </svg>
        </span>
      );
    default:
      return (
        <span className="sbd-g sbd-g-type">
          <b />
          <i />
        </span>
      );
  }
}

/**
 * 基建三拍:① 动效库铺开 → ② 收进编辑台 → ③ 以后每条几分钟。
 * 讲"先建库、再搭台、之后复利"这套逻辑时用一张卡演完,不用叠三张。
 * 三拍按秒数卡点(deckAt / payAt),对着台词填。
 */
function StudioBuild({ params, playToken }: EffectProps<StudioBuildParams>) {
  const {
    position, kicker, libZh, libEn, deckZh, deckEn, payZh, payEn,
    chips, chipStepMs, libAt, deckAt, payAt, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const n = Math.max(3, Math.min(16, Math.round(chips ?? 12)));
  const step = (chipStepMs ?? 130) / 1000;
  const onDeck = elapsed >= (deckAt ?? 4);
  const onPay = elapsed >= (payAt ?? 7.7);

  return (
    <div
      className={`hud sbd hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""} ${
        onDeck ? "is-deck" : ""
      } ${onPay ? "is-pay" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      {kicker && (
        <div className="sbd-kick">
          <i />
          <span>{kicker}</span>
        </div>
      )}

      {/* ① 动效库:小卡逐张飞进来铺成一面墙 */}
      <div className="sbd-step">
        <span className="sbd-no">01</span>
        <span className="sbd-en">{libEn}</span>
        <span className="sbd-zh">{libZh}</span>
      </div>
      <div className="sbd-lib">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={`sbd-chip ${elapsed >= (libAt ?? 0.25) + i * step ? "is-on" : ""}`}>
            <ChipGlyph i={i} />
          </span>
        ))}
      </div>

      {/* ② 编辑台:库收小让位,台子画出来,三张卡落到轨道上 */}
      <div className="sbd-step sbd-step2">
        <span className="sbd-no">02</span>
        <span className="sbd-en">{deckEn}</span>
        <span className="sbd-zh">{deckZh}</span>
      </div>
      <div className="sbd-deck">
        <span className="sbd-bar">
          <i /><i /><i />
        </span>
        <span className="sbd-track">
          <b className="sbd-fill" />
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="sbd-slot" style={{ transitionDelay: `${0.18 + i * 0.14}s` }} />
          ))}
        </span>
      </div>

      {/* ③ 收益 */}
      <div className="sbd-pay">
        <span className="sbd-pay-zh">{payZh}</span>
        {payEn && <span className="sbd-pay-en">{payEn}</span>}
      </div>
    </div>
  );
}

export const studioBuildDef: EffectDef<StudioBuildParams> = {
  id: "studio-build",
  vTier: "half",
  name: "StudioBuild",
  description: "基建三拍 · 动效库铺开→收进编辑台→以后每条几分钟",
  tags: ["聚散飞行"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    kicker: "THE LOGIC · 这套逻辑",
    libEn: "STEP ONE",
    libZh: "第一步做什么(换成你的话)",
    deckEn: "STEP TWO",
    deckZh: "第二步做什么(换成你的话)",
    payEn: "THE PAYOFF",
    payZh: "之后能省下什么",
    chips: 12,
    chipStepMs: 130,
    libAt: 0.3,
    deckAt: 4,
    payAt: 7.7,
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
      ],
    },
    { key: "kicker", label: "眉题(EN · 中文)", type: "text" },
    { key: "libEn", label: "① EN 标签", type: "text" },
    { key: "libZh", label: "① 中文说明", type: "text" },
    { key: "deckEn", label: "② EN 标签", type: "text" },
    { key: "deckZh", label: "② 中文说明", type: "text" },
    { key: "payEn", label: "③ EN 标签", type: "text" },
    { key: "payZh", label: "③ 中文(药丸)", type: "text" },
    { key: "chips", label: "库里铺几张小卡", type: "range", min: 3, max: 16, step: 1, unit: "张" },
    { key: "chipStepMs", label: "小卡逐张间隔", type: "range", min: 40, max: 400, step: 10, unit: "ms" },
    { key: "libAt", label: "① 第一张小卡出现秒(卡点)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "deckAt", label: "② 编辑台出现秒(卡点)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "payAt", label: "③ 收益出现秒(卡点)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: StudioBuild,
};
