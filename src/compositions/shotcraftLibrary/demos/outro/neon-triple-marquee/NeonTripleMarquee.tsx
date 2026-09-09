// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from "@/compositions/shotcraftLibrary/runtime";
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const MarqueeRow: React.FC<{
  word: string;
  color: string;
  dir: 1 | -1;
  speed: number; // px/frame
  frame: number;
  y: number;
  fontSize: number;
  brightness: number; // 0..1 脉冲亮度
}> = ({ word, color, dir, speed, frame, y, fontSize, brightness }) => {
  // 逐字符估宽（上限估计），保证槽位 >= 实际文本宽，副本不重叠
  const est = word.length * fontSize * 0.92;
  const unitW = est + fontSize * 1.3; // 词间空隙（含分隔点）
  const copies = Math.ceil(1920 / unitW) + 3;
  const offsetRaw = (frame * speed) % unitW;
  const offset = dir === 1 ? -unitW * 1.5 + offsetRaw : -unitW * 0.5 - offsetRaw;

  const strokeW = 5 + brightness * 3;

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        width: '100%',
        height: fontSize * 1.1,
        overflow: 'visible',
        transform: `translateX(${offset}px)`,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize,
        letterSpacing: 4,
        lineHeight: 1,
        color: 'transparent',
        WebkitTextStroke: `${strokeW}px ${color}`,
        opacity: 0.35 + brightness * 0.65,
        filter: `drop-shadow(0 0 ${8 + brightness * 22}px ${color}) drop-shadow(0 0 ${
          20 + brightness * 50
        }px ${color})`,
      }}
    >
      {Array.from({ length: copies }).map((_, i) => (
        <span
          key={i}
          style={{ position: 'absolute', left: i * unitW, top: 0, whiteSpace: 'nowrap' }}
        >
          {word}
          <span style={{ display: 'inline-block', transform: `translateX(${fontSize * 0.4}px)` }}>
            {'•'}
          </span>
        </span>
      ))}
    </div>
  );
};
const NeonTripleMarquee: React.FC = () => {
  const f = useCurrentFrame();

  // 三行轮流脉冲：周期 45 帧，每行占 1/3 相位，余弦软脉冲
  const pulse = (idx: number) => {
    const period = 45;
    const phase = (((f - idx * (period / 3)) % period) + period) % period;
    const t = phase / period;
    if (t < 1 / 3) return 0.5 - 0.5 * Math.cos(t * 3 * Math.PI * 2);
    return 0;
  };

  // 入场淡入 + 结尾整组淡出
  const groupOpacity = interpolate(f, [0, 10, 128, 148], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const rows: { word: string; color: string; dir: 1 | -1; speed: number }[] = [
    { word: contentText(content, "copy0", "BETTER"), color: '#4d9fff', dir: 1, speed: 14 },
    { word: contentText(content, "copy1", "FASTER"), color: '#ff4dd2', dir: -1, speed: 17 },
    { word: contentText(content, "copy2", "STRONGER"), color: '#ffb347', dir: 1, speed: 14 },
  ];

  return (
    <AbsoluteFill style={{ background: '#050308', overflow: 'hidden' }}>
      <div style={{ opacity: groupOpacity, position: 'absolute', inset: 0 }}>
        {rows.map((r, i) => (
          <MarqueeRow
            key={r.word}
            word={r.word}
            color={r.color}
            dir={r.dir}
            speed={r.speed}
            frame={f}
            y={40 + i * 350}
            fontSize={300}
            brightness={pulse(i)}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
return NeonTripleMarquee;
}
