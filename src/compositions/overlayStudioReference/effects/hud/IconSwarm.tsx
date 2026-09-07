import type { EffectDef, EffectProps } from "../types";
import { useCardElapsed } from "./useTimelineTime";
import { hasVecIcon, VecIcon } from "./vecIcons";
import { isMediaUrl, MediaImg } from "./MediaImg";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface IconSwarmParams {
  theme: "dark" | "light";
  /** 大标题(中文) */
  head: string;
  /** 标题后面的 EN 灰字(可空) */
  headEn: string;
  /** 一行一条:「文字 | 图标名或 /logos/x.svg」,最多 8 条;文字里 *词* 换强调色 */
  items: string;
  /** 第一条出现的时刻(秒,距卡片 start) */
  startAt: number;
  /** 逐条点亮间隔(ms,按 SRT 卡点) */
  stepMs: number;
  /** 排布:两侧分列(避开人物)/ 只在左列 */
  layout: "split" | "left";
  /** 底部结论行(可空) */
  foot: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

interface Item {
  text: string;
  icon: string;
}

function parseItems(raw: string): Item[] {
  return (raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((l) => {
      const [text = "", icon = ""] = l.split("|").map((s) => s.trim());
      return { text, icon };
    });
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 行内 *重点词* 上强调色 */
function mark(text: string) {
  return (text ?? "")
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((seg, i) =>
      seg.startsWith("*") && seg.endsWith("*") ? (
        <em className="isw-kw" key={i}>
          {seg.slice(1, -1)}
        </em>
      ) : (
        <span key={i}>{seg}</span>
      ),
    );
}

function Chip({ it, p }: { it: Item; p: number }) {
  const isImg = isMediaUrl(it.icon);
  return (
    <div
      className="isw-chip"
      style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}
    >
      <span className="isw-ico">
        {isImg ? (
          <MediaImg src={it.icon} className="isw-img" />
        ) : hasVecIcon(it.icon) ? (
          <VecIcon name={it.icon} size={26} />
        ) : (
          <em>{it.icon}</em>
        )}
      </span>
      <b>{mark(it.text)}</b>
    </div>
  );
}

/**
 * 图标群:无底板的 icon + 词条,
 * 分列排在人物两侧逐条点亮,底部一行结论收口。
 * 每条一个语义精确的线稿图标 —— 一屏里元素形态不重样,又不压人脸。
 * 用途:并列列举"这些都行"、"这套逻辑适用于 A/B/C/D"。
 */
function IconSwarm({ params, playToken }: EffectProps<IconSwarmParams>) {
  const elapsed = useCardElapsed(params, playToken);
  const { head, headEn, startAt, stepMs, layout, foot, accent } = params;
  const items = parseItems(params.items);
  const p = (i: number) => clamp01((elapsed - startAt - (i * stepMs) / 1000 + 0.3) / 0.45);
  const half = Math.ceil(items.length / 2);
  const cols =
    layout === "left" ? [items, []] : [items.slice(0, half), items.slice(half)];
  const footP = clamp01(
    (elapsed - startAt - ((items.length - 1) * stepMs) / 1000 - 0.4) / 0.5,
  );

  return (
    <div className="hud isw" data-layout={layout} style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}>
      {(head || headEn) && (
        <div className="isw-head" style={{ opacity: clamp01((elapsed - startAt + 0.4) / 0.5) }}>
          {head && <strong>{mark(head)}</strong>}
          {headEn && <i>{headEn}</i>}
        </div>
      )}
      <div className="isw-col isw-col--l">
        {cols[0].map((it, i) => (
          <Chip key={i} it={it} p={p(i)} />
        ))}
      </div>
      {cols[1].length > 0 && (
        <div className="isw-col isw-col--r">
          {cols[1].map((it, i) => (
            <Chip key={i} it={it} p={p(i + half)} />
          ))}
        </div>
      )}
      {foot && (
        <div className="isw-foot" style={{ opacity: footP, transform: `translateY(${(1 - footP) * 12}px)` }}>
          <span className="isw-tick">✓</span>
          <b>{mark(foot)}</b>
        </div>
      )}
    </div>
  );
}

export const iconSwarmDef: EffectDef<IconSwarmParams> = {
  id: "icon-swarm",
  name: "IconSwarm",
  description: "图标群 · 无底板 icon 词条分列点亮",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    head: "",
    headEn: "",
    items: "",
    startAt: 0.3,
    stepMs: 420,
    layout: "split",
    foot: "",
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "head", label: "大标题(中文)", type: "text" },
    { key: "headEn", label: "标题 EN 灰字", type: "text" },
    { key: "items", label: "词条(一行一条:文字|图标名)", type: "textarea" },
    { key: "startAt", label: "起始时刻(s)", type: "range", min: 0, max: 12, step: 0.1, unit: "s" },
    { key: "stepMs", label: "逐条间隔", type: "range", min: 100, max: 1600, step: 20, unit: "ms" },
    {
      key: "layout",
      label: "排布",
      type: "select",
      options: [
        { label: "两侧分列(避开人物)", value: "split" },
        { label: "只在左列", value: "left" },
      ],
    },
    { key: "foot", label: "底部结论行", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: IconSwarm,
};
