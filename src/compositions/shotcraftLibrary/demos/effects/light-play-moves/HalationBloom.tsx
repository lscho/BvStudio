// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const BG = '#2a2a28';
const WHITE = '#f7f7f5';
const MID = '#8f8f8d';
const ZOOM_START = 8;
const IMPACT = 15;
const REBOUND_END = 17;
const POP_END = IMPACT + 6;
const FALL_END = POP_END + 20;
const SETTLE_END = FALL_END + 15;
const TextBlock: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: 260,
      fontWeight: 800,
      color,
      letterSpacing: '-0.02em',
      lineHeight: 1,
      whiteSpace: 'nowrap',
    }}
  >
    {contentText(content, "copy0", "10x")}</div>
);
const HalationBloom: React.FC = () => {
  const frame = useCurrentFrame();

  // —— crash-zoom 入场：scale 2.4 → 0.94（7f in-quad 加速撞停）→ 1（2f 回弹）——
  const zoomIn = interpolate(frame, [ZOOM_START, IMPACT], [2.4, 0.94], {
    easing: Easing.in(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rebound = interpolate(frame, [IMPACT, REBOUND_END], [0.94, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textScale = frame < IMPACT ? zoomIn : rebound;
  const textOpacity = interpolate(frame, [ZOOM_START, ZOOM_START + 3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // —— 晕层：撞停帧起条件挂载 ——
  // 扩散（scale）：out-cubic，6f 猛涨 1 → 1.3
  const bloomScale = interpolate(frame, [IMPACT, POP_END], [1, 1.3], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 消散（opacity）：与扩散解耦——猛涨段保持全亮，随后 20f 线性回落到 0.35
  const bloomFall = interpolate(frame, [POP_END, FALL_END], [1, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 驻留晕 15f 缓收到 0.22 稳态
  const bloomSettle = interpolate(frame, [FALL_END, SETTLE_END], [0.35, 0.22], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bloomOpacity = frame < FALL_END ? bloomFall : bloomSettle;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: BG,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 小标签，全程静态 */}
      <div
        style={{
          position: 'absolute',
          top: 110,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '0.35em',
          color: MID,
        }}
      >
        {contentText(content, "copy1", "HALATION BLOOM")}</div>

      {/* 晕层：文字复制底层，blur + 提亮，撞停帧起条件挂载 */}
      {frame >= IMPACT && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${bloomScale})`,
            opacity: bloomOpacity,
            filter: 'blur(22px) brightness(1.8)',
          }}
        >
          <TextBlock color={WHITE} />
        </div>
      )}

      {/* 本体文字：crash-zoom 急停 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${textScale})`,
          opacity: textOpacity,
        }}
      >
        <TextBlock color={WHITE} />
      </div>
    </div>
  );
};
return HalationBloom;
}
