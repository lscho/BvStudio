import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { isMediaPlaceholderSrc, MediaImg } from "./MediaImg";
import { OFFSET_CONTROLS, OFFSET_DEFAULTS, offsetVars, THEME_OPTIONS } from "./accent";
import { useCardElapsed } from "./useTimelineTime";

export interface GhostVideoParams {
  theme: "dark" | "light";
  /** 参考视频/录屏/网页截图路径(视频预览循环播,导出按时间轴对位) */
  src: string;
  side: "left" | "right";
  /** 距顶(px) */
  top: number;
  /** 宽度(px),高度按素材比例自适应 */
  w: number;
  /** 整体透明度:0.7-0.9 之间"在场但不压人脸" */
  opacity: number;
  /** 四边羽化宽度(px):0 = 硬边 */
  feather: number;
  /** 3D 倾斜(度):屏幕绕竖轴转,靠人一侧退远;0 = 正对镜头 */
  tilt: number;
  offsetX?: number;
  offsetY?: number;
  __start?: number;
}

/**
 * 幽灵参考视频:素材半透明浮在场景里,直接融进口播画面,
 * 无边框无底板,四边羽化 + 半透明,展示参考内容但不完全盖住背景和人。
 * 用途:引用别人的视频/网页/文档滚动录屏,比 proof-shot 更"氛围",
 * 适合"我看到了这个东西"而非"这是证据"的场景。
 */
function GhostVideo({ params, playToken }: EffectProps<GhostVideoParams>) {
  const { src, side, top, w, opacity, feather, tilt } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const driftY = Math.sin(elapsed * 0.9) * 8;

  return (
    <div
      className={`hud gsv gsv--${side} ${entered ? "is-in" : ""}`}
      style={{
        ["--gsv-top" as string]: `${top}px`,
        ["--gsv-w" as string]: `${w}px`,
        ["--gsv-op" as string]: opacity,
        ["--gsv-f" as string]: `${feather}px`,
        ["--gsv-rot" as string]: `${side === "right" ? -(tilt ?? 0) : (tilt ?? 0)}deg`,
        ["--gsv-drift-y" as string]: `${driftY.toFixed(2)}px`,
        ...offsetVars(params),
      }}
    >
      {src && !isMediaPlaceholderSrc(src) ? <MediaImg src={src} className="gsv-media" tStart={params.__start} /> : <div className="gsv-media gsv-placeholder" />}
    </div>
  );
}

export const ghostVideoDef: EffectDef<GhostVideoParams> = {
  id: "ghost-video",
  name: "GhostVideo",
  description: "幽灵参考视频 · 半透明+四边羽化融进画面,展示素材不压人脸",
  tags: ["玻璃虚化"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    src: "",
    side: "right",
    top: 110,
    w: 820,
    opacity: 0.82,
    feather: 90,
    tilt: 14,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "src", label: "素材路径(视频/图)", type: "text" },
    {
      key: "side",
      label: "落位",
      type: "select",
      options: [
        { label: "右侧", value: "right" },
        { label: "左侧", value: "left" },
      ],
    },
    { key: "top", label: "距顶", type: "range", min: 0, max: 600, step: 10, unit: "px" },
    { key: "w", label: "宽度", type: "range", min: 400, max: 1400, step: 20, unit: "px" },
    { key: "opacity", label: "透明度", type: "range", min: 0.4, max: 1, step: 0.02, unit: "" },
    { key: "feather", label: "边缘羽化", type: "range", min: 0, max: 200, step: 10, unit: "px" },
    { key: "tilt", label: "3D 倾斜", type: "range", min: 0, max: 30, step: 1, unit: "°" },
    ...OFFSET_CONTROLS,
  ],
  Component: GhostVideo,
};
