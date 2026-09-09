// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { CameraMotionBlur } from "@/compositions/shotcraftLibrary/runtime";
import { contentPageGeometry, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const TARGET = contentPageGeometry(content);
const VIEW_Y = 0;
const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [40, 46, 51], [1, 2.6, 2.45], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.bezier(0.55, 0, 0.7, 1),
  });
  const cx = interpolate(frame, [40, 46], [960, TARGET.cx], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad),
  });
  const cy = interpolate(frame, [40, 46], [VIEW_Y + 540, TARGET.cy], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: '#f9f6f1', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: 1920, height: TARGET.pageH,
          transform: `translate(${960 - cx * zoom}px, ${540 - cy * zoom}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <Img src={staticFile('textures/live/projects-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920 }} />
        {/* 高清目标卡覆盖原位，放大后文字仍锐（Q2） */}
        {(content.imageSizes?.length ?? 0) > 1 && <Img
          src={staticFile('textures/live/card4-hires.png')}
          style={{
            position: 'absolute',
            left: TARGET.rect.x, top: TARGET.rect.y,
            width: TARGET.rect.w, height: TARGET.rect.h,
          }}
        />}
      </div>
    </AbsoluteFill>
  );
};
const CrashZoomReal: React.FC = () => {
  const frame = useCurrentFrame();
  return frame >= 38 && frame <= 48 ? (
    <CameraMotionBlur shutterAngle={200} samples={20}>
      <Scene />
    </CameraMotionBlur>
  ) : (
    <Scene />
  );
};
return CrashZoomReal;
}
