// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { CameraMotionBlur } from "@/compositions/shotcraftLibrary/runtime";
import layout from '@/compositions/shotcraftLibrary/demos/_textures/live-layout.json';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const RAIL = layout.projects.cards.slice(0, 9);
const GAP = 60;
const CARD_W = 460;
const TARGET_I = 9;
const END = 120 + TARGET_I * (CARD_W + GAP) + CARD_W / 2 - 960;
const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  // 前 70% 路程 12f，后 30% 路程 48f ease-out 长尾
  const dx = interpolate(frame, [30, 42, 90], [0, END * 0.7, END], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: '#f9f6f1', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 340, transform: `translateX(${-dx}px)` }}>
        {RAIL.map((c, k) => (
          <Img
            key={c.file + k}
            src={staticFile(`textures/live/${c.file}`)}
            style={{
              position: 'absolute', left: 120 + k * (CARD_W + GAP), top: 0,
              width: CARD_W, borderRadius: 12,
              boxShadow: '0 4px 16px rgba(31,28,23,0.10)',
            }}
          />
        ))}
        {/* 目标卡：高清纹理，急刹落点 */}
        <Img
          src={staticFile('textures/live/card4-hires.png')}
          style={{
            position: 'absolute', left: 120 + TARGET_I * (CARD_W + GAP), top: -20,
            width: CARD_W, borderRadius: 12,
            boxShadow: '0 10px 32px rgba(31,28,23,0.18)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
const WhipBrakeReal: React.FC = () => (
  // 峰值 ~710px/f：采样密度按"回波间距 ≤ 字高"配，20 samples 拖影连续
  <CameraMotionBlur shutterAngle={200} samples={20}>
    <Scene />
  </CameraMotionBlur>
);
return WhipBrakeReal;
}
