// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const PATH = 'M 400 705 L 2600 705 L 2600 375 L 3160 375 L 3160 705 L 2600 705';
const SEGS: Array<[number, number, number, number, number]> = [
  [400, 705, 2600, 705, 2200],
  [2600, 705, 2600, 375, 330],
  [2600, 375, 3160, 375, 560],
  [3160, 375, 3160, 705, 330],
  [3160, 705, 2600, 705, 560],
];
const TOTAL = 3980;
const tipAt = (drawn: number): [number, number] => {
  let d = Math.max(0, Math.min(drawn, TOTAL));
  for (const [x1, y1, x2, y2, len] of SEGS) {
    if (d <= len) {
      const t = d / len;
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }
    d -= len;
  }
  return [2600, 705];
};
const LineCarryTransition: React.FC = () => {
  const frame = useCurrentFrame();

  // 镜头：34–94f 左移 1920px，inOut cubic
  const cam = interpolate(frame, [34, 94], [0, 1920], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 已画长度：三段接力（进度条 → 冲出 → 与镜头同速 → 收框）
  let drawn: number;
  if (frame < 24) {
    drawn = interpolate(frame, [0, 24], [0, 560], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (frame < 34) {
    drawn = interpolate(frame, [24, 34], [560, 1100], {
      extrapolateRight: 'clamp',
    });
  } else if (frame < 94) {
    drawn = 1100 + cam; // 与镜头同速延伸，笔头稳在画面偏右
  } else {
    drawn = interpolate(frame, [94, 112], [3020, TOTAL], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  // B 卡内容：框闭合(112f)后淡入 12f
  const contentOpacity = interpolate(frame, [112, 124], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 笔头墨点：全程随笔走，112–118f 线性消散，118f 起条件卸载
  const tipMounted = frame < 118;
  const tipOpacity = interpolate(frame, [112, 118], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const [tx, ty] = tipAt(drawn);

  return (
    <AbsoluteFill style={{ background: G.bg, overflow: 'hidden' }}>
      {/* 世界容器：3840 宽，整体横移 = 镜头跟线走 */}
      <div
        style={{
          position: 'absolute',
          width: 3840,
          height: 1080,
          transform: `translateX(${-cam}px)`,
        }}
      >
        {/* B 半世界底色略浅，卖出"新世界" */}
        <div style={{ position: 'absolute', left: 1920, top: 0, width: 1920, height: 1080, background: G.panel }} />

        {/* 场景 A：标题 + 卡 + 进度条轨道（ink 填充即 path 本体） */}
        <div style={{ position: 'absolute', left: 400, top: 250 }}>
          <TitleBlock text={contentText(content, "copy0", "Scene A")} size={56} />
        </div>
        <Card w={560} h={330} seed={2} style={{ position: 'absolute', left: 400, top: 350 }} />
        <div style={{ position: 'absolute', left: 400, top: 702, width: 560, height: 6, borderRadius: 3, background: G.line }} />

        {/* 一条线全程 evolve：dasharray/dashoffset 生长 */}
        <svg width={3840} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <path
            d={PATH}
            fill="none"
            stroke={G.ink}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={TOTAL}
            strokeDashoffset={TOTAL - drawn}
          />
          {tipMounted && <circle cx={tx} cy={ty} r={11} fill={G.ink} opacity={tipOpacity} />}
        </svg>

        {/* 场景 B：框(2600,375–3160,705)由线画成，内容淡入 */}
        <div
          style={{
            position: 'absolute',
            left: 2600,
            top: 375,
            width: 560,
            height: 330,
            boxSizing: 'border-box',
            padding: 26,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            opacity: contentOpacity,
          }}
        >
          <div style={{ height: 18, width: '58%', background: G.bar, borderRadius: 9 }} />
          <div style={{ height: 11, width: '86%', background: G.line, borderRadius: 5 }} />
          <div style={{ height: 11, width: '72%', background: G.line, borderRadius: 5 }} />
          <div style={{ height: 11, width: '64%', background: G.line, borderRadius: 5 }} />
          <div style={{ marginTop: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: G.mid }} />
            <div style={{ height: 11, width: 90, background: G.line, borderRadius: 5 }} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 2600, top: 275, opacity: contentOpacity }}>
          <TitleBlock text={contentText(content, "copy1", "Scene B")} size={56} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
return LineCarryTransition;
}
