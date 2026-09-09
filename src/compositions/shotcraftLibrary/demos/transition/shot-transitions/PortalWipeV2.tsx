// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, Card, TitleBlock, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const PortalWipeV2: React.FC = () => {
  const frame = useCurrentFrame();

  // ── 窗放大：40f，先慢后快再缓收 ──
  const t = interpolate(frame, [25, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.7, 0, 0.3, 1),
  });
  const c0 = { x: 1180, y: 620, w: 480, h: 320, r: 14 };
  const x = interpolate(t, [0, 1], [c0.x, 0]);
  const y = interpolate(t, [0, 1], [c0.y, 0]);
  const w = interpolate(t, [0, 1], [c0.w, 1920]);
  const h = interpolate(t, [0, 1], [c0.h, 1080]);
  const r = interpolate(t, [0, 1], [c0.r, 0]);

  // ── 窗内视差散开：40→73f，Easing.out 保证 f65 穿窗完成后 8f 内速度归零 ──
  const spread = interpolate(frame, [40, 73], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // 窗内整体从缩略推到满幅
  const innerScale = interpolate(t, [0, 1], [0.42, 1]);

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      {/* 旧场景：dashboard A */}
      <FakeDashboard variant="A" />

      {/* 窗（放大的卡）——内藏新场景 */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: r,
          overflow: 'hidden',
          boxShadow: t < 1 ? '0 12px 48px rgba(0,0,0,0.22)' : 'none',
        }}
      >
        {/* 窗内 1920×1080 舞台，随穿窗从 0.42 推到 1 */}
        <div
          style={{
            position: 'absolute',
            width: 1920,
            height: 1080,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${innerScale})`,
            background: '#e4e4e2',
          }}
        >
          {/* 远景层（系数 0.08，不加 blur）：新场景整页 dashboard 缩略 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `scale(${1 + spread * 0.08})`,
              transformOrigin: '960px 540px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 1920,
                height: 1080,
                transform: 'translate(-50%, -50%) scale(0.82)',
                transformOrigin: 'center',
                borderRadius: 20,
                overflow: 'hidden',
                border: `2px solid ${G.border}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
              }}
            >
              <FakeDashboard variant="B" />
            </div>
            <div style={{ position: 'absolute', left: 250, top: 100 }}>
              <TitleBlock text={contentText(content, "copy0", "Scene B")} size={64} />
            </div>
          </div>

          {/* 近景层（系数 0.3，不加 blur）：只 2 张卡，向边缘让位 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `scale(${1 + spread * 0.3})`,
              transformOrigin: '960px 540px',
            }}
          >
            <div style={{ position: 'absolute', left: 150, top: 660 }}>
              <Card w={380} h={250} seed={71} />
            </div>
            <div style={{ position: 'absolute', left: 1420, top: 160 }}>
              <Card w={340} h={220} seed={72} />
            </div>
          </div>
        </div>

        {/* 卡正面：放大初期渐隐，露出窗内新场景 */}
        <div style={{ position: 'absolute', inset: 0, opacity: Math.max(0, 1 - t * 2.4) }}>
          <Card w={c0.w} h={c0.h} seed={5} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
return PortalWipeV2;
}
