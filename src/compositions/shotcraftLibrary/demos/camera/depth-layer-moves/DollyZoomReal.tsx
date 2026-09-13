// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, useCurrentFrame, Easing, contentAppearance, useShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const theme = contentAppearance(content);
const heroSize = content.imageSizes?.[0] ?? { width: 1920, height: 1080 };
const heroHeight = 520 * heroSize.height / Math.max(1, heroSize.width);
const DollyZoomReal: React.FC = () => {
  const frame = useCurrentFrame();
  const { images } = useShotcraftContent();
  const t = interpolate(frame, [15, 110], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.bezier(0.4, 0, 0.3, 1),
  });
  const bgScale = 1 + t * 1.25;
  const bgBlur = t * 3.5;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.surface, overflow: 'hidden' }}>
      {/* 背景：整页 + 卡群，从画面中心膨胀逼近 */}
      <div
        style={{
          position: 'absolute', inset: 0,
          transform: `scale(${bgScale})`, transformOrigin: '960px 540px',
          opacity: 0.45 + t * 0.15,
        }}
      >
        {Array.from({ length: 7 }, (_, k) => (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: [120, 1390, 240, 1260, 620, 820, 50][k],
              top: [90, 140, 730, 760, 20, 850, 430][k],
              width: 360, height: 230, borderRadius: 18,
              border: `2px solid ${theme.accent}55`,
              background: `${theme.surface}cc`,
              boxShadow: `0 ${8 + bgBlur}px ${24 + bgBlur * 4}px rgba(0,0,0,0.36)`,
            }}
          />
        ))}
      </div>
      {/* 主体：高清卡视觉大小恒定钉在屏中，落影渐深强调"世界在动我不动" */}
      <Img
        src={images[0]}
        style={{
          position: 'absolute', left: 960 - 260, top: 540 - heroHeight / 2, width: 520, height: heroHeight,
          objectFit: 'contain', background: theme.surface, zIndex: 2,
          borderRadius: 14,
          boxShadow: `0 ${12 + t * 16}px ${40 + t * 28}px rgba(31,28,23,${0.16 + t * 0.10})`,
        }}
      />
    </AbsoluteFill>
  );
};
return DollyZoomReal;
}
