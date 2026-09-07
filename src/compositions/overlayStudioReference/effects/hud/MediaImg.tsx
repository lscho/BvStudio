import { useContext, useLayoutEffect, useRef, type CSSProperties } from "react";
import { alignReferenceVideo } from "@/compositions/overlayStudioReference/videoFrames";
import { imgRetry } from "./imgRetry";
import { FxTimelineMsContext } from "../useAnimation";

export const isVideoSrc = (src: string) => /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(src) || src.endsWith("#bvideo-video");
export const isMediaPlaceholderSrc = (src: string) => src.endsWith("#bvideo-placeholder");
export const isMediaUrl = (src: string) => src.includes("/") || src.includes(".") || /^(?:blob:|data:image|asset:)/iu.test(src);

/**
 * 卡内视频通用槽。参考库单卡预览时自行播放；BVideo 注入时间轴后暂停媒体，
 * 按播放头对齐裁剪、倍速和循环位置。导出截图前会等待目标帧解码完成。
 */
export function FxVideo({
  src,
  className,
  tStart,
  clipStart,
  loop,
  rate,
  style,
}: {
  src: string;
  className?: string;
  tStart?: number;
  /** 从素材的第几秒开始播(同一条视频切出不同片段时用) */
  clipStart?: number;
  loop?: boolean;
  /** 播放倍速:1.5 / 2 …(长录屏塞进短窗口用);导出侧按倍速换算帧号 */
  rate?: number;
  style?: CSSProperties;
}) {
  const clip = clipStart && clipStart > 0 ? clipStart : 0;
  const spd = rate && rate > 0 ? rate : 1;
  const timelineMs = useContext(FxTimelineMsContext);
  const ref = useRef<HTMLVideoElement>(null);
  useLayoutEffect(() => {
    if (timelineMs === null) return;
    const video = ref.current;
    if (!video) return;
    const align = () => alignReferenceVideo(video, timelineMs / 1_000);
    align();
    video.addEventListener("loadedmetadata", align);
    return () => video.removeEventListener("loadedmetadata", align);
  }, [clip, loop, spd, tStart, timelineMs]);
  return (
    <video
      ref={ref}
      className={className}
      data-fx-video
      data-t-start={tStart ?? 0}
      /* 拖播放头后要把卡内录屏拉回正确位置,得知道素材起播秒和倍速(见 App.tsx alignCardVideos) */
      data-fx-clip={clip}
      data-fx-rate={spd}
      {...(loop ? { "data-fx-loop": "1" } : {})}
      src={src}
      muted
      playsInline
      preload="auto"
      autoPlay={timelineMs === null}
      loop={loop}
      style={style}
      /* 刚上传完的文件偶发第一次请求落空:自动重试加载几次 */
      /* 片段偏移:预览里加载完直接跳到 clip 秒;循环回 0 时再跳回去 */
      onLoadedMetadata={(e) => {
        e.currentTarget.playbackRate = spd;
        if (clip) e.currentTarget.currentTime = clip;
      }}
      onCanPlay={(e) => { e.currentTarget.playbackRate = spd; }}
      onTimeUpdate={
        clip
          ? (e) => {
              const v = e.currentTarget;
              if (v.currentTime < clip - 0.05) v.currentTime = clip;
            }
          : undefined
      }
      onError={(e) => {
        const v = e.currentTarget;
        const n = Number(v.dataset.retry || 0);
        if (n < 3) {
          v.dataset.retry = String(n + 1);
          setTimeout(() => v.load(), 400);
        }
      }}
    />
  );
}

/**
 * 图/视频通用媒体槽:同一个参数位,填图片路径出图,填视频路径出会动的小窗
 * (参考片心得:证据素材本身要是活的)。
 * 视频预览时静音循环;导出时由 __seekVideos 按时间轴对位,data-fx-loop 表示循环短素材。
 */
export function MediaImg({
  src,
  className,
  tStart,
}: {
  src: string;
  className?: string;
  /** 时间轴导出用:所在卡片的 start(秒),循环素材按 (t-start)%时长 对位 */
  tStart?: number;
}) {
  if (isVideoSrc(src)) {
    return <FxVideo src={src} className={className} tStart={tStart} loop />;
  }
  return <img className={className} src={src} alt="" onError={imgRetry(src)} />;
}
