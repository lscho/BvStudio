// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const W = 1920;
const CARD_W = 420;
const CARD_H = 260;
const CARD_Y = (1080 - CARD_H) / 2;
const X_LEFT = 120;
const X_RIGHT = 1380;
const X_CENTER = (W - CARD_W) / 2;
const OVERSHOOT = 36;
const SWITCH = 48;
const ARRIVE = 70;
const SETTLE = 75;
const pos1 = (t: number): number =>
  interpolate(t, [0, SWITCH], [X_LEFT, X_RIGHT], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
const pos2 = (t: number): number =>
  interpolate(t, [SWITCH, ARRIVE, SETTLE], [X_RIGHT, X_CENTER - OVERSHOOT, X_CENTER], {
    easing: Easing.out(Easing.poly(4)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
const SakugaTimingShift: React.FC = () => {
  const f = useCurrentFrame();
  const onThrees = f < SWITCH;

  // ---- 卡片位置 ----
  const q = Math.floor(f / 3) * 3; // 一拍三驱动帧
  const x = onThrees ? pos1(q) : pos2(f);

  // 顿挫段 rotate 摆动（随 q 冻结，一步一个姿势）
  const rot = onThrees
    ? Math.sin(q * 0.7) * 5
    : interpolate(f, [SWITCH, SWITCH + 8], [Math.sin(SWITCH * 0.7) * 5, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // 冲刺段速度（位置差分，帧时间解耦）→ 运动拉伸
  const v = onThrees ? 0 : Math.abs(pos2(f) - pos2(f - 1));
  const sFac = Math.min(v / 55, 1);
  const stretchX = 1 + 0.35 * sFac; // 峰值 ≈1.35，横向拉丝
  const stretchY = 1 - 0.12 * sFac;

  // 落位急停回弹：72–78f scaleX 压扁再回 1
  const sqX = interpolate(f, [SETTLE - 3, SETTLE, SETTLE + 3], [1, 0.9, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sqY = interpolate(f, [SETTLE - 3, SETTLE, SETTLE + 3], [1, 1.07, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 冲刺残影：只在段二速度高时挂载（条件挂载，不留 opacity 0 的壳）
  const ghosts =
    !onThrees && f > SWITCH + 1 && f < ARRIVE + 2 && sFac > 0.15
      ? [
          { xg: pos2(f - 2), op: 0.28 * sFac },
          { xg: pos2(f - 4), op: 0.13 * sFac },
        ]
      : [];

  // ---- 角标 "on 3s" / "on 1s"，line-boil，f=108 后冻结 ----
  const h = (n: number) => {
    const s = Math.sin(n * 127.3) * 43758.5453;
    return s - Math.floor(s);
  };
  const qb = Math.min(Math.floor(f / 4) * 4, 108); // boil 驱动帧，108 后冻结
  const bx = (h(qb + 1) - 0.5) * 7;
  const by = (h(qb + 2) - 0.5) * 7;
  const brot = (h(qb + 3) - 0.5) * 3;
  // 切换瞬间角标弹一下
  const pop = interpolate(f, [SWITCH, SWITCH + 3, SWITCH + 9], [1, 1.35, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleOp = interpolate(f, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 90, width: '100%', textAlign: 'center', opacity: titleOp }}>
        <TitleBlock text={contentText(content, "copy0", "SAKUGA TIMING SHIFT")} size={64} />
      </div>

      {/* 轨道基线 + 中央落位虚线槽 */}
      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 100,
          top: CARD_Y + CARD_H + 24,
          height: 3,
          background: G.line,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: X_CENTER,
          top: CARD_Y,
          width: CARD_W,
          height: CARD_H,
          border: `3px dashed ${G.bar}`,
          borderRadius: 14,
          boxSizing: 'border-box',
        }}
      />

      {/* 冲刺残影 */}
      {ghosts.map((g, i) => (
        <div
          key={`ghost-${i}`}
          style={{ position: 'absolute', left: 0, top: CARD_Y, opacity: g.op, transform: `translateX(${g.xg}px)` }}
        >
          <Card w={CARD_W} h={CARD_H} seed={4} />
        </div>
      ))}

      {/* 主卡 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: CARD_Y,
          transform: `translateX(${x}px) rotate(${rot}deg) scaleX(${stretchX * sqX}) scaleY(${stretchY * sqY})`,
          transformOrigin: '50% 50%',
        }}
      >
        <Card w={CARD_W} h={CARD_H} seed={4} />
      </div>

      {/* 角标：on 3s / on 1s */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 160,
          transform: `translate(${bx}px, ${by}px) rotate(${brot}deg) scale(${pop})`,
          transformOrigin: '0% 50%',
          fontFamily: 'Courier New, monospace',
          fontWeight: 700,
          fontSize: 84,
          color: G.ink,
          borderBottom: `6px solid ${G.ink}`,
          paddingBottom: 6,
        }}
      >
        {onThrees ? 'on 3s' : 'on 1s'}
      </div>
    </div>
  );
};
return SakugaTimingShift;
}
