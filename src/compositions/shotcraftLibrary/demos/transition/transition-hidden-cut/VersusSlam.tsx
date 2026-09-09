// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, TitleBlock, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const IMPACT = 30;
const SEAM_TOP_X = 1075;
const SEAM_BOT_X = 845;
const SEAM_DEG = (Math.atan2(SEAM_TOP_X - SEAM_BOT_X, 1080) * 180) / Math.PI;
const VersusSlam: React.FC = () => {
  const frame = useCurrentFrame();

  // 两半屏对冲：ease-in 加速，10f 从 ±1200px 冲到位
  const leftX = interpolate(frame, [20, IMPACT], [-1200, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const rightX = -leftX;

  // 撞击帧起：整机震屏 12px 指数衰减（约 5f 收干）
  const since = frame - IMPACT;
  const env = since >= 0 ? 12 * Math.exp(-since / 1.6) : 0;
  const shakeX = env * Math.sin(since * 3.4);
  const shakeY = env * 0.6 * Math.sin(since * 4.1 + 0.7);

  // 白闪：撞击帧 0.9 → 0，3f 收掉
  const flash = interpolate(frame, [IMPACT, IMPACT + 3], [0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "VS" 盖章：scale 1.6 → 1 带 back overshoot，6f 压出
  const vsScale = interpolate(frame, [IMPACT, IMPACT + 6], [1.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(2.6)),
  });
  const vsOpacity = interpolate(frame, [IMPACT, IMPACT + 2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const impacted = frame >= IMPACT;

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shakeX}px, ${shakeY}px)` }}>
        {/* 建立段的斜缝虚线预示（撞合后被实缝替代） */}
        {!impacted && (
          <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
            <line
              x1={SEAM_TOP_X} y1={0} x2={SEAM_BOT_X} y2={1080}
              stroke={G.bar} strokeWidth={4} strokeDasharray="18 16"
            />
          </svg>
        )}
        {/* 左半屏：FakeDashboard A 裁左半，斜边 78° */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translateX(${leftX}px)`,
          clipPath: `polygon(0px 0px, ${SEAM_TOP_X}px 0px, ${SEAM_BOT_X}px 1080px, 0px 1080px)`,
        }}>
          <FakeDashboard variant="A" />
        </div>
        {/* 右半屏：FakeDashboard B 裁右半 */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translateX(${rightX}px)`,
          clipPath: `polygon(${SEAM_TOP_X}px 0px, 1920px 0px, 1920px 1080px, ${SEAM_BOT_X}px 1080px)`,
        }}>
          <FakeDashboard variant="B" />
        </div>
        {/* 撞合后的实体斜缝条 */}
        {impacted && (
          <div style={{
            position: 'absolute', left: 960 - 6, top: 540 - 700,
            width: 12, height: 1400, background: G.ink,
            transform: `rotate(${SEAM_DEG}deg)`,
          }} />
        )}
        {/* "VS" 字块盖章：贴缝、随缝倾斜 */}
        {impacted && (
          <div style={{
            position: 'absolute', left: 960, top: 540,
            transform: `translate(-50%, -50%) rotate(${SEAM_DEG}deg) scale(${vsScale})`,
            opacity: vsOpacity,
            background: G.card, border: `6px solid ${G.ink}`, borderRadius: 20,
            padding: '18px 46px', boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
          }}>
            <TitleBlock text={contentText(content, "copy0", "VS")} size={140} />
          </div>
        )}
      </div>
      {/* 撞击白闪（不随震屏位移） */}
      <AbsoluteFill style={{ background: '#ffffff', opacity: flash, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
return VersusSlam;
}
