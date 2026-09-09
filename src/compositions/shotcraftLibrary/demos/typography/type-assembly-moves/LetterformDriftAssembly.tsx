// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const h = (n: number) => {
  const s = Math.sin(n * 127.3) * 43758.5453;
  return s - Math.floor(s);
};
const WORD = contentText(content, "copy0", "ASSEMBLE");
const TRAVEL = 45;
const STAG = 3;
const LetterformDriftAssembly: React.FC = () => {
  const frame = useCurrentFrame();
  const chars = WORD.split('');

  // 整词收束呼吸：80–92 放大到 1.04，92–104 回落，之后恒 1 → 帧确定
  const breath =
    frame < 92
      ? interpolate(frame, [80, 92], [1, 1.04], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        })
      : interpolate(frame, [92, 104], [1.04, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy1", "LETTERFORM DRIFT ASSEMBLY")} size={54} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${breath})`,
        }}
      >
        {chars.map((c, i) => {
          const start = i * STAG;
          const lock = start + TRAVEL;
          // 漂入进度
          const p = interpolate(frame, [start, lock], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          });
          // seeded 起始向量：方向 h(i)，幅度 260–360px
          const ang = h(i + 1) * Math.PI * 2;
          const mag = 260 + h(i + 101) * 100;
          const dx = Math.cos(ang) * mag * (1 - p);
          const dy = Math.sin(ang) * mag * (1 - p);
          const blur = 8 * (1 - p);
          const op = interpolate(p, [0, 1], [0.35, 1]);
          // 锁定加深脉冲：lock→lock+8，三角波 0→1→0
          const pulse =
            frame <= lock || frame >= lock + 8
              ? 0
              : frame < lock + 4
                ? (frame - lock) / 4
                : (lock + 8 - frame) / 4;
          const shade = Math.round(47 * (1 - pulse)); // #2f(47)→#00
          const color = `rgb(${shade},${shade},${shade})`;
          const strokeW = 3 * pulse;
          return (
            <span
              key={i}
              style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 800,
                fontSize: 140,
                letterSpacing: 8,
                color,
                display: 'inline-block',
                transform: `translate(${dx}px, ${dy}px)`,
                opacity: op,
                filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
                WebkitTextStroke: strokeW > 0.01 ? `${strokeW}px #000` : undefined,
              }}
            >
              {c}
            </span>
          );
        })}
      </div>
    </div>
  );
};
return LetterformDriftAssembly;
}
