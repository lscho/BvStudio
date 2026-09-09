// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const K = '#c792ea';
const ID = '#e8eaf0';
const FN = '#82aaff';
const ST = '#c3e88d';
const PU = '#89ddff';
const CM = '#546e7a';
const LINES: [string, string][][] = [
  [[contentText(content, "copy0", "const "), K], [contentText(content, "copy1", "app"), ID], [' = ', PU], [contentText(content, "copy2", "createApp"), FN], ['();', ID]],
  [[contentText(content, "copy1", "app"), ID], ['.', PU], [contentText(content, "copy3", "use"), FN], ['(', ID], [contentText(content, "copy4", "router"), ID], [');', ID]],
  [[contentText(content, "copy1", "app"), ID], ['.', PU], [contentText(content, "copy5", "mount"), FN], ['(', ID], [contentText(content, "copy6", "'#root'"), ST], [');', ID]],
  [[contentText(content, "copy7", "// ready"), CM]],
];
const FLAT: { ch: string; color: string; row: number }[] = [];
LINES.forEach((line, row) => {
  for (const [txt, color] of line) for (const ch of txt) FLAT.push({ ch, color, row });
});
const Panel: React.FC<{ x: number; label: string; children: React.ReactNode }> = ({
  x,
  label,
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      left: `${x}%`,
      top: '14%',
      width: '45%',
      height: '72%',
      background: '#10121a',
      border: '1px solid #1c2030',
      borderRadius: 8,
      padding: '10px 12px',
      boxSizing: 'border-box',
      fontFamily: '"SF Mono",Menlo,monospace',
      fontSize: 12,
      lineHeight: 1.9,
    }}
  >
    <div style={{ fontSize: 8, letterSpacing: 2, color: '#4a5270', marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);
const TypingCodeBlock: React.FC = () => {
  const t = useT();
  // 右侧打字进度：t∈[0.08,0.9] 线性推进到全部字符
  const typed = Math.floor(seg(t, 0.08, 0.9) * FLAT.length);
  return (
    <DesignStage bg="#0a0b10">
      {/* 左：逐行淡入上浮（行级 stagger） */}
      <Panel x={3.5} label={contentText(content, "copy8", "LINE FADE-IN")}>
        {LINES.map((line, i) => {
          const k = seg(t, 0.08 + i * 0.14, 0.08 + i * 0.14 + 0.3, E.outCubic);
          return (
            <div key={i} style={{ opacity: k, transform: `translateY(${(1 - k) * 8}px)` }}>
              {line.map(([txt, color], j) => (
                <span key={j} style={{ color }}>
                  {txt}
                </span>
              ))}
            </div>
          );
        })}
      </Panel>
      {/* 右：逐字符打字（保色），当前字符位带方块光标底色 */}
      <Panel x={51.5} label={contentText(content, "copy9", "CHAR TYPING")}>
        {LINES.map((_, row) => (
          <div key={row} style={{ minHeight: '1.9em' }}>
            {FLAT.map((c, i) =>
              c.row === row ? (
                <span
                  key={i}
                  style={{
                    color: c.color,
                    // 光标位字符以底色块形式提示（保持可见）
                    opacity: i < typed || i === typed ? 1 : 0,
                    background: i === typed && typed < FLAT.length ? '#3a4468' : 'transparent',
                  }}
                >
                  {c.ch}
                </span>
              ) : null,
            )}
          </div>
        ))}
      </Panel>
    </DesignStage>
  );
};
return TypingCodeBlock;
}
