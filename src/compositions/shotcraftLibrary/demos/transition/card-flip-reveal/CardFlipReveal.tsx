// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CW = 440;
const CH = 300;
const GAP = 60;
const X0 = (1920 - (CW * 3 + GAP * 2)) / 2;
const Y = (1080 - CH) / 2;
const FLIP_START = 18;
const STAGGER = 10;
const FLIP_DUR = 18;
const SETTLE = 8;
const OVERSHOOT = 12;
const RESULTS = [contentText(content, "copy1", "4.9×"), contentText(content, "copy2", "−38%"), contentText(content, "copy3", "99.9%")];
const angleAt = (f: number, i: number): number => {
  const s = FLIP_START + i * STAGGER;
  if (f < s + FLIP_DUR) {
    return interpolate(f, [s, s + FLIP_DUR], [0, 180 + OVERSHOOT], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.55, 0, 0.3, 1),
    });
  }
  return interpolate(f, [s + FLIP_DUR, s + FLIP_DUR + SETTLE], [180 + OVERSHOOT, 180], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.poly(5)),
  });
};
const Sheen: React.FC<{ angle: number }> = ({ angle }) => {
  const pos = interpolate(angle, [35, 145], [-25, 115], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const op = Math.max(0, 1 - Math.abs(angle - 90) / 55);
  if (op <= 0.004) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 14,
        pointerEvents: 'none',
        opacity: op,
        background: `linear-gradient(105deg, rgba(0,0,0,0) ${pos - 14}%, rgba(0,0,0,0.32) ${pos}%, rgba(0,0,0,0) ${pos + 14}%)`,
      }}
    />
  );
};
const FlipCard: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const angle = angleAt(frame, i);
  return (
    <div
      style={{
        position: 'absolute',
        left: X0 + i * (CW + GAP),
        top: Y,
        width: CW,
        height: CH,
        perspective: 1200,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${angle}deg)`,
        }}
      >
        {/* 正面：占位卡 */}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
          <Card w={CW} h={CH} seed={i + 1} />
          <Sheen angle={angle} />
        </div>
        {/* 背面：白卡 + 大号结论数字（预先转 180°，翻满后正读） */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: G.card,
            border: `2px solid ${G.border}`,
            borderRadius: 14,
            boxSizing: 'border-box',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 800,
              fontSize: 96,
              color: G.ink,
              letterSpacing: -2,
            }}
          >
            {RESULTS[i]}
          </span>
          <Sheen angle={angle} />
        </div>
      </div>
    </div>
  );
};
const CardFlipReveal: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy0", "CARD FLIP REVEAL")} size={54} />
      </div>
      {[0, 1, 2].map((i) => (
        <FlipCard key={i} i={i} frame={frame} />
      ))}
    </div>
  );
};
return CardFlipReveal;
}
