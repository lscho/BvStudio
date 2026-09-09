// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, Card, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const ROLL = 70;
const LEVEL = 94;
const DutchRollToLevel: React.FC = () => {
  const f = useCurrentFrame();

  // —— 斜置期的缓慢漂移（帧 70 前）：±0.8° 长周期正弦 + 2px 纵漂 ——
  const driftT = Math.min(f, ROLL);
  const driftRot = Math.sin(driftT * 0.035) * 0.8;
  const driftY = Math.sin(driftT * 0.05) * 2;
  // 滚正期间漂移随进度淡出
  const driftFade = interpolate(f, [ROLL, ROLL + 6], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // —— 滚正：-10° 用 14f 冲过 0 到 +1.2°，再 10f 收回 0（单次过冲不振荡） ——
  const baseRot =
    f < ROLL
      ? -10
      : f < ROLL + 14
        ? interpolate(f, [ROLL, ROLL + 14], [-10, 1.2], {
            easing: Easing.out(Easing.cubic),
          })
        : interpolate(f, [ROLL + 14, LEVEL], [1.2, 0], {
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.quad),
          });

  const rot = baseRot + driftRot * driftFade;
  const y = driftY * driftFade;

  // scale 1.15（防旋转露边）→ 滚正同步收到 1.08
  const scale = interpolate(f, [ROLL, LEVEL], [1.15, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // —— 警示条（痛点）：斜置期悬在上方，滚正一拍淡出；干净卡反向淡入 ——
  const alertOpacity = interpolate(f, [ROLL, ROLL + 12], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cleanOpacity = interpolate(f, [ROLL + 8, ROLL + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateY(${y}px) rotate(${rot}deg) scale(${scale})`,
          transformOrigin: '50% 50%',
        }}
      >
        <FakeDashboard variant="B" />

        {/* 痛点警示条：深色横幅压在页面上方（斜着更显歪） */}
        <div
          style={{
            position: 'absolute',
            left: 560,
            top: 120,
            width: 800,
            height: 88,
            background: G.ink,
            borderRadius: 14,
            opacity: alertOpacity * 0.92,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '0 28px',
            boxSizing: 'border-box',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          }}
        >
          {/* 警示三角 */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '18px solid transparent',
              borderRight: '18px solid transparent',
              borderBottom: '32px solid #f7f7f6',
            }}
          />
          <div style={{ height: 16, width: 420, background: G.mid, borderRadius: 8 }} />
        </div>

        {/* 解决方案：干净卡随滚正浮现在同一位置 */}
        <div style={{ position: 'absolute', left: 560, top: 96, opacity: cleanOpacity }}>
          <Card w={800} h={140} seed={2} style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
return DutchRollToLevel;
}
