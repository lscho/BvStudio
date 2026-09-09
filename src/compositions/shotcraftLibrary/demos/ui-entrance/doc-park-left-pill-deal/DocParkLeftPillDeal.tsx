// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, rand, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
const BG = '#F1F1F3';
const INK = '#0B0B0C';
const TXT = '#111111';
const DIM = '#C9C9CE';
const LINE = '#E6E6EA';
const SKEL = '#DEDEE3';
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const h2r = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (p: number, a: string, b: string) => {
  const A = h2r(a), B = h2r(b), q = clamp01(p);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * q)},${Math.round(A[1] + (B[1] - A[1]) * q)},${Math.round(A[2] + (B[2] - A[2]) * q)})`;
};
const Icon: React.FC<{ k: 'leaf' | 'bowl' | 'wrap'; size: number }> = ({ k, size }) => (
  <div style={{ width: size, height: size, flex: '0 0 auto', color: TXT }}>
    <svg width={size} height={size} viewBox="0 0 16 16">
      {k === 'leaf' && (
        <>
          <path d="M3 13c0-6 5-10 10-10 0 6-4 10-10 10Z" fill="none" stroke="#111" strokeWidth={1.3} />
          <path d="M3 13 13 3" stroke="#111" strokeWidth={1.3} />
        </>
      )}
      {k === 'bowl' && (
        <>
          <path d="M2 7h12c0 4-2.6 6-6 6S2 11 2 7Z" fill="none" stroke="#111" strokeWidth={1.3} />
          <path d="M6 4.5V2M9.5 4.5V2" stroke="#111" strokeWidth={1.3} />
        </>
      )}
      {k === 'wrap' && (
        <>
          <circle cx={8} cy={8} r={5.6} fill="none" stroke="#111" strokeWidth={1.3} />
          <path d="M4.4 6.2h7.2M4.4 9.8h7.2" stroke="#111" strokeWidth={1.3} />
        </>
      )}
    </svg>
  </div>
);
const Caption: React.FC<{
  text: string;
  left: number;
  top: number;
  size: number;
  showV: number;
  innP: number;
  outP: number;
}> = ({ text, left, top, size, showV, innP, outP }) => {
  const words = text.split(' ');
  const n = words.length;
  const st = 0.78 / n, win = st * 1.5; // 入场逐词交错
  const stw = 0.55 / n;                // 出场逐词交错
  const rowOpacity = outP > 0 ? clamp01(1 - (outP - 0.7) / 0.3) : showV;
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'baseline',
        whiteSpace: 'nowrap',
        left,
        top,
        opacity: rowOpacity,
      }}
    >
      {words.map((w, i) => {
        const q = clamp01((innP - i * st) / win);
        let color = mix(q, DIM, TXT);
        if (outP > 0) {
          const p = clamp01((outP - i * stw) / (stw * 1.4));
          color = mix(1 - p, DIM, TXT);
        }
        return (
          <span
            key={i}
            style={{
              font: `600 ${size}px/1.25 ${SANS}`,
              color,
              letterSpacing: (-0.03 * (1 - q)).toFixed(4) + 'em',
              marginRight: i === n - 1 ? 0 : 4.5,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
const DW = 250, DH = 190, COLS = 3;
const COL_W = (DW - 28 - (COLS - 1) * 10) / COLS;
const DOC_COLS = Array.from({ length: COLS }, (_, c) => {
  const x = 14 + c * (COL_W + 10);
  return {
    x,
    headW: (COL_W * 0.72).toFixed(1),
    rows: Array.from({ length: 7 }, (_, r) => (COL_W * (0.55 + rand(c * 13 + r * 7) * 0.45)).toFixed(1)),
  };
});
const ITEMS: { n: string; ic: 'leaf' | 'bowl' | 'wrap'; cap: string }[] = [
  { n: contentText(content, "copy0", "Quick Start"), ic: 'leaf', cap: 'Start matches their preference' },
  { n: contentText(content, "copy1", "Bundle Plan"), ic: 'bowl', cap: 'Plan fits their weekday usage' },
  { n: contentText(content, "copy2", "Starter Kit"), ic: 'wrap', cap: 'Kit is their top repeat item' },
];
const PX = 214, PY = 54, PH = 34, PG = 14;
const T0 = [0.26, 0.48, 0.70];
const DocParkLeftPillDeal: React.FC = () => {
  const t = useT();
  // 文档靠左驻留：滑出只露约 35% 宽 + 微缩 0.92
  const park = seg(t, 0.06, 0.24, E.inOutCubic);
  // 极缓慢自动滚动（t=1 处回到整数周期，画面稳定）
  const scrollY = (-((t * 3) % 1) * 40).toFixed(2);
  return (
    <DesignStage bg={BG}>
      {/* 页面 + 440×240 定尺画布（居中） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: BG,
          overflow: 'hidden',
          fontFamily: SANS,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 440, height: 240, margin: '-120px 0 0 -220px' }}>
          {/* 左侧文档窗格：靠左驻留 + 微缩，origin 钉在左缘中点 */}
          <div
            style={{
              position: 'absolute',
              left: 34,
              top: (240 - DH) / 2,
              width: DW,
              height: DH,
              transformOrigin: '0% 50%',
              transform: `translateX(${lerp(park, 0, -55)}%) scale(${lerp(park, 1, 0.92)})`,
            }}
          >
            {/* 文档卡：白底描边 + 骨架条（3 栏 × 7 行，宽度由 rand 定） */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: DW,
                height: DH,
                background: '#fff',
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                boxShadow: '0 8px 26px rgba(0,0,0,.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  right: 0,
                  height: DH + 60,
                  transform: `translateY(${scrollY}px)`,
                }}
              >
                <div style={{ position: 'absolute', left: 14, top: 12, width: Math.round(DW * 0.34), height: 7, borderRadius: 3, background: INK, opacity: 0.85 }} />
                <div style={{ position: 'absolute', left: 14, top: 25, width: Math.round(DW * 0.2), height: 5, borderRadius: 3, background: SKEL }} />
                {DOC_COLS.map(({ x, headW, rows }, c) => (
                  <React.Fragment key={c}>
                    <div style={{ position: 'absolute', left: x, top: 44, width: `${headW}px`, height: 6, borderRadius: 3, background: '#9A9AA2' }} />
                    {rows.map((ww, r) => (
                      <div key={r} style={{ position: 'absolute', left: x, top: 58 + r * 13, width: `${ww}px`, height: 5, borderRadius: 2.5, background: SKEL }} />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧三张药丸 + 逐词字幕，按 T0 节奏慢发牌 */}
          {ITEMS.map((it, k) => {
            const f = T0[k];
            const o = seg(t, f, f + 0.035, E.outQuad);
            const b = seg(t, f, f + 0.062, E.outBack);
            // 字幕：落定 +3 帧起加深，下一张入场前淡出
            const cs = f + 0.05, ce = k < 2 ? T0[k + 1] - 0.03 : 0.98;
            const showV = seg(t, cs, cs + 0.02);
            const innP = seg(t, cs, cs + (ce - cs) * 0.7);
            const outP = seg(t, ce - 0.05, ce, E.outQuad);
            return (
              <React.Fragment key={k}>
                <div
                  style={{
                    position: 'absolute',
                    left: PX,
                    top: PY + k * (PH + PG),
                    width: 172,
                    height: PH,
                    borderRadius: PH / 2,
                    background: '#fff',
                    border: `1px solid ${LINE}`,
                    boxSizing: 'border-box',
                    boxShadow: '0 4px 14px rgba(0,0,0,.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '0 14px',
                    opacity: o,
                    transform: `translateY(${lerp(b, 14, 0).toFixed(2)}px) scale(${lerp(b, 0.94, 1).toFixed(4)})`,
                  }}
                >
                  <Icon k={it.ic} size={16} />
                  <div style={{ font: `600 12.5px/1 ${SANS}`, color: TXT, letterSpacing: '-.01em' }}>{it.n}</div>
                </div>
                <Caption
                  text={it.cap}
                  left={PX + 4}
                  top={PY + k * (PH + PG) + PH + 7}
                  size={11}
                  showV={showV}
                  innP={innP}
                  outP={outP}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </DesignStage>
  );
};
return DocParkLeftPillDeal;
}
