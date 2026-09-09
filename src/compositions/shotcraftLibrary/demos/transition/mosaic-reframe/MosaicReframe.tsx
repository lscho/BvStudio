// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, rand, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const smooth = (x: number) => x * x * (3 - 2 * x);
type Box = { x: number; y: number; w: number; h: number; rot: number };
const KEYS = ['x', 'y', 'w', 'h', 'rot'] as const;
const acc = (t: number, base: Box, kfs: { at: [number, number]; to: Box }[], ease: (x: number) => number): Box => {
  const out: Box = { ...base };
  let prev = base;
  for (const kf of kfs) {
    const u = seg(t, kf.at[0], kf.at[1], ease);
    for (const k of KEYS) out[k] += u * (kf.to[k] - prev[k]);
    prev = kf.to;
  }
  return out;
};
const gw = (92 - 3 * 2) / 4, gh = (92 - 2 * 2) / 3;
const A: Box[] = Array.from({ length: 12 }, (_, i) => {
  const c = i % 4, r = (i / 4) | 0;
  return { x: 4 + c * (gw + 2), y: 4 + r * (gh + 2), w: gw, h: gh, rot: 0 };
});
const uw = (92 - 5 * 1.2) / 6, uh = (92 - 3 * 1.2) / 4;
const SLOTS: [number, number, number, number][] = [
  [0, 0, 3, 2], [3, 0, 1, 1], [4, 0, 1, 1], [5, 0, 1, 1], [3, 1, 2, 1], [5, 1, 1, 1],
  [0, 2, 1, 1], [1, 2, 2, 1], [3, 2, 1, 2], [4, 2, 2, 1], [0, 3, 3, 1], [4, 3, 2, 1],
];
const B: Box[] = SLOTS.map(([c, r, cw, rh]) => ({
  x: 4 + c * (uw + 1.2), y: 4 + r * (uh + 1.2),
  w: cw * uw + (cw - 1) * 1.2, h: rh * uh + (rh - 1) * 1.2, rot: 0,
}));
const C: Box[] = Array.from({ length: 12 }, (_, i) => ({
  x: 1 + i * 6.4, y: -7 + i * 7.6, w: 23, h: 27, rot: -15 + i * 3,
}));
const MosaicReframe: React.FC = () => {
  const t = useT();
  return (
    <DesignStage bg="#0a0b10" raster="zoom">
      {A.map((base, i) => {
        const hue = 198 + i * 13;
        const st = i * 0.007; // ≈ index*2 帧微 stagger
        const v = acc(t, base, [
          { at: [0.26 + st, 0.42 + st], to: B[i] }, // A → B
          { at: [0.62 + st, 0.80 + st], to: C[i] }, // hold 后 B → C
        ], smooth);
        const pop = seg(t, i * 0.012, i * 0.012 + 0.14, E.outCubic); // 开场逐片浮现
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              borderRadius: 7,
              overflow: 'hidden',
              background: `linear-gradient(${140 + i * 9}deg,hsl(${hue},58%,42%),hsl(${hue + 26},64%,20%))`,
              boxShadow: `0 8px 22px rgba(0,0,0,.45),inset 0 0 0 1px hsla(${hue},70%,72%,.22)`,
              left: `${v.x}%`,
              top: `${v.y}%`,
              width: `${v.w}%`,
              height: `${v.h}%`,
              transform: `rotate(${v.rot}deg) scale(${lerp(pop, 0.82, 1)})`,
              opacity: pop,
              zIndex: 10 + (i === 0 ? 5 : 0),
            }}
          >
            {/* 占位"图片"内容：一枚圆点 + 两条信息条 */}
            <div
              style={{
                position: 'absolute',
                left: 9,
                top: 9,
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: `hsla(${hue + 40},90%,78%,.95)`,
                boxShadow: `0 0 10px hsla(${hue + 40},90%,70%,.7)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 9,
                bottom: 16,
                height: 5,
                width: `${34 + rand(i) * 30}%`,
                borderRadius: 3,
                background: 'hsla(0,0%,100%,.6)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 9,
                bottom: 8,
                height: 4,
                width: `${20 + rand(i + 7) * 24}%`,
                borderRadius: 2,
                background: 'hsla(0,0%,100%,.28)',
              }}
            />
          </div>
        );
      })}
    </DesignStage>
  );
};
return MosaicReframe;
}
