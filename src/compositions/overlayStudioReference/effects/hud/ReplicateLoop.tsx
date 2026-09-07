import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { hasVecIcon, VecIcon } from "./vecIcons";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface ReplicateLoopParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  /** 眉题(EN · 中文) */
  kicker: string;
  /** 三站传送带,一行一站:「中文 | 图标名」 */
  stops: string;
  /** 每站点亮秒数(距卡片 start,| 分隔;对着台词填) */
  stopsAt: string;
  /** 库的格子总数 */
  cells: number;
  /** 起手已经亮着的格子数(= 你现在的库) */
  filled: number;
  /** 复刻出来的那张卡飞进库的秒数(库 +1 就在这一刻) */
  intoAt: number;
  /** 库标题 */
  libZh: string;
  libEn: string;
  /** 底部小注(可空) */
  note: string;
  /** 小注出现秒数 */
  noteAt: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  __t?: number;
  __start?: number;
}

interface Stop {
  zh: string;
  icon: string;
}

function parseStops(raw: string): Stop[] {
  return (raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((l) => {
      const [zh = "", icon = ""] = l.split("|").map((x) => x.trim());
      return { zh, icon };
    });
}

/**
 * 复刻入库:左边一条三站传送带(看到 → 扔给大模型 → 复刻出来),
 * 右边你的素材库网格;跑完一轮,复刻出的那张卡飞进库里,库亮起新的一格并弹 +1。
 *
 * 用途:讲"外面看到好东西 → 拿回来 → 库越攒越大"这类复利叙事。
 * 比逐条打勾的清单强的地方在于:**库变大这件事是演出来的,不是写出来的**。
 */
function ReplicateLoop({ params, playToken }: EffectProps<ReplicateLoopParams>) {
  const {
    position, kicker, stops, stopsAt, cells, filled,
    intoAt, libZh, libEn, note, noteAt, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const list = parseStops(stops);
  const at = (stopsAt ?? "")
    .split("|")
    .map((x) => parseFloat(x.trim()))
    .filter((v) => Number.isFinite(v));
  const stopAt = (i: number) => (at[i] != null ? at[i] : 0.3 + i * 2.4);
  const total = Math.max(4, Math.min(24, Math.round(cells ?? 12)));
  const base = Math.max(0, Math.min(total - 1, Math.round(filled ?? 9)));
  const landed = elapsed >= (intoAt ?? 6.5);
  const noteOn = note && elapsed >= (noteAt ?? 8);
  // 飞行阶段:落库前 0.55s 起飞,落库那一刻到位
  const flying = elapsed >= (intoAt ?? 6.5) - 0.55;
  // 飞行起点/终点(px,和 hud.css 里的尺寸对齐):
  // 起点 = 最后一站圆环的右外侧(别盖住那一站的图标);
  // 终点 = 库里"即将亮起的那一格"的中心,格子换位置飞行也跟着换
  const startX = Math.max(0, list.length - 1) * 200 + 100 + 46 - 17;
  const landX = (base % 6) * 74 + 32 - 17;
  const landY = 176 + Math.floor(base / 6) * 54 + 22 - 12;

  return (
    <div
      className={`hud rpl hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""} ${
        landed ? "is-landed" : ""
      } ${flying ? "is-flying" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--rpl-sx" as string]: `${startX}px`,
        ["--rpl-fx" as string]: `${landX}px`,
        ["--rpl-fy" as string]: `${landY}px`,
        ...offsetVars(params),
      }}
    >
      {kicker && (
        <div className="rpl-kick">
          <i />
          <span>{kicker}</span>
        </div>
      )}

      {/* 传送带:三站横排,讲到哪一站哪一站点亮,站与站之间的线跟着注水 */}
      <div className="rpl-belt">
        {list.map((s, i) => {
          const on = elapsed >= stopAt(i);
          return (
            <span key={i} className={`rpl-stop ${on ? "is-on" : ""}`}>
              {i > 0 && <b className={`rpl-link ${on ? "is-on" : ""}`} />}
              <span className="rpl-node">
                {hasVecIcon(s.icon) ? <VecIcon name={s.icon} size={30} /> : <em>{s.icon}</em>}
              </span>
              <span className="rpl-zh">{s.zh}</span>
            </span>
          );
        })}
        {/* 复刻出来的那张卡:从第三站起飞,落进右边的库 */}
        <span className="rpl-fly" />
      </div>

      {/* 你的库:落库那一刻多亮一格,并弹 +1 */}
      <div className="rpl-lib">
        <div className="rpl-lib-head">
          <span className="rpl-lib-zh">{libZh}</span>
          {libEn && <span className="rpl-lib-en">{libEn}</span>}
          <span className="rpl-plus">+1</span>
        </div>
        <div className="rpl-grid">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`rpl-cell ${i < base ? "is-on" : ""} ${
                i === base && landed ? "is-new" : ""
              }`}
            />
          ))}
        </div>
      </div>

      {note && <div className={`rpl-note ${noteOn ? "is-on" : ""}`}>{note}</div>}
    </div>
  );
}

export const replicateLoopDef: EffectDef<ReplicateLoopParams> = {
  id: "replicate-loop",
  vTier: "half",
  name: "ReplicateLoop",
  description: "复刻入库 · 看到→扔给大模型→复刻出来,飞进素材库,库亮一格 +1",
  tags: ["聚散飞行"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    kicker: "REPLICATE · 这一段的眉题",
    stops: "第一步(换成你的话)|search\n第二步|brain\n第三步|spin",
    stopsAt: "0.1|2.6|5.1",
    cells: 12,
    filled: 9,
    intoAt: 6.5,
    libZh: "落进哪里(换成你的话)",
    libEn: "YOUR LIBRARY",
    note: "补一句小注(可空)",
    noteAt: 8.2,
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
    { key: "stops", label: "传送带三站(中文|图标名,一行一站)", type: "textarea", rows: 3 },
    { key: "stopsAt", label: "每站点亮秒(| 分隔,对着台词填)", type: "text" },
    { key: "libZh", label: "库标题(中文)", type: "text" },
    { key: "libEn", label: "库标题(EN)", type: "text" },
    { key: "cells", label: "库的格子总数", type: "range", min: 4, max: 24, step: 1, unit: "格" },
    { key: "filled", label: "起手已有几格(= 现在的库)", type: "range", min: 0, max: 23, step: 1, unit: "格" },
    { key: "intoAt", label: "飞进库的秒(库 +1 就在这一刻)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "note", label: "底部小注(可空)", type: "text" },
    { key: "noteAt", label: "小注出现秒", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: ReplicateLoop,
};
