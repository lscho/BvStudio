import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { FxVideo } from "./MediaImg";
import { ACCENT_OPTIONS, ACCENT_VAR, THEME_OPTIONS } from "./accent";

export interface DemoTourParams {
  theme: "dark" | "light";
  videoSrc: string;
  /** 录屏播放倍速:长录屏塞进短窗口时用(1.5 / 2 / 3 …) */
  vidRate?: number;
  /** 静态截图(填了就用图,不放视频)——巡览全靠镜头动,截图也能"活" */
  imgSrc: string;
  /** 巡览路线:每行一站「横偏%,纵偏%,放大」,0,0 = 画面中心;站与站之间镜头缓滑过去 */
  stops: string;
  /** 走完整条路线的时长(秒) */
  tourSec: number;
  /** 浮屏 3D 倾斜幅度(度);镜头移动时倾角会跟着焦点微变,像手持飞行 */
  tilt: number;
  /** 口播视频(H264):左下圆形头像窗;留空导出时用全局口播 */
  camSrc?: string;
  /** 运镜焦点整体微调(%):推近各站的焦点一起平移,全景站不动 */
  panX: number;
  panY: number;
  accent: string;
  /** 时间轴导出时由 renderCard 注入:卡片 start(秒),录屏从此刻起算 */
  __start?: number;
}

/** 导出模式下视频不自动播,由导出脚本逐帧 seek */
const IS_EXPORT =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("export") === "1";

interface TourStop {
  x: number;
  y: number;
  z: number;
}

/** 解析巡览路线;非法行忽略,空路线退化为"原地全景" */
function parseStops(raw: string): TourStop[] {
  const stops = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [x, y, z] = l.split(/[,，\s]+/).map(Number);
      return { x: x || 0, y: y || 0, z: z && z > 0 ? z : 1 };
    });
  return stops.length ? stops : [{ x: 0, y: 0, z: 1 }];
}

/** 一站的镜头姿态:先倾斜(rotate)再推近(scale),最后把焦点平移回画面中心 */
function stopTransform(s: TourStop, tilt: number): string {
  const rx = (tilt * 0.42 + s.y * 0.06).toFixed(2);
  const ry = (-tilt * 0.8 - s.x * 0.08).toFixed(2);
  return `translate(${(-s.x * s.z).toFixed(2)}%, ${(-s.y * s.z).toFixed(2)}%) scale(${s.z}) rotateX(${rx}deg) rotateY(${ry}deg)`;
}

/** cubic-bezier(0.55, 0, 0.16, 1) 求值:牛顿迭代解出 t,再取 y */
function ease(x: number): number {
  const p1 = 0.55, p2 = 0.16;
  const cx = 3 * p1, bx = 3 * (p2 - p1) - cx, ax = 1 - cx - bx;
  const cy = 0, by = 3 * (1 - 0) - 0, ay = 1 - by;
  const fx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dfx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const d = fx(t) - x;
    const s = dfx(t);
    if (Math.abs(d) < 1e-5 || Math.abs(s) < 1e-6) break;
    t -= d / s;
  }
  t = Math.max(0, Math.min(1, t));
  return ((ay * t + by) * t + cy) * t;
}

/**
 * 巡览到第几站、走到哪了 —— **按时间轴时间算,不用 CSS 动画**。
 *
 * 为什么不用 @keyframes:CSS 动画是从"卡片挂载那一刻"开始跑的,和时间轴位置无关。
 * 预览里一拖播放头,卡片重新挂载,巡览就从头开始;导出是按虚拟时间逐帧推进的,
 * 同一秒拿到的是真实的巡览位置 —— 于是**预览和导出对不上**
 * (实测:拖到卡内 4.6s / 8.0s,预览的 scale 都是 1.0 = 刚起步,
 *  导出同一时刻已经推到别处了)。改成每帧现算,预览拖到哪都和导出一致。
 *
 * 节奏和原来的 keyframes 一致:每段前 35% 停留讲解,后 65% 缓滑到下一站。
 */
