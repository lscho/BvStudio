import { useEffect, useState } from "react";

/** 素材时长缓存(秒):同一条视频只探一次 */
const cache = new Map<string, number>();

function readDurs(srcs: string[]): number[] {
  const man = (window as unknown as { __VID_FRAMES?: Record<string, { dur?: number }> })
    .__VID_FRAMES;
  return srcs.map((s) => (s ? man?.[s]?.dur || cache.get(s) || 0 : 0));
}

/**
 * 一组视频素材的时长(秒),拿不到先返回 0。
 * - 导出:直接读抽帧清单 __VID_FRAMES 里的 dur(ffprobe 量的,和预览同一个数)
 * - 预览:临时 <video> 只加载 metadata 探一次,存进缓存
 * 用途:多段接力的卡要按"素材自己有多长"分配每段的时间,而不是把卡片时长均分。
 */
export function useVideoDurs(srcs: string[]): number[] {
  const key = srcs.join("|");
  const [durs, setDurs] = useState(() => readDurs(srcs));

  useEffect(() => {
    setDurs(readDurs(srcs));
    const pending = srcs.filter((s) => s && !readDurs([s])[0]);
    if (!pending.length) return;
    let alive = true;
    for (const s of pending) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => {
        if (Number.isFinite(v.duration) && v.duration > 0) cache.set(s, v.duration);
        if (alive) setDurs(readDurs(srcs));
      };
      v.src = s;
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return durs;
}
