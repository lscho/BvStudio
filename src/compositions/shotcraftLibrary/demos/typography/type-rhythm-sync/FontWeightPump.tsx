// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const BEATS = [30, 50, 70, 90, 110];
const ACCENTS = new Set([2, 4]);
const DECAY = 10;
const envAt = (frame: number, beat: number) => {
  const t = frame - beat;
  if (t < 0 || t >= DECAY) return 0;
  return Math.pow(1 - t / DECAY, 0.8);
};
const FontWeightPump: React.FC = () => {
  const frame = useCurrentFrame();

  // 只可能有一个活跃拍（拍距 20f > 衰减 10f），取最大包络及其拍序号
  let env = 0;
  let activeBeat = -1;
  BEATS.forEach((b, i) => {
    const e = envAt(frame, b);
    if (e > env) {
      env = e;
      activeBeat = i;
    }
  });

  const strokeW = 10 * env; // 笔画粗细连续衰减
  const weight = env > 0.15 ? 900 : 400; // 命中窗口离散跳字重
  const accent = activeBeat >= 0 && ACCENTS.has(activeBeat);
  const scaleX = accent ? 1 + 0.08 * env : 1; // 重音拍变宽一挡

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Helvetica, Arial, sans-serif',
      }}
    >
      {/* 定宽居中容器，transform 缩放不改排版 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 150,
            fontWeight: weight,
            color: G.ink,
            letterSpacing: 6,
            whiteSpace: 'nowrap',
            WebkitTextStroke: `${strokeW}px ${G.ink}`,
            transform: `scaleX(${scaleX})`,
            transformOrigin: 'center center',
          }}
        >
          {contentText(content, "copy0", "PUMP IT UP")}</div>
      </div>

      {/* 底部节拍点：5 个，命中哪拍哪个点闪 ink 并放大 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 130,
          width: 1920,
          display: 'flex',
          justifyContent: 'center',
          gap: 56,
        }}
      >
        {BEATS.map((b, i) => {
          const e = envAt(frame, b);
          const dotOpacity = e > 0.02 ? Math.min(1, 0.3 + e * 1.2) : 0;
          const dotScale = 1 + 0.8 * e;
          return (
            <div
              key={i}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                background: G.line,
                position: 'relative',
                transform: `scale(${dotScale})`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 13,
                  background: G.ink,
                  opacity: dotOpacity,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
return FontWeightPump;
}
