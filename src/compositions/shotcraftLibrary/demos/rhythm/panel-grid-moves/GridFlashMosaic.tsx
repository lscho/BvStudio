// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, FakeDashboard } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const h = (n: number) => {
  const s = Math.sin(n * 127.3) * 43758.5453;
  return s - Math.floor(s);
};
const CELL_W = 600;
const CELL_H = 340;
const GAP = 12;
const GRID_X = (1920 - (CELL_W * 3 + GAP * 2)) / 2;
const GRID_Y = (1080 - (CELL_H * 3 + GAP * 2)) / 2;
const FILL_START = 25;
const STEP = 2;
const ORDER = Array.from({ length: 9 }, (_, i) => i).sort(
  (a, b) => h(a + 1) - h(b + 1)
);
const RANK: number[] = [];
ORDER.forEach((cell, k) => (RANK[cell] = k));
const LAST_IN = FILL_START + 8 * STEP + 3;
const HOLD_END = LAST_IN + 14;
const ZOOM_DUR = 14;
const ZOOM_END = HOLD_END + ZOOM_DUR;
const MINI_SCALE = CELL_W / 1920;
const ZOOM_SCALE = 3.28;
const CROPS: Array<{ x: number; y: number; v: 'A' | 'B' } | null> = [
  { x: -120, y: -60, v: 'A' },
  null, // 灰卡
  { x: -1260, y: -120, v: 'B' },
  { x: -60, y: -520, v: 'B' },
  null, // 中心格(单独处理，占位)
  { x: -1300, y: -640, v: 'A' },
  { x: -420, y: -300, v: 'B' },
  null, // 灰卡
  { x: -900, y: -680, v: 'A' },
];
const CellContent: React.FC<{ i: number }> = ({ i }) => {
  if (i === 4) {
    // 中心格：整页 dashboard 缩到格内
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: (CELL_H - 1080 * MINI_SCALE) / 2,
          transform: `scale(${MINI_SCALE})`,
          transformOrigin: 'top left',
        }}
      >
        <FakeDashboard variant="A" />
      </div>
    );
  }
  const crop = CROPS[i];
  if (crop === null) {
    // 灰卡格
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: G.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card w={430} h={240} seed={i * 3 + 2} />
      </div>
    );
  }
  // 裁切片：整页 dashboard 以不同偏移塞进格子(相当于 backgroundPosition 各异)
  return (
    <div style={{ position: 'absolute', left: crop.x, top: crop.y }}>
      <FakeDashboard variant={crop.v} />
    </div>
  );
};
const GridFlashMosaic: React.FC = () => {
  const f = useCurrentFrame();

  // 整墙微呼吸：仅在填满后的 14f 停顿段，一个正弦来回 1→1.008→1
  const breath =
    f >= LAST_IN && f < HOLD_END
      ? 1 + 0.008 * Math.sin((Math.PI * (f - LAST_IN)) / 14)
      : 1;

  // 中心格放大：14f Easing.in(cubic)，吞掉全屏
  const zoom = interpolate(f, [HOLD_END, ZOOM_END], [1, ZOOM_SCALE], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${breath})`,
          transformOrigin: '960px 540px',
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const start = FILL_START + RANK[i] * STEP;
          if (f < start) return null; // 硬入：未到拍点不渲染，无淡化
          const row = Math.floor(i / 3);
          const col = i % 3;
          // 入格 3f scale 1.18→1
          const popScale = interpolate(f, [start, start + 3], [1.18, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          // 2f 加深脉冲
          const darken = interpolate(f, [start, start + 2], [0.45, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const isCenter = i === 4;
          const cellScale = isCenter ? popScale * zoom : popScale;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: GRID_X + col * (CELL_W + GAP),
                top: GRID_Y + row * (CELL_H + GAP),
                width: CELL_W,
                height: CELL_H,
                overflow: 'hidden',
                background: G.card,
                border: `3px solid ${G.ink}`,
                boxSizing: 'border-box',
                transform: `scale(${cellScale})`,
                transformOrigin: 'center',
                zIndex: isCenter ? 10 : 1,
              }}
            >
              <CellContent i={i} />
              {darken > 0.001 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#000',
                    opacity: darken,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
return GridFlashMosaic;
}
