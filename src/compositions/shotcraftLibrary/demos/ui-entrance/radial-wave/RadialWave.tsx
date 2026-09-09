// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const COLS = 17;
const ROWS = 9;
const CX = (COLS - 1) / 2;
const CY = (ROWS - 1) / 2;
const MAX_D = Math.hypot(CX, CY);
const DOTS = Array.from({ length: ROWS * COLS }, (_, i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  return {
    left: `${((c + 0.5) / COLS) * 100}%`,
    top: `${((r + 0.5) / ROWS) * 100}%`,
    dist: Math.hypot(c - CX, r - CY) / MAX_D,
  };
});
const RadialWave: React.FC = () => {
  const t = useT();
  return (
    <DesignStage bg="#0a0b10">
      {DOTS.map(({ left, top, dist }, i) => {
        // 第一道波：扩散点亮；第二道波：反向脉冲
        const w1 = seg(t, dist * 0.35, dist * 0.35 + 0.18, E.outCubic);
        const w2 = seg(t, 0.62 + (1 - dist) * 0.25, 0.62 + (1 - dist) * 0.25 + 0.15);
        const pulse2 = Math.sin(w2 * Math.PI);
        const s = w1 * (1 + 0.5 * Math.sin(w1 * Math.PI)) + pulse2 * 0.8;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              borderRadius: '50%',
              left,
              top,
              margin: -5,
              background: pulse2 > 0.3 ? '#b9f2ff' : '#6c8cff',
              transform: `scale(${s})`,
              opacity: 0.25 + w1 * 0.5 + pulse2 * 0.25,
              boxShadow: pulse2 > 0.3 ? '0 0 12px #7fd8ff' : 'none',
            }}
          />
        );
      })}
    </DesignStage>
  );
};
return RadialWave;
}
