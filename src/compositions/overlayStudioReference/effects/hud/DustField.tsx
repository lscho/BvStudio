import { useEffect, useRef } from "react";
import type { EffectDef, EffectProps } from "../types";
import { useElapsed } from "../useAnimation";
import { useStageSize } from "../../stage";
import { ACCENT_OPTIONS, THEME_OPTIONS } from "./accent";

export interface DustFieldParams {
  theme: "dark" | "light";
  accent: string;
  count: number;
  rise: number; // 上升速度基准 px/s
  drift: number; // 横向漂移幅度 px
  size: number; // 粒子最大半径 px
  glow: number; // 发光半径 px
  dim: number; // 整体不透明度 %
}


/** 确定性伪随机(粒子序号 + 通道决定,导出稳定) */
function prand(a: number, b: number) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// canvas 取不到 CSS 变量,按主题写死两套(取值同 hud.css 的 --hud-*)
const RGB: Record<string, [string, string]> = {
  blue: ["95,160,250", "30,99,216"],
  teal: ["69,198,207", "10,149,166"],
  violet: ["143,134,234", "94,84,201"],
  pink: ["248,123,172", "224,50,111"],
  lav: ["185,178,238", "128,119,205"],
  alert: ["232,134,134", "205,58,58"],
  green: ["111,208,140", "34,150,80"],
  orange: ["240,162,79", "214,120,20"],
};

/**
 * 尘埃流场 · 氛围底噪层。
 * 缓慢上浮的光尘,速度和大小分层做出远近感,横向用正弦漂移避免呆板。
 * 位置全部由 elapsed 直接算(不用 CSS 动画、不用 rAF 自己计时),导出逐帧可复现。
 */
function DustField({ params, playToken }: EffectProps<DustFieldParams>) {
  const { theme, accent, count, rise, drift, size, glow, dim } = params;
  const { w: W, h: H } = useStageSize();
  const elapsed = useElapsed(playToken, 600000);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    if (cv.width !== W) {
      cv.width = W;
      cv.height = H;
    }
    ctx.clearRect(0, 0, W, H);

    const [dk, lt] = RGB[accent] ?? RGB.blue;
    const rgb = theme === "light" ? lt : dk;
    const t = elapsed / 1000;
    const n = Math.max(1, Math.round(count));

    ctx.shadowColor = `rgba(${rgb},0.9)`;
    for (let i = 0; i < n; i++) {
      // 速度分层:慢的小而暗(远),快的大而亮(近)
      const depth = prand(i, 7);
      const vy = rise * (0.35 + depth);
      const r = 0.6 + depth * size;
      const alpha = (0.18 + depth * 0.62) * (dim / 100);

      const y = (((prand(i, 2) * H - vy * t) % H) + H) % H;
      const x =
        prand(i, 1) * W + Math.sin(t * 0.35 + prand(i, 4) * 6.283) * drift * (0.4 + depth);

      ctx.shadowBlur = glow * depth;
      ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }, [elapsed, theme, accent, count, rise, drift, size, glow, dim, W, H]);

  return (
    <div className="hud df-wrap">
      <canvas ref={ref} className="df-canvas" />
    </div>
  );
}

export const dustFieldDef: EffectDef<DustFieldParams> = {
  id: "dust-field",
  name: "DustField",
  description: "尘埃流场 · 光尘缓缓上浮的全屏氛围底,分层做远近感",
  tags: ["粒子流场"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    accent: "blue",
    count: 70,
    rise: 26,
    drift: 40,
    size: 2.4,
    glow: 10,
    dim: 70,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "accent", label: "光尘颜色", type: "select", options: ACCENT_OPTIONS },
    { key: "count", label: "数量", type: "range", min: 20, max: 160, step: 5 },
    { key: "rise", label: "上浮速度", type: "range", min: 4, max: 90, step: 2, unit: "px/s" },
    { key: "drift", label: "横向漂移", type: "range", min: 0, max: 140, step: 5, unit: "px" },
    { key: "size", label: "颗粒大小", type: "range", min: 0.8, max: 7, step: 0.2, unit: "px" },
    { key: "glow", label: "发光", type: "range", min: 0, max: 30, step: 1, unit: "px" },
    { key: "dim", label: "整体浓度", type: "range", min: 10, max: 100, step: 5, unit: "%" },
  ],
  Component: DustField,
};
