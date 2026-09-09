// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { G, FakeDashboard, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CARD_L = 220 + 36 + 524.67 + 28;
const CARD_T = 72 + 36 + 454 + 28;
const CARD_W = 524.67;
const CARD_H = 454;
const ORIGIN_X = CARD_L + CARD_W / 2;
const ORIGIN_Y = CARD_T + CARD_H / 2;
const scaleAt = (f: number): number => (f < 35 ? 1.0 : f < 70 ? 1.6 : 2.6);
const pulseAt = (f: number): number =>
  (f >= 35 && f <= 36) || (f >= 70 && f <= 71) ? 0.92 : 1;
const JumpCutPunchIn: React.FC = () => {
  const frame = useCurrentFrame();
  const s = scaleAt(frame);
  const b = pulseAt(frame);

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
        {/* 目标卡片标记：随构图一起缩放，提示 punch-in 落点 */}
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
      {/* 标签不随缩放，固定左上角 */}
      <div style={{ position: 'absolute', left: 260, top: 20 }}>
        <TitleBlock text={contentText(content, "copy0", "JUMP CUT PUNCH-IN")} size={54} />
      </div>
    </div>
  );
};
return JumpCutPunchIn;
}
