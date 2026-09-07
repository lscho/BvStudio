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

export interface MapTerritoryParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 六个时刻(距卡片 start 秒):地图标题|地图条目|疆域标题|疆域条目|箭头|gap填色,按 SRT 卡点填 */
  times: string;
  /** 条目逐个弹入的间隔 */
  itemStepMs: number;
  mapEn: string;
  mapZh: string;
  /** 「图标,文字」用 | 分隔 */
  mapItems: string;
  terrEn: string;
  terrZh: string;
  terrItems: string;
  gapZh: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

interface Item {
  icon: string;
  text: string;
}

function parseItems(raw: string): Item[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => {
      const i = seg.indexOf(",");
      return i === -1
        ? { icon: "·", text: seg }
        : { icon: seg.slice(0, i).trim(), text: seg.slice(i + 1).trim() };
    });
}

/**
 * 地图与疆域:标题横杠 → 逐条列举 → 图像画出(每侧一套完整三段式)。
 * 左"地图"虚线直线,右"疆域"蜿蜒实线绕开障碍,最后橙色 your unknowns 箭头点题。
 * 外框黑玻璃,面板纸面白卡。
 */
function MapTerritory({ params, playToken }: EffectProps<MapTerritoryParams>) {
  const {
    position, times, itemStepMs, mapEn, mapZh, mapItems, terrEn, terrZh, terrItems, gapZh, accent,
  } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const uid = useId();
  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const t = (i: number, fb: number) => (Number.isFinite(ts[i]) ? ts[i] : fb);
  const onMap = elapsed >= t(0, 0.3);
  const mapItemsAt = t(1, 1.2);
  const onTerr = elapsed >= t(2, 3.4);
  const terrItemsAt = t(3, 4.4);
  const onGap = elapsed >= t(4, 7.2);
  // 第四幕:直线与弯路之间的空隙填橙呼吸——"gap 就是未知点"纯图形呈现
  const onDiff = elapsed >= t(5, 9.4);
  const step = (itemStepMs ?? 1200) / 1000;

  const side = (
    cls: string,
    en: string,
    zh: string,
    items: Item[],
    itemsAt: number,
    paper: React.ReactNode,
  ) => (
    <div className={`mpt-side mpt-side--${cls}`}>
      {(en || zh) && (
        <div className="mpt-lock">
          {en && <div className="mpt-lock-en">{en}</div>}
          <i className="mpt-rule" />
          {zh && <div className="mpt-lock-zh">{zh}</div>}
        </div>
      )}
      {items.length > 0 && (
        <div className="mpt-items">
          {items.map((it, i) => (
            <div className={`mpt-item ${elapsed >= itemsAt + i * step ? "is-on" : ""}`} key={i}>
              <span className="mpt-item-ic">{it.icon}</span>
              <span>{it.text}</span>
            </div>
          ))}
        </div>
      )}
      {paper}
    </div>
  );

  // 纯图案模式:标题/条目全留空 → 只剩两张图 + 中间箭头,箭头对齐两图正中
  const minimal =
    !mapEn?.trim() && !mapZh?.trim() && !terrEn?.trim() && !terrZh?.trim() &&
    parseItems(mapItems).length === 0 && parseItems(terrItems).length === 0;

  return (
    <div
      className={`hud mpt hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""} ${
        onMap ? "on-map" : ""
      } ${onTerr ? "on-terr" : ""} ${onGap ? "on-gap" : ""} ${onDiff ? "on-diff" : ""} ${
        minimal ? "is-min" : ""
      }`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="mpt-panel">
        {side(
          "map", mapEn, mapZh, parseItems(mapItems), mapItemsAt,
          <div className="mpt-paper">
            <svg viewBox="0 0 300 300" className="mpt-svg">
              <g stroke="#dedbd2" strokeWidth="1.5">
                <line x1="75" y1="10" x2="75" y2="290" />
                <line x1="150" y1="10" x2="150" y2="290" />
                <line x1="225" y1="10" x2="225" y2="290" />
                <line x1="10" y1="75" x2="290" y2="75" />
                <line x1="10" y1="150" x2="290" y2="150" />
                <line x1="10" y1="225" x2="290" y2="225" />
              </g>
              <polygon points="105,202 120,178 135,202" fill="none" stroke="#bcb8ac" strokeWidth="2.5" />
              <circle cx="188" cy="205" r="13" fill="none" stroke="#c8c4b8" strokeWidth="2.5" />
              <mask id={`${uid}-m`}>
                <path d="M55 245 L245 55" pathLength={100} stroke="#fff" strokeWidth="14" fill="none"
                  className="mpt-reveal mpt-reveal--map" />
              </mask>
              <path d="M55 245 L245 55" stroke="#22211d" strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray="0.5 10" fill="none" mask={`url(#${uid}-m)`} />
              <circle cx="55" cy="245" r="8" className="mpt-dot" />
              <circle cx="245" cy="55" r="9" fill="none" stroke="#22211d" strokeWidth="3.5" className="mpt-end" />
            </svg>
          </div>,
        )}

        {/* 中:your unknowns 橙色虚线双箭头 */}
        <div className="mpt-gap">
          <svg viewBox="0 0 150 40" className="mpt-gap-svg">
            <line x1="18" y1="20" x2="132" y2="20" strokeDasharray="2 7" strokeLinecap="round" strokeWidth="3.5" className="mpt-gap-line" />
            <polyline points="26,10 12,20 26,30" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="mpt-gap-line" />
            <polyline points="124,10 138,20 124,30" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="mpt-gap-line" />
          </svg>
          <div className="mpt-gap-en">your unknowns</div>
          <div className="mpt-gap-zh">{gapZh}</div>
        </div>

        {side(
          "terr", terrEn, terrZh, parseItems(terrItems), terrItemsAt,
          <div className="mpt-paper mpt-paper--terr">
            <svg viewBox="0 0 300 300" className="mpt-svg">
              <g fill="none" stroke="#dcd8cb" strokeWidth="2" strokeLinecap="round">
                <path d="M30 45 q14 -8 28 0 q14 8 28 0" />
                <path d="M215 255 q14 -8 28 0" />
                <path d="M35 270 q14 -8 28 0 q14 8 28 0" />
              </g>
              <path d="M55 245 L245 55" stroke="#c9c5b8" strokeWidth="2.5" strokeDasharray="0.5 9"
                strokeLinecap="round" fill="none" className="mpt-ghost" />
              {/* gap 填色:理想直线与真实弯路之间的空隙 = 你的未知点 */}
              <path
                d="M55 245 L245 55 C238 68 232 79 222 90 C208 105 222 120 214 138 C205 160 190 138 172 148 C152 160 168 197 142 206 C118 214 118 189 92 196 C60 205 90 240 55 245 Z"
                className="mpt-diff" />
              <g className="mpt-diff-q" fontFamily="Georgia, serif" fontWeight="700">
                <text x="128" y="166" fontSize="26">?</text>
                <text x="196" y="112" fontSize="22">?</text>
              </g>
              <g className="mpt-obs">
                <circle cx="122" cy="102" r="14" fill="none" stroke="#8f8b80" strokeWidth="3" />
                <circle cx="142" cy="114" r="7" fill="none" stroke="#8f8b80" strokeWidth="3" />
                <text x="92" y="145" fontSize="30" fill="#a09c90" fontFamily="Georgia, serif">?</text>
                <polygon points="146,205 165,172 184,205" fill="#f7f4ec" stroke="#22211d" strokeWidth="3.5" />
                <path d="M196 190 q9 -12 18 0 q-9 12 -18 0" fill="none" stroke="#6d6a61" strokeWidth="3" />
                <text x="212" y="216" fontSize="34" fontWeight="700" className="mpt-obs-q" fontFamily="Georgia, serif">?</text>
              </g>
              <path
                d="M55 245 C90 240 60 205 92 196 C118 189 118 214 142 206 C168 197 152 160 172 148 C190 138 205 160 214 138 C222 120 208 105 222 90 C232 79 238 68 245 55"
                pathLength={100} strokeDasharray="101" fill="none" stroke="#22211d" strokeWidth="4"
                strokeLinecap="round" className="mpt-path" />
              <circle cx="55" cy="245" r="8" className="mpt-dot" />
              <circle cx="245" cy="55" r="9" fill="none" stroke="#22211d" strokeWidth="3.5" className="mpt-end" />
            </svg>
          </div>,
        )}
      </div>
    </div>
  );
}

export const mapTerritoryDef: EffectDef<MapTerritoryParams> = {
  id: "map-territory",
  vTier: "half",
  name: "MapTerritory",
  description: "地图与疆域 · 标题横杠+逐条列举+图像画出,unknowns 箭头点题",
  tags: ["生长描画", "逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    times: "0.3|1.2|3.4|4.4|7.4|9.4",
    itemStepMs: 1200,
    mapEn: "MAP",
    mapZh: "左面板 · 比喻/模型这一侧",
    mapItems: "💬,条目逐条弹入|⚡,图标+短词|📚,最多放三条",
    terrEn: "TERRITORY",
    terrZh: "右面板 · 现实这一侧",
    terrItems: "📁,同样三段式|🌍,标题先出条目后出|⛓️,图形最后画",
    gapZh: "两图间的 gap 点题",
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
    { key: "times", label: "六个时刻(图题|图条目|域题|域条目|箭头|gap填色,秒)", type: "text" },
    { key: "itemStepMs", label: "条目间隔(卡点用)", type: "range", min: 400, max: 3000, step: 100, unit: "ms" },
    { key: "mapEn", label: "左 · 英文标题", type: "text" },
    { key: "mapZh", label: "左 · 中文名", type: "text" },
    { key: "mapItems", label: "左 · 条目(图标,文字 | 分隔)", type: "text" },
    { key: "terrEn", label: "右 · 英文标题", type: "text" },
    { key: "terrZh", label: "右 · 中文名", type: "text" },
    { key: "terrItems", label: "右 · 条目(图标,文字 | 分隔)", type: "text" },
    { key: "gapZh", label: "箭头 · 中文点题", type: "text" },
    { key: "accent", label: "点缀色(箭头/起点)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: MapTerritory,
};
