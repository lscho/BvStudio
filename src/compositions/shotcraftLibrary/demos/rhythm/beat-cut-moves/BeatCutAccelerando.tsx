// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
type View = { variant: 'A' | 'B'; scale: number; cx: number; cy: number };
const VIEWS: View[] = [
  { variant: 'A', scale: 1, cx: 960, cy: 540 },    // v0 全景（建立）
  { variant: 'A', scale: 1.8, cx: 1070, cy: 576 }, // v1 卡片区
  { variant: 'A', scale: 2.6, cx: 600, cy: 340 },  // v2 单卡特写
  { variant: 'B', scale: 1, cx: 960, cy: 540 },    // v3 列表页全景
  { variant: 'B', scale: 1.9, cx: 1070, cy: 500 }, // v4 列表行区
  { variant: 'B', scale: 2.8, cx: 1070, cy: 290 }, // v5 单行特写
];
const CUTS = [0, 49, 65, 77, 85, 91, 95];
const FINAL = 95;
const ViewShot: React.FC<{ view: View; extraScale?: number }> = ({ view, extraScale = 1 }) => {
  const s = view.scale * extraScale;
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        transformOrigin: `${view.cx}px ${view.cy}px`,
        transform: `translate(${960 - view.cx}px, ${540 - view.cy}px) scale(${s})`,
      }}
    >
      <FakeDashboard variant={view.variant} />
    </div>
  );
};
const BeatCutAccelerando: React.FC = () => {
  const frame = useCurrentFrame();

  // 当前落在哪个区间（末段 = 主画面 v0）
  let seg = 0;
  for (let i = 0; i < CUTS.length; i++) {
    if (frame >= CUTS[i]) seg = i;
  }
  const isFinal = seg === CUTS.length - 1;
  const view = isFinal ? VIEWS[0] : VIEWS[seg];

  // 末段慢推：scale 1 → 1.06，ease-out，推 22f 后静止（结尾静止 ≥15f）
  const push = isFinal
    ? interpolate(frame, [FINAL, FINAL + 20], [1, 1.06], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
    : 1;

  // 每次硬切的 1f 亮度跳变（约 +5%）模拟快门
  const isCutFrame = CUTS.some((c, i) => i > 0 && frame === c);
  const flash = isCutFrame ? 1.05 : 1;

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, filter: `brightness(${flash})` }}>
        <ViewShot view={view} extraScale={push} />
      </div>
      {/* 切帧再叠一层极薄白闪，保证肉眼可感 */}
      {isCutFrame && (
        <AbsoluteFill style={{ background: '#ffffff', opacity: 0.06 }} />
      )}
    </AbsoluteFill>
  );
};
return BeatCutAccelerando;
}
