import type { CSSProperties } from "react";
import type { EffectDef, EffectProps } from "../types";
import { easeOutExpo, useElapsed } from "../useAnimation";
import { MediaImg } from "./MediaImg";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

/*
 * 封面流(coverflow):一排卡横向排开,居中那张正对镜头,两侧按距离依次缩小、
 * 后退、侧转,形成纵深。这是个通用的画廊排布方式,自 2006 年起在各类播放器和
 * 相册里常见。
 *
 * 本实现的两个要点:
 * 1) 位置完全由 useElapsed 派生,不靠交互也不靠定时器(视频里没有鼠标,
 *    而虚拟时钟下定时器不可靠);
 * 2) 缩放/纵深/侧转三件事由同一个衰减系数派生,而不是各写各的常量 ——
 *    三者绑在一起才不会调出别扭的透视。
 */

export interface CoverFlowParams {
  theme: "dark" | "light";
  position: "center" | "bottom" | "top-left" | "top-right";
  img1: string;
  cap1: string;
  img2: string;
  cap2: string;
  img3: string;
  cap3: string;
  img4: string;
  cap4: string;
  img5: string;
  cap5: string;
  holdMs: number;
  cardW: number;
  cardH: number;
  gap: number;
  tilt: number;
  sideTilt: number;
  dim: number;
  depth: number;
  radius: number;
  showTitle: boolean;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

// preserve-3d 下绘制顺序跟 3D 位置走(不是 z-index):居中那张离镜头最近,
// 两侧按 falloff 依次退后,所以不需要手动管层级。
const PERSPECTIVE = 1400;   // 透视距离:越小纵深越夸张
const SPAN = 2.4;           // 可见跨度:离中心超过这个距离就淡出
const SHRINK = 0.38;        // 最边缘时缩到 1-SHRINK

function CoverFlow({ params, playToken }: EffectProps<CoverFlowParams>) {
  const {
    position,
    holdMs,
    cardW,
    cardH,
    gap,
    tilt,
    sideTilt,
    dim,
    depth,
    radius,
    showTitle,
    accent,
  } = params;

  const slides = [
    { src: params.img1, cap: params.cap1 },
    { src: params.img2, cap: params.cap2 },
    { src: params.img3, cap: params.cap3 },
    { src: params.img4, cap: params.cap4 },
    { src: params.img5, cap: params.cap5 },
  ].filter((s) => s.src || s.cap);
  const n = slides.length;

  // 轮播完全由时间派生。两处都不能偷懒:
  // 1) 定时器(setInterval)在虚拟时钟下节奏不可控 → 用 elapsed 算
  // 2) 位置也必须自己算,不能用「离散 index + CSS transition」——
  //    transition 的触发相位不归我们控制,换卡那一帧差一帧,整段过渡就全错位
  //    (实测那样写两次导出差 32.7dB;改成连续位置后逐帧一致)。
  const hold = Math.max(200, holdMs);
  const elapsed = useElapsed(playToken, 600000);
  const phase = elapsed / hold;
  const beat = Math.floor(phase);
  const inBeat = phase - beat;
  // 一拍里前 MOVE_RATIO 用来换卡,其余时间停住 —— 要的是「停顿→利落切换」的手感,
  // 匀速滑动会显得拖沓
  const MOVE_RATIO = 0.4;
  const moved = inBeat < MOVE_RATIO ? easeOutExpo(inBeat / MOVE_RATIO) : 1;
  const pos = beat + moved;
  const effRadius = (Math.max(0, Math.min(20, radius)) / 20) * (Math.min(cardW, cardH) / 2);
  const dimAmt = Math.max(0, Math.min(100, dim)) / 100;

  if (!n) return null;

  return (
    <div
      className={`hud cf hud-anchor hud-anchor--${position}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div
        style={{
          position: "relative",
          width: cardW,
          height: cardH,
          perspective: `${PERSPECTIVE}px`,
          transformStyle: "preserve-3d",
        }}
      >
        {slides.map((slide, i) => {
          let rel = i - pos;
          while (rel > n / 2) rel -= n;
          while (rel < -n / 2) rel += n;
          const ax = Math.abs(rel);
          // 一个衰减系数派生三件事,rel 是连续值所以它们也连续(否则边缘会闪)
          const falloff = Math.min(1, ax / SPAN);
          const vis = 1 - falloff;
          const sc = 1 - falloff * SHRINK;

          const cardStyle: CSSProperties = {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: cardW,
            height: cardH,
            borderRadius: effRadius,
            overflow: "hidden",
            transformStyle: "preserve-3d",
            transformOrigin: "center center",
            transform: [
              "translate(-50%, -50%)",
              `translateX(${(rel * gap * 30).toFixed(2)}px)`,
              `translateZ(${(-falloff * depth).toFixed(2)}px)`,
              `rotateY(${(-rel * tilt).toFixed(2)}deg)`,
              `rotateZ(${(rel * sideTilt).toFixed(2)}deg)`,
              `scale(${sc.toFixed(4)})`,
            ].join(" "),
            opacity: vis,
            background: "#1a1a1a",
          };

          return (
            <div key={i} style={cardStyle}>
              {slide.src ? (
                <MediaImg
                  src={slide.src}
                  className="cf-img"
                  tStart={(params as unknown as { __start?: number }).__start}
                />
              ) : null}

              {showTitle && slide.cap ? (
                <>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.7) 100%)",
                    }}
                  />
                  <div style={{ position: "absolute", left: 22, right: 22, bottom: 24 }}>
                    <span className="cf-cap">{slide.cap}</span>
                  </div>
                </>
              ) : null}

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#000",
                  opacity: dimAmt * falloff,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const coverFlowDef: EffectDef<CoverFlowParams> = {
  id: "cover-flow",
  vTier: "half",
  name: "CoverFlow",
  description: "封面流 · 3D 卡片横向轮播,居中一张正对镜头,两侧侧倾退后",
  tags: ["3D 浮屏", "翻转轮换"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    img1: "",
    cap1: "标题写这行",
    img2: "",
    cap2: "第二张",
    img3: "",
    cap3: "第三张",
    img4: "",
    cap4: "",
    img5: "",
    cap5: "",
    holdMs: 1600,
    cardW: 400,
    cardH: 400,
    gap: 8,
    tilt: 12,
    sideTilt: 8,
    dim: 60,
    depth: 540,
    radius: 3,
    showTitle: true,
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
        { label: "底部", value: "bottom" },
        { label: "左上", value: "top-left" },
        { label: "右上", value: "top-right" },
      ],
    },
    { key: "img1", label: "图/视频 1", type: "text" },
    { key: "cap1", label: "标题 1", type: "text" },
    { key: "img2", label: "图/视频 2", type: "text" },
    { key: "cap2", label: "标题 2", type: "text" },
    { key: "img3", label: "图/视频 3(可空)", type: "text" },
    { key: "cap3", label: "标题 3(可空)", type: "text" },
    { key: "img4", label: "图/视频 4(可空)", type: "text" },
    { key: "cap4", label: "标题 4(可空)", type: "text" },
    { key: "img5", label: "图/视频 5(可空)", type: "text" },
    { key: "cap5", label: "标题 5(可空)", type: "text" },
    { key: "showTitle", label: "显示标题", type: "toggle" },
    { key: "holdMs", label: "每张停留", type: "range", min: 400, max: 4000, step: 100, unit: "ms" },
    { key: "cardW", label: "卡片宽", type: "range", min: 200, max: 700, step: 10, unit: "px" },
    { key: "cardH", label: "卡片高", type: "range", min: 200, max: 700, step: 10, unit: "px" },
    { key: "gap", label: "间距", type: "range", min: 0, max: 20, step: 1 },
    { key: "tilt", label: "侧转角", type: "range", min: 0, max: 40, step: 1, unit: "°" },
    { key: "sideTilt", label: "侧倾角", type: "range", min: 0, max: 20, step: 1, unit: "°" },
    { key: "dim", label: "两侧压暗", type: "range", min: 0, max: 100, step: 5, unit: "%" },
    { key: "depth", label: "纵深(两侧后退)", type: "range", min: 0, max: 900, step: 20, unit: "px" },
    { key: "radius", label: "圆角", type: "range", min: 0, max: 20, step: 1 },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: CoverFlow,
};
