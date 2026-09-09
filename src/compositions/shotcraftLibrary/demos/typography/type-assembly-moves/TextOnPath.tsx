// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const P0 = { x: 200, y: 820 };
const P1 = { x: 760, y: 810 };
const P2 = { x: 1240, y: 660 };
const P3 = { x: 1500, y: 320 };
const bez = (t: number) => {
  const u = 1 - t;
  return {
    x: u * u * u * P0.x + 3 * u * u * t * P1.x + 3 * u * t * t * P2.x + t * t * t * P3.x,
    y: u * u * u * P0.y + 3 * u * u * t * P1.y + 3 * u * t * t * P2.y + t * t * t * P3.y,
  };
};
const tangent = (t: number) => {
  const u = 1 - t;
  const dx = 3 * u * u * (P1.x - P0.x) + 6 * u * t * (P2.x - P1.x) + 3 * t * t * (P3.x - P2.x);
  const dy = 3 * u * u * (P1.y - P0.y) + 6 * u * t * (P2.y - P1.y) + 3 * t * t * (P3.y - P2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};
const TEXT = contentText(content, "copy0", "GROWTH ALL THE WAY");
const N = TEXT.length;
const CHAR_W = 46;
const FINAL_Y = 300;
const FINAL_X0 = 960 - (N * CHAR_W) / 2;
const TextOnPath: React.FC = () => {
  const frame = useCurrentFrame();
  // 曲线 evolve：随最前字符推进同步生长
  const evolve = interpolate(frame, [0, 82], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy1", "TEXT ON PATH")} size={54} />
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <path
          d={`M ${P0.x} ${P0.y} C ${P1.x} ${P1.y}, ${P2.x} ${P2.y}, ${P3.x} ${P3.y}`}
          fill="none" stroke={G.bar} strokeWidth={3}
          pathLength={1} strokeDasharray={1} strokeDashoffset={1 - evolve}
        />
      </svg>
      {TEXT.split('').map((ch, i) => {
        if (ch === ' ') return null;
        const tEnd = 0.12 + 0.82 * (i / (N - 1)); // 各字符沿线终点
        const start = i * 2;
        // 沿线推进：start 起 45f 到达 tEnd
        const t = interpolate(frame, [start, start + 45], [0, tEnd], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        const pOnCurve = bez(t);
        const angOnCurve = tangent(t);
        // 到达后停 8f，再 12f 摆正到水平基线
        const settle = interpolate(frame, [start + 53, start + 65], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });
        const x = pOnCurve.x + (FINAL_X0 + i * CHAR_W - pOnCurve.x) * settle;
        const y = pOnCurve.y + (FINAL_Y - pOnCurve.y) * settle;
        const ang = angOnCurve * (1 - settle);
        const op = interpolate(frame, [start, start + 8], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, opacity: op,
            transform: `translate(-50%, -50%) rotate(${ang}deg)`,
            fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 800,
            fontSize: 64, color: G.ink,
          }}>
            {ch}
          </div>
        );
      })}
    </div>
  );
};
return TextOnPath;
}
