// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const HOLD = 25;
const MOVE = 43;
const TiltReveal: React.FC = () => {
  const f = useCurrentFrame();

  const rotX = interpolate(
    f,
    [HOLD, HOLD + MOVE, HOLD + MOVE + 4, HOLD + MOVE + 8],
    [-80, 2.6, -0.9, 0],
    { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const p = interpolate(f, [HOLD, HOLD + MOVE], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(p, [0, 1], [3.2, 1]);
  const ty = interpolate(p, [0, 1], [200, 0]);
  const persp = interpolate(p, [0, 1], [600, 1200]);
  const perspY = interpolate(p, [0, 1], [5, 40]);

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: persp,
          perspectiveOrigin: `50% ${perspY}%`,
        }}
      >
        <div
          style={{
            width: 1920,
            height: 1080,
            transformOrigin: '50% 0%', // 画面上缘
            transform: `translateY(${ty}px) scale(${scale}) rotateX(${rotX}deg)`,
          }}
        >
          <FakeDashboard variant="A" />
        </div>
      </div>
    </AbsoluteFill>
  );
};
return TiltReveal;
}
