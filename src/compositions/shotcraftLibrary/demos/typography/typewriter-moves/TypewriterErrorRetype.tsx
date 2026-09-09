// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const TEXT1 = 'just a dashboard';
const KEEP = 5;
const DEL = TEXT1.length - KEEP;
const TEXT2 = 'your command center';
const T1 = 2;
const PAUSE_START = T1 + (TEXT1.length - 1) * 2;
const DS = PAUSE_START + 16;
const RS = 68;
const TYPE2_END = RS + (TEXT2.length - 1) * 1.5;
const CURSOR_OFF = 115;
const CHAR_W = 58;
const cursorOn = (f: number): boolean => {
  if (f >= CURSOR_OFF) return false;
  if (f >= TYPE2_END) {
    // f95 起：on[95,100) off[100,105) on[105,110) off[110,115)
    return Math.floor((f - TYPE2_END) / 5) % 2 === 0;
  }
  if (f >= DS) return true; // 删除 + 重打：常亮（果断）
  if (f >= PAUSE_START) {
    // 犹豫段 f32–48：on[32,36) off[36,40) on[40,44) off[44,48)
    return Math.floor((f - PAUSE_START) / 4) % 2 === 0;
  }
  return true; // 第一遍打字：常亮
};
const TypewriterErrorRetype: React.FC = () => {
  const f = useCurrentFrame();

  // 第一遍已打出字符数
  const n1 = f < T1 ? 0 : Math.min(TEXT1.length, Math.floor((f - T1) / 2) + 1);
  // 已删除字符数（从尾部删）
  const removed = f < DS ? 0 : Math.min(DEL, Math.floor((f - DS) / 1.5) + 1);
  // 第二遍已打出字符数
  const n2 = f < RS ? 0 : Math.min(TEXT2.length, Math.floor((f - RS) / 1.5) + 1);

  const shown =
    TEXT1.slice(0, Math.max(KEEP, n1 - removed)).slice(0, n1) +
    TEXT2.slice(0, n2);

  const chars = shown.split('');

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        position: 'relative',
      }}
    >
      {/* 左缘锚定：最终句 24 字符×58=1392px，左起 264 恰好整体居中；
          打字过程不横移（真打字机感） */}
      <div
        style={{
          position: 'absolute',
          left: 264,
          top: 490,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {chars.map((c, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: CHAR_W,
              textAlign: 'center',
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: 96,
              fontWeight: 700,
              color: G.ink,
              lineHeight: 1.1,
            }}
          >
            {c === ' ' ? ' ' : c}
          </span>
        ))}
        {/* 光标：竖线，条件挂载而非 opacity 0 */}
        {cursorOn(f) && (
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 100,
              marginLeft: 4,
              background: G.ink,
            }}
          />
        )}
      </div>
    </div>
  );
};
return TypewriterErrorRetype;
}
