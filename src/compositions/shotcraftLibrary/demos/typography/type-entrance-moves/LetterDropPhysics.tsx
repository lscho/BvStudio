// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const h = (n: number) => {
  const s = Math.sin(n * 127.3) * 43758.5453;
  return s - Math.floor(s);
};
const WORD = contentText(content, "copy0", "GRAVITY");
const SLOT_W = 150;
const FONT = 140;
const WORD_W = WORD.length * SLOT_W;
const LEFT = (1920 - WORD_W) / 2;
const REST_TOP = 452;
const FLOOR_Y = REST_TOP + 152;
const DROP = 720;
const T_FALL = 24;
const T_B1 = 16;
const T_B2 = 8;
const SNAP = 110;
const SNAP_DUR = 6;
const easeOutCubic = Easing.out(Easing.cubic);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const dropY = (t: number): number => {
  if (t <= 0) return -DROP;
  if (t < T_FALL) return -DROP + DROP * (t / T_FALL) ** 2; // 重力加速
  if (t < T_FALL + T_B1) {
    const u = (t - T_FALL) / T_B1;
    return -DROP * 0.3 * 4 * u * (1 - u); // 弹跳 1：30%
  }
  if (t < T_FALL + T_B1 + T_B2) {
    const u = (t - T_FALL - T_B1) / T_B2;
    return -DROP * 0.09 * 4 * u * (1 - u); // 弹跳 2：9%
  }
  return 0;
};
const LetterDropPhysics: React.FC = () => {
  const frame = useCurrentFrame();
  // 帧 110 起的齐整回正进度
  const snap = easeOutCubic(clamp01((frame - SNAP) / SNAP_DUR));

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, overflow: 'hidden', position: 'relative' }}>
      {/* 地板线：字符落点的视觉基线 */}
      <div style={{ position: 'absolute', left: LEFT - 60, top: FLOOR_Y, width: WORD_W + 120, height: 6, background: G.bar, borderRadius: 3 }} />

      {WORD.split('').map((ch, i) => {
        const start = 10 + i * 5;
        const t = frame - start;
        const y = dropY(t);
        // 落地瞬间歪到 seed 小角度（±6°），落地前为 0
        const tiltTarget = (h(i + 1) - 0.5) * 12;
        const landP = clamp01((t - T_FALL) / 6);
        const restJitter = (h(i + 11) - 0.5) * 10; // 落定后的 ±5px 竖向错位
        // snap 一拍：歪角与错位齐整归零，scale 1.06→1 脉冲
        const rot = tiltTarget * landP * (1 - snap);
        const jitter = restJitter * landP * (1 - snap);
        const scale = frame < SNAP ? 1 : 1 + 0.06 * (1 - snap);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: LEFT + i * SLOT_W,
              top: REST_TOP,
              width: SLOT_W,
              height: FONT,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              transform: `translateY(${y + jitter}px) rotate(${rot}deg) scale(${scale})`,
              transformOrigin: '50% 100%',
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 800,
              fontSize: FONT,
              lineHeight: 1,
              color: G.ink,
            }}
          >
            {ch}
          </div>
        );
      })}
    </div>
  );
};
return LetterDropPhysics;
}
