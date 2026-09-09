// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, TitleBlock, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const F1 = 30;
const F2 = 52;
const F3 = 70;
const SETTLE = 6;
const DECAY = 4;
const FLASHES = [F1, F2, F3];
const hash = (i: number) => {
  const s = Math.sin(i * 127.3) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};
const Footage: React.FC = () => (
  <div style={{ position: 'absolute', width: 1920, height: 1080 }}>
    <FakeDashboard variant="A" />
    <div style={{ position: 'absolute', left: 1070, top: 350, transform: 'translate(-50%, -50%)' }}>
      <TitleBlock text={contentText(content, "copy0", "84,213")} size={104} />
    </div>
  </div>
);
type View = { scale: number; origin: string };
const VIEW_WIDE: View = { scale: 1.0, origin: '960px 540px' };
const VIEW_CARD: View = { scale: 2.3, origin: '1070px 335px' };
const VIEW_DIGIT: View = { scale: 4.0, origin: '1070px 350px' };
const PaparazziFlash: React.FC = () => {
  const frame = useCurrentFrame();

  // 当前处于哪一段：-1 = 闪前活素材段
  let seg = -1;
  for (let i = 0; i < FLASHES.length; i++) {
    if (frame >= FLASHES[i]) seg = i;
  }

  let scale: number;
  let origin: string;
  let settleScale = 1;
  let settleY = 0;

  if (seg === -1) {
    // 闪前：中景慢推（活的），衬托闪后定格的"死"
    origin = '900px 480px';
    scale = interpolate(frame, [0, F1], [1.16, 1.2], {
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.quad),
    });
  } else {
    const view = [VIEW_WIDE, VIEW_CARD, VIEW_DIGIT][seg];
    scale = view.scale;
    origin = view.origin;
    // 切入回落：1.03→1 的 6f 收敛 + 半格沉降（-16px 落回 0）像快门余韵
    const t = interpolate(frame, [FLASHES[seg], FLASHES[seg] + SETTLE], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
    settleScale = 1 + 0.03 * t;
    settleY = -16 * t;
  }

  // 白闪层：每个切点 0.95→0，4f 衰减，取各闪最大值
  let flash = 0;
  for (const f of FLASHES) {
    const o = interpolate(frame, [f, f + DECAY], [0.95, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.quad),
    });
    if (frame >= f && frame < f + DECAY + 1) flash = Math.max(flash, o);
  }

  // 白闪帧全屏微位移抖动模拟快门震（seed 哈希，非随机）
  const inFlash = FLASHES.some((f) => frame >= f && frame < f + DECAY);
  const jx = inFlash ? 2 * hash(frame * 7 + 1) : 0;
  const jy = inFlash ? 2 * hash(frame * 13 + 5) : 0;

  return (
    <AbsoluteFill style={{ background: G.ink, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${jx}px, ${jy + settleY}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 1920,
            height: 1080,
            transform: `scale(${scale * settleScale})`,
            transformOrigin: origin,
          }}
        >
          <Footage />
        </div>
      </div>
      {/* 白闪层 */}
      {flash > 0 && (
        <AbsoluteFill style={{ background: '#ffffff', opacity: flash }} />
      )}
    </AbsoluteFill>
  );
};
return PaparazziFlash;
}
