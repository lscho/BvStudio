// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, Card, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const CARD_W = 996;
const CARD_H = 560;
const GAP = 140;
const PITCH = CARD_W + GAP;
const INNER = CARD_H / 1080;
const PAN_END = 55;
const DROP_END = 85;
const PageCard: React.FC<{ x: number; children: React.ReactNode }> = ({ x, children }) => (
  <div
    style={{
      position: 'absolute',
      left: x - CARD_W / 2,
      top: -CARD_H / 2,
      width: CARD_W,
      height: CARD_H,
      background: G.card,
      border: `2px solid ${G.border}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxSizing: 'border-box',
      boxShadow: '0 24px 48px rgba(0,0,0,0.22)',
      backfaceVisibility: 'hidden',
      transform: 'translateZ(4px)',
    }}
  >
    <div style={{ width: 1920, height: 1080, transform: `scale(${INNER})`, transformOrigin: '0 0' }}>
      {children}
    </div>
  </div>
);
const OverheadTabletopDrop: React.FC = () => {
  const f = useCurrentFrame();

  // 0–55f 横滑：只动 translateX，缓入缓出
  const panX = interpolate(f, [0, PAN_END], [700, -650], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 55–85f 骤降：角度 / 缩放 / 位移三者同跑，out-cubic + 2% 过冲
  const drop = interpolate(f, [PAN_END, DROP_END], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rotX = interpolate(f, [PAN_END, DROP_END, DROP_END + 4, DROP_END + 8], [62, -1.8, 0.6, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(f, [PAN_END, DROP_END, DROP_END + 7], [1, 2.04, 2.0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dropX = interpolate(drop, [0, 1], [panX, 0]); // drop 段把 -650 收回 0

  const tx = f <= PAN_END ? panX : dropX;

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, perspective: 1600, perspectiveOrigin: '50% 42%' }}>
        {/* 世界原点 = 屏心；先 in-plane scale，再 rotateX，最后 translateX */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 0,
            height: 0,
            transformStyle: 'preserve-3d',
            transform: `translateX(${tx}px) rotateX(${rotX}deg) scale(${scale})`,
          }}
        >
          {/* 桌面：浅灰底 + 网格线，给横滑段提供运动参照 */}
          <div
            style={{
              position: 'absolute',
              left: -2800,
              top: -760,
              width: 5600,
              height: 1520,
              background: '#e6e6e4',
              backgroundImage: `repeating-linear-gradient(90deg, ${G.line} 0px, ${G.line} 2px, transparent 2px, transparent 160px), repeating-linear-gradient(0deg, ${G.line} 0px, ${G.line} 2px, transparent 2px, transparent 160px)`,
              backfaceVisibility: 'hidden',
            }}
          />
          <PageCard x={-PITCH}>
            <FakeDashboard variant="B" />
          </PageCard>
          {/* 目标页：落版满屏 */}
          <PageCard x={0}>
            <FakeDashboard variant="A" />
          </PageCard>
          <PageCard x={PITCH}>
            <div
              style={{
                width: 1920,
                height: 1080,
                background: G.panel,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Card w={760} h={520} seed={4} />
            </div>
          </PageCard>
        </div>
      </div>
    </AbsoluteFill>
  );
};
return OverheadTabletopDrop;
}
