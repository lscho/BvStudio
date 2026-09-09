// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const X0 = 240;
const X1 = 1140;
const OVER = 27;
const Y = 380;
const posAt = (f: number): number =>
  f < 37
    ? interpolate(f, [25, 37], [X0, X1 + OVER], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.cubic),
      })
    : interpolate(f, [37, 43], [X1 + OVER, X1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
const Slot: React.FC<{ x: number }> = ({ x }) => (
  <div
    style={{
      position: 'absolute',
      left: x - 20,
      top: Y - 20,
      width: 520,
      height: 360,
      border: `3px dashed ${G.bar}`,
      borderRadius: 20,
      boxSizing: 'border-box',
    }}
  />
);
const SmearMultiples: React.FC = () => {
  const frame = useCurrentFrame();
  const bodyX = posAt(frame);
  // 本体速度 = 相邻帧位置差；>25px/f 才渲染分身
  const speed = Math.abs(posAt(frame) - posAt(frame - 1));
  const speedGate = interpolate(speed, [25, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 落位合拢：35–38 三帧内分身延迟收缩到 0（位置滑向本体）+ 不透明度归零
  const cv = interpolate(frame, [35, 38], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const convergeFade = frame >= 35 ? 1 - cv : 0;

  const ghostOps = [0.45, 0.3, 0.18, 0.09];

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy0", "SMEAR MULTIPLES")} size={54} />
      </div>
      <Slot x={X0} />
      <Slot x={X1} />
      {/* 4 个分身：第 k 个取 frame - k*2 帧时刻的位置；合拢期延迟×(1-cv) 收缩到 0 */}
      {ghostOps.map((baseOp, i) => {
        const k = i + 1;
        const gx = posAt(frame - k * 2 * (1 - cv));
        const op = baseOp * Math.max(speedGate, convergeFade);
        if (op <= 0.001) return null;
        return (
          <div key={k} style={{ position: 'absolute', left: gx, top: Y, opacity: op }}>
            <Card w={480} h={320} seed={5} />
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: bodyX, top: Y }}>
        <Card w={480} h={320} seed={5} />
      </div>
    </div>
  );
};
return SmearMultiples;
}
