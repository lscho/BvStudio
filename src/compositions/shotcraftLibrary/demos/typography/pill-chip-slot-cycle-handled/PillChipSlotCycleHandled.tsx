// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const WORDS = [
  { w: 'Sales', e: '⚡' },
  { w: 'Workflow', e: '📈' },
  { w: 'Admin', e: '⚙️' },
  { w: 'Reports', e: '📄' },
];
const FONT = '700 22px -apple-system,system-ui,sans-serif';
const FALLBACK_WIDTHS = WORDS.map((o) => o.w.length * 13 + 74);
const SIDE: React.CSSProperties = {
  color: '#15171d',
  fontWeight: 800,
  fontSize: 30,
  letterSpacing: -0.5,
  flex: 'none',
};
const PillChipSlotCycleHandled: React.FC = () => {
  const t = useT();

  // 量宽：与原 effect.js 相同，用隐藏 span 实测每个词的 offsetWidth（+74 胶囊留白），
  // 只在首次布局量一次；量到前用兜底估算，避免首帧闪动
  const measRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>(FALLBACK_WIDTHS);
  useLayoutEffect(() => {
    const spans = measRef.current?.children;
    if (!spans) return;
    setWidths(
      WORDS.map((o, i) => ((spans[i] as HTMLElement).offsetWidth || o.w.length * 13) + 74),
    );
  }, []);

  // 三次切换：0.25 / 0.47 / 0.69，每次用 0.12 的 inOutCubic 推进一格
  let pos = 0;
  for (const s0 of [0.25, 0.47, 0.69]) pos += seg(t, s0, s0 + 0.12, E.inOutCubic);
  const ci = Math.min(WORDS.length - 1, Math.floor(pos));
  const frac = pos - ci;
  // 胶囊宽度随当前词→下一词插值，平滑挤开两侧文字
  const chipW = lerp(frac, widths[ci], widths[Math.min(ci + 1, WORDS.length - 1)]);

  // 幽灵项：当前词的前/后邻居，随滚动微移，落定时回到基准透明度
  const near = Math.round(pos);
  const roll = (pos - near) * 48 * 0.5;
  const settle = 1 - Math.min(1, Math.abs(pos - near) * 3);
  const ghost = (top: number): React.CSSProperties => ({
    position: 'absolute',
    left: '50%',
    top,
    font: FONT,
    color: '#15171d',
    whiteSpace: 'nowrap',
    transform: `translateX(-50%) translateY(${-roll}px)`,
    opacity: 0.13 * (0.4 + settle * 0.6),
  });

  return (
    <DesignStage bg="#fbfbfd">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system,system-ui,sans-serif',
        }}
      >
        {/* 隐藏量宽 span（与原 setup 的 meas 等价，不参与布局显示） */}
        <div ref={measRef} style={{ position: 'absolute', visibility: 'hidden' }}>
          {WORDS.map((o) => (
            <span key={o.w} style={{ whiteSpace: 'nowrap', font: FONT }}>
              {o.w}
            </span>
          ))}
        </div>
        <div style={SIDE}>{contentText(content, "copy0", "Your")}</div>
        <div style={{ position: 'relative', flex: 'none' }}>
          {/* 深色胶囊：overflow hidden 里放 4 行词的滚轮列 */}
          <div
            style={{
              position: 'relative',
              height: 48,
              width: chipW,
              margin: '0 14px',
              flex: 'none',
              borderRadius: 99,
              background: '#1a1c24',
              boxShadow: '0 8px 24px rgba(20,22,40,.22)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                transform: `translateY(${-pos * 48}px)`,
              }}
            >
              {WORDS.map(({ w, e }) => (
                <div
                  key={w}
                  style={{
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    paddingLeft: 18,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{e}</span>
                  <span style={{ font: FONT, color: '#fff' }}>{w}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 胶囊外上下的灰色幽灵项 */}
          <div style={ghost(-38)}>{near > 0 ? WORDS[near - 1].w : ''}</div>
          <div style={ghost(58)}>{near < WORDS.length - 1 ? WORDS[near + 1].w : ''}</div>
        </div>
        <div style={SIDE}>{contentText(content, "copy1", "Handled")}</div>
      </div>
    </DesignStage>
  );
};
return PillChipSlotCycleHandled;
}
