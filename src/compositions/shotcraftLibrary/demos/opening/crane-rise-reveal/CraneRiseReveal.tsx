// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, FakeDashboard } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const HOLD = 20;
const MOVE_END = 120;
const ease = Easing.out(Easing.quad);
const ROW_LEFT = 220 + 36;
const ROW_W = 1920 - ROW_LEFT - 36;
const ROW_H = (1080 - 72 - 72 - 4 * 20) / 5;
const rowTop = (i: number) => 72 + 36 + i * (ROW_H + 20);
const F0 = { x: 520, y: rowTop(4) + ROW_H / 2 };
const F1 = { x: 960, y: 540 };
const S0 = 3.2;
const camAt = (frame: number) => {
  const p = Math.min(1, Math.max(0, (frame - HOLD) / (MOVE_END - HOLD)));
  const e = ease(p);
  const s = S0 + (1 - S0) * e;
  const fx = F0.x + (F1.x - F0.x) * e;
  const fy = F0.y + (F1.y - F0.y) * e;
  return { s, tx: 960 - fx * s, ty: 540 - fy * s, visTop: fy - 540 / s };
};
const triggers = Array.from({ length: 5 }, (_, i) => {
  for (let f = HOLD; f <= MOVE_END; f++) {
    if (camAt(f).visTop <= rowTop(i) + 1) return f;
  }
  return MOVE_END;
});
const CraneRiseReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { s, tx, ty } = camAt(frame);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 1920,
          height: 1080,
          transformOrigin: '0 0',
          transform: `translate(${tx}px, ${ty}px) scale(${s})`,
        }}
      >
        <FakeDashboard variant="B" />
        {triggers.map((t, i) => {
          const op = interpolate(frame, [t, t + 4, t + 22], [0, 0.22, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          if (op <= 0.001) return null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: ROW_LEFT,
                top: rowTop(i),
                width: ROW_W,
                height: ROW_H,
                borderRadius: 14,
                background: G.ink,
                opacity: op,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
return CraneRiseReveal;
}
