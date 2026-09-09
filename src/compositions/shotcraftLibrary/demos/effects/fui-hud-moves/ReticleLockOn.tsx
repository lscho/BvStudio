// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, FakeDashboard } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CARD_X = 220 + 36 + 524 + 28;
const CARD_Y = 72 + 36;
const CARD_W = 524;
const CARD_H = 425;
const PAD = 14;
const TCX = CARD_X + CARD_W / 2;
const TCY = CARD_Y + CARD_H / 2;
const FLY_IN = 14;
const FLY_END = 24;
const LOCK_END = 46;
const LABEL_END = 56;
const ARM = 56;
const THICK = 10;
const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const ReticleLockOn: React.FC = () => {
  const frame = useCurrentFrame();

  // 飞入：整框从右下画外冲进来，同时是个放大 2.2× 的大框
  const flyT = interpolate(frame, [FLY_IN, FLY_END], [0, 1], {
    easing: Easing.out(Easing.cubic),
    ...clamp,
  });
  const flyDX = (1 - flyT) * 1100;
  const flyDY = (1 - flyT) * 620;

  // 收缩咬合：半宽/半高从 2.2× 收到贴紧，带超调（收过头 6% 再弹回）
  const shrink = interpolate(
    frame,
    [FLY_END, LOCK_END - 8, LOCK_END - 3, LOCK_END],
    [2.2, 1.06, 0.94, 1],
    { easing: Easing.inOut(Easing.cubic), ...clamp },
  );
  const hw = (CARD_W / 2 + PAD) * shrink;
  const hh = (CARD_H / 2 + PAD) * shrink;

  // 咬合帧：卡片微亮（一层白色 overlay 快闪后停在 0.28）
  const glow = interpolate(frame, [LOCK_END, LOCK_END + 3, LOCK_END + 10], [0, 0.55, 0.28], clamp);

  // 标签：咬合后从角标右上弹出（scaleX 展开 + 淡入）
  const labelT = interpolate(frame, [LOCK_END + 2, LABEL_END], [0, 1], {
    easing: Easing.out(Easing.back(1.8)),
    ...clamp,
  });

  const showReticle = frame >= FLY_IN;
  const locked = frame >= LOCK_END;

  // 四个 L 角：位置 = 中心 ± (hw, hh)，各自镜像
  const corners = [
    { x: TCX - hw, y: TCY - hh, sx: 1, sy: 1 },
    { x: TCX + hw, y: TCY - hh, sx: -1, sy: 1 },
    { x: TCX - hw, y: TCY + hh, sx: 1, sy: -1 },
    { x: TCX + hw, y: TCY + hh, sx: -1, sy: -1 },
  ];

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, overflow: 'hidden', position: 'relative' }}>
      <FakeDashboard variant="A" />
      {/* 咬合微亮层：条件渲染，锁定前不存在 */}
      {locked && (
        <div
          style={{
            position: 'absolute',
            left: CARD_X,
            top: CARD_Y,
            width: CARD_W,
            height: CARD_H,
            borderRadius: 14,
            background: '#ffffff',
            opacity: glow,
            pointerEvents: 'none',
          }}
        />
      )}
      {showReticle && (
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${flyDX}px, ${flyDY}px)` }}>
          {corners.map((c, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: c.x,
                top: c.y,
                transform: `scale(${c.sx}, ${c.sy})`,
                transformOrigin: '0 0',
              }}
            >
              {/* L 形角标：横臂 + 竖臂 */}
              <div style={{ position: 'absolute', left: 0, top: 0, width: ARM, height: THICK, background: G.ink }} />
              <div style={{ position: 'absolute', left: 0, top: 0, width: THICK, height: ARM, background: G.ink }} />
            </div>
          ))}
          {/* 小标签：右上角标外侧弹出 */}
          {frame >= LOCK_END + 2 && (
            <div
              style={{
                position: 'absolute',
                left: TCX + hw + 18,
                top: TCY - hh - 6,
                transform: `scale(${labelT})`,
                transformOrigin: '0 50%',
                background: G.ink,
                color: '#fff',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 700,
                fontSize: 26,
                padding: '10px 18px',
                borderRadius: 8,
                whiteSpace: 'nowrap',
                opacity: Math.min(1, labelT * 1.5),
              }}
            >
              {contentText(content, "copy0", "TARGET · CARD_02")}</div>
          )}
        </div>
      )}
    </div>
  );
};
return ReticleLockOn;
}
