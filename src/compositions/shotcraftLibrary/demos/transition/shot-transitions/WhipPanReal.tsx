// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { CameraMotionBlur } from "@/compositions/shotcraftLibrary/runtime";
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const SWING = 2880;
const VIEW_Y = -180;
const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const dx = interpolate(frame, [35, 43], [0, SWING], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.6, 0, 0.4, 1),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: '#f9f6f1', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', transform: `translateX(${-dx}px)` }}>
        {/* A 景：项目板全满 */}
        <Img
          src={staticFile('textures/live/projects-full.png')}
          style={{ position: 'absolute', left: 0, top: VIEW_Y, width: 1920 }}
        />
        {/* 缝隙纸色空场 960px——甩动中段一晃而过，全糊 */}
        {/* B 景：同页底部 section（PERCEPTION & SENSING 区），换景可辨且内容饱满 */}
        <Img
          src={staticFile('textures/live/projects-full.png')}
          style={{ position: 'absolute', left: SWING, top: -666, width: 1920 }}
        />
      </div>
    </AbsoluteFill>
  );
};
const WhipPanReal: React.FC = () => (
  // 峰值 ~540px/f：采样按"回波间距 ≤ 字高"配，20 samples 拖影连续
  <CameraMotionBlur shutterAngle={200} samples={20}>
    <Scene />
  </CameraMotionBlur>
);
return WhipPanReal;
}
