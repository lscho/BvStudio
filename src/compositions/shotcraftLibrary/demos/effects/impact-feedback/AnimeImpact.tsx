// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, Card, TitleBlock, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const ZOOM_START = 24;
const ZOOM_END = 30;
const IMPACT_LEN = 3;
const RECOVER = ZOOM_END + IMPACT_LEN;
const CARD = { x: 808, y: 108, w: 524, h: 454 };
const CX = CARD.x + CARD.w / 2;
const CY = CARD.y + CARD.h / 2;
const SCALE_END = 2.4;
const rnd = (i: number) => {
  const s = Math.sin(i * 127.3) * 43758.5453;
  return s - Math.floor(s);
};
const SpeedLines: React.FC<{ phase: number }> = ({ phase }) => {
  const cx = 960;
  const cy = 540;
  const R_OUT = 1300; // 超出画框对角(~1101)
  const polys = Array.from({ length: 30 }).map((_, i) => {
    const k = i * 13 + phase * 101;
    const ang = ((i + 0.5) / 30) * Math.PI * 2 + (rnd(k) - 0.5) * 0.22;
    const r0 = 300 + rnd(k + 1) * 220; // 内端长短随机（卡片周缘一带）
    const halfW = (7 + rnd(k + 2) * 16) / R_OUT; // 外端宽 7–23px 的楔形
    const ax = cx + Math.cos(ang) * r0;
    const ay = cy + Math.sin(ang) * r0;
    const b1x = cx + Math.cos(ang - halfW) * R_OUT;
    const b1y = cy + Math.sin(ang - halfW) * R_OUT;
    const b2x = cx + Math.cos(ang + halfW) * R_OUT;
    const b2y = cy + Math.sin(ang + halfW) * R_OUT;
    return `${ax},${ay} ${b1x},${b1y} ${b2x},${b2y}`;
  });
  return (
    <svg
      viewBox="0 0 1920 1080"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {polys.map((pts, i) => (
        <polygon key={i} points={pts} fill={i % 4 === 0 ? '#111111' : '#f5f5f5'} />
      ))}
    </svg>
  );
};
const Scene: React.FC = () => (
  <>
    <FakeDashboard variant="A" />
    <div style={{ position: 'absolute', left: CARD.x, top: CARD.y }}>
      <Card
        w={CARD.w}
        h={CARD.h}
        seed={9}
        style={{ boxShadow: '0 10px 36px rgba(0,0,0,0.18)', border: `3px solid ${G.ink}` }}
      />
      <div style={{ position: 'absolute', left: 24, bottom: 96 }}>
        <TitleBlock text={contentText(content, "copy0", "IMPACT")} size={92} />
      </div>
    </div>
  </>
);
const AnimeImpact: React.FC = () => {
  const frame = useCurrentFrame();

  // 急推：6f ease-in 撞到 2.4x，卡心推到画面正中
  const p = interpolate(frame, [ZOOM_START, ZOOM_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const scale = 1 + p * (SCALE_END - 1);
  const tx = (960 - CX) * p;
  const ty = (540 - CY) * p;

  const impact = frame >= ZOOM_END && frame < RECOVER;
  const phase = impact ? frame - ZOOM_END : 0; // 每 1f 换一次集中线形态

  // 撞停后震屏：6px 起步、指数衰减，~12f 收干后真静止
  const since = frame - RECOVER;
  const env = since >= 0 ? 6 * Math.exp(-since / 2.2) : 0;
  const shakeX = env * Math.sin(since * 3.7);
  const shakeY = env * 0.7 * Math.sin(since * 5.1 + 0.9);

  const zoomStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    transformOrigin: `${CX}px ${CY}px`,
  };

  return (
    <AbsoluteFill style={{ background: impact ? '#131315' : G.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shakeX}px, ${shakeY}px)` }}>
        {/* 主层：冲击帧期间整幅负片黑白 */}
        <div style={{ ...zoomStyle, filter: impact ? 'invert(1) grayscale(1)' : 'none' }}>
          <Scene />
        </div>
        {/* RGB split：红/青双层负片副本，screen 叠底、±8px 错位（随 phase 抖动） */}
        {impact && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                mixBlendMode: 'screen',
                transform: `translate(-8px, ${phase % 2 === 0 ? 4 : -4}px)`,
              }}
            >
              <div style={{ ...zoomStyle, filter: 'invert(1) grayscale(1)' }}>
                <Scene />
              </div>
              <div style={{ position: 'absolute', inset: 0, background: '#ff0033', mixBlendMode: 'multiply' }} />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                mixBlendMode: 'screen',
                transform: `translate(8px, ${phase % 2 === 0 ? -4 : 4}px)`,
              }}
            >
              <div style={{ ...zoomStyle, filter: 'invert(1) grayscale(1)' }}>
                <Scene />
              </div>
              <div style={{ position: 'absolute', inset: 0, background: '#00e5ff', mixBlendMode: 'multiply' }} />
            </div>
            {/* 手绘放射集中线：每帧换形态 */}
            <SpeedLines phase={phase} />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
return AnimeImpact;
}
