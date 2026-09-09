// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import layout from '@/compositions/shotcraftLibrary/demos/_textures/live-layout.json';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const C4 = layout.projects.cards[3];
const VIEW_Y = 180;
const MaskWipeReal: React.FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [40, 85], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.bezier(0.5, 0, 0.2, 1),
  });
  // 卡在屏幕空间的初始 geometry（全景视口下）
  const g0 = { x: C4.x, y: C4.y - VIEW_Y, w: C4.w, h: C4.h, r: 12 };
  const x = interpolate(t, [0, 1], [g0.x, 0]);
  const y = interpolate(t, [0, 1], [g0.y, 0]);
  const w = interpolate(t, [0, 1], [g0.w, 1920]);
  const h = interpolate(t, [0, 1], [g0.h, 1080]);
  const r = interpolate(t, [0, 1], [g0.r, 0]);
  // 窗内新景（detail 视角用 papers 页顶部模拟）：从 0.42 缩放反向长到 1
  const innerScale = interpolate(t, [0, 1], [0.42, 1]);
  return (
    <AbsoluteFill style={{ backgroundColor: '#f9f6f1', overflow: 'hidden' }}>
      {/* 背景：projects 全景 */}
      <Img
        src={staticFile('textures/live/projects-full.png')}
        style={{ position: 'absolute', left: 0, top: -VIEW_Y, width: 1920 }}
      />
      {/* 卡片即窗口 */}
      <div
        style={{
          position: 'absolute', left: x, top: y, width: w, height: h,
          borderRadius: r, overflow: 'hidden',
          boxShadow: t > 0 && t < 1 ? '0 16px 56px rgba(31,28,23,0.25)' : 'none',
        }}
      >
        {/* 窗内新景：projects 页深部（detail 语义），反向补偿铺满 */}
        <div
          style={{
            position: 'absolute', width: 1920, height: 1080,
            left: '50%', top: '50%',
            transform: `translate(-50%, -50%) scale(${innerScale})`,
            overflow: 'hidden', background: '#f9f6f1',
          }}
        >
          <Img
            src={staticFile('textures/live/projects-full.png')}
            style={{ position: 'absolute', left: 0, top: -846, width: 1920 }}
          />
        </div>
        {/* 卡片脸：随放大渐隐露出窗内景 */}
        <Img
          src={staticFile('textures/live/card4-hires.png')}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: Math.max(0, 1 - t * 2.2),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
return MaskWipeReal;
}
