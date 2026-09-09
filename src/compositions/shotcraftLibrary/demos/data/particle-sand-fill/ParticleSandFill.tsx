// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const AMBER = '#b45309';
const frac = (x: number) => x - Math.floor(x);
const rnd = (i: number, salt: number) => frac(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453);
const CARD = { x: 460, y: 300, w: 1000, h: 560 };
const PLOT_BOTTOM = CARD.y + CARD.h - 70;
const GRAIN = 14;
const PER_LAYER = 9;
const BAR_W = GRAIN * PER_LAYER;
const DROP_FROM = 230;
const GRAV = 1.6;
const STAGGER = 6;
const RATE = 0.28;
const BARS = [
  { cx: CARD.x + 175, h: 238, label: contentText(content, "copy0", "238") },
  { cx: CARD.x + 395, h: 336, label: contentText(content, "copy1", "336") },
  { cx: CARD.x + 615, h: 182, label: contentText(content, "copy2", "182") },
  { cx: CARD.x + 835, h: 294, label: contentText(content, "copy3", "294") },
].map((b) => ({ ...b, layers: Math.round(b.h / GRAIN), n: Math.round(b.h / GRAIN) * PER_LAYER }));
const fallTime = (dist: number) => Math.sqrt((2 * dist) / GRAV);
const departOf = (bar: number, i: number) => 8 + bar * STAGGER + i * RATE + rnd(i, bar * 7 + 1) * 1.5;
const ParticleSandFill: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 110, width: '100%', textAlign: 'center' }}>
        <TitleBlock text={contentText(content, "copy4", "PARTICLE SAND FILL")} size={72} />
      </div>

      {/* 图表卡 */}
      <div style={{
        position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h,
        background: G.card, border: `2px solid ${G.border}`, borderRadius: 14,
        boxSizing: 'border-box', padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ height: 14, width: 260, background: G.bar, borderRadius: 7 }} />
        <div style={{ height: 10, width: 160, background: G.line, borderRadius: 5, marginTop: 10 }} />
      </div>
      {/* 基线 */}
      <div style={{ position: 'absolute', left: CARD.x + 40, top: PLOT_BOTTOM, width: CARD.w - 80, height: 3, background: G.line }} />

      {BARS.map((bar, b) => {
        const left = bar.cx - BAR_W / 2;
        // 末颗落地帧（闭式）：末颗落点在堆顶，坠距仍 ≈DROP_FROM
        const lastLand = departOf(b, bar.n - 1) + fallTime(DROP_FROM);
        const doneAt = lastLand + 7; // 回弹收完 → 开始交接
        const solidOp = interpolate(frame, [doneAt, doneAt + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const labelScale = interpolate(frame, [doneAt + 6, doneAt + 18], [0, 1], {
          easing: Easing.out(Easing.back(2.2)),
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        return (
          <React.Fragment key={b}>
            {solidOp > 0 && (
              <div style={{
                position: 'absolute', left, top: PLOT_BOTTOM - bar.h,
                width: BAR_W, height: bar.h, background: b === 1 ? AMBER : G.bar,
                borderRadius: '6px 6px 0 0', opacity: solidOp,
              }} />
            )}
            {labelScale > 0 && (
              <div style={{
                position: 'absolute', left: bar.cx - 70, top: PLOT_BOTTOM - bar.h - 62, width: 140,
                textAlign: 'center', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 800,
                fontSize: 46, color: b === 1 ? AMBER : G.ink,
                transform: `scale(${labelScale})`,
              }}>
                {bar.label}
              </div>
            )}
            {/* 粒子面：交接完成（solidOp=1）即整体条件卸载 → 真静止 */}
            {solidOp < 1 && Array.from({ length: bar.n }).map((_, i) => {
              const depart = departOf(b, i);
              const age = frame - depart;
              if (age <= 0) return null;
              const layer = Math.floor(i / PER_LAYER);
              const col = i % PER_LAYER;
              const targetTop = PLOT_BOTTOM - (layer + 1) * GRAIN; // 闭式堆积面
              const startTop = targetTop - DROP_FROM - rnd(i, b * 13 + 3) * 70;
              const dist = targetTop - startTop;
              const tLand = fallTime(dist);
              let top: number;
              if (age < tLand) {
                top = startTop + 0.5 * GRAV * age * age;
              } else {
                const ba = age - tLand;
                const bounce = ba < 6 ? Math.sin((ba / 6) * Math.PI) * GRAIN * 2 * 0.15 * (1 + rnd(i, b * 13 + 9)) : 0;
                top = targetTop - bounce;
              }
              const amber = b === 1 || rnd(i, b * 13 + 7) < 0.18;
              return (
                <div key={i} style={{
                  position: 'absolute', left: left + col * GRAIN + 1, top, width: GRAIN - 2, height: GRAIN - 2,
                  background: amber ? AMBER : G.mid, opacity: 1 - solidOp,
                  borderRadius: 2,
                }} />
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};
return ParticleSandFill;
}
