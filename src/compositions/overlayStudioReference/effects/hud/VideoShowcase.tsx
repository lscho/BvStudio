import type { EffectDef, EffectProps } from "../types";
import { useCardElapsed } from "./useTimelineTime";
import { FxVideo, isVideoSrc } from "./MediaImg";
import { imgRetry } from "./imgRetry";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";
import { useStageRatio } from "../../stage";

export interface VideoShowcaseParams {
  theme: "dark" | "light";
  /** 一行一块:「路径 | 素材起始秒 | 标签」;2-3 块最稳,最多 6 块 */
  clips: string;
  /** 素材框比例:横屏 16:9 / 竖屏 9:16 / 方形 / 4:3 */
  frameRatio?: "16:9" | "9:16" | "1:1" | "4:3";
  /** 排法:auto = 横版横排、竖版竖排;也可强制横排/竖排/网格 */
  layout?: "auto" | "row" | "column" | "grid";
  offsetX?: number;
  offsetY?: number;
  /** 左上角标(EN 等宽) */
  kicker: string;
  /** 角标中文小字 */
  kickerZh: string;
  /** 第一块升起的时刻(秒,距卡片 start) */
  startAt: number;
  /** 两块之间的进场间隔(ms) */
  stepMs: number;
  /** 两块屏向内的 3D 倾斜(度,0 = 正对镜头) */
  tilt: number;
  /** 托稳后的上下呼吸幅度(px,0 = 不动) */
  float: number;
  /** 底部字幕安全区(%画面高):原片烧录字幕露出来 */
  safeBottom: number;
  /** 全屏底(盖住原片) */
  bg: "dark" | "none";
  accent: string;
}

interface Clip {
  src: string;
  clip: number;
  label: string;
}

function parseClips(raw: string): Clip[] {
  return (raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => {
      const [src = "", clip = "0", label = ""] = l.split("|").map((s) => s.trim());
      return { src, clip: parseFloat(clip) || 0, label };
    });
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * 双屏展台:两条(最多三条)往期视频并排、各自向内微微 3D 倾斜,
 * 像展台上的两台显示器同时在放,各带一条名字标签,托稳后缓缓呼吸。
 * 用途:开场自证"我这几期的动效都是这么做的"——观众直接看效果,不用听描述。
 * 独占全屏,勿与其他卡同屏;safeBottom 留出原片烧录字幕。
 */
function VideoShowcase({ params, playToken }: EffectProps<VideoShowcaseParams>) {
  const elapsed = useCardElapsed(params, playToken);
  const { kicker, kickerZh, startAt, stepMs, tilt, float, safeBottom, bg, accent } = params;
  const clips = parseClips(params.clips);
  const shown = clips.length ? clips : [{ src: "", clip: 0, label: "" }, { src: "", clip: 0, label: "" }];
  const safe = Math.max(0, Math.min(25, safeBottom));
  // 排法:auto 跟画幅走 —— 竖版并排会把每块挤成窄条,竖着叠才看得清
  const V = useStageRatio() === "v";
  const lay = !params.layout || params.layout === "auto" ? (V ? "column" : "row") : params.layout;
  const ar = (params.frameRatio ?? "16:9").replace(":", " / ");

  return (
    <div
      className="hud vsc"
      data-n={shown.length}
      data-layout={lay}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--vsc-safe" as string]: `${safe}%`,
        ["--vsc-ar" as string]: ar,
        ...offsetVars(params),
      }}
    >
      {bg !== "none" && (
        <div
          className="vsc-backdrop"
          style={{ opacity: clamp01((elapsed - startAt + 0.3) / 0.5) }}
        />
      )}

      <div className="vsc-row">
        {shown.map((c, i) => {
          const p = clamp01((elapsed - startAt - (i * stepMs) / 1000) / 0.7);
          const e = easeOut(p);
          // 两块向内倾:左块正角、右块负角;中间块不倾
          const dir = shown.length === 1 ? 0 : i === 0 ? 1 : i === shown.length - 1 ? -1 : 0;
          const bob = p >= 1 && float ? Math.sin((elapsed - startAt - i * 0.3) * 1.3) * float : 0;
          return (
            <div
              key={i}
              className="vsc-screen"
              style={{
                opacity: p,
                transform: `perspective(2200px) rotateY(${dir * tilt}deg) translateY(${(1 - e) * 70 + bob}px) scale(${0.9 + e * 0.1})`,
              }}
            >
              <div className="vsc-frame">
                {c.src ? (
                  isVideoSrc(c.src) ? (
                    <FxVideo
                      src={c.src}
                      tStart={params.__start ?? 0}
                      clipStart={c.clip}
                      loop
                    />
                  ) : (
                    <img src={c.src} alt="" onError={imgRetry(c.src)} />
                  )
                ) : (
                  <div className="vsc-empty">展台素材</div>
                )}
              </div>
              {c.label && <span className="vsc-label">{c.label}</span>}
            </div>
          );
        })}
      </div>

      {(kicker || kickerZh) && (
        <div
          className="vsc-kicker"
          style={{ opacity: clamp01((elapsed - startAt + 0.2) / 0.5) }}
        >
          {kicker && <b>{kicker}</b>}
          {kickerZh && <i>{kickerZh}</i>}
        </div>
      )}
    </div>
  );
}

export const videoShowcaseDef: EffectDef<VideoShowcaseParams> = {
  id: "video-showcase",
  name: "VideoShowcase",
  description: "双屏展台 · 两条往期视频并排微倾同时放",
  tags: ["3D 浮屏"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    clips: "",
    frameRatio: "16:9",
    layout: "auto",
    ...OFFSET_DEFAULTS,
    kicker: "",
    kickerZh: "",
    startAt: 0.2,
    stepMs: 260,
    tilt: 7,
    float: 6,
    safeBottom: 12,
    bg: "dark",
    accent: "blue",
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "clips", label: "素材(一行一块:路径|起始秒|标签,最多 6 块)", type: "textarea" },
    {
      key: "frameRatio",
      label: "素材框比例",
      type: "select",
      options: [
        { label: "16:9 横屏", value: "16:9" },
        { label: "9:16 竖屏", value: "9:16" },
        { label: "1:1 方形", value: "1:1" },
        { label: "4:3", value: "4:3" },
      ],
    },
    {
      key: "layout",
      label: "排法",
      type: "select",
      options: [
        { label: "跟画幅走(横版横排/竖版竖排)", value: "auto" },
        { label: "横排", value: "row" },
        { label: "竖排", value: "column" },
        { label: "网格", value: "grid" },
      ],
    },
    { key: "kicker", label: "左上角标(EN)", type: "text" },
    { key: "kickerZh", label: "角标中文小字", type: "text" },
    { key: "startAt", label: "升起时刻(s)", type: "range", min: 0, max: 10, step: 0.1, unit: "s" },
    { key: "stepMs", label: "两块进场间隔", type: "range", min: 0, max: 1200, step: 20, unit: "ms" },
    { key: "tilt", label: "向内倾斜(度)", type: "range", min: 0, max: 16, step: 1, unit: "°" },
    { key: "float", label: "呼吸幅度(px)", type: "range", min: 0, max: 16, step: 1, unit: "px" },
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
      label: "全屏底",
      type: "select",
      options: [
        { label: "暗底(盖住原片)", value: "dark" },
        { label: "透明(透出原片)", value: "none" },
      ],
    },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: VideoShowcase,
};
