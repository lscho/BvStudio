// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const HITS = [30, 54, 78, 102];
const AMP = [4, 7, 11, 16];
const PUMP_WIN = 14;
const SPLIT_WIN = 12;
const Plate: React.FC<{ color: string; dx: number; dy: number }> = ({ color, dx, dy }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `translate(${dx}px, ${dy}px)`,
      mixBlendMode: 'multiply',
    }}
  >
    <div
      style={{
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontWeight: 800,
        fontSize: 160,
        color,
        letterSpacing: -1,
        whiteSpace: 'nowrap',
      }}
    >
      {contentText(content, "copy0", "ON THE BEAT")}</div>
  </div>
);
const RisoBeatPump: React.FC = () => {
  const frame = useCurrentFrame();

  // 找最近一次已命中的节拍（24f 间隔 > 14f 窗口，永远只有一拍在作用）
  let beatIdx = -1;
  for (let i = 0; i < HITS.length; i++) {
    if (frame >= HITS[i]) beatIdx = i;
  }
  const t = beatIdx >= 0 ? frame - HITS[beatIdx] : Infinity;

  // ① 整画面泵：命中帧一帧到位 1.08（t=0 即满值，无渐入），指数衰减回 1
  const pump = t < PUMP_WIN ? 1 + 0.08 * Math.exp(-t / 3) : 1;

  // ② 标题错位：衰减余弦震荡（周期 6f 抖两下），窗口外精确 0 = 套准
  const split = t < SPLIT_WIN;
  const m = split ? Math.cos((2 * Math.PI * t) / 6) * Math.exp(-t / 3) : 0;
  const dx = beatIdx >= 0 ? AMP[beatIdx] * m : 0;
  const dy = dx * 0.45; // y 少量，更像没对准版

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 整画面容器：scale 泵作用在全部内容上 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${pump})`,
          transformOrigin: 'center center',
        }}
      >
        {/* 标题区：正体 / 双版错位互斥切换 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 660 }}>
          {!split && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TitleBlock text={contentText(content, "copy0", "ON THE BEAT")} size={160} />
            </div>
          )}
          {split && (
            <>
              <Plate color={G.mid} dx={-dx} dy={dy} />
              <Plate color={G.ink} dx={dx} dy={-dy} />
            </>
          )}
        </div>

        {/* 底下一排 3 张小卡 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 660,
            display: 'flex',
            justifyContent: 'center',
            gap: 44,
          }}
        >
          <Card w={330} h={200} seed={2} />
          <Card w={330} h={200} seed={5} />
          <Card w={330} h={200} seed={8} />
        </div>

        {/* 节拍刻度：命中即闪深（8f 缩放脉冲 1.8→1）并常驻深色 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 950,
            display: 'flex',
            justifyContent: 'center',
            gap: 60,
          }}
        >
          {HITS.map((hit, i) => {
            const dt = frame - hit;
            const on = dt >= 0;
            const s = on && dt < 8 ? 1 + 0.8 * (1 - dt / 8) : 1;
            return (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  background: on ? G.ink : G.bar,
                  transform: `scale(${s})`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
return RisoBeatPump;
}
