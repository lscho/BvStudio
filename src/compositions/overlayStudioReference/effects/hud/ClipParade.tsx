import type { EffectDef, EffectProps } from "../types";
import { useCardElapsed } from "./useTimelineTime";
import { FxVideo, isVideoSrc } from "./MediaImg";
import { imgRetry } from "./imgRetry";
import { ACCENT_OPTIONS, ACCENT_VAR, THEME_OPTIONS } from "./accent";
import { useStageRatio, useStageSize } from "../../stage";

export interface ClipParadeParams {
  theme: "dark" | "light";
  /** 排布:整墙平铺(多素材) / 自由摆放(2-3 条,各自可拖) */
  layout: "grid" | "free";

  /* ── 整墙模式 ── */
  /** 一行一块:「路径 | 素材起始秒 | 标签」;同一条视频写多行、起始秒不同 = 切成多块 */
  tiles: string;
  /** 铺墙列数 */
  cols: number;

  /* ── 自由摆放模式(最多 3 块,每块都能在画布上直接拖) ── */
  img1: string;
  clip1: number;
  label1: string;
  x1: number;
  y1: number;
  w1: number;
  img2: string;
  clip2: number;
  label2: string;
  x2: number;
  y2: number;
  w2: number;
  img3: string;
  clip3: number;
  label3: string;
  x3: number;
  y3: number;
  w3: number;
  /** 自由摆放时的随手歪斜(度,0 = 摆正) */
  tileTilt: number;

  /** 左上角标(EN 等宽) */
  kicker: string;
  /** 角标中文小字 */
  kickerZh: string;
  /** 第一块铺上来的时刻(秒,距卡片 start) */
  buildAt: number;
  /** 逐块进场间隔(ms,按你报名字的节奏) */
  buildStepMs: number;
  /** 开始收队的时刻(秒,距卡片 start) */
  paradeAt: number;
  /** 逐块飞进侧栏的间隔(ms) */
  paradeStepMs: number;
  /** 收队后侧栏落在哪一侧 */
  listSide: "right" | "left";
  /** 收队后另一侧的大标题(EN 小字 / 大标题 / 中文小字,都可空) */
  titleEn: string;
  title: string;
  titleZh: string;
  /** 顶部安全区(px):避开章节导航条,默认 64 */
  safeTop: number;
  /** 底部字幕安全区(%画面高):原片烧录字幕露出来 */
  safeBottom: number;
  /** 底幕颜色(盖住原片那层) */
  bg: "dark" | "ink" | "cream" | "accent" | "none";
  /** 底幕不透明度(0.2-1,越小越透出原片) */
  bgAlpha: number;
  /** 底幕边缘羽化(px):0 = 硬边(生硬),给到 80-160 就化开了 */
  bgFeather: number;
  /** 底幕左右内缩(px):不铺满整宽,收成一条带 */
  bgInsetX: number;
  accent: string;
}

interface Placed {
  src: string;
  clip: number;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  /** 这块在画布上拖动时写回的参数名(自由摆放模式才有) */
  keyX?: string;
  keyY?: string;
}

