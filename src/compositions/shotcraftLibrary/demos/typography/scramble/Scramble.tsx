// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, rand, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const TEXT = contentText(content, "copy0", "TEMPLATE MOTION DEMO");
const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/\\';
const CHARS = [...TEXT];
const Scramble: React.FC = () => {
  const t = useT();
  const frame = Math.floor(t * 96);
  return (
    <DesignStage bg="#07080c">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07080c',
          fontFamily: '"SF Mono",Menlo,monospace',
          fontSize: 34,
          letterSpacing: 2,
        }}
      >
        {CHARS.map((ch, i) => {
          let content: string = ch;
          let color = '#3d4560';
          let textShadow = 'none';
          if (ch !== ' ') {
            // 锁定时刻：从左到右基础 stagger + 种子微扰
            const lockAt = 0.25 + (i / CHARS.length) * 0.6 + rand(i * 7) * 0.06;
            if (t < 0.06) {
              content = ' '; // 开场短暂空白
            } else if (t < lockAt) {
              // 高速跳字：每 2 帧换一个随机字符
              content = POOL[Math.floor(rand(i * 131 + Math.floor(frame / 2)) * POOL.length)];
            } else {
              // 锁定为真字符，锁定瞬间闪高亮辉光后回落
              const flash = 1 - seg(t, lockAt, lockAt + 0.1);
              color = flash > 0.4 ? '#dff3ff' : '#e8eaf0';
              textShadow = `0 0 ${flash * 18}px rgba(120,200,255,${flash})`;
            }
          }
          return (
            <span
              key={i}
              style={{ minWidth: '0.62em', textAlign: 'center', color, textShadow }}
            >
              {content === ' ' ? ' ' : content}
            </span>
          );
        })}
      </div>
    </DesignStage>
  );
};
return Scramble;
}
