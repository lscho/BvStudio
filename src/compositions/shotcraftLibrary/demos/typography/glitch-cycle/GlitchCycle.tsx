// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, lerp, rand, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const PHRASES = [contentText(content, "copy0", "INITIALIZING"), contentText(content, "copy1", "LOADING ASSETS"), contentText(content, "copy2", "COMPILING SHADERS"), contentText(content, "copy3", "READY TO SHIP")];
const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&<>/\\';
const KF = [1, 0, 0, 0.1, 0, 0, 1];
const KF_LAST = [1, 0, 0, 0.1, 0, 0, 0];
const MAXCH = Math.max(...PHRASES.map((p) => p.length));
const glitchAt = (kf: number[], p: number) => {
  const segs = kf.length - 1;
  const x = Math.min(segs - 1e-6, Math.max(0, p * segs));
  const i = Math.floor(x);
  return lerp(x - i, kf[i], kf[i + 1]);
};
const GlitchCycle: React.FC = () => {
  const t = useT();
  const N = PHRASES.length;
  const slot = Math.min(N - 1, Math.floor(t * N));
  const p = t * N - slot; // 短语内进度 0..1
  const text = PHRASES[slot];
  const g = glitchAt(slot === N - 1 ? KF_LAST : KF, p);
  const frame = Math.floor(t * 168);
  const bucket = Math.floor(frame / 2); // 乱码跳字节流：每 2 帧换一批随机字符
  // 整行抖动 + RGB 分离，强度跟随 glitch 概率
  const jx = (rand(bucket * 5 + slot) - 0.5) * g * 10;
  const jy = (rand(bucket * 9 + slot + 40) - 0.5) * g * 4;
  return (
    <DesignStage bg="#0a0b10">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0b10',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: '"SF Mono",Menlo,monospace',
            fontSize: 26,
            letterSpacing: 3,
            color: '#dfe6f5',
            transform: `translate(${jx}px,${jy}px)`,
            textShadow:
              g > 0.04
                ? `${g * 3}px 0 rgba(255,60,90,${g * 0.8}), ${-g * 3}px 0 rgba(60,220,255,${g * 0.8})`
                : 'none',
          }}
        >
          {Array.from({ length: MAXCH }, (_, i) => {
            const ch = i < text.length ? text[i] : ' ';
            let content = ch;
            let color: string | undefined;
            if (ch !== ' ') {
              // 逐字符按种子掷 glitch：命中显示乱码 + 变色，未命中显示真字符
              const hit = rand(i * 31 + bucket * 17 + slot * 97) < g;
              if (hit) {
                content = POOL[Math.floor(rand(i * 131 + bucket * 7 + slot * 13) * POOL.length)];
                color = rand(i + bucket) > 0.5 ? '#6c8cff' : '#4a5270';
              } else {
                color = '#dfe6f5';
              }
            }
            return (
              <span key={i} style={{ minWidth: '0.66em', textAlign: 'center', color }}>
                {content}
              </span>
            );
          })}
        </div>
      </div>
      {/* 底部细进度条：随 t 匀速填满 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '63%',
          width: 120,
          height: 2,
          marginLeft: -60,
          background: '#232840',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <div style={{ height: '100%', width: `${t * 100}%`, background: '#6c8cff' }} />
      </div>
    </DesignStage>
  );
};
return GlitchCycle;
}
