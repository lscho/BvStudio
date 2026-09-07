import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { OFFSET_CONTROLS, OFFSET_DEFAULTS, offsetVars } from "./accent";

export interface FocusTakeoverParams {
  /** 右侧菜单项,| 分隔(自动编号 01 02 03…) */
  items: string;
  /** 大标题两行「上行|下行」,`*词*` 变黄斜体放大 */
  title: string;
  /** 右下角竖排英文水印 */
  en?: string;
  /** 左侧大编号 */
  num?: string;
  /** 圆窗直径(px) */
  ring?: number;
  /** 圆窗中心相对画布中心的偏移(px) */
  ringX?: number;
  ringY?: number;
  /** 菜单逐项点亮间隔 */
  stepMs?: number;
  offsetX?: number;
  offsetY?: number;
}

function renderRich(s: string) {
  return s.split(/(\*[^*]+\*)/).map((p, i) =>
    p.startsWith("*") && p.endsWith("*") ? <em key={i}>{p.slice(1, -1)}</em> : p,
  );
}

/**
 * 黑屏聚焦仪表盘:整个画面压黑,只留一个黄色十字准星圆窗露出人物,
 * 右侧菜单逐项点亮(自动编号),下方砸两行大标题——
 * "接下来讲这几件事"的全屏接管时刻(章节总起/悬念揭晓)。
 * 圆窗是透明的:导出盖在原片上,窗里自然就是你的脸;
 * 预览时拖 ringX/ringY 让圆窗套住自己。独占全屏,不与其他卡同屏。
 */
function FocusTakeover({ params, playToken }: EffectProps<FocusTakeoverParams>) {
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const { items, title, en, num, ring, ringX, ringY, stepMs } = params;
  const list = items
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  const [t1 = "", t2 = ""] = title.split("|").map((s) => s.trim());
  // 圆窗直径吃缩放(滚轮/缩放滑杆 → --hud-scale);黑幕始终满屏不缩
  const d = `calc(${ring ?? 460}px * var(--hud-scale, 1))`;
  const r = `calc(${(ring ?? 460) / 2}px * var(--hud-scale, 1))`;
  // 位置微调(画布拖拽/滑杆)挪的是圆窗+准星,黑幕始终满屏(不能露边)
  const cx = `calc(50% + ${ringX ?? 0}px + var(--hud-ox, 0px))`;
  const cy = `calc(42% + ${ringY ?? 0}px + var(--hud-oy, 0px))`;
  const step = (stepMs ?? 700) / 1000;

  return (
    <div className={`hud fto ${entered ? "is-in" : ""}`} style={offsetVars(params)}>
      {/* 黑幕:圆窗处挖空(透明),盖回原片就露脸 */}
      <div
        className="fto-shade"
        style={{
          WebkitMaskImage: `radial-gradient(circle ${r} at ${cx} ${cy}, transparent 98%, #000 100%)`,
          maskImage: `radial-gradient(circle ${r} at ${cx} ${cy}, transparent 98%, #000 100%)`,
        }}
      />
      {/* 黄色准星圆环 + 十字刻度 */}
      <div className="fto-ring" style={{ left: cx, top: cy, width: d, height: d }}>
        <i className="fto-tick fto-tick--t" />
        <i className="fto-tick fto-tick--b" />
        <i className="fto-tick fto-tick--l" />
        <i className="fto-tick fto-tick--r" />
      </div>
      {/* 右侧菜单:逐项点亮 */}
      <div className="fto-menu">
        {list.map((it, i) => (
          <div className={`fto-item ${elapsed >= 0.6 + i * step ? "is-on" : ""}`} key={i}>
            <span className="fto-item-name">{it}</span>
            <span className="fto-item-no">{String(i + 1).padStart(2, "0")}</span>
            <i />
          </div>
        ))}
      </div>
      {/* 左侧大编号 + 装饰条 */}
      {num && (
        <div className="fto-num">
          {num}
          <i />
          <i />
        </div>
      )}
      {/* 大标题两行 */}
      <div className="fto-title">
        {t1 && <div className="fto-t1">{renderRich(t1)}</div>}
        {t2 && <div className="fto-t2">{renderRich(t2)}</div>}
      </div>
      {en && <div className="fto-en">{en}</div>}
      {/* 四角括号 */}
      <i className="fto-cor fto-cor--tl" />
      <i className="fto-cor fto-cor--tr" />
      <i className="fto-cor fto-cor--bl" />
      <i className="fto-cor fto-cor--br" />
    </div>
  );
}

export const focusTakeoverDef: EffectDef<FocusTakeoverParams> = {
  id: "focus-takeover",
  name: "FocusTakeover",
  description: "黑屏聚焦仪表盘 · 全屏压黑只留准星圆窗,菜单逐项点亮",
  tags: ["玻璃虚化", "取景重构"],
  selfPosition: true,
  defaults: {
    items: "菜单一|菜单二|菜单三",
    title: "大标题在这 *变黄词*|第二行小一号",
    en: "EDIT",
    num: "01",
    ring: 460,
    ringX: 0,
    ringY: 0,
    stepMs: 700,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "items", label: "右侧菜单(| 分隔,自动编号)", type: "text" },
    { key: "title", label: "大标题(上行|下行,*词* 变黄)", type: "text" },
    { key: "num", label: "左侧大编号(空 = 不要)", type: "text" },
    { key: "en", label: "右下竖排英文(空 = 不要)", type: "text" },
    { key: "ring", label: "圆窗直径", type: "range", min: 260, max: 760, step: 10, unit: "px" },
    { key: "ringX", label: "圆窗左右(套住自己的脸)", type: "range", min: -600, max: 600, step: 5, unit: "px" },
    { key: "ringY", label: "圆窗上下", type: "range", min: -300, max: 300, step: 5, unit: "px" },
    { key: "stepMs", label: "菜单逐项间隔(卡点用)", type: "range", min: 200, max: 3000, step: 50, unit: "ms" },
    ...OFFSET_CONTROLS,
  ],
  Component: FocusTakeover,
};
