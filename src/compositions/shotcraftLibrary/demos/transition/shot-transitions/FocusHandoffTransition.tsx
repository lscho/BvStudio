// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const PAGE_H = 1746;
const A_VIEW_Y = -180;
const B_VIEW_Y = -900;
const Scene: React.FC = () => {
  const frame = useCurrentFrame();

  // A 景：24→40 淡出 + blur 加深 + 略推出（前景滑出焦平面）
  const aOut = interpolate(frame, [24, 40], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.45, 0, 0.3, 1),
  });
  const aBlur = aOut * 8;
  const aDrift = aOut * 60; // 轻微左移，读作"滑出"而非原地淡

  // B 景：26→42 收焦入场（错开 2f 起跑），8px→0 + 淡入 + 反向滑入
  const bIn = interpolate(frame, [26, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const bBlur = (1 - bIn) * 8;
  const bDrift = (1 - bIn) * -50; // 反向（从右滑入）

  return (
    <AbsoluteFill style={{ backgroundColor: '#faf7f2', overflow: 'hidden' }}>
      {/* A 景：同一页的上半部（网格区） */}
      <div style={{ position: 'absolute', opacity: 1 - aOut, filter: `blur(${aBlur}px)`, transform: `translateX(${-aDrift}px)` }}>
        <Img
          src={staticFile('textures/live/projects-full.png')}
          style={{ position: 'absolute', left: 0, top: A_VIEW_Y, width: 1920, height: PAGE_H }}
        />
      </div>

      {/* B 景（上层）：同一页的下半部（sections 区），交叉窗口内收焦 */}
      <div style={{ position: 'absolute', opacity: bIn, filter: `blur(${bBlur}px)`, transform: `translateX(${bDrift}px)` }}>
        <Img
          src={staticFile('textures/live/projects-full.png')}
          style={{ position: 'absolute', left: 0, top: B_VIEW_Y, width: 1920, height: PAGE_H }}
        />
      </div>
    </AbsoluteFill>
  );
};
const FocusHandoffTransition: React.FC = () => (
  <Scene />
);
return FocusHandoffTransition;
}
