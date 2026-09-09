// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const CX = 240;
const CY = 138;
const N = 140;
const BASE = 76;
const rA = (th: number) => BASE * (1 + 0.3 * Math.cos(th * 3) + 0.05 * Math.sin(th * 7 + 0.8));
const rB = (th: number) => BASE * (1 + 0.26 * Math.sin(th * 5 + 1.2) + 0.06 * Math.cos(th * 2));
const RAD_A: number[] = [];
const RAD_B: number[] = [];
for (let i = 0; i < N; i++) {
  const th = (i / N) * Math.PI * 2;
  RAD_A.push(rA(th));
  RAD_B.push(rB(th));
}
const build = (m: number) => {
  let d = '';
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = lerp(m, RAD_A[i], RAD_B[i]);
    const x = (CX + Math.cos(th) * r).toFixed(1);
    const y = (CY + Math.sin(th) * r).toFixed(1);
    d += (i ? 'L' : 'M') + x + ',' + y;
  }
  return d + 'Z';
};
const SvgShapeMorph: React.FC = () => {
  const t = useT();
  const m1 = seg(t, 0.08, 0.42, E.inOutCubic); // A → B
  const m2 = seg(t, 0.58, 0.92, E.inOutCubic); // B → A
  const m = m1 - m2; // 0=A 1=B
  const d = build(m);
  const hue = lerp(m, 185, 305);
  // 变形中段的 scale 呼吸 + 缓慢自转
  const breath = 1 + 0.045 * (Math.sin(m1 * Math.PI) + Math.sin(m2 * Math.PI));
  const rot = Math.sin(t * Math.PI * 2) * 4;
  return (
    <DesignStage bg="#0a0b10">
      <svg
        viewBox="0 0 480 270"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#0a0b10' }}
      >
        <g transform={`translate(${CX},${CY}) scale(${breath}) rotate(${rot}) translate(${-CX},${-CY})`}>
          <path d={d} fill={`hsla(${hue},80%,58%,.14)`} />
          <path
            d={d}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            stroke={`hsl(${hue},90%,66%)`}
            style={{ filter: `drop-shadow(0 0 8px hsla(${hue},90%,60%,.4))` }}
          />
        </g>
        <text
          x={CX}
          y={252}
          textAnchor="middle"
          fill="#5b6480"
          opacity={0.4 + 0.6 * Math.abs(m - 0.5) * 2}
          style={{ font: '10px "SF Mono",Menlo,monospace', letterSpacing: '2px' }}
        >
          {m > 0.5 ? 'morphTo(shapeB)' : 'morphTo(shapeA)'}
        </text>
      </svg>
    </DesignStage>
  );
};
return SvgShapeMorph;
}
