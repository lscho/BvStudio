import type { EffectDef, EffectProps } from "../types";
import { useCardElapsed } from "./useTimelineTime";
import { hasVecIcon, VecIcon } from "./vecIcons";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  GLASS_CONTROLS,
  GLASS_DEFAULTS,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface CostCutParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  /** 眉题:mono EN + 中文小字(比什么的成本) */
  kicker: string;
  kickerZh: string;

  /** 旧做法:中文名 / EN 小标 / 条长(0-100) / 条尾小注 */
  oldZh: string;
  oldEn: string;
  oldPct: number;
  oldNote: string;
  /** 新做法:同上,条要明显短 */
  newZh: string;
  newEn: string;
  newPct: number;
  newNote: string;
  /** 新做法那行的图标(矢量名,可空) */
  newIcon: string;

  /** 压下来之后砸的结论巨字 + EN 小字(可空) */
  punch: string;
  punchEn: string;

  /** 三个节拍:旧条画出 / 新条画出 / 巨字砸下(秒,距卡片 start) */
  oldAt: number;
  newAt: number;
  punchAt: number;
  /** 两条之间的压缩箭头 */
  arrow: boolean;

  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * 成本压缩条:
 * 两条同起点的横条 —— 旧做法拉满、新做法只剩一小截,条画完后
 * 一个箭头把差距往下一压,最后砸出结论巨字。
 * 用途:"以前要 X,现在只要 Y"的成本/耗时/步骤对比 ——
 * 比两个方框对撞干净,而且长短差一眼就懂,不用读完两段字。
 */
function CostCut({ params, playToken }: EffectProps<CostCutParams>) {
  const elapsed = useCardElapsed(params, playToken);
  const {
    position,
    kicker,
    kickerZh,
    oldZh,
    oldEn,
    oldPct,
    oldNote,
    newZh,
    newEn,
    newPct,
    newNote,
    newIcon,
    punch,
    punchEn,
    oldAt,
    newAt,
    punchAt,
    arrow,
    glass,
    glassAlpha,
    accent,
  } = params;

  const pOld = easeOut(clamp01((elapsed - oldAt) / 0.7));
  const pNew = easeOut(clamp01((elapsed - newAt) / 0.7));
  const pArrow = clamp01((elapsed - newAt - 0.5) / 0.5);
  const pPunch = clamp01((elapsed - punchAt) / 0.5);
  const headP = clamp01((elapsed - oldAt + 0.4) / 0.5);

  return (
    <div
      className={`hud cct hud-anchor hud-anchor--${position}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...(glass && glass !== "none"
          ? { ["--cct-glass-a" as string]: glassAlpha ?? 0.6 }
          : {}),
        ...offsetVars(params),
      }}
      data-glass={glass ?? "none"}
    >
      <div className="cct-box">
        {(kicker || kickerZh) && (
          <div className="cct-kicker" style={{ opacity: headP }}>
            {kicker && <b>{kicker}</b>}
            {kickerZh && <i>{kickerZh}</i>}
          </div>
        )}

        <div className="cct-row is-old" style={{ opacity: clamp01(pOld * 2) }}>
          <div className="cct-lb">
            <b>{oldZh}</b>
            {oldEn && <i>{oldEn}</i>}
          </div>
          <div className="cct-track">
            <span className="cct-fill" style={{ width: `${pOld * Math.max(0, Math.min(100, oldPct))}%` }} />
          </div>
          {oldNote && <div className="cct-note">{oldNote}</div>}
        </div>

        {arrow && (
          <div className="cct-arrow" style={{ opacity: pArrow, transform: `translateY(${(1 - pArrow) * -10}px)` }}>
            <VecIcon name="arrow-down" size={26} />
          </div>
        )}

        <div className="cct-row is-new" style={{ opacity: clamp01(pNew * 2) }}>
          <div className="cct-lb">
            {newIcon && hasVecIcon(newIcon) && (
              <span className="cct-ico">
                <VecIcon name={newIcon} size={22} />
              </span>
            )}
            <b>{newZh}</b>
            {newEn && <i>{newEn}</i>}
          </div>
          <div className="cct-track">
            <span className="cct-fill" style={{ width: `${pNew * Math.max(0, Math.min(100, newPct))}%` }} />
          </div>
          {newNote && <div className="cct-note">{newNote}</div>}
        </div>

        {(punch || punchEn) && (
          <div
            className="cct-punch"
            style={{ opacity: pPunch, transform: `scale(${0.86 + pPunch * 0.14})` }}
          >
            {punch && <strong>{punch}</strong>}
            {punchEn && <i>{punchEn}</i>}
          </div>
        )}
      </div>
    </div>
  );
}

export const costCutDef: EffectDef<CostCutParams> = {
  id: "cost-cut",
  vTier: "half",
  name: "CostCut",
  description: "成本压缩条 · 两条对比压到最短 + 结论巨字",
  tags: ["对撞并置"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    kicker: "OLD VS NEW",
    kickerZh: "比什么的成本 · 写这",
    oldZh: "旧做法",
    oldEn: "OLD WAY",
    oldPct: 100,
    oldNote: "很贵",
    newZh: "新做法",
    newEn: "NEW WAY",
    newPct: 12,
    newNote: "很便宜",
    newIcon: "bolt",
    punch: "压到最低",
    punchEn: "MIN",
    oldAt: 0.3,
    newAt: 2.2,
    punchAt: 4.2,
    arrow: true,
    ...GLASS_DEFAULTS,
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "kicker", label: "眉题(EN)", type: "text" },
    { key: "kickerZh", label: "眉题中文", type: "text" },
    { key: "oldZh", label: "旧做法·中文", type: "text" },
    { key: "oldEn", label: "旧做法·EN", type: "text" },
    { key: "oldPct", label: "旧做法·条长", type: "range", min: 10, max: 100, step: 1, unit: "%" },
    { key: "oldNote", label: "旧做法·条尾小注", type: "text" },
    { key: "newZh", label: "新做法·中文", type: "text" },
    { key: "newEn", label: "新做法·EN", type: "text" },
    { key: "newPct", label: "新做法·条长", type: "range", min: 2, max: 100, step: 1, unit: "%" },
    { key: "newNote", label: "新做法·条尾小注", type: "text" },
    { key: "newIcon", label: "新做法·图标(矢量名)", type: "text" },
    { key: "punch", label: "结论巨字", type: "text" },
    { key: "punchEn", label: "结论 EN 小字", type: "text" },
    { key: "oldAt", label: "旧条画出(s)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "newAt", label: "新条画出(s)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "punchAt", label: "巨字砸下(s)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "arrow", label: "两条之间的压缩箭头", type: "toggle" },
    ...GLASS_CONTROLS,
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: CostCut,
};
