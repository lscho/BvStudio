import { useId } from "react";
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

export interface DuoTitleParams {
  theme: "dark" | "light";
  position: "top-left" | "top-right" | "left" | "right";
  /** mono 英文小标(全大写,前面带一截 accentA 短横),如 COST VS STABILITY */
  en: string;
  /** 第一行标题:chip 模式=黑底彩字;ink 模式默认墨色,*词* 上 accentA 色 */
  line1: string;
  /** 第二行标题:chip 模式=彩底黑字;ink 模式默认墨色,*词* 上 accentB 色 */
  line2: string;
  /** 版式:chip=双色块(黑底彩字/彩底黑字) · ink=彩字(无色块,靠字色区分) */
  mode: "chip" | "ink";
  /** 主强调色(第一行/kicker 短横) */
  accentA: string;
  /** 副强调色(第二行/下划线) */
  accentB: string;
  /** 渐变:第二行色块用 A→B 双色渐变(参考片的渐变色块) */
  grad?: boolean;
  /** 色块形状:sharp 方角 · soft 圆角 · pill 药丸 · slant 斜切 */
  chipShape?: "sharp" | "soft" | "pill" | "slant";
  /** 色块外围的装饰虚线框:none 不要 · dash 横杠虚线 · dot 点点虚线 */
  chipDeco?: "none" | "dash" | "dot";
  /** 第一块的底色:ink 黑底 · paper 白底 · accent A色底 · none 无底(只有字) */
  chip1Bg?: "ink" | "paper" | "accent" | "none";
  /** 投影:none 无 · soft 柔和 · hard 硬投影 · outline 深色描边 */
  shadow?: "none" | "soft" | "hard" | "outline";
  /** 标题下的灰色小注(可空,*词* 上 accentA 色) */
  note?: string;
  /** 小注出现秒数(距卡片 start,0=跟标题一起) */
  noteAt?: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  __t?: number;
  __start?: number;
}

/** 行内 *重点词* 换成强调色 */
function mark(text: string) {
  return (text ?? "")
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((seg, i) =>
      seg.startsWith("*") && seg.endsWith("*") ? (
        <i className="dtt-kw" key={i}>
          {seg.slice(1, -1)}
        </i>
      ) : (
        <span key={i}>{seg}</span>
      ),
    );
}

/**
 * 双色块标题(Levi 式开章标题):mono 英文小标 + 两行大标题 + 短线句点收尾。
 * chip 模式两行各占一个色块(第一行黑底彩字/第二行彩底黑字),一卡一对强调色,
 * 逐卡换色对让整片自动变色;ink 模式无色块,彩字更轻。
 */
