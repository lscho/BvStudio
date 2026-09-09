// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
type Word = { text: string; start: number; end: number };
const LINES: Word[][] = [
  [
    { text: contentText(content, "copy0", "SHIP"), start: 20, end: 38 },
    { text: contentText(content, "copy1", "FASTER"), start: 42, end: 75 },
  ],
  [
    { text: contentText(content, "copy2", "BREAK"), start: 85, end: 103 },
    { text: contentText(content, "copy3", "NOTHING"), start: 107, end: 130 },
  ],
];
const KaraokeWord: React.FC<{ word: Word; frame: number }> = ({ word, frame }) => {
  // 词内 linear 填充进度，clamp 保证读完保持
  const p = interpolate(frame, [word.start, word.end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const active = frame >= word.start && frame < word.end; // 正在读这个词
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {/* 底层：浅灰未读字 */}
      <span style={{ color: G.line }}>{word.text}</span>
      {/* 上层：深字按进度从左到右揭开 */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          color: G.ink,
          clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
        }}
      >
        {word.text}
      </span>
      {/* 读指下划线：只在正在填的词下出现，右缘跟随填充进度 */}
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            bottom: -14,
            width: `${p * 100}%`,
            height: 8,
            background: G.ink,
          }}
        />
      )}
    </span>
  );
};
const KaraokeFillSync: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingLeft: 240,
        boxSizing: 'border-box',
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 130,
        fontWeight: 800,
        letterSpacing: 2,
        lineHeight: 1.45,
      }}
    >
      {LINES.map((words, li) => (
        <div key={li} style={{ display: 'flex', gap: 48 }}>
          {words.map((w) => (
            <KaraokeWord key={w.text} word={w} frame={frame} />
          ))}
        </div>
      ))}
    </div>
  );
};
return KaraokeFillSync;
}
