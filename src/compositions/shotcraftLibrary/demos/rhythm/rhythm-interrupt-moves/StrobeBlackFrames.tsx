// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, FakeDashboard, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CARD_L = 220 + 36 + 524.67 + 28;
const CARD_T = 72 + 36 + 454 + 28;
const CARD_W = 524.67;
const CARD_H = 454;
const ORIGIN_X = CARD_L + CARD_W / 2;
const ORIGIN_Y = CARD_T + CARD_H / 2;
const FLASHES = [40, 48, 55, 61, 66, 70, 73, 76, 79];
const isBlack = (f: number): boolean =>
  FLASHES.some((f0) => f >= f0 && f <= f0 + 1);
const scaleAt = (f: number): number =>
  f < 81
    ? interpolate(f, [0, 80], [1.0, 1.05], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.quad),
      })
    : 1.35;
const pulseAt = (f: number): number => (f >= 81 && f <= 82 ? 0.88 : 1);
const StrobeBlackFrames: React.FC = () => {
  const frame = useCurrentFrame();
  const s = scaleAt(frame);
  const b = pulseAt(frame);
  const black = isBlack(frame);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        position: 'relative',
        overflow: 'hidden',
        filter: `brightness(${b})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${s})`,
          transformOrigin: `${ORIGIN_X}px ${ORIGIN_Y}px`,
        }}
      >
        <FakeDashboard variant="A" />
        {/* 落点卡片标记：随构图一起缩放，提示硬切对准的核心卡 */}
        <div
          style={{
            position: 'absolute',
            left: CARD_L - 10,
            top: CARD_T - 10,
            width: CARD_W + 20,
            height: CARD_H + 20,
            border: `3px dashed ${G.mid}`,
            borderRadius: 20,
            boxSizing: 'border-box',
          }}
        />
      </div>
      {/* 标签不随缩放，固定顶栏位置 */}
      <div style={{ position: 'absolute', left: 260, top: 20 }}>
        <TitleBlock text={contentText(content, "copy0", "STROBE BLACK FRAMES")} size={54} />
      </div>
      {/* 全屏黑闪层：盖住一切（含标签），每次 2f */}
      {black && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0c0c0c',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};
return StrobeBlackFrames;
}