function parseTiles(raw: string) {
  return (raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((l) => {
      const [src = "", clip = "0", label = ""] = l.split("|").map((s) => s.trim());
      return { src, clip: parseFloat(clip) || 0, label };
    });
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 飞行曲线:起步快、落位稳(收队要"排得整齐",不能软绵绵) */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 自由摆放的随手歪斜:三块各歪一点,不规整才像"摆上去的" */
const FREE_ROT = [-1, 0.7, -0.5];

/**
 * 素材墙收队:
 * 视频片段逐块进场各自播放(每块带名字标签),讲完之后按顺序飞进
 * 一侧的竖排清单缩成缩略图常驻,人物重新露出,另一侧砸出结论大标题。
 * 两种排布:整墙平铺(素材多)/ 自由摆放(2-3 条,每块直接在画布上拖)。
 * 独占全屏,勿与其他卡同屏;safeTop 避开章节条,safeBottom 留出烧录字幕。
 */
function ClipParade({ params, playToken }: EffectProps<ClipParadeParams>) {
  const { w: STAGE_W, h: STAGE_H } = useStageSize();
  const V = useStageRatio() === "v";
  const elapsed = useCardElapsed(params, playToken);
  const {
    layout,
    cols,
    kicker,
    kickerZh,
    buildAt,
    buildStepMs,
    paradeAt,
    paradeStepMs,
    listSide,
    titleEn,
    title,
    titleZh,
    safeTop,
    safeBottom,
    tileTilt,
    bg,
    bgAlpha,
    bgFeather,
    bgInsetX,
    accent,
  } = params;

  const top = Math.max(0, safeTop ?? 64);
  const wallBottom = STAGE_H * (1 - Math.max(0, Math.min(30, safeBottom)) / 100);
  const wallH = Math.max(120, wallBottom - top);

  // ── 每块的"进场位置"(整墙 = 算出来的格子;自由 = 你拖出来的坐标) ──
  const placed: Placed[] = [];
  if (layout === "free") {
    const p = params as unknown as Record<string, string | number>;
    for (let i = 1; i <= 3; i++) {
      const src = String(p[`img${i}`] ?? "");
      const label = String(p[`label${i}`] ?? "");
      if (!src && !label) continue;
      const w = Number(p[`w${i}`]) || 720;
      placed.push({
        src,
        clip: Number(p[`clip${i}`]) || 0,
        label,
        x: Number(p[`x${i}`]) || 0,
        y: Number(p[`y${i}`]) || 0,
        w,
        h: (w * 9) / 16,
        rot: (FREE_ROT[i - 1] ?? 0) * (tileTilt ?? 0),
        keyX: `x${i}`,
        keyY: `y${i}`,
      });
    }
  } else {
    const list = parseTiles(params.tiles);
    const nCols = Math.max(1, Math.min(4, Math.round(cols) || 3));
    const rows = Math.ceil((list.length || 1) / nCols);
    const gap = 6;
    const cellW = STAGE_W / nCols;
    const cellH = wallH / rows;
    list.forEach((t, i) => {
      placed.push({
        ...t,
        x: (i % nCols) * cellW + gap / 2,
        y: top + Math.floor(i / nCols) * cellH + gap / 2,
        w: cellW - gap,
        h: cellH - gap,
        rot: 0,
      });
    });
  }

  const n = Math.max(placed.length, 1);
  // 收队落位 —— 横版收进侧栏(缩略图竖排),竖版收到底部(横排一条)。
  // 竖版只有 1080 宽,留不出侧栏:一条 470 宽的侧栏要吃掉 44% 画面,
  // 剩下的墙面根本铺不开。所以竖版一律收到下面横着排。
  const rail = V
    ? (() => {
        const pad = 60;
        const gap = 14;
        const w = Math.min(280, (STAGE_W - pad * 2 - gap * (n - 1)) / n);
        const h = w / 1.68;
        const span = w * n + gap * (n - 1);
        return {
          w,
          h,
          x0: Math.round((STAGE_W - span) / 2),
          y0: Math.round(wallBottom - h - 32),
          dx: w + gap,
          dy: 0,
        };
      })()
    : (() => {
        // 块数少就让缩略图大一点
        const itemCap = n <= 2 ? 158 : n <= 4 ? 122 : 96;
        const itemH = Math.min(itemCap, (wallH - 80) / n);
        return {
          w: itemH * 1.68,
          h: itemH - 8,
          x0: listSide === "right" ? STAGE_W - 470 : 60,
          y0: top + (wallH - n * itemH) / 2,
          dx: 0,
          dy: itemH,
        };
      })();

  const paradeSpan = ((n - 1) * paradeStepMs) / 1000 + 0.85;
  const paradeAll = clamp01((elapsed - paradeAt) / Math.max(paradeSpan, 0.4));
  const titleP = clamp01((elapsed - paradeAt - paradeSpan * 0.55) / 0.7);
  const kickerP = clamp01((elapsed - buildAt) / 0.5) * (1 - clamp01((elapsed - paradeAt) / 0.5));

  return (
    <div
      className="clp hud"
      data-side={listSide}
      data-layout={layout}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent] }}
    >
      {bg !== "none" && (
        <div
          className="clp-backdrop"
          data-bg={bg}
          style={{
            opacity: (1 - paradeAll) * (bgAlpha ?? 0.92),
            top,
            height: wallH,
            left: bgInsetX ?? 0,
            right: bgInsetX ?? 0,
            ["--clp-f" as string]: `${bgFeather ?? 0}px`,
          }}
        />
      )}

      {placed.map((t, i) => {
        const b = clamp01((elapsed - buildAt - (i * buildStepMs) / 1000) / 0.45);
        const p = clamp01((elapsed - paradeAt - (i * paradeStepMs) / 1000) / 0.85);
        const e = easeInOut(p);
        const x = t.x + (rail.x0 + i * rail.dx - t.x) * e;
        const y = t.y + (rail.y0 + i * rail.dy - t.y) * e;
        const w = t.w + (rail.w - t.w) * e;
        const h = t.h + (rail.h - t.h) * e;
        const inList = p > 0.5;
        return (
          <div
            key={i}
            className={`clp-tile ${inList ? "is-list" : ""}`}
            data-drag-x={t.keyX}
            data-drag-y={t.keyY}
            style={{
              left: x,
              top: y,
              width: w,
              height: h,
              opacity: b,
              transform: `translateY(${(1 - b) * 26}px) rotate(${t.rot * (1 - e)}deg)`,
            }}
          >
            <div className="clp-screen">
              {t.src ? (
                isVideoSrc(t.src) ? (
                  <FxVideo
                    src={t.src}
                    tStart={params.__start ?? 0}
                    clipStart={t.clip}
                    loop
                  />
                ) : (
                  <img src={t.src} alt="" onError={imgRetry(t.src)} />
                )
              ) : (
                <div className="clp-empty">展示素材</div>
              )}
            </div>
            {t.label && <span className="clp-label">{t.label}</span>}
          </div>
        );
      })}

      {(kicker || kickerZh) && (
        <div className="clp-kicker" style={{ opacity: kickerP, top: top + 16 }}>
          {kicker && <b>{kicker}</b>}
          {kickerZh && <i>{kickerZh}</i>}
        </div>
      )}

      {(title || titleEn || titleZh) && (
        <div
          className="clp-title"
          style={{ opacity: titleP, transform: `translateY(calc(-50% + ${(1 - titleP) * 26}px))` }}
        >
          {titleEn && <b>{titleEn}</b>}
          {title && <strong>{title}</strong>}
          {titleZh && <i>{titleZh}</i>}
        </div>
      )}
    </div>
  );
}

