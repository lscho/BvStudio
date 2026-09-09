// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const STRIPS = 16;
const H = 1080;
const STRIP_H = H / STRIPS;
const AMP = 70;
const h = (n: number) => {
  const s = Math.sin(n * 127.3) * 43758.5453;
  return s - Math.floor(s);
};
const GlitchDisplace: React.FC = () => {
  const frame = useCurrentFrame();

  const tearing = frame >= 45 && frame < 62;
  const variant: 'A' | 'B' = frame >= 58 ? 'B' : 'A';

  if (!tearing) {
    // 45f 前 A 静置；62f 起 B 摘罩真静止（无 transform / filter / 重影）
    return (
      <AbsoluteFill style={{ background: G.bg }}>
        <FakeDashboard variant={variant} />
      </AbsoluteFill>
    );
  }

  // 幅度包络：45–48f out-cubic 冲起 → 平台 → 56–62f 线性消散（帧驱动，确定性）
  const rise = interpolate(frame, [45, 48], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const decay = interpolate(frame, [56, 62], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const env = Math.min(rise, decay);

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      {/* 底垫一份完整页，防条带间横移露底色缝 */}
      <AbsoluteFill>
        <FakeDashboard variant={variant} />
      </AbsoluteFill>

      {/* 明暗错位重影（灰阶版 RGB 分离）：+12px 压暗 / -12px 反相提亮 */}
      <AbsoluteFill
        style={{
          transform: 'translateX(12px)',
          opacity: 0.35 * env,
          filter: 'brightness(0.45)',
        }}
      >
        <FakeDashboard variant={variant} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: 'translateX(-12px)',
          opacity: 0.28 * env,
          filter: 'invert(1)',
        }}
      >
        <FakeDashboard variant={variant} />
      </AbsoluteFill>

      {/* 16 条水平条带：外层裁切，内层整页反向 translateY 对位 + 逐帧横向抖动 */}
      {Array.from({ length: STRIPS }).map((_, i) => {
        const dx = (h(i * 31 + frame * 7) * 2 - 1) * AMP * env;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: i * STRIP_H,
              left: 0,
              width: 1920,
              height: STRIP_H,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 1920,
                height: H,
                transform: `translate(${dx.toFixed(2)}px, ${-i * STRIP_H}px)`,
              }}
            >
              <FakeDashboard variant={variant} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
return GlitchDisplace;
}
