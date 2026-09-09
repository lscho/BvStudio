// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const SCROLL_START = 12;
const BRAKE = 59;
const PITCH = 156;
const ROW_H = 120;
const TARGET_ROW = 30;
const FINAL_SCROLL = TARGET_ROW * PITCH - 480;
const LIST_X = 360;
const LIST_W = 1200;
const scrollAt = (f: number): number => {
  if (f <= SCROLL_START) return 0;
  if (f <= 50) {
    return interpolate(f, [SCROLL_START, 50], [0, FINAL_SCROLL - 430], {
      easing: Easing.in(Easing.sin),
    });
  }
  if (f <= BRAKE) {
    return interpolate(f, [50, BRAKE], [FINAL_SCROLL - 430, FINAL_SCROLL + 30], {
      easing: Easing.out(Easing.cubic),
    });
  }
  return interpolate(f, [BRAKE, BRAKE + 4], [FINAL_SCROLL + 30, FINAL_SCROLL], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
};
const Row: React.FC<{ i: number; highlight: number }> = ({ i, highlight }) => (
  <div
    style={{
      position: 'absolute',
      top: i * PITCH,
      left: 0,
      width: LIST_W,
      height: ROW_H,
      background: highlight > 0 ? '#ffffff' : G.card,
      border: `${highlight > 0 ? 3 : 2}px solid ${highlight > 0 ? G.ink : G.border}`,
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      padding: '0 28px',
      boxSizing: 'border-box',
      boxShadow: highlight > 0 ? `0 10px 34px rgba(0,0,0,${0.2 * highlight})` : 'none',
    }}
  >
    <div style={{ width: 44, height: 44, borderRadius: 10, background: G.mid }} />
    <div style={{ height: 14, width: `${28 + ((i * 31) % 34)}%`, background: G.bar, borderRadius: 7 }} />
    <div style={{ height: 10, width: `${12 + ((i * 17) % 18)}%`, background: G.line, borderRadius: 5 }} />
    <div style={{ marginLeft: 'auto', height: 12, width: 120, background: G.line, borderRadius: 6 }} />
  </div>
);
const Corner: React.FC<{ flip: [number, number]; style: React.CSSProperties }> = ({ flip, style }) => (
  <div style={{ position: 'absolute', width: 46, height: 46, transform: `scale(${flip[0]}, ${flip[1]})`, ...style }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: 46, height: 8, background: G.ink, borderRadius: 3 }} />
    <div style={{ position: 'absolute', left: 0, top: 0, width: 8, height: 46, background: G.ink, borderRadius: 3 }} />
  </div>
);
const BrakeReticleLock: React.FC = () => {
  const f = useCurrentFrame();
  const scroll = scrollAt(f);

  // 速度段 blur：由相邻帧位移决定，冲刺段全糊，刹停即清晰
  const v = Math.abs(scroll - scrollAt(Math.max(0, f - 1)));
  const blur = Math.min(v * 0.12, 24);

  // 急刹帧起：高亮 0→1（6f），标签 63f 弹出
  const highlight = interpolate(f, [BRAKE, BRAKE + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 角标：急刹帧同帧从画外四方向飞入，back-out 超调咬合（59–68f）
  const lockT = interpolate(f, [BRAKE, BRAKE + 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(2.4)),
  });
  const fly = 1 - lockT; // 1=画外 0=咬合到位

  // 停点条目屏幕坐标（落定后 top=480）
  const rowTop = TARGET_ROW * PITCH - scroll;
  const GAP = 10; // 咬合位：角外扩 10px
  const rect = { x: LIST_X - GAP, y: rowTop - GAP, w: LIST_W + GAP * 2, h: ROW_H + GAP * 2 };

  const corners: Array<{ x: number; y: number; fromX: number; fromY: number; flip: [number, number] }> = [
    { x: rect.x - 23, y: rect.y - 23, fromX: -620, fromY: -320, flip: [1, 1] },
    { x: rect.x + rect.w - 23, y: rect.y - 23, fromX: 620, fromY: -320, flip: [-1, 1] },
    { x: rect.x - 23, y: rect.y + rect.h - 23, fromX: -620, fromY: 320, flip: [1, -1] },
    { x: rect.x + rect.w - 23, y: rect.y + rect.h - 23, fromX: 620, fromY: 320, flip: [-1, -1] },
  ];

  // 小标签：63f 从条目右侧弹出（超调）
  const tagT = interpolate(f, [BRAKE + 4, BRAKE + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(2.6)),
  });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      {/* 顶栏（不随滚动） */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 72, background: G.panel, borderBottom: `2px solid ${G.line}`, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 20, boxSizing: 'border-box', zIndex: 3 }}>
        <div style={{ height: 18, width: 220, background: G.bar, borderRadius: 9 }} />
        <div style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, background: G.mid }} />
      </div>

      {/* changelog 长列表：整体上掠，速度段 blur */}
      <div style={{ position: 'absolute', left: LIST_X, top: 0, width: LIST_W, height: 1080, filter: blur > 0.5 ? `blur(${blur}px)` : 'none' }}>
        <div style={{ position: 'absolute', top: -scroll, left: 0, width: LIST_W, height: 40 * PITCH }}>
          {Array.from({ length: 38 }).map((_, i) => (
            <Row key={i} i={i} highlight={i === TARGET_ROW ? highlight : 0} />
          ))}
        </div>
      </div>

      {/* 准星角标：急刹帧同帧挂载（组合命门：与刹停同帧共振） */}
      {f >= BRAKE &&
        corners.map((c, i) => (
          <Corner
            key={i}
            flip={c.flip}
            style={{ left: c.x + c.fromX * fly, top: c.y + c.fromY * fly, opacity: Math.min(1, lockT * 3 + 0.35) }}
          />
        ))}

      {/* 旁弹小标签 */}
      {f >= BRAKE + 4 && (
        <div
          style={{
            position: 'absolute',
            left: rect.x + rect.w + 28,
            top: rect.y + rect.h / 2 - 27,
            transform: `scale(${tagT})`,
            transformOrigin: 'left center',
            padding: '12px 26px',
            borderRadius: 27,
            background: G.ink,
            color: '#ffffff',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: 0.5,
          }}
        >
          {contentText(content, "copy0", "v2.41")}</div>
      )}
    </div>
  );
};
return BrakeReticleLock;
}
