// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing, spring } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const W = 1920;
const AXIS_Y = 700;
const TICK_GAP = 1400;
const TICKS = [
  { label: contentText(content, "copy0", "v1.0"), x: 960 },
  { label: contentText(content, "copy1", "v2.0"), x: 960 + TICK_GAP },
  { label: contentText(content, "copy2", "v3.0"), x: 960 + TICK_GAP * 2 },
  { label: contentText(content, "copy3", "Today"), x: 960 + TICK_GAP * 3 },
];
const WORLD_W = 960 + TICK_GAP * 3 + 960;
const TRAVEL_START = 12;
const TRAVEL_END = 104;
const ZOOM_END = 114;
const camXAt = (f: number): number => {
  const total = TICKS[3].x - 960; // 需要位移的世界距离
  const t = interpolate(f, [TRAVEL_START, TRAVEL_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 加速→巡航→急刹：分段缓动，前 15% 缓起，中段近匀加速冲刺，末 12% 急收
  const eased = interpolate(t, [0, 0.15, 0.88, 1], [0, 0.055, 0.9, 1], {
    easing: Easing.inOut(Easing.quad),
  });
  return eased * total;
};
const popFrameOf = (tickX: number): number => {
  for (let f = TRAVEL_START; f <= TRAVEL_END; f++) {
    if (camXAt(f) >= tickX - 960) return f;
  }
  return TRAVEL_END;
};
const CARD_W = 360;
const CARD_H = 240;
const TickStop: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const tick = TICKS[i];
  const pop = popFrameOf(tick.x) - 6; // 提前 6f 起弹，掠过时正好立起
  const s = spring({
    frame: frame - pop,
    fps: 30,
    config: { damping: 11, stiffness: 160, mass: 0.9 }, // 明显过冲
    durationInFrames: 26,
  });
  const appeared = frame >= pop;

  return (
    <div style={{ position: 'absolute', left: tick.x, top: 0 }}>
      {/* 刻度竖线 */}
      <div style={{ position: 'absolute', left: -3, top: AXIS_Y - 28, width: 6, height: 56, background: G.ink, borderRadius: 3 }} />
      {/* 刻度标签 */}
      <div style={{ position: 'absolute', left: -80, top: AXIS_Y + 44, width: 160, textAlign: 'center', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 800, fontSize: 40, color: G.ink }}>
        {tick.label}
      </div>
      {/* 卡片从刻度线弹立：以底边为轴 scaleY 0→1（带过冲），伴随上移 */}
      {appeared && (
        <div
          style={{
            position: 'absolute',
            left: -CARD_W / 2,
            top: AXIS_Y - 36 - CARD_H,
            transform: `scaleY(${s}) scaleX(${0.6 + 0.4 * s})`,
            transformOrigin: '50% 100%',
            opacity: Math.min(1, s * 2),
          }}
        >
          <Card w={CARD_W} h={CARD_H} seed={i + 2} />
        </div>
      )}
    </div>
  );
};
const TimelineTravel: React.FC = () => {
  const frame = useCurrentFrame();
  const camX = camXAt(frame);

  // 急停后推近末刻度：scale 1 → 1.28，中心对准 Today 刻度
  const zoom = interpolate(frame, [TRAVEL_END, ZOOM_END], [1, 1.28], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ width: W, height: 1080, background: G.bg, overflow: 'hidden', position: 'relative' }}>
      {/* 推近层：以画面中央偏下（末刻度落点）为原点放大 */}
      <div style={{ width: W, height: 1080, transform: `scale(${zoom})`, transformOrigin: '50% 62%' }}>
        {/* 世界层：唯一横移的容器 */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: WORLD_W, height: 1080, transform: `translateX(${-camX}px)` }}>
          {/* 主轴线 */}
          <div style={{ position: 'absolute', left: 200, top: AXIS_Y - 3, width: WORLD_W - 400, height: 6, background: G.bar, borderRadius: 3 }} />
          {/* 次刻度（小点，增强速度感） */}
          {Array.from({ length: 22 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: 960 + i * (TICK_GAP / 5) - 2, top: AXIS_Y - 12, width: 4, height: 24, background: G.bar, borderRadius: 2 }} />
          ))}
          {TICKS.map((_, i) => (
            <TickStop key={i} i={i} frame={frame} />
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 90, width: '100%', textAlign: 'center' }}>
        <TitleBlock text={contentText(content, "copy4", "TIMELINE TRAVEL")} size={64} />
      </div>
    </div>
  );
};
return TimelineTravel;
}
