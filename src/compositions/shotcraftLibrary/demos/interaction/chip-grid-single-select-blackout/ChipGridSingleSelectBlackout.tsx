// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
const BG = '#F1F1F3';
const INK = '#0B0B0C';
const TXT = '#111111';
const DIM = '#C9C9CE';
const LINE = '#E6E6EA';
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const h2r = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (p: number, a: string, b: string) => {
  const A = h2r(a), B = h2r(b), q = clamp01(p);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * q)},${Math.round(A[1] + (B[1] - A[1]) * q)},${Math.round(A[2] + (B[2] - A[2]) * q)})`;
};
const NAMES = [contentText(content, "copy0", "Option one plan"), contentText(content, "copy1", "Option two plan"), contentText(content, "copy2", "Option three long name"), contentText(content, "copy3", "Option four"), contentText(content, "copy4", "Option five variant")];
const TI = 0;
const FS = 0.44;
const CAP_TEXT = '18% off  ·  42.00  →  34.44';
const CAP_WORDS = CAP_TEXT.split(' ');
const CAP_N = CAP_WORDS.length;
const CAP_ST = 0.78 / CAP_N;
const CAP_WIN = CAP_ST * 1.5;
const ChipGridSingleSelectBlackout: React.FC = () => {
  const t = useT();

  // 选中 chip 上移时同步回到水平中线：cx = 220 - 选中 chip 在 440 画布内的中心 x。
  // chip 宽度由文本 + padding 决定（flex 布局），挂载后实测一次；149 为兜底估算
  // （"Option one plan" 600 12px ≈ 90px 文本 + 30 padding + 2 border，行首起点 ≈ 11）。
  const targetRef = useRef<HTMLDivElement>(null);
  const [cx, setCx] = useState(149);
  useLayoutEffect(() => {
    const el = targetRef.current;
    if (el && el.offsetWidth) setCx(220 - (el.offsetLeft + el.offsetWidth / 2));
  }, []);

  const capShow = seg(t, FS + 0.36, FS + 0.42);
  const capInn = seg(t, FS + 0.37, 0.98);

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
          {/* 标题 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 26,
              textAlign: 'center',
              font: `600 11px/1 ${SANS}`,
              letterSpacing: 2.4,
              color: '#9A9AA2',
              opacity: seg(t, 0.02, 0.1, E.outQuad),
            }}
          >
            {contentText(content, "copy5", "OPTION GROUP")}</div>

          {/* 两行 chip：3+2 居中排布（flex 布局，位置全程锁死不重排） */}
          {[0, 1].map((row) => (
            <div
              key={row}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: row === 0 ? 96 : 136,
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              {NAMES.map((n, i) => {
                if ((i < 3 ? 0 : 1) !== row) return null;
                const d = 0.05 + i * 0.028;
                const inP = seg(t, d, d + 0.04, E.outQuad);
                let bg = '#fff';
                let borderColor = LINE;
                let labelColor: string = TXT;
                let flashO = '0';
                let opacity: string | number;
                let transform: string;
                if (i === TI) {
                  // 灰闪 1 帧
                  flashO = (seg(t, FS, FS + 0.006) * (1 - seg(t, FS + 0.006, FS + 0.014))).toFixed(3);
                  const bk = seg(t, FS + 0.008, FS + 0.04, E.linear);
                  bg = mix(bk, '#ffffff', INK);
                  borderColor = mix(bk, LINE, INK);
                  labelColor = mix(bk, TXT, '#ffffff');
                  // 按压回弹 1→1.04→1
                  const pr = seg(t, FS + 0.008, FS + 0.075, E.linear);
                  const sc = 1 + Math.sin(pr * Math.PI) * 0.04 * (pr > 0 ? 1 : 0);
                  const lift = seg(t, FS + 0.30, FS + 0.42, E.inOutCubic);
                  opacity = inP;
                  transform =
                    `translate(${(cx * lift).toFixed(2)}px,${(-46 * lift).toFixed(2)}px) ` +
                    `scale(${(sc * lerp(lift, 1, 0.82)).toFixed(4)})`;
                } else {
                  const fade = seg(t, FS + 0.008, FS + 0.075, E.outQuad);
                  const gone = seg(t, FS + 0.30, FS + 0.35, E.outQuad);
                  opacity = (inP * lerp(fade, 1, 0.18) * (1 - gone)).toFixed(3);
                  transform = 'none';
                }
                return (
                  <div
                    key={i}
                    ref={i === TI ? targetRef : undefined}
                    style={{
                      position: 'relative',
                      height: 30,
                      borderRadius: 15,
                      background: bg,
                      border: `1px solid ${borderColor}`,
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 15px',
                      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                      overflow: 'hidden',
                      opacity,
                      transform,
                    }}
                  >
                    <div style={{ font: `600 12px/1 ${SANS}`, color: labelColor, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>
                      {n}
                    </div>
                    {/* 按压灰闪块（盖在 label 上） */}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(120,120,120,.5)', opacity: flashO }} />
                  </div>
                );
              })}
            </div>
          ))}

          {/* 算式行：逐词加深（浅灰占位 → 黑），整行透明度随 show 淡入 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 150,
              display: 'flex',
              alignItems: 'baseline',
              whiteSpace: 'nowrap',
              transform: 'translateX(-50%)',
              opacity: capShow,
            }}
          >
            {CAP_WORDS.map((w, i) => {
              const q = clamp01((capInn - i * CAP_ST) / CAP_WIN);
              return (
                <span
                  key={i}
                  style={{
                    font: `600 14px/1.25 ${SANS}`,
                    color: mix(q, DIM, TXT),
                    letterSpacing: (-0.03 * (1 - q)).toFixed(4) + 'em',
                    marginRight: i === CAP_N - 1 ? 0 : 4.5,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </DesignStage>
  );
};
return ChipGridSingleSelectBlackout;
}
