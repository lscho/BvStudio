// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const SPLIT = 20;
const POP = 3;
const STAGGER = 2;
const HOLD_END = 45;
const EXPAND_END = 57;
const outCubic = Easing.out(Easing.cubic);
const PageA: React.FC = () => (
  <div style={{ width: 1920, height: 1080, position: 'relative' }}>
    <FakeDashboard variant="A" />
    <div style={{
      position: 'absolute', left: 328, top: 320, width: 380, height: 160,
      background: G.card, borderRadius: 12, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 800, fontSize: 96, color: G.ink, letterSpacing: -2, lineHeight: 1 }}>
        {contentText(content, "copy0", "1,284")}</div>
      <div style={{ height: 10, width: 150, background: G.mid, borderRadius: 5 }} />
    </div>
  </div>
);
type PanelSpec = {
  clip: (f: number) => string; // clip-path polygon
  centroidX: number;           // 弹入缩放原点
  originX: number; originY: number; // 内容变换原点（焦点）
  baseScale: number;           // 机位倍率
  tx: number; ty: number;      // 焦点搬到格中心的位移
  z: number;
};
const ComicPanelSplit: React.FC = () => {
  const frame = useCurrentFrame();

  // ===== 摘罩：扩张完成后特写直出，分格结构 / 缝线全部卸载 =====
  if (frame >= EXPAND_END) {
    return (
      <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
        <div style={{
          width: 1920, height: 1080,
          transform: 'translate(442px, 140px) scale(2.6)',
          transformOrigin: '518px 400px',
        }}>
          <PageA />
        </div>
      </AbsoluteFill>
    );
  }

  // ===== 阶段 1：全屏 A =====
  if (frame < SPLIT) {
    return (
      <AbsoluteFill style={{ background: G.bg }}>
        <PageA />
      </AbsoluteFill>
    );
  }

  // ===== 阶段 2/3：分格 + 第三格扩张 =====
  // 定格期微推近（27–45f 线性，很缓）
  const push = interpolate(frame, [SPLIT + 2 * STAGGER + POP, HOLD_END], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  // 第三格扩张进度（扩散用 out-cubic）
  const ex = interpolate(frame, [HOLD_END, EXPAND_END], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outCubic,
  });

  // 第三格左斜边（= 边界2 吃屏轨迹）
  const e3Top = 1410 + ex * (-60 - 1410);    // 1410 → -60
  const e3Bot = 1180 + ex * (-290 - 1180);   // 1180 → -290

  const panels: PanelSpec[] = [
    { // 全景 1x
      clip: () => 'polygon(0px 0px, 745px 0px, 515px 1080px, 0px 1080px)',
      centroidX: 315, originX: 960, originY: 540,
      baseScale: 1 + push * 0.03, tx: 0, ty: 0, z: 1,
    },
    { // 卡片特写 1.9x（中上卡片）
      clip: () => 'polygon(755px 0px, 1400px 0px, 1170px 1080px, 525px 1080px)',
      centroidX: 962, originX: 1070, originY: 371,
      baseScale: 1.9 + push * 0.055, tx: -108, ty: 169, z: 1,
    },
    { // 数字区特写 2.6x（KPI 块），扩张时焦点从格中心搬到屏中心
      clip: () => `polygon(${e3Top}px 0px, 1920px 0px, 1920px 1080px, ${e3Bot}px 1080px)`,
      centroidX: 1607, originX: 518, originY: 400,
      // 扩张时 push 增量退掉，scale 收敛回 2.6（与摘罩帧完全一致）
      baseScale: 2.6 + push * 0.08 * (1 - ex), tx: 1089 + ex * (442 - 1089), ty: 140, z: 3,
    },
  ];

  // 缝线透明度：边界1 随第 2 格弹入出现、扩张期被吃前线性淡出；
  // 边界2 随第 3 格弹入出现、扩张末 4f 线性淡出（消散用线性）
  const seam1O = Math.min(
    interpolate(frame, [SPLIT + STAGGER, SPLIT + STAGGER + 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [HOLD_END, HOLD_END + 3], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );
  const seam2O = Math.min(
    interpolate(frame, [SPLIT + 2 * STAGGER, SPLIT + 2 * STAGGER + 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [EXPAND_END - 4, EXPAND_END], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );

  return (
    <AbsoluteFill style={{ background: '#ffffff' }}>
      {panels.map((p, i) => {
        const start = SPLIT + i * STAGGER;
        if (frame < start) return null; // 未弹入不渲染
        // 弹入：3f scale 1.06→1 + 加深脉冲
        const pop = interpolate(frame, [start, start + POP], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outCubic,
        });
        const popScale = 1.06 - 0.06 * pop;
        const pulse = 0.3 * (1 - pop);
        return (
          <div key={i} style={{
            position: 'absolute', inset: 0, zIndex: p.z,
            clipPath: p.clip(frame),
            transform: `scale(${popScale})`,
            transformOrigin: `${p.centroidX}px 540px`,
          }}>
            <div style={{
              width: 1920, height: 1080,
              transform: `translate(${p.tx}px, ${p.ty}px) scale(${p.baseScale})`,
              transformOrigin: `${p.originX}px ${p.originY}px`,
            }}>
              <PageA />
            </div>
            {pulse > 0.005 && (
              <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${pulse})` }} />
            )}
          </div>
        );
      })}
      {/* 斜缝：白缝命门 + 墨线描边（暗 16 下、白 10 上 → 两侧各 3px 墨边） */}
      {(seam1O > 0.005 || seam2O > 0.005) && (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
          {seam1O > 0.005 && (
            <g opacity={seam1O}>
              <line x1={750} y1={-10} x2={520} y2={1090} stroke="#2f2f2f" strokeWidth={16} />
              <line x1={750} y1={-10} x2={520} y2={1090} stroke="#ffffff" strokeWidth={10} />
            </g>
          )}
          {seam2O > 0.005 && (
            <g opacity={seam2O}>
              <line x1={e3Top - 5} y1={-10} x2={e3Bot - 5} y2={1090} stroke="#2f2f2f" strokeWidth={16} />
              <line x1={e3Top - 5} y1={-10} x2={e3Bot - 5} y2={1090} stroke="#ffffff" strokeWidth={10} />
            </g>
          )}
        </svg>
      )}
    </AbsoluteFill>
  );
};
return ComicPanelSplit;
}
