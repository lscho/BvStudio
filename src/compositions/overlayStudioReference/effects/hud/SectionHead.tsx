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

export interface SectionHeadParams {
  theme: "dark" | "light";
  position: "top-left" | "top-right" | "left" | "right";
  /** 章编号(空=段头模式;填 01/02 变章头大编号) */
  num?: string;
  /** mono 英文小标签(全大写,段意英译,如 POWERED DOWN / TRULY SCARCE) */
  en: string;
  /** 中文标题,*重点词* 用强调色点亮 */
  zh: string;
  /** 论点行(可空):标题下的一句话论点 */
  sub?: string;
  /** 论点行出现秒数(距卡片 start,0=跟标题一起) */
  subAt?: number;
  /** 来源行(可空):mono 小字出处,如 SOURCE · OPENAI 官方 · 2026.6 */
  src?: string;
  /** 尺寸:l=段头/章头,s=块级小标题(钉在证据块上方,块讲完一起退场) */
  size?: "l" | "s";
  /** 投影:none 无 · soft 柔和 · hard 硬投影 · outline 深色描边 */
  shadow?: "none" | "soft" | "hard" | "outline";
  accent: string;
  offsetX?: number;
  offsetY?: number;
  /** 时间轴注入(编辑台/导出),subAt 卡点用 */
  __t?: number;
  __start?: number;
}

/** 行内 *重点词* 用强调色点亮 */
function renderMark(text: string) {
  return text
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((seg, i) =>
      seg.startsWith("*") && seg.endsWith("*") ? (
        <i className="shd-kw" key={i}>
          {seg.slice(1, -1)}
        </i>
      ) : (
        <span key={i}>{seg}</span>
      ),
    );
}

/**
 * 段头三件套(段落语法的地基):竖色条 + mono 英文小标签 + 中文标题,
 * 从段落第一句常驻到最后一句;可选论点行(晚点进场)和 mono 来源行。
 * 填 num 变"章头模式":大编号立在左侧(01 TOKEN COST 式)。
 * 编排规则:end = 段尾秒,讲过让位填 dimAt;段内其他卡与它同段同色。
 */
function SectionHead({ params, playToken }: EffectProps<SectionHeadParams>) {
  const { position, num, en, zh, sub, subAt, src, size, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const subOn = elapsed >= (subAt ?? 0);

  return (
    <div
      className={`hud shd ${size === "s" ? "shd--s" : ""} hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="shd-box">
        {num && <div className="shd-num">{num}</div>}
        <div className="shd-main">
          <div className="shd-row">
            <span className="shd-bar" />
            <span className="shd-en">{en}</span>
            {src && <span className="shd-src">{src}</span>}
          </div>
          <div className="shd-zh">{renderMark(zh)}</div>
          {sub && <div className={`shd-sub ${subOn ? "is-on" : ""}`}>{renderMark(sub)}</div>}
        </div>
      </div>
    </div>
  );
}

export const sectionHeadDef: EffectDef<SectionHeadParams> = {
  id: "section-head",
  name: "SectionHead",
  description: "段头三件套 · 竖色条+EN标签+中文标题,段落常驻;填编号变章头",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "top-left",
    num: "",
    en: "EN MONO LABEL",
    zh: "段落标题 · *重点词*换色",
    sub: "",
    subAt: 0,
    src: "",
    size: "l",
    accent: "blue",
    shadow: "none",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "左上", value: "top-left" },
        { label: "右上", value: "top-right" },
        { label: "左中", value: "left" },
        { label: "右中", value: "right" },
      ],
    },
    { key: "num", label: "章编号(空=段头;填 01/02 变章头大编号)", type: "text" },
    { key: "en", label: "英文小标签(全大写 mono,段意英译)", type: "text" },
    { key: "zh", label: "中文标题(*重点词*换色)", type: "text" },
    { key: "sub", label: "论点行(可空)", type: "text" },
    { key: "subAt", label: "论点行出现秒数(卡点用)", type: "range", min: 0, max: 30, step: 0.1, unit: "s" },
    { key: "src", label: "来源行(可空,SOURCE·出处·日期)", type: "text" },
    {
      key: "size",
      label: "尺寸",
      type: "select",
      options: [
        { label: "大 · 段头/章头", value: "l" },
        { label: "小 · 块级标题(钉在证据块上方)", value: "s" },
      ],
    },
    { key: "accent", label: "段落语义色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: SectionHead,
};