function DuoTitle({ params, playToken }: EffectProps<DuoTitleParams>) {
  const { position, en, line1, line2, mode, accentA, accentB, grad, note, noteAt } = params;
  const { chipShape, chipDeco, chip1Bg } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const noteOn = elapsed >= (noteAt ?? 0);
  // 渐变描边要唯一 id,同屏多张卡才不会互相串色
  const gid = `dtt-g-${useId().replace(/[:]/g, "")}`;

  return (
    <div
      className={`hud dtt dtt--${mode}${grad ? " dtt--grad" : ""} hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      data-shape={chipShape ?? "sharp"}
      data-deco={chipDeco ?? "none"}
      data-chip1={chip1Bg ?? "ink"}
      style={{
        ["--dtt-a" as string]: ACCENT_VAR[accentA] ?? "var(--hud-orange)",
        ["--dtt-b" as string]: ACCENT_VAR[accentB] ?? "var(--hud-teal)",
        ...offsetVars(params),
      }}
    >
      <div className="dtt-kick">
        <span className="dtt-dash" />
        <span className="dtt-en">{en}</span>
      </div>
      <div className="dtt-l dtt-l1">
        <span className="dtt-chip">{mark(line1)}</span>
      </div>
      <div className="dtt-l dtt-l2">
        <span className="dtt-chip">{mark(line2)}</span>
      </div>
      {/* 收尾横线:一根横平的渐变直线,末端一枚空心圆环
          (刻意做成横平竖直,不用斜的装饰) */}
      <svg className="dtt-arc" viewBox="0 0 248 26" fill="none" aria-hidden>
        <defs>
          {/* 必须用 userSpaceOnUse:直线的包围盒高度为 0,默认的 objectBoundingBox
              会退化成一个空盒子,渐变直接画不出来(线会整根消失) */}
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="3" y1="13" x2="212" y2="13">
            <stop offset="0" stopColor="var(--dtt-a)" stopOpacity="0.12" />
            <stop offset="0.55" stopColor="var(--dtt-a)" stopOpacity="0.85" />
            <stop offset="1" stopColor="var(--dtt-b)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path
          className="dtt-arc-p"
          d="M3 13 L 212 13"
          stroke={`url(#${gid})`}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle className="dtt-arc-r" cx="222" cy="13" r="5.2" stroke="var(--dtt-b)" strokeWidth="2" opacity="0.55" />
        <circle className="dtt-arc-d" cx="222" cy="13" r="2.1" fill="var(--dtt-b)" />
      </svg>
      {note && <div className={`dtt-note ${noteOn ? "is-on" : ""}`}>{mark(note)}</div>}
    </div>
  );
}

export const duoTitleDef: EffectDef<DuoTitleParams> = {
  id: "duo-title",
  vTier: "half",
  name: "DuoTitle",
  description: "双色块标题 · EN小标+两行色块大标题(黑底彩字/彩底黑字),一卡一对色",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "top-left",
    en: "EN SUBTITLE",
    line1: "第一行",
    line2: "第二行*变色*",
    mode: "chip",
    accentA: "orange",
    accentB: "green",
    grad: true,
    chipShape: "slant",
    chipDeco: "none",
    chip1Bg: "none",
    shadow: "none",
    note: "补充说明写这里,不填就不显示。",
    noteAt: 0.6,
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
        { label: "左上", value: "top-left" },
        { label: "右上", value: "top-right" },
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    {
      key: "mode",
      label: "版式",
      type: "select",
      options: [
        { label: "双色块(黑底彩字/彩底黑字)", value: "chip" },
        { label: "彩字(无色块)", value: "ink" },
      ],
    },
    { key: "en", label: "EN 小标(全大写)", type: "text" },
    { key: "line1", label: "第一行(*词* 上 A 色)", type: "text" },
    { key: "line2", label: "第二行(*词* 上 B 色)", type: "text" },
    { key: "accentA", label: "A 色(第一行/短横)", type: "select", options: ACCENT_OPTIONS },
    { key: "accentB", label: "B 色(第二行/下划线)", type: "select", options: ACCENT_OPTIONS },
    { key: "grad", label: "第二行渐变色(A→B)", type: "toggle" },
    {
      key: "chip1Bg",
      label: "第一块底色",
      type: "select",
      options: [
        { label: "黑底 · A 色字", value: "ink" },
        { label: "白底 · 深色字", value: "paper" },
        { label: "A 色底 · 黑字", value: "accent" },
        { label: "无底 · 只有 A 色字", value: "none" },
      ],
    },
    {
      key: "chipShape",
      label: "色块形状",
      type: "select",
      options: [
        { label: "方角", value: "sharp" },
        { label: "圆角", value: "soft" },
        { label: "药丸", value: "pill" },
        { label: "斜切", value: "slant" },
      ],
    },
    {
      key: "chipDeco",
      label: "色块外围虚线框",
      type: "select",
      options: [
        { label: "不要", value: "none" },
        { label: "横杠虚线", value: "dash" },
        { label: "点点虚线", value: "dot" },
      ],
    },
    { key: "note", label: "小注(可空)", type: "textarea", rows: 2 },
    { key: "noteAt", label: "小注出现秒", type: "range", min: 0, max: 10, step: 0.1, unit: "s" },
    ...OFFSET_CONTROLS,
  ],
  Component: DuoTitle,
};