export const clipParadeDef: EffectDef<ClipParadeParams> = {
  id: "clip-parade",
  name: "ClipParade",
  description: "素材墙收队 · 视频铺开 → 依次排队进侧栏",
  tags: ["聚散飞行"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    layout: "free",
    tiles: "",
    cols: 3,
    img1: "",
    clip1: 0,
    label1: "",
    x1: 90,
    y1: 150,
    w1: 720,
    img2: "",
    clip2: 0,
    label2: "",
    x2: 950,
    y2: 130,
    w2: 800,
    img3: "",
    clip3: 0,
    label3: "",
    x3: 430,
    y3: 520,
    w3: 700,
    tileTilt: 2,
    kicker: "",
    kickerZh: "",
    buildAt: 0.2,
    buildStepMs: 400,
    paradeAt: 6,
    paradeStepMs: 140,
    listSide: "right",
    titleEn: "",
    title: "",
    titleZh: "",
    safeTop: 64,
    safeBottom: 12,
    bg: "dark",
    bgAlpha: 0.92,
    bgFeather: 90,
    bgInsetX: 0,
    accent: "blue",
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "layout",
      label: "排布",
      type: "select",
      options: [
        { label: "自由摆放(2-3 条 · 每块可拖)", value: "free" },
        { label: "整墙平铺(素材多)", value: "grid" },
      ],
    },

    { key: "img1", label: "① 视频/图", type: "text" },
    { key: "label1", label: "① 标签", type: "text" },
    { key: "clip1", label: "① 从第几秒开始播", type: "range", min: 0, max: 600, step: 1, unit: "s" },
    { key: "w1", label: "① 大小(宽 px)", type: "range", min: 240, max: 1400, step: 20, unit: "px" },
    { key: "x1", label: "① 横向(px)", type: "range", min: -200, max: 1800, step: 10, unit: "px" },
    { key: "y1", label: "① 纵向(px)", type: "range", min: 0, max: 980, step: 10, unit: "px" },

    { key: "img2", label: "② 视频/图", type: "text" },
    { key: "label2", label: "② 标签", type: "text" },
    { key: "clip2", label: "② 从第几秒开始播", type: "range", min: 0, max: 600, step: 1, unit: "s" },
    { key: "w2", label: "② 大小(宽 px)", type: "range", min: 240, max: 1400, step: 20, unit: "px" },
    { key: "x2", label: "② 横向(px)", type: "range", min: -200, max: 1800, step: 10, unit: "px" },
    { key: "y2", label: "② 纵向(px)", type: "range", min: 0, max: 980, step: 10, unit: "px" },

    { key: "img3", label: "③ 视频/图", type: "text" },
    { key: "label3", label: "③ 标签", type: "text" },
    { key: "clip3", label: "③ 从第几秒开始播", type: "range", min: 0, max: 600, step: 1, unit: "s" },
    { key: "w3", label: "③ 大小(宽 px)", type: "range", min: 240, max: 1400, step: 20, unit: "px" },
    { key: "x3", label: "③ 横向(px)", type: "range", min: -200, max: 1800, step: 10, unit: "px" },
    { key: "y3", label: "③ 纵向(px)", type: "range", min: 0, max: 980, step: 10, unit: "px" },
    { key: "tileTilt", label: "随手歪斜(度)", type: "range", min: 0, max: 6, step: 0.5, unit: "°" },

    {
      key: "tiles",
      label: "整墙模式的素材(一行一块:路径|起始秒|标签)",
      type: "textarea",
    },
    { key: "cols", label: "整墙列数", type: "range", min: 2, max: 4, step: 1, unit: "列" },

    { key: "kicker", label: "左上角标(EN)", type: "text" },
    { key: "kickerZh", label: "角标中文小字", type: "text" },
    { key: "buildAt", label: "开始进场(s)", type: "range", min: 0, max: 10, step: 0.1, unit: "s" },
    {
      key: "buildStepMs",
      label: "逐块进场间隔",
      type: "range",
      min: 80,
      max: 1600,
      step: 20,
      unit: "ms",
    },
    { key: "paradeAt", label: "开始收队(s)", type: "range", min: 0, max: 40, step: 0.1, unit: "s" },
    {
      key: "paradeStepMs",
      label: "逐块收队间隔",
      type: "range",
      min: 40,
      max: 600,
      step: 20,
      unit: "ms",
    },
    {
      key: "listSide",
      label: "收队到哪一侧",
      type: "select",
      options: [
        { label: "右侧", value: "right" },
        { label: "左侧", value: "left" },
      ],
    },
    { key: "titleEn", label: "收队后·EN 小字", type: "text" },
    { key: "title", label: "收队后·大标题", type: "text" },
    { key: "titleZh", label: "收队后·中文小字", type: "text" },
    { key: "safeTop", label: "顶部安全区(避开章节条 px)", type: "range", min: 0, max: 200, step: 4, unit: "px" },
    {
      key: "safeBottom",
      label: "底部字幕安全区(%)",
      type: "range",
      min: 0,
      max: 25,
      step: 1,
      unit: "%",
    },
    {
      key: "bg",
      label: "底幕颜色",
      type: "select",
      options: [
        { label: "暗黑", value: "dark" },
        { label: "墨蓝", value: "ink" },
        { label: "米白", value: "cream" },
        { label: "跟点缀色", value: "accent" },
        { label: "不要底幕(透出原片)", value: "none" },
      ],
    },
    { key: "bgAlpha", label: "底幕透明度", type: "range", min: 0.2, max: 1, step: 0.02, unit: "" },
    { key: "bgFeather", label: "底幕边缘羽化(px)", type: "range", min: 0, max: 240, step: 10, unit: "px" },
    { key: "bgInsetX", label: "底幕左右内缩(px)", type: "range", min: 0, max: 420, step: 10, unit: "px" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
  ],
  Component: ClipParade,
};
