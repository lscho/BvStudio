// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const TEXT = contentText(content, "copy0", "MOTION SYSTEM");
const START = 12;
const RISE = 14;
const SETTLE = 6;
const OVERSHOOT = -10;
const FONT = 120;
const charY = (f: number, idx: number): number => {
  const t0 = START + idx * 2;
  if (f < t0 + RISE) {
    return interpolate(f, [t0, t0 + RISE], [115, OVERSHOOT], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  }
  return interpolate(f, [t0 + RISE, t0 + RISE + SETTLE], [OVERSHOOT, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
};
const SplitTextStagger: React.FC = () => {
  const frame = useCurrentFrame();
  const chars = TEXT.split('');
  // 基线：首字起跳同帧开始，从左向右生长到 100%
  const lineW = interpolate(frame, [START, START + 26], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy1", "SPLIT TEXT STAGGER")} size={54} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex' }}>
          {chars.map((c, i) => (
            <div
              key={i}
              style={{
                // 遮罩盒：上方留 0.3em 头部空间容纳过冲，底边即裁切线
                overflow: 'hidden',
                height: FONT * 1.35,
                display: 'flex',
                alignItems: 'flex-end',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 800,
                  fontSize: FONT,
                  lineHeight: 1.05,
                  color: G.ink,
                  letterSpacing: 2,
                  transform: `translateY(${charY(frame, i)}%)`,
                }}
              >
                {c === ' ' ? ' ' : c}
              </span>
            </div>
          ))}
        </div>
        {/* 基线细线：宽度从 0 生长到全文宽 */}
        <div style={{ width: 920, marginTop: 10, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ height: 2, width: `${lineW}%`, background: G.bar }} />
        </div>
      </div>
    </div>
  );
};
return SplitTextStagger;
}
