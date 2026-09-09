// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard, TitleBlock, G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const PEAK = 52;
const LightLeakBurn: React.FC = () => {
  const frame = useCurrentFrame();

  // 光团沿对角线的位移进度：右上外 → 左下外，贯穿 25–95
  const sweep = interpolate(frame, [25, 95], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.4, 0, 0.3, 1),
  });

  // 光强包络：25–PEAK 爬升（ease-in 有蓄力感），PEAK–95 收敛（ease-out 余温）
  const rise = interpolate(frame, [25, PEAK], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const fall = interpolate(frame, [PEAK, 95], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const intensity = frame <= PEAK ? rise : fall;

  // 光团中心：从画面右上外侧斜扫到左下外侧（有方向的漏光）
  const cx = interpolate(sweep, [0, 1], [2350, -650]);
  const cy = interpolate(sweep, [0, 1], [-500, 1500]);

  // 三团琥珀光的偏移与直径（seed 正弦哈希做微差，避免完美同心）
  const blobs = [0, 1, 2].map((i) => {
    const j1 = (Math.sin(i * 127.3) * 43758) % 1; // -1..1 小数
    const j2 = (Math.sin(i * 311.7) * 27183) % 1;
    return {
      dx: i * 260 - 260 + j1 * 90, // 沿扫掠方向拖尾排布
      dy: i * 200 - 200 + j2 * 70,
      d: 1500 + i * 450, // 直径 1500 / 1950 / 2400
      color: ['#f6c878', '#e8a44a', '#d98a2b'][i],
      alpha: [0.95, 0.8, 0.55][i],
    };
  });

  // 峰值时页面被光冲淡：对比度降、亮度抬（旧页被"烧穿"的感觉）
  const pageFilter = `contrast(${1 - intensity * 0.45}) brightness(${1 + intensity * 0.35})`;

  // 全屏暖色罩：峰值时约 8%
  const warmWash = intensity * 0.08;

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      {/* 页面层：光峰帧前是旧页（网格），之后是新页（列表+标题）——切点藏在最亮处 */}
      <AbsoluteFill style={{ filter: pageFilter }}>
        {frame <= PEAK ? (
          <FakeDashboard variant="A" />
        ) : (
          <>
            <FakeDashboard variant="B" />
            <div style={{ position: 'absolute', left: 288, top: 132 }}>
              <TitleBlock text={contentText(content, "copy0", "Next Page")} size={64} />
            </div>
          </>
        )}
      </AbsoluteFill>

      {/* 全屏暖色罩：峰值 8%，让高光溢出带温度 */}
      <AbsoluteFill
        style={{
          background: '#e8a44a',
          opacity: warmWash,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      {/* 琥珀漏光层：3 团大直径径向渐变，blur 90px，screen 叠加，沿对角线扫过 */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {blobs.map((b, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx + b.dx - b.d / 2,
              top: cy + b.dy - b.d / 2,
              width: b.d,
              height: b.d,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${b.color} 0%, ${b.color}cc 30%, transparent 68%)`,
              filter: 'blur(90px)',
              mixBlendMode: 'screen',
              opacity: b.alpha * intensity,
            }}
          />
        ))}
        {/* 峰值核心过曝：光心一小团接近白的热核，峰值帧吞掉约七成画面 */}
        <div
          style={{
            position: 'absolute',
            left: cx - 550,
            top: cy - 550,
            width: 1100,
            height: 1100,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fff3dd 0%, #f6c878aa 45%, transparent 70%)',
            filter: 'blur(80px)',
            mixBlendMode: 'screen',
            opacity: intensity * intensity, // 只在临近峰值时才烧起来
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
return LightLeakBurn;
}
