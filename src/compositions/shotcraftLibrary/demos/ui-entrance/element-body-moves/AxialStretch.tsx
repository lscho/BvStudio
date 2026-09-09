// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const W = 1920;
const CARD_W = 380;
const CARD_H = 230;
const GAP = 60;
const ROW_W = 3 * CARD_W + 2 * GAP;
const ROW_X0 = (W - ROW_W) / 2;
const ROW_Y = (1080 - CARD_H) / 2;
const START_X = 1980;
const FLIGHT = 36;
const STAGGER = 12;
const FIRST = 10;
const SQUASH = 8;
const VEL_MIN = 2;
const VEL_REF = 140;
const STRETCH_X = 1.2;
const SQUISH_Y = 0.28;
const flightEase = Easing.inOut(Easing.poly(4));
const posAt = (f: number, start: number, targetX: number): number =>
  interpolate(f, [start, start + FLIGHT], [START_X, targetX], {
    easing: flightEase,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
const FlyCard: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const start = FIRST + i * STAGGER;
  const targetX = ROW_X0 + i * (CARD_W + GAP);
  const land = start + FLIGHT;

  const x = posAt(frame, start, targetX);
  // 速度 = 位置差分（帧时间解耦，纯由位置函数决定）
  const v = Math.abs(posAt(frame, start, targetX) - posAt(frame - 1, start, targetX));
  const s = Math.min(Math.max((v - VEL_MIN) / (VEL_REF - VEL_MIN), 0), 1);

  const stretchX = 1 + STRETCH_X * s;
  const stretchY = 1 - SQUISH_Y * s;

  // 落点回弹：scaleX 过冲到 0.85 再回 1（横向被"撞停"压扁），8f
  const sqX = interpolate(frame, [land, land + SQUASH / 2, land + SQUASH], [1, 0.85, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sqY = interpolate(frame, [land, land + SQUASH / 2, land + SQUASH], [1, 1.1, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: ROW_Y,
        // 顺序：先 translate 再 scale；transformOrigin 设运动后缘（向左飞 → 右缘）
        transform: `translateX(${x}px) scaleX(${stretchX * sqX}) scaleY(${stretchY * sqY})`,
        transformOrigin: '100% 50%',
      }}
    >
      <Card w={CARD_W} h={CARD_H} seed={i + 1} />
    </div>
  );
};
const AxialStretch: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 120, width: '100%', textAlign: 'center', opacity: titleOp }}>
        <TitleBlock text={contentText(content, "copy0", "AXIAL STRETCH")} size={72} />
      </div>
      {/* 落位虚线槽，标出目标位置 */}
      {[0, 1, 2].map((i) => (
        <div
          key={`slot-${i}`}
          style={{
            position: 'absolute',
            left: ROW_X0 + i * (CARD_W + GAP),
            top: ROW_Y,
            width: CARD_W,
            height: CARD_H,
            border: `2px dashed ${G.bar}`,
            borderRadius: 14,
            boxSizing: 'border-box',
          }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <FlyCard key={i} i={i} frame={frame} />
      ))}
    </div>
  );
};
return AxialStretch;
}
