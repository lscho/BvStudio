// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const FONT = 'Helvetica, Arial, sans-serif';
const ROW_H = 150;
const WORDS = [contentText(content, "copy0", "modern"), contentText(content, "copy1", "playful"), contentText(content, "copy2", "expressive"), contentText(content, "copy3", "seamless"), contentText(content, "copy4", "intuitive")];
const BEAT_LEN = 18;
const FIRST_BEAT = 30;
const N_BEATS = 3;
const THEMES = [
  { pill: '#d8d8d4', bg: '#241a12', ink: '#2a2018' }, // modern：灰白胶囊 / 深棕场
  { pill: '#4fae62', bg: '#1e2416', ink: '#173015' }, // playful：绿
  { pill: '#8e6fd8', bg: '#221a33', ink: '#2a2144' }, // expressive：紫
  { pill: '#d64d55', bg: '#141c2e', ink: '#1a2440' }, // seamless：红 / 深藏青
];
const snap = (t: number) => interpolate(t, [0, 1], [0, 1], {
  easing: (x) => 1 - Math.pow(1 - x, 3.2),
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const BeatStepListThemeCycle: React.FC = () => {
  const frame = useCurrentFrame();

  // 当前拍序号与拍内进度（跳变只占拍头 6 帧）
  const raw = (frame - FIRST_BEAT) / BEAT_LEN;
  const beat = Math.min(N_BEATS, Math.max(0, Math.floor(raw) + 1)); // 已触发的拍数
  const beatStartFrame = FIRST_BEAT + (beat - 1) * BEAT_LEN;
  const tInBeat = beat === 0 ? 1 : snap((frame - beatStartFrame) / 6);

  // 连续步进量：整数拍 + 拍头 6 帧内的插值
  const step = beat === 0 ? 0 : (beat - 1) + tInBeat;

  // 三通道 —— 1) 列表上移一行
  const listY = -step * ROW_H;

  // 2) 胶囊换色（拍头硬跳，带一点 cross-fade）
  const themePrev = THEMES[Math.max(0, beat - 1)];
  const themeNow = THEMES[beat];
  const mixT = beat === 0 ? 1 : tInBeat;
  const mix = (a: string, b: string, t: number) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
  };
  const pillColor = mix(themePrev.pill, themeNow.pill, mixT);
  const bgColor = mix(themePrev.bg, themeNow.bg, mixT);

  // 胶囊每拍落位时 squash 弹一下
  const pop = beat === 0 ? 1 : interpolate(tInBeat, [0, 0.6, 1], [1.12, 0.97, 1]);

  // 选中行文字反白判定：胶囊固定在视口中央行，选中词 = WORDS[beat]
  const selectedIdx = beat;

  return (
    <AbsoluteFill style={{ background: bgColor, fontFamily: FONT, justifyContent: 'center' }}>
      {/* 中央固定胶囊（列表在其下滚动，视觉上"胶囊跳到下一行"） */}
      <div style={{
        position: 'absolute', left: '50%', top: 540 - ROW_H / 2 + 10,
        width: 900, height: ROW_H - 20, transform: `translateX(-50%) scale(${pop})`,
        background: pillColor, borderRadius: 999,
        boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
      }} />
      {/* 词列表 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 540 - ROW_H / 2,
        transform: `translateY(${listY}px)`,
      }}>
        {WORDS.map((w, i) => {
          const isSel = i === selectedIdx;
          return (
            <div key={w} style={{
              height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 92, fontWeight: 800, letterSpacing: -1.5,
                color: isSel ? (beat === 0 ? '#2a2018' : '#ffffff') : 'rgba(255,255,255,0.34)',
                position: 'relative', zIndex: 2,
              }}>{w}</span>
            </div>
          );
        })}
      </div>
      {/* 视口上下羽化 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300, background: `linear-gradient(${bgColor}, transparent)`, zIndex: 3 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300, background: `linear-gradient(transparent, ${bgColor})`, zIndex: 3 }} />
    </AbsoluteFill>
  );
};
return BeatStepListThemeCycle;
}
