// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { useId } from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useShotcraftContent, contentAppearance } from "@/compositions/shotcraftLibrary/runtime";
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CARD_W = 460;
const GAP = 60;
const TARGET_I = 5;
const theme = contentAppearance(content);
const AMBER = theme.accent;
const FreezeAnnotateReal: React.FC = () => {
  const frame = useCurrentFrame();
  const { images } = useShotcraftContent();
  const focus = interpolate(frame, [40, 52, 96, 108], [1, 1.65, 1.65, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // 滤镜 ID 按实例生成，多实例同场不串引（useId 的 «:» 在 url() 里非法，需清洗）
  const roughId = `rough-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const src = interpolate(frame, [0, 45, 100, 135], [0, 45, 45, 94], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const dx = src * 22;
  const draw = interpolate(frame, [52, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const arrowDraw = interpolate(frame, [60, 66], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = interpolate(frame, [96, 104], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // 导轨起点 -880：定格时（dx=990）目标卡 k=5 中心 = -880+2600-990+230 = 960 屏中
  const X0 = -880;
  const targetX = X0 + TARGET_I * (CARD_W + GAP) - dx + CARD_W / 2;
  const C = 1750; // 椭圆周长近似
  return (
    <AbsoluteFill style={{ backgroundColor: theme.surface, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${focus})`, transformOrigin: "50% 52%" }}>
      <div style={{ position: 'absolute', top: 370, transform: `translateX(${-dx + X0}px)` }}>
        {Array.from({ length: 14 }).map((_, k) => {
          const isTarget = k === TARGET_I;
          return (
            <Img
              key={k}
              src={images[isTarget ? 0 : 1 + k % Math.max(1, images.length - 1)] ?? images[0] ?? ""}
              style={{
                position: 'absolute', left: k * (CARD_W + GAP), top: 0,
                width: CARD_W, height: 360, objectFit: "contain", borderRadius: 8,
                boxShadow: '0 4px 16px rgba(31,28,23,0.10)',
              }}
            />
          );
        })}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: fade }}>
        <defs>
          <filter id={roughId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
          </filter>
        </defs>
        <ellipse
          cx={targetX} cy={560} rx={290} ry={230}
          fill="none" stroke={AMBER} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - draw)}
          transform={`rotate(-6 ${targetX} 560)`}
          filter={`url(#${roughId})`}
        />
        <path
          d={`M ${targetX + 330} 190 Q ${targetX + 220} 240 ${targetX + 140} 320`}
          fill="none" stroke={AMBER} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={420} strokeDashoffset={420 * (1 - arrowDraw)}
          filter={`url(#${roughId})`}
        />
      </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
return FreezeAnnotateReal;
}
