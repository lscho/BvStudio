// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { renderToStaticMarkup } from "react-dom/server";
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const maskText = contentText(content, "copy1", "SCALE");
const naturalWidth = Array.from(maskText).reduce((width, character) => width + (character.codePointAt(0)! > 255 ? 360 : 240), 0);
const maskWidth = Math.min(1500, Math.max(1, naturalWidth));
const maskFontSize = 360 * Math.min(1, 1500 / Math.max(1, naturalWidth));
const MASK_SVG = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={1920} height={1080}><text x={960} y={540} dominantBaseline="central" fontFamily="Helvetica, Arial, sans-serif" fontSize={maskFontSize} fontWeight={900} letterSpacing={0} textAnchor="middle" textLength={maskWidth} lengthAdjust="spacingAndGlyphs" fill="white">{maskText}</text></svg>);
const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(MASK_SVG)}")`;
const ORIGIN = '61.5% 50%';
const TextAsMask: React.FC = () => {
  const f = useCurrentFrame();
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  // 结尾撤场进度：100–130f 单段 bezier
  const endT = interpolate(f, [100, 130], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  // dashboard 内容运动：20–100f 匀速漂移，100–130f 归位到全屏
  const driftX = interpolate(f, [20, 100], [110, -110], clamp);
  const dx = f < 100 ? driftX : interpolate(endT, [0, 1], [-110, 0]);
  const dashS = interpolate(endT, [0, 1], [1.15, 1]);

  // mask 层放大（内容层反向抵消，dashboard 不跟着几何畸变）
  const maskS = interpolate(endT, [0, 1], [1, 26]);
  // 无遮罩全屏层淡入，保证接管彻底
  const cover = interpolate(endT, [0.25, 0.9], [0, 1], clamp);
  // 底部小注释：撤场时淡出
  const caption = interpolate(f, [100, 114], [1, 0], clamp);

  const dashMotion: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: `translateX(${dx}px) scale(${dashS})`,
    transformOrigin: '50% 50%',
  };

  return (
    <div style={{ width: 1920, height: 1080, background: G.ink, position: 'relative', overflow: 'hidden' }}>
      {/* 遮罩层：wrapper 负责 mask + 放大；inner 用 1/S 反向缩放抵消内容形变 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${maskS})`,
          transformOrigin: ORIGIN,
          WebkitMaskImage: MASK_URL,
          maskImage: MASK_URL,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: '1920px 1080px',
          maskSize: '1920px 1080px',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 / maskS})`, transformOrigin: ORIGIN }}>
          <div style={dashMotion}>
            <FakeDashboard variant="A" />
          </div>
        </div>
      </div>

      {/* 接管层：同一运动变换的全屏 dashboard，撤场时淡入到 1 */}
      <div style={{ position: 'absolute', inset: 0, opacity: cover }}>
        <div style={dashMotion}>
          <FakeDashboard variant="A" />
        </div>
      </div>

      {/* 底部小注释 */}
      <div
        style={{
          position: 'absolute',
          bottom: 90,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: 10,
          color: G.mid,
          opacity: caption,
        }}
      >
        {contentText(content, "copy0", "TEXT AS MASK")}</div>
    </div>
  );
};
return TextAsMask;
}
