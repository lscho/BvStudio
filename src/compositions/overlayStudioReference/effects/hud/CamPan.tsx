import type { EffectDef, EffectProps } from "../types";
import { easeOutExpo, useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { FxVideo } from "./MediaImg";
import { THEME_OPTIONS } from "./accent";

export interface CamPanParams {
  theme: "dark" | "light";
  videoSrc: string;
  /** 运镜方式:推近 / 拉远 / 左漂 / 右漂 / 斜切环绕 */
  motion: "in" | "out" | "drift-l" | "drift-r" | "tilt";
  /** 目标放大倍数(运镜幅度) */
  zoom: number;
  /** 一段运镜走完的时长(秒) */
  moveSec: number;
  /** 退场淡出时长(秒):全屏卡硬切消失会"闪一下",留一点溶解更自然 */
  fadeOut?: number;
  /** 时间轴导出时由 renderCard 注入:卡片 start(秒),录屏从此刻起算 */
  __start?: number;
}

/** 导出模式下视频不自动播,由导出脚本逐帧 seek */
const IS_EXPORT =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("export") === "1";

function CamPan({ params, playToken }: EffectProps<CamPanParams>) {
  const { videoSrc, motion, zoom, moveSec } = params;
  const entered = useEnter(playToken);
  // 临近 end 时整卡淡出:全屏运镜卡一帧切没会很"闪",给它一点溶解
  const elapsed = useCardElapsed(params as { __t?: number; __start?: number }, playToken);
  const pAny = params as unknown as { __start?: number; __end?: number };
  const dur = typeof pAny.__end === "number" ? pAny.__end - (pAny.__start ?? 0) : null;
  const fo = params.fadeOut ?? 0.4;
  const outK = dur != null && fo > 0 ? easeOutExpo(Math.max(0, Math.min(1, (dur - elapsed) / fo))) : 1;

  return (
    <div
      className={`hud cpn ${entered ? "is-in" : ""}`}
      data-motion={motion}
      style={{
        ["--cp-z" as string]: zoom,
        ["--cp-sec" as string]: `${moveSec}s`,
        ...(outK < 1 ? { opacity: outK } : {}),
      }}
    >
      <div className="cpn-move">
        {videoSrc ? (
          <FxVideo src={videoSrc} tStart={params.__start ?? 0} />
        ) : (
          <div className="sd-empty">
            <div className="sd-empty-bars">
              <span /><span /><span />
            </div>
            {!IS_EXPORT && (
              <div className="sd-empty-hint">录屏素材</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const camPanDef: EffectDef<CamPanParams> = {
  id: "cam-pan",
  name: "CamPan",
  description: "全屏录屏运镜 · 慢推近/漂移/斜切环绕",
  tags: ["推近定格"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    videoSrc: "",
    motion: "in",
    zoom: 1.18,
    moveSec: 8,
    fadeOut: 0.4,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "videoSrc", label: "录屏路径(/demo/xxx.mp4)", type: "text" },
    {
      key: "motion",
      label: "运镜方式",
      type: "select",
      options: [
        { label: "推近", value: "in" },
        { label: "拉远", value: "out" },
        { label: "左漂", value: "drift-l" },
        { label: "右漂", value: "drift-r" },
        { label: "斜切环绕", value: "tilt" },
      ],
    },
    { key: "zoom", label: "运镜幅度(放大倍数)", type: "range", min: 1.05, max: 1.6, step: 0.01, unit: "×" },
    { key: "fadeOut", label: "退场淡出(0=硬切)", type: "range", min: 0, max: 1.5, step: 0.05, unit: "s" },
    { key: "moveSec", label: "运镜时长", type: "range", min: 2, max: 20, step: 0.5, unit: "s" },
  ],
  Component: CamPan,
};
