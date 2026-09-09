// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const ROW = 44;
const WORDS = [contentText(content, "copy0", "Apps"), contentText(content, "copy1", "Teams"), contentText(content, "copy2", "Data"), contentText(content, "copy3", "Everyone")];
const STEPS = [0.16, 0.36, 0.56];
const ACCENT = '#4B4BF5';
const ACCENT_DIM = '#B9B9BE';
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mixHex = (a: string, b: string, k: number) => {
  k = clamp01(k);
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
const VerticalWordRollBlurCycle: React.FC = () => {
  const t = useT();

  // 滚轮进度 p：每步 0.7·outQuint + 0.3·outBack（前快后极慢 + 轻微过冲回落）
  let p = 0;
  for (const s of STEPS) {
    const u = seg(t, s, s + 0.11);
    p += 0.7 * E.outQuint(u) + 0.3 * E.outBack(u);
  }

  return (
    <DesignStage bg="#F7F7FA">
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            // 结束整组淡出
            opacity: 1 - seg(t, 0.9, 0.985) * 0.999,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: '#0B0B0C',
              letterSpacing: -0.5,
            }}
          >
            {contentText(content, "copy4", "Built for")}</div>
          {/* 三行高的遮罩窗口，滚轮列在其中滑动，中心行 = 第二行 */}
          <div style={{ position: 'relative', height: ROW * 3, width: 190, overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translateY(${ROW - p * ROW}px)`,
              }}
            >
              {WORDS.map((w, i) => {
                const d = Math.abs(i - p);
                // 相邻行方向 blur：距中心 1 行内线性 0→3px，更远 3→5px
                const blur = d < 1 ? 3 * d : 3 + 2 * Math.min(d - 1, 1);
                const op = d < 1 ? 1 - 0.65 * d : Math.max(0.1, 0.35 - 0.23 * (d - 1));
                return (
                  <div
                    key={w}
                    style={{
                      height: ROW,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 30,
                      fontWeight: 800,
                      letterSpacing: -0.5,
                      filter: `blur(${blur.toFixed(2)}px)`,
                      opacity: op,
                      // 落定染色：中心词灰→强调色（d 越小越彩）
                      color: mixHex(ACCENT_DIM, ACCENT, clamp01(1 - d * 2.4)),
                    }}
                  >
                    {w}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DesignStage>
  );
};
return VerticalWordRollBlurCycle;
}
