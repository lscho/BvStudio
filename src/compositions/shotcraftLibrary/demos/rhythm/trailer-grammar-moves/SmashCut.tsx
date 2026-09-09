// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, FakeDashboard } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const CUT = 42;
type Fly = {
  from: [number, number];
  to: [number, number];
  rot: [number, number]; // 微旋转 起→终
  seed: number;
  w: number;
  h: number;
};
const FLIES: Fly[] = [
  { from: [-1400, -120], to: [1400, 60], rot: [-6, 5], seed: 1, w: 440, h: 290 },
  { from: [1400, 180], to: [-1400, -100], rot: [7, -4], seed: 2, w: 400, h: 260 },
  { from: [-300, -900], to: [200, 900], rot: [-3, 8], seed: 3, w: 460, h: 300 },
  { from: [-1300, 800], to: [1300, -750], rot: [5, -7], seed: 4, w: 420, h: 280 },
  { from: [1350, -780], to: [-1350, 820], rot: [-8, 4], seed: 5, w: 480, h: 310 },
];
const passWindow = (i: number, k: number): [number, number] => {
  const start = i * 4 + k * 20;
  const dur = k === 0 ? 16 : 12;
  return [start, start + dur];
};
const FlyCard: React.FC<{ fly: Fly; i: number; frame: number }> = ({ fly, i, frame }) => {
  // 找当前活跃的 pass（两轮）
  let active: [number, number] | null = null;
  for (let k = 0; k < 2; k++) {
    const [s, e] = passWindow(i, k);
    if (frame >= s && frame < e) { active = [s, e]; break; }
  }
  if (!active) return null;
  const [s, e] = active;
  // ease-in：全程加速，越接近终点越快
  const p = interpolate(frame, [s, e], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const x = fly.from[0] + (fly.to[0] - fly.from[0]) * p;
  const y = fly.from[1] + (fly.to[1] - fly.from[1]) * p;
  const rot = fly.rot[0] + (fly.rot[1] - fly.rot[0]) * p;
  const scale = 1.5 + 1.5 * p; // 1.5 → 3 冲脸
  // 速度门控方向模糊感：ease-in 下瞬时速度 ∝ p，速度越快越糊
  const blur = 1 + 4 * p;
  return (
    <div style={{
      position: 'absolute', left: 960 - fly.w / 2, top: 540 - fly.h / 2,
      transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
      filter: `blur(${blur}px)`,
    }}>
      <Card w={fly.w} h={fly.h} seed={fly.seed}
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }} />
    </div>
  );
};
const SmashCut: React.FC = () => {
  const frame = useCurrentFrame();

  // —— 死寂段：42f 起 variant B 整齐静止全景，无任何动画属性 ——
  if (frame >= CUT) {
    return <FakeDashboard variant="B" />;
  }

  // —— 轰鸣段：背景 ease-in 加速推近 + 滚动，切点前 3f 仍在加速 ——
  const bgScale = interpolate(frame, [0, CUT], [1, 1.55], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const bgRot = interpolate(frame, [0, CUT], [0, 1.8], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        width: 1920, height: 1080,
        transform: `scale(${bgScale}) rotate(${bgRot}deg)`,
        transformOrigin: '50% 50%',
        filter: 'blur(1.5px)', // 背景轻糊，衬前景飞卡
      }}>
        <FakeDashboard variant="A" />
      </div>
      {FLIES.map((fly, i) => (
        <FlyCard key={i} fly={fly} i={i} frame={frame} />
      ))}
    </div>
  );
};
return SmashCut;
}
