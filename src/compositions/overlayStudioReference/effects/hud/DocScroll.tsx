import { useState } from "react";
import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { imgRetry } from "./imgRetry";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";
import { useCardElapsed } from "./useTimelineTime";

export interface DocScrollParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  /** 窗口标题(来源归因),如 "《Finding your Unknowns》原文" */
  title: string;
  /** 长截图(文章/合同/文档整页) */
  img1: string;
  /** 滚完全文用时 */
  scrollMs: number;
  /** 窗口中部高亮条(讲到哪句"划到哪句"的视觉替身) */
  highlight: boolean;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

/**
 * 文档滚动卡:长截图在圆角窗口里缓缓滚动 + 中部高亮条。
 * "你的合同 = 你的原文"——引用文章/协议/长文档时,滚动的原件
 * 比静态截图有说服力得多。截图越长越好(整页导出)。
 */
function DocScroll({ params, playToken }: EffectProps<DocScrollParams>) {
  const { position, title, img1, scrollMs, highlight, accent } = params;
  const entered = useEnter(playToken);
  const [dist, setDist] = useState(0);
  const elapsed = useCardElapsed(params, playToken);
  const progress = Math.max(0, Math.min(1, (elapsed - 0.8) / Math.max(0.1, scrollMs / 1000)));
  const eased = progress * progress * (3 - 2 * progress);
  const translateY = -(dist || 620) * eased;

  return (
    <div
      className={`hud dsc hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--dsc-ms" as string]: `${scrollMs}ms`,
        ["--dsc-dist" as string]: `${dist}px`,
        ...offsetVars(params),
      }}
    >
      <div className="dsc-box">
        {title && <div className="dsc-title">{title}</div>}
        <div className="dsc-win">
          {img1 ? (
            <img
              src={img1}
              alt=""
              className="dsc-img"
              style={{ transform: `translateY(${translateY.toFixed(2)}px)` }}
              onLoad={(e) => {
                const im = e.currentTarget;
                const winH = im.parentElement?.clientHeight ?? 700;
                const shownH = (im.naturalHeight / im.naturalWidth) * (im.parentElement?.clientWidth ?? 680);
                setDist(Math.max(0, shownH - winH));
              }}
              onError={imgRetry(img1)}
            />
          ) : (
            <div className="dsc-empty" style={{ transform: `translateY(${translateY.toFixed(2)}px)` }}><span>选择文档长截图</span></div>
          )}
          {highlight && <i className="dsc-hl" />}
        </div>
      </div>
    </div>
  );
}

export const docScrollDef: EffectDef<DocScrollParams> = {
  id: "doc-scroll",
  vTier: "half",
  name: "DocScroll",
  description: "文档滚动 · 原文/合同在窗口里缓缓滚过 + 高亮条",
  tags: ["扫过点亮"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "right",
    title: "原文 · 来源归因写这里",
    img1: "",
    scrollMs: 8000,
    highlight: true,
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
    { key: "title", label: "窗口标题(来源归因)", type: "text" },
    { key: "img1", label: "长截图", type: "text" },
    { key: "scrollMs", label: "滚完用时(≈卡片时长)", type: "range", min: 2000, max: 30000, step: 500, unit: "ms" },
    { key: "highlight", label: "中部高亮条", type: "toggle" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: DocScroll,
};
