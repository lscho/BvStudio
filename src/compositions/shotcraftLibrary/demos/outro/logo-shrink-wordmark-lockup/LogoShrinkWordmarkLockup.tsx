// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const ACCENT = '#e0342c';
const WORDMARK = contentText(content, "copy1", "BRAND");
const ICON = 30;
const SHIFT = -68;
const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
};
const Arcs: React.FC<{ a0: number; a1: number; col: string; w: number; blur: number; opacity: number; stroke?: string }> = ({
  a0,
  a1,
  col,
  w,
  blur,
  opacity,
  stroke,
}) => (
  <g opacity={opacity}>
    {[
      [a0, a1],
      [a0 + 180, a1 + 180],
    ].map(([b0, b1], i) => (
      <path
        key={i}
        d={arcPath(15, 15, 10.5, b0, b1)}
        fill="none"
        stroke={stroke ?? col}
        strokeWidth={w}
        strokeLinecap="round"
        style={blur ? { filter: `blur(${blur}px)` } : undefined}
      />
    ))}
  </g>
);
const LogoShrinkWordmarkLockup: React.FC = () => {
  const t = useT();
  // 收束：scale 5.4→1（easeInOut），末尾轻微 1.05 过冲刹车
  const k = seg(t, 0.02, 0.28, E.inOutCubic);
  const brake = Math.sin(seg(t, 0.26, 0.37) * Math.PI) * 0.06;
  const s = lerp(k, 5.4, 1) * (1 + brake);
  // 左移让位：落位后 t 0.34-0.47
  const shift = seg(t, 0.34, 0.47, E.inOutCubic) * SHIFT;
  // 霓虹缺口态 → 实心白 O 交叉淡化（随收束进行）
  const heal = seg(t, 0.10, 0.28, E.inOutQuad);
  // 底色标定：原样片 mp4（yuv420p，无色彩元数据）把 #05060a 解码回 rgb(3,5,9)，
  // 深底上 2/255 的恒差会拖垮平坦区 SSIM，这里钉到解码值；其余数值与 effect.js 一致
  return (
    <DesignStage bg="#030509">
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* 图标：SVG 双弧切口环 —— 抽象几何 mark，非任何具体品牌 logo（收束时缺口愈合、霓虹转纯白） */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: ICON,
            height: ICON,
            margin: `${-ICON / 2}px 0 0 ${-ICON / 2}px`,
            transform: `translateX(${shift}px) scale(${s})`,
          }}
        >
          <svg
            viewBox="0 0 30 30"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            {/* 霓虹晕（带缺口） */}
            <Arcs a0={-32} a1={122} col="rgba(110,90,255,.6)" w={6.5} blur={2.5} opacity={1 - heal} />
            {/* 霓虹芯：heal 过半后转纯白 */}
            <Arcs
              a0={-32}
              a1={122}
              col="#dfe9ff"
              w={3.4}
              blur={0}
              opacity={1 - heal * 0.75}
              stroke={heal > 0.5 ? '#fff' : '#dfe9ff'}
            />
            {/* 愈合后的实心白 O */}
            <circle cx={15} cy={15} r={10.5} fill="none" stroke="#fff" strokeWidth={5.5} opacity={heal} />
          </svg>
        </div>
        {/* 字母行（图标右侧）：从左到右 stagger，opacity 0→1 + translateX 8px→0 */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(50% - 40px)',
            top: '50%',
            height: ICON,
            marginTop: -ICON / 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {[...WORDMARK].map((ch, i) => {
            const lk = seg(t, 0.46 + i * 0.035, 0.46 + i * 0.035 + 0.10, E.outCubic);
            return (
              <span
                key={i}
                style={{
                  color: '#f2f5fa',
                  font: "800 27px/1 -apple-system,'Helvetica Neue',sans-serif",
                  letterSpacing: 2,
                  opacity: lk,
                  transform: `translateX(${lerp(lk, 8, 0)}px)`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        {/* 强调色标语（占位文案）：延迟整行淡入 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(50% + 34px)',
            textAlign: 'center',
            color: ACCENT,
            font: '600 13px/1 -apple-system,sans-serif',
            letterSpacing: 5,
            opacity: seg(t, 0.72, 0.84, E.outQuad),
          }}
        >
          {contentText(content, "copy0", "BUILD. SHIP. REPEAT.")}</div>
      </div>
    </DesignStage>
  );
};
return LogoShrinkWordmarkLockup;
}
