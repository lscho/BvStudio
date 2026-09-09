// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const STRIPS = 12;
const W = 160;
const WAVE_START = 20;
const STAGGER = 2;
const FLIP = 10;
const WAVE_END = WAVE_START + (STRIPS - 1) * STAGGER + FLIP;
const Slice: React.FC<{ x: number; variant: 'A' | 'B' }> = ({ x, variant }) => (
  <div style={{ width: 1920, height: 1080, marginLeft: -x }}>
    <FakeDashboard variant={variant} />
  </div>
);
const BlindsSlice: React.FC = () => {
  const frame = useCurrentFrame();

  // 摘罩：波完成后条结构全部卸载，B 整页直出
  if (frame >= WAVE_END) {
    return (
      <AbsoluteFill style={{ background: '#ececea' }}>
        <FakeDashboard variant="B" />
      </AbsoluteFill>
    );
  }

  const seams: { x: number; opacity: number }[] = [];

  const strips = Array.from({ length: STRIPS }).map((_, i) => {
    const x = i * W;
    const start = WAVE_START + i * STAGGER;
    const end = start + FLIP;

    // 未开始：纯 A 切片；已完成：纯 B 切片
    if (frame < start) {
      return (
        <div key={i} style={{ position: 'absolute', left: x, top: 0, width: W, height: 1080, overflow: 'hidden' }}>
          <Slice x={x} variant="A" />
        </div>
      );
    }
    if (frame >= end) {
      return (
        <div key={i} style={{ position: 'absolute', left: x, top: 0, width: W, height: 1080, overflow: 'hidden' }}>
          <Slice x={x} variant="B" />
        </div>
      );
    }

    // 翻换中：A、B 共用同一进度 p——A 宽 160(1-p) 靠左，B 宽 160p 靠右，
    // 交接点恒为 x+160(1-p)，无露底
    const p = interpolate(frame, [start, end], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.in(Easing.cubic),
    });

    // 缝亮线：进出各 2f 线性淡入淡出
    const seamOpacity = Math.min(
      interpolate(frame, [start, start + 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      interpolate(frame, [end - 2, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    );
    seams.push({ x: x + W * (1 - p), opacity: seamOpacity });

    return (
      <div key={i} style={{ position: 'absolute', left: x, top: 0, width: W, height: 1080, overflow: 'hidden' }}>
        {/* A：向左缘收缩 */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', transform: `scaleX(${1 - p})`, transformOrigin: '0% 50%' }}>
          <Slice x={x} variant="A" />
        </div>
        {/* B：从右缘展开 */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', transform: `scaleX(${p})`, transformOrigin: '100% 50%' }}>
          <Slice x={x} variant="B" />
        </div>
      </div>
    );
  });

  return (
    <AbsoluteFill style={{ background: '#ececea' }}>
      {strips}
      {/* 缝亮线：白底判例——纯提亮不可见，柔光 + 暗描边 + 白核三层 */}
      {seams.length > 0 && (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {seams.map((s, i) => (
            <g key={i} opacity={s.opacity}>
              <line x1={s.x} y1={0} x2={s.x} y2={1080} stroke="rgba(255,255,255,0.45)" strokeWidth={16} />
              <line x1={s.x} y1={0} x2={s.x} y2={1080} stroke="rgba(0,0,0,0.55)" strokeWidth={6} />
              <line x1={s.x} y1={0} x2={s.x} y2={1080} stroke="rgba(255,255,255,0.95)" strokeWidth={3} />
            </g>
          ))}
        </svg>
      )}
    </AbsoluteFill>
  );
};
return BlindsSlice;
}
