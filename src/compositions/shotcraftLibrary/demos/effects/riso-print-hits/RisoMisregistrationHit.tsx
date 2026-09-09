// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const HIT = 28;
const SNAP = 72;
const AX = 16;
const AY = 7;
const OMEGA = (2 * Math.PI) / 18;
const TAU = 60;
const Plate: React.FC<{ color: string; dx: number; dy: number }> = ({ color, dx, dy }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `translate(${dx}px, ${dy}px)`,
      mixBlendMode: 'multiply',
    }}
  >
    <div
      style={{
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontWeight: 800,
        fontSize: 200,
        color,
        letterSpacing: -1,
        whiteSpace: 'nowrap',
      }}
    >
      {contentText(content, "copy0", "IMPACT")}</div>
  </div>
);
const RisoMisregistrationHit: React.FC = () => {
  const frame = useCurrentFrame();

  // 阶段判定
  const entering = frame >= 20 && frame < HIT; // 撞入
  const split = frame >= HIT && frame < SNAP; // 双版错位震荡
  const showSingle = frame < HIT || frame >= SNAP; // 正体（画外/撞入/套准后）

  // 撞入位移：右画外 1400px → 0，8f Easing.in(cubic)（加速撞停）
  const slideX = interpolate(frame, [20, HIT], [1400, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 错位震荡包络：t 自命中起，衰减余弦（帧 72 前仍有可见残余，硬切归零成"啪"）
  const t = frame - HIT;
  const m = split ? Math.cos(OMEGA * t) * Math.exp(-t / TAU) : 0;
  const dx = AX * m;
  const dy = AY * m;

  // 套准合一脉冲：帧 72 起 4f scale 1.03 → 1，之后精确 1（保证结尾真静止）
  const pulse =
    frame >= SNAP && frame < SNAP + 4 ? 1 + 0.03 * (1 - (frame - SNAP) / 4) : 1;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 底部装饰线：全程静止的布景锚点 */}
      <div
        style={{
          position: 'absolute',
          left: 510,
          top: 740,
          width: 900,
          height: 6,
          borderRadius: 3,
          background: G.bar,
        }}
      />

      {/* 正体：画外等待 / 撞入 / 套准后（撞入前 frame<20 时在画外，视觉等同空场） */}
      {showSingle && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translateX(${entering || frame < 20 ? slideX : 0}px) scale(${pulse})`,
            transformOrigin: 'center center',
          }}
        >
          <TitleBlock text={contentText(content, "copy0", "IMPACT")} size={200} />
        </div>
      )}

      {/* 双版错位：浅灰版与深墨版反向偏移，multiply 叠加出"重影套印" */}
      {split && (
        <>
          <Plate color={G.mid} dx={-dx} dy={dy} />
          <Plate color={G.ink} dx={dx} dy={-dy} />
        </>
      )}
    </div>
  );
};
return RisoMisregistrationHit;
}
