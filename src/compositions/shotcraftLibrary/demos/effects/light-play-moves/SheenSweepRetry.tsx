// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CARD_W = 760;
const CARD_H = 420;
const SHEEN_W = CARD_W * 1.6;
const SheenSweepRetry: React.FC = () => {
  const frame = useCurrentFrame();

  // 扫光：40–68f，从卡左外(-SHEEN_W)扫到卡右外(CARD_W)，inOut(cubic)，只一次
  const sweepActive = frame >= 40 && frame <= 68;
  const x = interpolate(frame, [40, 68], [-SHEEN_W, CARD_W], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          background: G.side,
          borderRadius: 24,
          overflow: 'hidden', // 圆角裁剪：高光带被卡的圆角裁住
          position: 'relative',
          boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
          boxSizing: 'border-box',
          padding: '64px 72px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <div
          style={{
            fontSize: 130,
            fontWeight: 800,
            color: '#f5f5f3',
            letterSpacing: 2,
            lineHeight: 1,
          }}
        >
          {contentText(content, "copy0", "PRO")}</div>
        <div style={{ height: 16, width: 380, background: G.sideBar, borderRadius: 8 }} />
        <div style={{ height: 16, width: 260, background: G.sideBar, borderRadius: 8 }} />

        {/* 高光带：条件挂载，扫完即摘罩，收尾真静止 */}
        {sweepActive && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: SHEEN_W,
              height: CARD_H,
              transform: `translateX(${x}px)`,
              background:
                'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.32) 50%, transparent 58%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
};
return SheenSweepRetry;
}
