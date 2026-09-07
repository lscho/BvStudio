import { useEffect, useRef } from "react";
import type { EffectDef, EffectProps } from "../types";
import { useElapsed } from "../useAnimation";
import { useStageSize } from "../../stage";
import { THEME_OPTIONS } from "./accent";

export interface LetterGlitchParams {
  theme: "dark" | "light";
  flipMs: number; // 每次翻动间隔 ms(不能叫 speed:与全局「动画速度」控件撞名会变 N 倍速)
  density: number; // 每次翻动的格子比例(%)
  dim: number; // 整体不透明度(%)
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>[]{}#$%&*+=/\\";
const CELL = 30;
const FONT = 22;

/** 确定性伪随机(cell, tick 决定,导出稳定) */
function prand(a: number, b: number) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** React Bits「Letter Glitch」风格:字母矩阵翻动 · B-roll 全屏背景层 */
function LetterGlitch({ params, playToken }: EffectProps<LetterGlitchParams>) {
  const { theme, flipMs, density, dim } = params;
  const { w: W, h: H } = useStageSize();
  const elapsed = useElapsed(playToken, 600000);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tick = Math.floor(elapsed / Math.max(60, flipMs));

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    if (cv.width !== W) {
      cv.width = W;
      cv.height = H;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.font = `600 ${FONT}px "SF Mono", Menlo, monospace`;

    const cols = Math.ceil(W / CELL);
    const rows = Math.ceil(H / CELL);
    // 三色家族(按主题取值),大部分格子暗、少量亮
    const palette =
      theme === "light"
        ? ["rgba(26,37,64,0.16)", "rgba(30,99,216,0.34)", "rgba(224,50,111,0.30)", "rgba(10,149,166,0.30)"]
        : ["rgba(255,255,255,0.07)", "rgba(95,160,250,0.30)", "rgba(248,123,172,0.26)", "rgba(69,198,207,0.26)"]
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 每个格子有自己的"翻动节拍",按 density 决定这一拍换不换字
        const cellSeed = r * 131 + c * 7;
        const flip = prand(cellSeed, tick) * 100 < density ? tick : Math.floor(tick / 4);
        const g = GLYPHS[Math.floor(prand(cellSeed + 1, flip) * GLYPHS.length)];
        const colorRnd = prand(cellSeed + 2, flip);
        const color =
          colorRnd > 0.965 ? palette[1] : colorRnd > 0.93 ? palette[2] : colorRnd > 0.9 ? palette[3] : palette[0];
        ctx.fillStyle = color;
        ctx.fillText(g, c * CELL + 4, r * CELL + FONT);
      }
    }
  }, [tick, theme, density, W, H]);

  return (
    <div className="hud lg-wrap" style={{ opacity: dim / 100 }}>
      <canvas ref={canvasRef} className="lg-canvas" />
    </div>
  );
}

export const letterGlitchDef: EffectDef<LetterGlitchParams> = {
  id: "letter-glitch",
  name: "LetterGlitch",
  description: "字母矩阵 · B-roll 全屏科技背景",
  tags: ["故障噪点"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    flipMs: 160,
    density: 12,
    dim: 70,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "flipMs", label: "翻动速度", type: "range", min: 60, max: 600, step: 20, unit: "ms" },
    { key: "density", label: "翻动密度", type: "range", min: 2, max: 60, step: 2, unit: "%" },
    { key: "dim", label: "整体透明度", type: "range", min: 10, max: 100, step: 5, unit: "%" },
  ],
  Component: LetterGlitch,
};
