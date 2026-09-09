// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const easeInCubic = Easing.in(Easing.cubic);
const easeOutCubic = Easing.out(Easing.cubic);
const TITLE_START = 36;
const IMPACT_1 = 51;
const CARD_STAGGER = 5;
const CARD_DUR = 12;
const IMPACT_2 = IMPACT_1 + 3 * CARD_STAGGER + CARD_DUR;
const SIDE_END = IMPACT_2 + 14;
const SIDE_SETTLE = SIDE_END + 8;
const shake = (f: number, at: number, amp: number) => {
  if (f < at || f > at + 4) return 0;
  const seq = [amp, -amp * 0.6, amp * 0.3, -amp * 0.12, 0];
  return seq[f - at];
};
const CARD_W = 340;
const CARD_H = 220;
const GAP = 40;
const ROW_W = 4 * CARD_W + 3 * GAP;
const ROW_LEFT = 1080 - ROW_W / 2;
const CARD_TOP = 700;
const DominoCascade: React.FC = () => {
  const frame = useCurrentFrame();

  // ① 标题砸落：画外顶 → 上半屏，ease-in 加速读作"砸"
  const titleTop = interpolate(frame, [TITLE_START, IMPACT_1], [-260, 240], {
    easing: easeInCubic,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 两次撞击的全画面竖向震动
  const shakeY = shake(frame, IMPACT_1, 10) + shake(frame, IMPACT_2, 6);

  // ② 卡片弹跳：抛物线 4t(1-t)，依次隔 5f
  const cardDy = (i: number) => {
    const s = IMPACT_1 + i * CARD_STAGGER;
    const t = Math.min(1, Math.max(0, (frame - s) / CARD_DUR));
    return -60 * 4 * t * (1 - t);
  };
  // 末卡落地时向左歪 3°（横向动量的可见出处），随后回正
  const lastCardRot = interpolate(
    frame,
    [IMPACT_2 - 9, IMPACT_2, SIDE_END],
    [0, -3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ③ 侧边栏横向撞滑：带初速滑入 + 过冲回弹
  let sideX: number;
  if (frame < IMPACT_2) {
    sideX = -260;
  } else if (frame < SIDE_END) {
    const t = (frame - IMPACT_2) / (SIDE_END - IMPACT_2);
    sideX = -260 + 272 * easeOutCubic(t); // 冲到 +12（约 5% 过冲）
  } else if (frame < SIDE_SETTLE) {
    const t = (frame - SIDE_END) / (SIDE_SETTLE - SIDE_END);
    sideX = 12 * (1 - Easing.inOut(Easing.quad)(t));
  } else {
    sideX = 0;
  }

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, overflow: 'hidden', position: 'relative' }}>
      {/* 全画面震动容器 */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${shakeY}px)` }}>
        {/* 地板线：卡片落点 */}
        <div style={{ position: 'absolute', left: ROW_LEFT - 30, top: 928, width: ROW_W + 60, height: 6, background: G.bar, borderRadius: 3 }} />

        {/* ① 砸落的标题 */}
        <div style={{ position: 'absolute', left: 240, width: 1680, top: titleTop, display: 'flex', justifyContent: 'center' }}>
          <TitleBlock text={contentText(content, "copy0", "CHAIN REACTION")} size={120} />
        </div>

        {/* ② 被震弹起的 4 张卡片 */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: ROW_LEFT + i * (CARD_W + GAP),
              top: CARD_TOP,
              transform: `translateY(${cardDy(i)}px)${i === 3 ? ` rotate(${lastCardRot}deg)` : ''}`,
              transformOrigin: '50% 100%',
            }}
          >
            <Card w={CARD_W} h={CARD_H} seed={i + 2} />
          </div>
        ))}

        {/* ③ 被撞滑进场的侧边栏 */}
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: 240, height: 1080,
            background: G.side, transform: `translateX(${sideX}px)`,
            padding: '32px 24px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', gap: 22,
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#777775' }} />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 13, width: `${58 + ((i * 31) % 38)}%`, background: G.sideBar, borderRadius: 6 }} />
          ))}
        </div>
      </div>
    </div>
  );
};
return DominoCascade;
}
