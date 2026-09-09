// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { CameraMotionBlur } from "@/compositions/shotcraftLibrary/runtime";
import layout from '@/compositions/shotcraftLibrary/demos/_textures/live-layout.json';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const CARD_W = 460;
const GAP = 60;
const RAIL = layout.projects.cards.slice(0, 9);
const TARGET_I = 5;
const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  // remap：0–40f 走 88 源帧（快），40–85f 走 9 源帧（0.2x），85–135f 走 110（快）
  const src = interpolate(frame, [0, 40, 85, 135], [0, 88, 97, 207], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const dx = src * 28;
  return (
    <AbsoluteFill style={{ backgroundColor: '#f9f6f1', overflow: 'hidden' }}>
      {/* 偏移 717：让慢速窗中点（src≈92.4，dx≈2587）时目标卡 k=5 中心落屏中 */}
      <div style={{ position: 'absolute', top: 360, transform: `translateX(${-dx + 717}px)` }}>
        {Array.from({ length: 16 }).map((_, k) => {
          const c = RAIL[k % RAIL.length];
          const isTarget = k === TARGET_I;
          return (
            <Img
              key={k}
              src={staticFile(`textures/live/${isTarget ? 'card4-hires.png' : c.file}`)}
              style={{
                position: 'absolute', left: k * (CARD_W + GAP), top: isTarget ? -16 : 0,
                width: CARD_W, borderRadius: 12,
                boxShadow: isTarget
                  ? '0 10px 32px rgba(31,28,23,0.18)'
                  : '0 4px 16px rgba(31,28,23,0.10)',
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
const SpeedRampReal: React.FC = () => {
  const frame = useCurrentFrame();
  const fast = frame < 42 || frame > 83;
  return fast ? (
    <CameraMotionBlur shutterAngle={200} samples={20}>
      <Scene />
    </CameraMotionBlur>
  ) : (
    <Scene />
  );
};
return SpeedRampReal;
}
