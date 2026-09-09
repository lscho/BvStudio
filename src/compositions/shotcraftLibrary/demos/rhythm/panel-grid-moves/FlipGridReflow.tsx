// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CARD_W = 280;
const CARD_H = 170;
const N = 6;
const ROW_Y = 330;
const ROW_CENTERS: Array<[number, number]> = Array.from({ length: N }, (_, i) => [
  60 + CARD_W / 2 + i * (CARD_W + 24),
  ROW_Y,
]);
const GC = [571.6, 960, 1348.4];
const GR = [416.2, 663.8];
const GRID_CENTERS: Array<[number, number]> = [
  [GC[0], GR[0]], // card0 → 上左
  [GC[0], GR[1]], // card1 → 下左
  [GC[1], GR[0]], // card2 → 上中
  [GC[1], GR[1]], // card3 → 下中
  [GC[2], GR[0]], // card4 → 上右
  [GC[2], GR[1]], // card5 → 下右
];
const BEAT = 30;
const STAGGER = 1.5;
const MOVE = 16;
const SETTLE = 3;
const SCALE_END = 1.28;
const OVERSHOOT = 1.02;
const PULSE_IN = 58;
const PULSE_MID = 61;
const PULSE_OUT = 64;
const moveEase = Easing.inOut(Easing.cubic);
const FlipCard: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const t0 = BEAT + i * STAGGER;
  const [x0, y0] = ROW_CENTERS[i];
  const [x1, y1] = GRID_CENTERS[i];

  const x = interpolate(frame, [t0, t0 + MOVE], [x0, x1], {
    easing: moveEase, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [t0, t0 + MOVE], [y0, y1], {
    easing: moveEase, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // scale：16f 冲到 1.28*1.02，随后 3f 回落到 1.28
  const sUp = interpolate(frame, [t0, t0 + MOVE], [1, SCALE_END * OVERSHOOT], {
    easing: moveEase, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const sBack = interpolate(frame, [t0 + MOVE, t0 + MOVE + SETTLE], [SCALE_END * OVERSHOOT, SCALE_END], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const s = frame < t0 + MOVE ? sUp : sBack;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - CARD_W / 2,
        top: y - CARD_H / 2,
        width: CARD_W,
        height: CARD_H,
        transform: `scale(${s})`,
        transformOrigin: '50% 50%',
        zIndex: i,
      }}
    >
      <Card w={CARD_W} h={CARD_H} seed={i + 1} />
    </div>
  );
};
const FlipGridReflow: React.FC = () => {
  const frame = useCurrentFrame();

  // 加深脉冲：仅脉冲窗口内挂载 filter，窗口外完全不挂（摘罩）
  const pulsing = frame >= PULSE_IN && frame <= PULSE_OUT;
  const bright = pulsing
    ? interpolate(frame, [PULSE_IN, PULSE_MID, PULSE_OUT], [1, 0.78, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        position: 'relative',
        overflow: 'hidden',
        ...(pulsing ? { filter: `brightness(${bright})` } : {}),
      }}
    >
      <div style={{ position: 'absolute', left: 70, top: 56 }}>
        <TitleBlock text={contentText(content, "copy0", "FLIP GRID REFLOW")} size={44} />
      </div>
      {Array.from({ length: N }).map((_, i) => (
        <FlipCard key={i} i={i} frame={frame} />
      ))}
    </div>
  );
};
return FlipGridReflow;
}
