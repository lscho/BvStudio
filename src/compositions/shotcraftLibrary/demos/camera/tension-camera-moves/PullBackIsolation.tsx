// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { Card } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, contentAppearance, useShotcraftContent, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const theme = contentAppearance(content);
const title = contentText(content, "copy0", "99.9%");
const SIBS = [
  { dx: -620, dy: -330, w: 360, h: 240, seed: 3 },
  { dx: 10, dy: -390, w: 420, h: 220, seed: 4 },
  { dx: 620, dy: -320, w: 380, h: 260, seed: 5 },
  { dx: -680, dy: 20, w: 340, h: 230, seed: 6 },
  { dx: 700, dy: 40, w: 360, h: 250, seed: 7 },
  { dx: -600, dy: 360, w: 400, h: 240, seed: 8 },
  { dx: 40, dy: 400, w: 440, h: 220, seed: 9 },
  { dx: 640, dy: 350, w: 370, h: 250, seed: 10 },
].map((s) => ({ ...s, dist: Math.hypot(s.dx, s.dy) }));
const RANKED = SIBS.map((_s, i) => i).sort((a, b) => SIBS[a].dist - SIBS[b].dist);
const FADE_START = RANKED.reduce<number[]>((acc, idx, rank) => {
  acc[idx] = 30 + rank * 8;
  return acc;
}, []);
const FADE_DUR = 16;
const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const PullBackIsolation: React.FC = () => {
  const frame = useCurrentFrame();
  const { images } = useShotcraftContent();

  // 相机后拉：2.2（怼脸特写）→ 0.62（大远景孤悬）
  const scale = interpolate(frame, [0, 110], [2.2, 0.62], {
    easing: Easing.out(Easing.cubic),
    ...clamp,
  });

  // 背景沉入黑暗：#ececea → #141414（60–110f）
  const bgT = interpolate(frame, [60, 110], [0, 1], { easing: Easing.inOut(Easing.quad), ...clamp });
  const bgC = Math.round(236 + (20 - 236) * bgT);
  const bg = `rgb(${bgC},${bgC},${bgC})`;

  // 主卡白光晕淡入（60–100f）
  const glow = interpolate(frame, [60, 100], [0, 0.35], { ...clamp });

  return (
    <div style={{ width: 1920, height: 1080, background: bg, overflow: 'hidden', position: 'relative' }}>
      {/* 相机容器：以主卡中心（画面中心）为原点整体缩放 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: '960px 540px',
        }}
      >
        {/* 兄弟卡：错峰熄灭 */}
        {SIBS.map((s, i) => {
          const t0 = FADE_START[i];
          const op = interpolate(frame, [t0, t0 + FADE_DUR], [1, 0], {
            easing: Easing.out(Easing.quad),
            ...clamp,
          });
          const bright = interpolate(frame, [t0, t0 + FADE_DUR], [1, 0.3], { ...clamp });
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 960 + s.dx - s.w / 2,
                top: 540 + s.dy - s.h / 2,
                opacity: op,
                filter: `brightness(${bright})`,
              }}
            >
              {images.length ? <Card w={s.w} h={s.h} seed={s.seed} /> : <div style={{ width: s.w, height: s.h, background: theme.surface, border: `2px solid ${theme.accent}`, borderRadius: 14 }} />}
            </div>
          );
        })}

        {/* 主卡：520×340 居中，叠大数字 + 白光晕 */}
        <div
          style={{
            position: 'absolute',
            left: 960 - 260,
            top: 540 - 170,
            width: 520,
            height: 340,
            borderRadius: 14,
            boxShadow: `0 0 80px rgba(255,255,255,${glow}), 0 0 160px rgba(255,255,255,${glow * 0.6})`,
          }}
        >
          {images.length > 0 && <Card w={520} h={340} seed={2} />}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.fontFamily,
              fontWeight: 800,
              fontSize: Math.min(128, 780 / Math.max(1, Array.from(title).length)),
              letterSpacing: 0,
              lineHeight: 1.3,
              padding: 28,
              boxSizing: 'border-box',
              textAlign: 'center',
              overflowWrap: 'anywhere',
              color: theme.color,
              background: theme.surface,
              borderRadius: 14,
            }}
          >
            {title}</div>
        </div>
      </div>
    </div>
  );
};
return PullBackIsolation;
}
