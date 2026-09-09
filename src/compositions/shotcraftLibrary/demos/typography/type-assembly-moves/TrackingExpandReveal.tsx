// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const WORD = contentText(content, "copy0", "BREATHE");
const FS = 150;
const GAP_DELTA = -0.56 * FS;
const TrackingExpandReveal: React.FC = () => {
  const frame = useCurrentFrame();
  // 展开进度 0→1（0–50f，out poly(5)）
  const p = interpolate(frame, [0, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.poly(5)),
  });
  const blur = 10 * (1 - p);
  const op = interpolate(p, [0, 1], [0.6, 1]);
  const sx = interpolate(p, [0, 1], [0.92, 1]);
  // 副标题：主词时间轴走到 70%（帧 35）起淡入
  const subOp = interpolate(frame, [35, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const N = WORD.length;
  const center = (N - 1) / 2;
  const settled = frame >= 50; // 展开完成后摘掉一切滤镜/变换，保证逐帧完全相同

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy1", "TRACKING EXPAND REVEAL")} size={54} />
      </div>

      {/* 主词：容器 letterSpacing 恒为 0.14em（终态），字符仅做 translateX */}
      <div
        style={{
          position: 'absolute',
          top: 430,
          left: 0,
          width: 1920,
          display: 'flex',
          justifyContent: 'center',
          transform: settled ? undefined : `scaleX(${sx})`,
          filter: settled ? undefined : `blur(${blur}px)`,
          opacity: settled ? 1 : op,
        }}
      >
        <div
          style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 800,
            fontSize: FS,
            color: G.ink,
            letterSpacing: '0.14em',
            whiteSpace: 'pre',
            // letter-spacing 只加在字后，整体左移半个缝宽找回视觉对中
            marginLeft: 0.14 * FS * 0.5,
          }}
        >
          {WORD.split('').map((ch, i) => {
            const tx = (1 - p) * (i - center) * GAP_DELTA;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  transform: settled ? undefined : `translateX(${tx}px)`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </div>

      {/* 副标题：主词展开 70% 时点淡入 */}
      <div
        style={{
          position: 'absolute',
          top: 630,
          left: 0,
          width: 1920,
          textAlign: 'center',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 500,
          fontSize: 34,
          color: G.mid,
          letterSpacing: '0.32em',
          opacity: frame >= 58 ? 1 : subOp,
        }}
      >
        {contentText(content, "copy2", "A CINEMATIC TITLE ENTRANCE")}</div>
    </div>
  );
};
return TrackingExpandReveal;
}
