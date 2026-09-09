// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, spring, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const FPS = 30;
const N = 7;
const GAP_Z = 120;
const SPREAD_START = 18;
const HOLD_END = 18 + 12 + 25;
const MERGE_DUR = 10;
const ClonerDepthEcho: React.FC = () => {
  const frame = useCurrentFrame();

  // 吸回进度（全体同步，ease-in 加速）
  const merge = interpolate(frame, [HOLD_END, HOLD_END + MERGE_DUR], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 合体瞬间本体弹一下
  const popS = spring({
    frame: frame - (HOLD_END + MERGE_DUR),
    fps: FPS,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
    durationInFrames: 18,
  });
  const heroScale = frame >= HOLD_END + MERGE_DUR ? 1 + 0.08 * Math.sin(popS * Math.PI) : 1;

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 100, width: '100%', textAlign: 'center' }}>
        <TitleBlock text={contentText(content, "copy0", "CLONER DEPTH ECHO")} size={72} />
      </div>

      <div style={{ position: 'absolute', inset: 0, perspective: 1600, perspectiveOrigin: '58% 46%' }}>
        <div
          style={{
            position: 'absolute',
            left: 960 - 260,
            top: 540 - 170 + 40,
            transformStyle: 'preserve-3d',
            transform: 'rotateY(16deg)',
          }}
        >
          {/* 克隆队列：从后往前渲染保证遮挡正确 */}
          {Array.from({ length: N }, (_, k) => N - k).map((idx) => {
            // idx 1..N，idx 越大越靠后
            const spread = spring({
              frame: frame - SPREAD_START - (idx - 1) * 1.6,
              fps: FPS,
              config: { damping: 14, stiffness: 160, mass: 0.8 },
              durationInFrames: 16,
            });
            const p = spread * (1 - merge);
            const z = -GAP_Z * idx * p;
            // 斜向错位让纵队肉眼可见（像侧看一列纵队）
            const dx = 64 * idx * p;
            const dy = -34 * idx * p;
            const op = (1 - (idx / N) * 0.8) * spread * (1 - merge);
            if (op <= 0.005) return null;
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, ${z.toFixed(2)}px)`,
                  opacity: op,
                }}
              >
                <Card w={520} h={340} seed={3} />
              </div>
            );
          })}
          {/* 本体 */}
          <div style={{ position: 'absolute', transform: `translateZ(0px) scale(${heroScale.toFixed(4)})` }}>
            <Card w={520} h={340} seed={3} style={{ boxShadow: '0 10px 36px rgba(31,28,23,0.22)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
return ClonerDepthEcho;
}
