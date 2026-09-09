// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, interpolateColors, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const ROW = 210;
const DW = 126;
const FS = 190;
const SPIN = 0.85;
const VALUE = contentText(content, "copy1", "00.00");
const DIGITS = /^\d{2}\.\d{2}$/u.test(VALUE) ? VALUE.replace(".", "").split("").map(Number) : [0, 0, 0, 0];
const posAt = (f: number, i: number): number => {
  const d = DIGITS[i];
  const s = 20 + i * 7; // 开始减速帧
  const p0 = SPIN * s;
  // 最小再走 6 行后，落在个位 = d 的最近整数位置
  const T = Math.ceil((p0 + 6 - d) / 10) * 10 + d;
  if (f < s) return SPIN * Math.max(f, 0);
  if (f < s + 16)
    return interpolate(f, [s, s + 16], [p0, T + 0.5], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  if (f < s + 22)
    return interpolate(f, [s + 16, s + 22], [T + 0.5, T], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  return T;
};
const Strip: React.FC<{ pos: number; color: string; opacity?: number; dy?: number }> = ({
  pos,
  color,
  opacity = 1,
  dy = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: DW,
      transform: `translateY(${-(pos % 10) * ROW + dy}px)`,
      opacity,
    }}
  >
    {Array.from({ length: 20 }).map((_, k) => (
      <div
        key={k}
        style={{
          width: DW,
          height: ROW,
          lineHeight: `${ROW}px`,
          textAlign: 'center',
          fontSize: FS,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color,
        }}
      >
        {k % 10}
      </div>
    ))}
  </div>
);
const DigitReel: React.FC<{ frame: number; i: number; color: string }> = ({ frame, i, color }) => {
  const pos = posAt(frame, i);
  const speed = Math.abs(pos - posAt(frame - 1, i));
  const gate = interpolate(speed, [0.06, 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'relative', width: DW, height: ROW, overflow: 'hidden' }}>
      {gate > 0.001 && (
        <>
          <Strip pos={pos} color={color} opacity={0.25 * gate} dy={ROW * 0.5} />
          <Strip pos={pos} color={color} opacity={0.12 * gate} dy={-ROW * 0.5} />
        </>
      )}
      <Strip pos={pos} color={color} />
    </div>
  );
};
const StaticGlyph: React.FC<{ ch: string; color: string; w?: number }> = ({ ch, color, w }) => (
  <div
    style={{
      width: w,
      height: ROW,
      lineHeight: `${ROW}px`,
      textAlign: 'center',
      fontSize: FS,
      fontWeight: 800,
      fontVariantNumeric: 'tabular-nums',
      color,
    }}
  >
    {ch}
  </div>
);
const OdometerDigitRoll: React.FC = () => {
  const frame = useCurrentFrame();
  // 全位锁定于 63f：整体加深脉冲 ink→#000→ink（8f），附微缩放加码可感性
  const inkNow = interpolateColors(frame, [63, 67, 71], [G.ink, '#000000', G.ink]);
  const pulseScale = interpolate(frame, [63, 67, 71], [1, 1.035, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const labelOp = interpolate(frame, [66, 84], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy0", "ODOMETER DIGIT ROLL")} size={54} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 400,
          width: 1920,
          display: 'flex',
          justifyContent: 'center',
          fontFamily: 'Helvetica, Arial, sans-serif',
          transform: `scale(${pulseScale})`,
          transformOrigin: '960px 105px',
        }}
      >
        <DigitReel frame={frame} i={0} color={inkNow} />
        <DigitReel frame={frame} i={1} color={inkNow} />
        <StaticGlyph ch="." color={inkNow} w={70} />
        <DigitReel frame={frame} i={2} color={inkNow} />
        <DigitReel frame={frame} i={3} color={inkNow} />
        <StaticGlyph ch={contentText(content, "copy2", "%")} color={inkNow} />
      </div>
      {/* 下方标签条：全部锁定后淡入 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 680,
          width: 1920,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          opacity: labelOp,
        }}
      >
        <div style={{ width: 520, height: 22, background: G.bar, borderRadius: 11 }} />
        <div style={{ width: 320, height: 14, background: G.line, borderRadius: 7 }} />
      </div>
    </div>
  );
};
return OdometerDigitRoll;
}
