// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const TEXT = contentText(content, "copy0", "DECODE SPEED");
const CHARSET = 'ABCDEF0123456789#$%&';
const LOCK_START = 20;
const LOCK_STEP = 6;
const FLASH_LEN = 2;
const h = (n: number) => {
  const s = Math.sin(n * 127.3) * 43758.5453;
  return s - Math.floor(s);
};
const ScrambleDecode: React.FC = () => {
  const frame = useCurrentFrame();
  const chars = TEXT.split('');
  const lockedCount = chars.filter((c, i) => c === ' ' || frame >= LOCK_START + i * LOCK_STEP).length;
  const allLocked = lockedCount === chars.length;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 48,
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, Menlo, Monaco, monospace',
          fontWeight: 800,
          fontSize: 120,
          letterSpacing: 2,
          display: 'flex',
        }}
      >
        {chars.map((ch, i) => {
          if (ch === ' ') {
            return <span key={i} style={{ display: 'inline-block', width: '0.7em' }} />;
          }
          const lockFrame = LOCK_START + i * LOCK_STEP;
          const locked = frame >= lockFrame;
          const flashing = locked && frame < lockFrame + FLASH_LEN;
          // 跳动期：每 2 帧换一个伪随机字符
          const tick = Math.floor(frame / 2);
          const scrambleChar = CHARSET[Math.floor(h(i * 101 + tick * 7 + 13) * CHARSET.length)];
          const shown = locked ? ch : scrambleChar;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: '1ch',
                textAlign: 'center',
                color: flashing ? G.card : locked ? G.ink : G.mid,
                background: flashing ? G.ink : 'transparent',
              }}
            >
              {shown}
            </span>
          );
        })}
      </div>
      {/* 底部进度提示条：已锁定字符数比例，帮助读出"从左到右扫过"的推进感 */}
      <div style={{ width: 900, height: 10, background: G.line, borderRadius: 5, overflow: 'hidden' }}>
        <div
          style={{
            width: `${(lockedCount / chars.length) * 100}%`,
            height: '100%',
            background: allLocked ? G.ink : G.mid,
            borderRadius: 5,
          }}
        />
      </div>
    </div>
  );
};
return ScrambleDecode;
}
