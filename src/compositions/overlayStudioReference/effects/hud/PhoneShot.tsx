import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { FxVideo, MediaImg } from "./MediaImg";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface PhoneShotParams {
  theme: "dark" | "light";
  position: "left" | "right";
  /** 分类标签,如 "评论区" "私信 · 女装电商"(空 = 不显示) */
  tag: string;
  img1: string;
  img2: string;
  img3: string;
  /** 视频(填了就播视频,忽略图片;导出逐帧 seek) */
  videoSrc: string;
  /** 多图翻页间隔 */
  stepMs: number;
  /** 手机壳外发光 */
  glow: boolean;
  accent: string;
  offsetX?: number;
  offsetY?: number;
  __start?: number;
  __t?: number;
}

/**
 * 手机壳证据卡:截图/视频装进手机壳,外发光 + 左上分类标签。
 * 引用评论、私信、聊天记录、自己往期视频的标准容器;
 * 多图会按 stepMs 自动翻页(循环),讲一个案例故事就靠它。
 */
function PhoneShot({ params, playToken }: EffectProps<PhoneShotParams>) {
  const { position, tag, img1, img2, img3, videoSrc, stepMs, glow, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const imgs = [img1, img2, img3].filter(Boolean);
  const idx = imgs.length > 1 ? Math.floor((elapsed * 1000) / Math.max(stepMs, 400)) % imgs.length : 0;
  // 翻页入场:idx 变化时下一帧翻类名,触发过渡(替代一次性关键帧动画)
  const imgIn = useEnter(idx);

  return (
    <div
      className={`hud phs hud-anchor hud-anchor--${position} ${glow ? "has-glow" : ""} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="phs-body">
        {tag && <span className="phs-tag">{tag}</span>}
        <div className="phs-frame">
          <i className="phs-island" />
          <div className="phs-screen">
            {videoSrc ? (
              <FxVideo src={videoSrc} tStart={params.__start ?? 0} />
            ) : imgs.length ? (
              <MediaImg key={idx} src={imgs[idx]} className={`phs-img ${imgIn ? "is-in" : ""}`} tStart={params.__start ?? 0} />
            ) : (
              <div className="phs-empty">手机内容</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const phoneShotDef: EffectDef<PhoneShotParams> = {
  id: "phone-shot",
  vTier: "half",
  name: "PhoneShot",
  description: "手机壳证据 · 评论/私信/聊天装进手机,多图翻页",
  tags: ["翻转轮换"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "right",
    tag: "评论区 · 真实提问",
    img1: "",
    img2: "",
    img3: "",
    videoSrc: "",
    stepMs: 3500,
    glow: true,
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
      ],
    },
    { key: "tag", label: "分类标签(空 = 不显示)", type: "text" },
    { key: "img1", label: "截图 1", type: "text" },
    { key: "img2", label: "截图 2(可空,多图自动翻页)", type: "text" },
    { key: "img3", label: "截图 3(可空)", type: "text" },
    { key: "videoSrc", label: "视频(填了就播视频)", type: "text" },
    { key: "stepMs", label: "翻页间隔(卡点用)", type: "range", min: 1000, max: 8000, step: 100, unit: "ms" },
    { key: "glow", label: "手机外发光", type: "toggle" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: PhoneShot,
};
