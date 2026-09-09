// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, FakeDashboard } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CUT = 120;
const SlowPushIn: React.FC = () => {
  const frame = useCurrentFrame();

  // ---- 景 B：帧 120 起，满屏亮面板，完全静止 ----
  if (frame >= CUT) {
    return <FakeDashboard variant="A" />;
  }

  // ---- 景 A：0–120f 慢推 ----
  // 匀加速推近：Easing.in(quad)——前段几乎不可察，后段可感
  const scale = interpolate(frame, [0, CUT], [1.0, 1.14], {
    easing: Easing.in(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 暗角同步加深：压迫感的第二来源
  const vignette = interpolate(frame, [0, CUT], [0, 0.5], {
    easing: Easing.in(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.side,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Helvetica, Arial, sans-serif',
      }}
    >
      {/* 被推近的内容层：整体 scale */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale})`,
          transformOrigin: '50% 50%',
        }}
      >
        <div
          style={{
            fontSize: 300,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: -6,
            lineHeight: 1,
          }}
        >
          {contentText(content, "copy0", "10x")}</div>
        <div
          style={{
            marginTop: 36,
            fontSize: 40,
            fontWeight: 500,
            color: '#b8b8b6',
            letterSpacing: 6,
          }}
        >
          {contentText(content, "copy1", "FASTER THAN BASELINE")}</div>
      </div>

      {/* 暗角层：四角径向渐变，随推近同步加深 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: vignette,
          background:
            'radial-gradient(ellipse 62% 55% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.95) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
return SlowPushIn;
}
