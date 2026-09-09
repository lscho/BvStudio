// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const GLYPHS: Record<string, string> = {
  S: 'M 62 13 C 51 4, 18 3, 15 15 C 12 26, 29 29, 39 31 C 50 33, 66 37, 63 48 C 60 59, 21 61, 11 50',
  U: 'M 12 5 L 12 40 C 12 59, 66 59, 66 40 L 66 5',
  P: 'M 12 59 L 12 5 L 44 5 C 64 5, 64 32, 44 32 L 12 32',
  E: 'M 62 5 L 12 5 L 12 59 L 62 59 M 12 31 L 56 31',
  R: 'M 12 59 L 12 5 L 44 5 C 64 5, 64 31, 44 31 L 12 31 M 42 31 L 64 59',
  H: 'M 12 5 L 12 59 M 66 5 L 66 59 M 12 31 L 66 31',
  M: 'M 8 59 L 8 6 L 39 38 L 70 6 L 70 59',
  A: 'M 7 59 L 39 5 L 71 59 M 17 41 L 61 41',
  N: 'M 12 59 L 12 5 L 66 59 L 66 5',
};
const WORD = contentText(content, "copy0", "SUPERHUMAN");
const START = 16;
const DUR = 52;
const LetterspaceMaterialize: React.FC = () => {
  const frame = useCurrentFrame();

  // 全字符共享同一进度：同时开始、同时完成
  const p = interpolate(frame, [START, START + DUR], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  // easeInOut：起笔缓→中段匀速→收笔缓（手写感）
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  // 画完瞬间轻微提亮回落（结晶收束）——全字符同帧发生
  const doneGlow = interpolate(frame, [START + DUR, START + DUR + 8], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const glowAmt = p >= 1 ? doneGlow : p > 0.7 ? (p - 0.7) / 0.3 : 0;

  const letters = WORD.split('').map((ch, li) => (
    <svg key={li} width={78} height={64} viewBox="0 0 78 64"
      style={{ overflow: 'visible', display: 'block' }}>
      {p > 0 && (
        <path
          d={GLYPHS[ch]}
          fill="none"
          stroke="#f4f2f8"
          strokeWidth={5.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - e}
          style={{
            filter: `drop-shadow(0 0 ${6 + glowAmt * 10}px rgba(240,235,255,${0.35 + glowAmt * 0.35}))`,
          }}
        />
      )}
    </svg>
  ));

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(178deg, #2c2a55 0%, #3d3465 30%, #241f40 58%, #0e0c1e 100%)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* 暮色地平线光带（山影/晚霞近似） */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 470, height: 170,
        background: 'linear-gradient(180deg, rgba(232,150,170,0) 0%, rgba(226,140,165,0.20) 45%, rgba(120,100,170,0.12) 75%, rgba(0,0,0,0) 100%)',
        filter: 'blur(20px)',
      }} />
      <div style={{
        position: 'absolute', right: 130, top: 330, width: 560, height: 200,
        background: 'radial-gradient(ellipse at center, rgba(216,120,160,0.16) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(26px)',
      }} />
      {/* 大字距字标：全字符并行连续描画 */}
      <div style={{ display: 'flex', gap: 34, alignItems: 'center' }}>
        {letters}
      </div>
    </AbsoluteFill>
  );
};
return LetterspaceMaterialize;
}
