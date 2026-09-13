import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { VecIcon } from "./vecIcons";
import { motionItemStartUs } from "@/domain/overlayStudioMotion";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface GlowBadgesParams {
  revealTimesUs?: string;
  theme: "dark" | "light";
  position: "center" | "left" | "right" | "top";
  /** 玻璃底板:黑玻璃 / 白玻璃 */
  bg?: "dark" | "light" | "none";
  /** EN 眉题(带竖杠),如 "THE MAP · 地图篇" */
  kicker: string;
  /** 大标行:小 EN 前缀 / 大中文 / 淡 EN 后缀 */
  tPre: string;
  tZh: string;
  tEn: string;
  /** 圆徽:「标签,图标,名字,小注」用 | 分隔,2-4 个 */
  badges: string;
  /** 第一个圆徽出现秒数(距卡片 start,卡点用) */
  badgesAt: number;
  /** 圆徽逐个间隔 */
  stepMs: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

interface Badge {
  label: string;
  icon: string;
  name: string;
  sub: string;
}

function parseBadges(raw: string): Badge[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((seg) => {
      const [label = "", icon = "", name = "", sub = ""] = seg.split(",").map((x) => x.trim());
      return { label, icon, name, sub };
    });
}

/**
 * 发光圆徽:EN 眉题(竖杠)+ 大标行 + 2-4 个发光圆图标徽章逐个点亮。
 * "WIDE / TELE"式的概念并列版式——标签在圆上方,名字和小注在下方。
 */
function GlowBadges({ params, playToken }: EffectProps<GlowBadgesParams>) {
  const { position, bg, kicker, tPre, tZh, tEn, badges, badgesAt, stepMs, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const list = parseBadges(badges);
  const step = (stepMs ?? 900) / 1000;

  return (
    <div
      className={`hud gbd hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      data-bg={bg ?? "dark"}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      {kicker && (
        <div className="gbd-kicker">
          <i />
          <span>{kicker}</span>
        </div>
      )}
      {(tPre || tZh || tEn) && (
        <div className="gbd-title">
          {tPre && <span className="gbd-pre">{tPre}</span>}
          {tZh && <span className="gbd-zh">{tZh}</span>}
          {tEn && <span className="gbd-en">{tEn}</span>}
        </div>
      )}
      <div className="gbd-row">
        {list.map((b, i) => (
          <div
            className={`gbd-badge ${elapsed * 1_000_000 >= motionItemStartUs({ revealTimesUs: params.revealTimesUs ?? "" }, i, ((badgesAt ?? 0.8) + i * step) * 1_000_000) ? "is-on" : ""}`}
            key={i}
          >
            {b.label && <div className="gbd-lb">{b.label}</div>}
            <div className="gbd-orb">
              <VecIcon name={b.icon} size={62} />
            </div>
            {b.name && <div className="gbd-name">{b.name}</div>}
            {b.sub && <div className="gbd-sub">{b.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export const glowBadgesDef: EffectDef<GlowBadgesParams> = {
  id: "glow-badges",
  vTier: "half",
  name: "GlowBadges",
  description: "发光圆徽 · 眉题+大标+发光圆图标逐个点亮",
  tags: ["光效发光", "逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    bg: "dark",
    kicker: "KICKER · 眉题写这",
    tPre: "PRE",
    tZh: "大标题写这里",
    tEn: "FAINT EN SUBTITLE",
    badges: "标签一,chat,圆徽的名字,小注写在下面|标签二,bolt,图标填矢量名,如 bolt 与 books|标签三,books,最多放四枚,按间隔逐个亮",
    badgesAt: 0.8,
    stepMs: 900,
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
        { label: "顶部", value: "top" },
      ],
    },
    {
      key: "bg",
      label: "玻璃底板",
      type: "select",
      options: [
        { label: "黑玻璃", value: "dark" },
        { label: "白玻璃", value: "light" },
        { label: "无底板(字浮在画面上)", value: "none" },
      ],
    },
    { key: "kicker", label: "眉题(EN · 中文)", type: "text" },
    { key: "tPre", label: "大标 · EN 前缀", type: "text" },
    { key: "tZh", label: "大标 · 中文", type: "text" },
    { key: "tEn", label: "大标 · EN 后缀(淡)", type: "text" },
    { key: "badges", label: "圆徽(标签,图标,名字,小注 | 分隔)", type: "textarea", rows: 3 },
    { key: "badgesAt", label: "第一个圆徽出现秒数(卡点用)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "stepMs", label: "圆徽逐个间隔(卡点用)", type: "range", min: 300, max: 4000, step: 100, unit: "ms" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: GlowBadges,
};