function tourTransform(stops: TourStop[], tourSec: number, elapsed: number, tilt: number): string {
  if (stops.length < 2) return stopTransform(stops[0], tilt);
  const n = stops.length - 1;
  const seg = Math.max(tourSec, 0.1) / n;
  const k = Math.min(n - 1, Math.max(0, Math.floor(elapsed / seg)));
  const local = Math.max(0, Math.min(1, (elapsed - k * seg) / seg));
  const p = local <= 0.35 ? 0 : ease((local - 0.35) / 0.65);
  const a = stops[k], b = stops[k + 1];
  return stopTransform(
    { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z: a.z + (b.z - a.z) * p },
    tilt,
  );
}

function DemoTour({ params, playToken }: EffectProps<DemoTourParams>) {
  const { videoSrc, imgSrc, stops, tourSec, tilt, camSrc, panX, panY, accent, vidRate } = params;
  const entered = useEnter(playToken);
  // 焦点微调:自动路线没推到想展示的区域时,把推近各站整体平移过去(全景站不动)
  const elapsed = useCardElapsed(params, playToken);
  const route = parseStops(stops).map((s) =>
    s.z > 1.05 ? { ...s, x: s.x + (panX || 0), y: s.y + (panY || 0) } : s,
  );

  return (
    <div
      className={`hud dtr ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent] }}
    >
      <div className="dtr-bg" />
      <div className="dtr-stage">
        <div
          className="dtr-plane"
          style={{ transform: tourTransform(route, tourSec, elapsed, tilt) }}
        >
          <div className="dtr-frame">
            {imgSrc ? (
              <img src={imgSrc} alt="" />
            ) : videoSrc ? (
              <FxVideo src={videoSrc} tStart={params.__start ?? 0} rate={Number(vidRate) || 1} />
            ) : (
              <div className="sd-empty">
                <div className="sd-empty-bars">
                  <span />
                  <span />
                  <span />
                </div>
                {!IS_EXPORT && (
                  <div className="sd-empty-hint">巡览素材</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 口播圆窗:tStart 必须是 0 —— 口播是跟着整条时间轴走的,填卡片 start 会让
          它在这张卡出现时从视频 0:00 重新开始,画面和声音就对不上了(和
          screen-demo / focus-card 保持一致)。
          预览不在这里画:交给 PIP 直接搬舞台上那条真口播,所见即所得;
          这里只留一个圆环当落位框。 */}
      {camSrc && <FxVideo className="dtr-cam" src={camSrc} tStart={0} />}
    </div>
  );
}

export const demoTourDef: EffectDef<DemoTourParams> = {
  id: "demo-tour",
  name: "DemoTour",
  description: "demo 巡览运镜 · 黑底浮屏 3D 倾斜,镜头逐站推近讲解焦点",
  tags: ["3D 浮屏", "推近定格"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    videoSrc: "",
    vidRate: 1,
    imgSrc: "",
    stops: "0,0,1\n-16,-6,1.55\n4,8,1.9\n15,-2,2.15",
    tourSec: 9,
    tilt: 7,
    camSrc: "",
    panX: 0,
    panY: 0,
    accent: "blue",
  },
  controls: [
    {
      key: "vidRate",
      label: "录屏播放倍速",
      type: "select",
      options: [
        { label: "1× 原速", value: "1" },
        { label: "1.25×", value: "1.25" },
        { label: "1.5×", value: "1.5" },
        { label: "2×", value: "2" },
        { label: "3×", value: "3" },
        { label: "4×", value: "4" },
      ],
    },
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "videoSrc", label: "录屏路径(/demo/xxx.mp4)", type: "text" },
    { key: "imgSrc", label: "截图路径(填了优先用图)", type: "text" },
    {
      key: "stops",
      label: "巡览路线(每行:横偏%,纵偏%,放大)",
      type: "textarea",
      rows: 5,
    },
    { key: "tourSec", label: "巡览总时长", type: "range", min: 3, max: 24, step: 0.5, unit: "s" },
    { key: "tilt", label: "3D 倾斜幅度", type: "range", min: 0, max: 14, step: 0.5, unit: "°" },
    { key: "panX", label: "焦点横移(推近各站整体)", type: "range", min: -40, max: 40, step: 1, unit: "%" },
    { key: "panY", label: "焦点纵移(推近各站整体)", type: "range", min: -40, max: 40, step: 1, unit: "%" },
    { key: "camSrc", label: "口播圆窗(留空导出用全局口播)", type: "text" },
    { key: "accent", label: "强调色(圆窗描边)", type: "select", options: ACCENT_OPTIONS },
  ],
  Component: DemoTour,
};
