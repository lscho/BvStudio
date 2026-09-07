import type { EffectDef, EffectProps } from "../types";
import { easeOutExpo, useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { FxVideo } from "./MediaImg";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";
import { useStageRatio, useStageSize } from "../../stage";

export interface ScreenDemoParams {
  theme: "dark" | "light";
  corner: "br" | "bl";
  /** 演示窗方向:横屏大窗(默认)/ 竖屏窄窗(竖版录屏铺满不留黑边) */
  orient?: "landscape" | "portrait";
  /**
   * 演示窗比例:auto = 跟着「演示窗方向」走老布局(默认,老编排行为不变);
   * 选了具体比例就按它算窗口几何,窗宽由 winSize 决定、水平居中。
   */
  winRatio?: "auto" | "16:9" | "9:16" | "4:3" | "1:1";
  /** 演示窗大小:占画布的百分比(横向比例吃宽度,竖向比例吃高度) */
  winSize?: number;
  title: string;
  videoSrc: string;
  /** 口播视频(H264):填了就把"满屏缩角"运镜直接烤进导出,成片不用再对位 */
  camSrc?: string;
  /** 全屏纯色底:盖住底下的原片,不留"口播影子"(none = 旧行为,透出原片) */
  bg?: "mist" | "cream" | "dark" | "none";
  accent: string;
  showRing: boolean;
  /** 分段变焦:一行「起秒|焦点X%|焦点Y%|倍率|过渡秒」 */
  zooms?: string;
  offsetX?: number;
  offsetY?: number;
  /** 时间轴导出时由 renderCard 注入:卡片 start(秒),录屏从此刻起算 */
  __start?: number;
}

/** 导出模式下视频不自动播,由导出脚本逐帧 seek */
const IS_EXPORT =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("export") === "1";


/** 分段变焦:一行一段「起秒|焦点X%|焦点Y%|倍率|过渡秒」,顺序生效 */
function zoomState(zooms: string | undefined, elapsed: number, ease: (t: number) => number) {
  let zx = 50, zy = 50, zk = 1;
  for (const line of (zooms ?? "").split(/[\n;]/)) {
    const seg = line.trim();
    if (!seg) continue;
    const [t, x, y, k, d] = seg.split("|").map((s) => parseFloat(s.trim()));
    if (!Number.isFinite(t) || elapsed < t) continue;
    const f = ease(Math.max(0, Math.min(1, (elapsed - t) / Math.max(0.1, d || 0.7))));
    zx += ((Number.isFinite(x) ? x : 50) - zx) * f;
    zy += ((Number.isFinite(y) ? y : 50) - zy) * f;
    zk += ((Number.isFinite(k) ? k : 1) - zk) * f;
  }
  return { zx, zy, zk };
}

function ScreenDemo({ params, playToken }: EffectProps<ScreenDemoParams>) {
  const { corner, orient, title, videoSrc, camSrc, bg, accent, showRing, winRatio, winSize } =
    params;
  const { w: SW, h: SH } = useStageSize();
  const V = useStageRatio() === "v";
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params as unknown as { __t?: number; __start?: number }, playToken);
  const zm = zoomState(params.zooms, elapsed, easeOutExpo);

  // 演示窗几何:选了具体比例就自己算(水平居中,竖版偏上、横版垂直居中),
  // 留 auto 就走老的 CSS 布局 —— 老编排一行不动
  const custom = !!winRatio && winRatio !== "auto";
  const winVars = custom
    ? (() => {
        const [aw, ah] = winRatio!.split(":").map(Number);
        const a = (aw || 16) / (ah || 9);
        const size = Math.max(40, Math.min(100, winSize ?? 82)) / 100;
        // 横向比例吃画布宽度,竖向比例吃高度 —— 这样滑杆推到 100% 不会溢出
        const w = a >= 1 ? Math.round(SW * size) : Math.round(SH * size * a);
        const h = a >= 1 ? Math.round((SW * size) / a) : Math.round(SH * size);
        return {
          ["--sdw-x" as string]: `${Math.round((SW - w) / 2)}px`,
          ["--sdw-y" as string]: `${V ? Math.round(SH * 0.1) : Math.round((SH - h) / 2)}px`,
          ["--sdw-w" as string]: `${w}px`,
          ["--sdw-h" as string]: `${h}px`,
        };
      })()
    : {};

  return (
    <div
      className={`hud sd ${entered ? "is-in" : ""}`}
      data-corner={corner}
      data-orient={orient ?? "landscape"}
      data-bg={bg ?? "mist"}
      data-win={custom ? "custom" : undefined}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...winVars, ...offsetVars(params) }}
    >
      {/* 全屏纯色底:独占全屏卡,盖住底下原片(口播画面只留在小窗里) */}
      <div className="sd-backdrop" />
      {/* 大演示窗:几乎满屏、3D 轻倾斜,等口播缩角后升起 */}
      <div className="sd-win">
        <div className="sd-bar">
          <span className="sd-dot r" />
          <span className="sd-dot y" />
          <span className="sd-dot g" />
          <span className="sd-title">{title}</span>
          <span className="sd-live">REC</span>
        </div>
        <div className="sd-screen">
          <div
            className="sd-zoom"
            style={{ transform: `scale(${zm.zk.toFixed(3)})`, transformOrigin: `${zm.zx.toFixed(1)}% ${zm.zy.toFixed(1)}%` }}
          >
          {videoSrc ? (
            <FxVideo src={videoSrc} tStart={params.__start ?? 0} />
          ) : (
            <div className="sd-empty">
              <div className="sd-empty-bars">
                <span /><span /><span />
              </div>
              {!IS_EXPORT && (
                <div className="sd-empty-hint">演示录屏</div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* 口播烤入导出:满屏起步 → 缩进角落,起点画面与底下原片相同,接管无痕。
          只在导出时渲染;预览里由 Canvas 的 PIP 实时演示同一运镜 */}
      {camSrc && <FxVideo className="sd-cam" src={camSrc} tStart={0} />}

      {/* 口播落位框:标出 3:4 小窗位置,成片时口播画面对齐这里(已烤入则不显示) */}
      {showRing && !camSrc && <div className="sd-ring" />}
    </div>
  );
}

export const screenDemoDef: EffectDef<ScreenDemoParams> = {
  id: "screen-demo",
  name: "ScreenDemo",
  description: "录屏演示运镜 · 口播缩角 + 大窗 3D 展示",
  tags: ["3D 浮屏", "取景重构"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    corner: "br",
    orient: "landscape",
    winRatio: "auto",
    winSize: 82,
    title: "你的软件画面 — 录屏演示",
    videoSrc: "",
    camSrc: "",
    bg: "dark",
    accent: "blue",
    showRing: true,
    zooms: "",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "bg",
      label: "全屏底(盖住原片,不留口播影子)",
      type: "select",
      options: [
        { label: "雾白", value: "mist" },
        { label: "米色", value: "cream" },
        { label: "暗色", value: "dark" },
        { label: "透明(透出原片)", value: "none" },
      ],
    },
    {
      key: "corner",
      label: "口播落角",
      type: "select",
      options: [
        { label: "右下", value: "br" },
        { label: "左下", value: "bl" },
      ],
    },
    {
      key: "orient",
      label: "演示窗方向(仅当下面「比例」= 跟着方向走时生效)",
      type: "select",
      options: [
        { label: "横屏大窗", value: "landscape" },
        { label: "竖屏窄窗(竖版录屏铺满)", value: "portrait" },
      ],
    },
    {
      key: "winRatio",
      label: "演示窗比例(选了具体比例就盖过上面的方向)",
      type: "select",
      options: [
        { label: "跟着方向走(默认)", value: "auto" },
        { label: "16:9 电脑录屏", value: "16:9" },
        { label: "9:16 手机录屏", value: "9:16" },
        { label: "4:3 窗口", value: "4:3" },
        { label: "1:1 方形", value: "1:1" },
      ],
    },
    { key: "winSize", label: "演示窗大小(比例≠自动时生效)", type: "range", min: 40, max: 100, step: 1, unit: "%" },
    { key: "title", label: "窗口标题", type: "text" },
    { key: "videoSrc", label: "录屏路径(/demo/xxx.mp4)", type: "text" },
    { key: "camSrc", label: "口播视频(烤进导出)", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    { key: "zooms", label: "分段变焦(一行:起秒|X%|Y%|倍率|过渡秒)", type: "textarea", rows: 2 },
    { key: "showRing", label: "显示口播落位框", type: "toggle" },
    ...OFFSET_CONTROLS,
  ],
  Component: ScreenDemo,
};
