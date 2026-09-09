// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
type Seg = { x1: number; y1: number; x2: number; y2: number };
const K = 200;
const H = 320;
const ADV = K + 60;
const SEGS: Seg[] = [
  // S (x offset 0) —— 6 段
  { x1: 30, y1: 22, x2: 185, y2: 22 },     // 0 上横
  { x1: 22, y1: 44, x2: 22, y2: 130 },     // 1 左上竖
  { x1: 30, y1: 152, x2: 175, y2: 152 },   // 2 中横
  { x1: 178, y1: 174, x2: 178, y2: 276 },  // 3 右下竖
  { x1: 15, y1: 298, x2: 170, y2: 298 },   // 4 下横
  { x1: 22, y1: 240, x2: 22, y2: 276 },    // 5 左下小竖（S 尾钩）
  // H (x offset ADV) —— 3 段
  { x1: ADV + 22, y1: 22, x2: ADV + 22, y2: 298 },   // 6 左竖
  { x1: ADV + 178, y1: 22, x2: ADV + 178, y2: 298 }, // 7 右竖
  { x1: ADV + 44, y1: 160, x2: ADV + 156, y2: 160 }, // 8 中横
  // I (x offset ADV*2) —— 3 段
  { x1: ADV * 2 + 40, y1: 22, x2: ADV * 2 + 160, y2: 22 },   // 9 上横
  { x1: ADV * 2 + 100, y1: 44, x2: ADV * 2 + 100, y2: 276 }, // 10 中竖
  { x1: ADV * 2 + 40, y1: 298, x2: ADV * 2 + 160, y2: 298 }, // 11 下横
  // P (x offset ADV*3) —— 4 段
  { x1: ADV * 3 + 22, y1: 22, x2: ADV * 3 + 22, y2: 298 },   // 12 左竖
  { x1: ADV * 3 + 44, y1: 22, x2: ADV * 3 + 165, y2: 22 },   // 13 上横
  { x1: ADV * 3 + 178, y1: 44, x2: ADV * 3 + 178, y2: 140 }, // 14 右短竖
  { x1: ADV * 3 + 44, y1: 162, x2: ADV * 3 + 165, y2: 162 }, // 15 中横
];
const ORDER = [3, 9, 6, 15, 1, 11, 14, 4, 0, 7, 13, 2, 5, 8, 10, 12];
const FIRST = 14;
const STEP = 6;
const SEG_IN = 6;
const LAST_LAND = FIRST + 15 * STEP + SEG_IN;
const PULSE_END = LAST_LAND + 8;
const WORD_W = ADV * 3 + K;
const OX = (1920 - WORD_W) / 2;
const OY = (1080 - H) / 2 + 20;
const StrokeSegmentBuild: React.FC = () => {
  const frame = useCurrentFrame();

  // 末段落位：整字脉冲 1 → 1.06 → 1（8f）
  const pulse = interpolate(
    frame,
    [LAST_LAND, LAST_LAND + 3, PULSE_END],
    [1, 1.06, 1],
    { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div style={{ width: 1920, height: 1080, background: G.ink, overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 110,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: 44,
          color: G.mid,
          letterSpacing: 2,
        }}
      >
        {contentText(content, "copy0", "STROKE SEGMENT BUILD")}</div>
      <svg
        width={1920}
        height={1080}
        style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${pulse})`, transformOrigin: '50% 55%' }}
      >
        {SEGS.map((seg, i) => {
          const rank = ORDER.indexOf(i);
          const start = FIRST + rank * STEP;
          if (frame < start) return null; // 未开始的段不渲染
          const t = interpolate(frame, [start, start + SEG_IN], [0, 1], {
            easing: Easing.out(Easing.cubic),
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          // 沿笔画方向滑入 12px
          const dx = seg.x2 - seg.x1;
          const dy = seg.y2 - seg.y1;
          const len = Math.hypot(dx, dy) || 1;
          const slide = 12 * (1 - t);
          const ox = (-dx / len) * slide;
          const oy = (-dy / len) * slide;
          return (
            <line
              key={i}
              x1={OX + seg.x1 + ox}
              y1={OY + seg.y1 + oy}
              x2={OX + seg.x2 + ox}
              y2={OY + seg.y2 + oy}
              stroke={G.panel}
              strokeWidth={44}
              strokeLinecap="butt"
              opacity={t}
            />
          );
        })}
      </svg>
    </div>
  );
};
return StrokeSegmentBuild;
}
