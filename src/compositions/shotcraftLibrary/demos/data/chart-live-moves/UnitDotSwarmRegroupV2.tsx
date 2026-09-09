// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, spring, interpolate } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const AMBER = '#b45309';
const FPS = 30;
const N = 320;
const DOT_R = 9;
const M1 = 12;
const M2 = 48;
const M3 = 84;
const DUR = 20;
const STAG = 8;
const rnd = (i: number, salt: number): number => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const scatter = (i: number): [number, number] => [
  300 + rnd(i, 1) * 1320,
  330 + rnd(i, 2) * 620,
];
const groupOf = (i: number): number => (i < 180 ? 0 : i < 282 ? 1 : 2);
const idxInGroup = (i: number): number => (i < 180 ? i : i < 282 ? i - 180 : i - 282);
const GROUP_N = [180, 102, 38];
const GROUP_LABEL = ['Free · 7,210', 'Pro · 4,102', 'Enterprise · 1,535'];
const CLUSTER_C: [number, number][] = [
  [520, 620],
  [980, 570],
  [1400, 640],
];
const CLUSTER_R = GROUP_N.map((n) => 58 + n * 0.46);
const cluster = (i: number): [number, number] => {
  const g = groupOf(i);
  const r = Math.sqrt(rnd(i, 3)) * CLUSTER_R[g];
  const a = rnd(i, 4) * Math.PI * 2;
  return [CLUSTER_C[g][0] + r * Math.cos(a), CLUSTER_C[g][1] + r * Math.sin(a)];
};
const BAR_BASE = 840;
const BAR_X = [520, 980, 1400];
const SPACING = 20;
const bar = (i: number): [number, number] => {
  const g = groupOf(i);
  const j = idxInGroup(i);
  const col = j % 8;
  const row = Math.floor(j / 8);
  return [BAR_X[g] + (col - 3.5) * SPACING, BAR_BASE - row * SPACING];
};
const ONE = ['00100', '01100', '00100', '00100', '00100', '00100', '01110'];
const TWO = ['01110', '10001', '00001', '00010', '00100', '01000', '11111'];
const EIGHT = ['01110', '10001', '10001', '01110', '10001', '10001', '01110'];
const FOUR = ['00110', '01010', '10010', '11111', '00010', '00010', '00010'];
const SEVEN = ['11111', '00001', '00010', '00100', '00100', '00100', '00100'];
const CELL = 40;
const SUB = 20;
const Y0 = 390;
const cellPts = (x: number, y: number): [number, number][] => [
  [x, y],
  [x + SUB, y],
  [x, y + SUB],
  [x + SUB, y + SUB],
];
const buildDigit = (bitmap: string[], x0: number): [number, number][] => {
  const out: [number, number][] = [];
  bitmap.forEach((rowStr, r) => {
    rowStr.split('').forEach((c, col) => {
      if (c === '1') out.push(...cellPts(x0 + col * CELL, Y0 + r * CELL));
    });
  });
  return out;
};
const DIGIT_PTS: [number, number][] = [
  ...buildDigit(ONE, 350),
  ...buildDigit(TWO, 590),
  // 逗号：基线处两格，微斜的小尾巴
  ...cellPts(845, Y0 + 5.4 * CELL),
  ...cellPts(836, Y0 + 6.3 * CELL),
  ...buildDigit(EIGHT, 920),
  ...buildDigit(FOUR, 1160),
  ...buildDigit(SEVEN, 1400),
];
const digit = (i: number): [number, number] => {
  const p = DIGIT_PTS[i % DIGIT_PTS.length];
  const jx = (rnd(i, 5) - 0.5) * 7;
  const jy = (rnd(i, 6) - 0.5) * 7;
  return [p[0] + jx, p[1] + jy];
};
const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const fade = (frame: number, inA: number, inB: number, outA?: number, outB?: number): number => {
  const fi = interpolate(frame, [inA, inB], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (outA === undefined || outB === undefined) return fi;
  const fo = interpolate(frame, [outA, outB], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.min(fi, fo);
};
const LABEL_FONT = 'Helvetica, Arial, sans-serif';
const UnitDotSwarmRegroupV2: React.FC = () => {
  const frame = useCurrentFrame();

  const dots = Array.from({ length: N }, (_, i) => {
    const stag = rnd(i, 7) * STAG;
    const mig = (start: number) =>
      spring({
        frame: frame - start - stag,
        fps: FPS,
        config: { damping: 11.5, stiffness: 150, mass: 0.8 },
        durationInFrames: DUR,
        durationRestThreshold: 0.0001,
      });
    let p = scatter(i);
    p = lerp(p, cluster(i), mig(M1));
    p = lerp(p, bar(i), mig(M2));
    p = lerp(p, digit(i), mig(M3));
    return p;
  });

  // 各阶段标签透明度（迁徙完成后浮现，下一次迁徙启动即撤）
  const clusterLabelOp = fade(frame, 38, 46, M2, M2 + 8);
  const barLabelOp = fade(frame, 72, 80, M3, M3 + 8);
  const captionOp = fade(frame, 114, 126);

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 110, width: '100%', textAlign: 'center' }}>
        <TitleBlock text={contentText(content, "copy0", "UNIT DOT SWARM REGROUP V2")} size={72} />
      </div>

      {/* 图例：每点的含义（全程挂角） */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 70,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: LABEL_FONT,
          fontSize: 24,
          fontWeight: 600,
          color: G.mid,
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: 9, background: G.mid }} />
        {contentText(content, "copy1", "Each dot ≈ 40 customers")}</div>

      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {dots.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={DOT_R} fill={groupOf(i) === 1 ? AMBER : groupOf(i) === 2 ? G.ink : G.mid} />
        ))}
      </svg>

      {/* 阶段 1：簇标签（真人数） */}
      {clusterLabelOp > 0 &&
        CLUSTER_C.map((c, g) => (
          <div
            key={`cl${g}`}
            style={{
              position: 'absolute',
              left: c[0] - 200,
              top: c[1] - CLUSTER_R[g] - 66,
              width: 400,
              textAlign: 'center',
              fontFamily: LABEL_FONT,
              fontSize: 30,
              fontWeight: 700,
              color: g === 1 ? AMBER : G.ink,
              opacity: clusterLabelOp,
            }}
          >
            {GROUP_LABEL[g]}
          </div>
        ))}

      {/* 阶段 2：柱底基线 + 真轴标 */}
      {barLabelOp > 0 && (
        <>
          <div style={{ position: 'absolute', left: 380, width: 1160, top: BAR_BASE + 16, height: 3, background: G.bar, opacity: barLabelOp }} />
          {BAR_X.map((x, g) => (
            <div
              key={`bl${g}`}
              style={{
                position: 'absolute',
                left: x - 150,
                top: BAR_BASE + 30,
                width: 300,
                textAlign: 'center',
                fontFamily: LABEL_FONT,
                fontSize: 28,
                fontWeight: 700,
                color: g === 1 ? AMBER : G.mid,
                opacity: barLabelOp,
              }}
            >
              {['Free', 'Pro', 'Enterprise'][g]}
            </div>
          ))}
        </>
      )}

      {/* 终幕：数字下方真文案 */}
      {captionOp > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 1920,
            top: Y0 + 7 * CELL + 60,
            textAlign: 'center',
            fontFamily: LABEL_FONT,
            fontSize: 34,
            fontWeight: 600,
            color: G.mid,
            opacity: captionOp,
            letterSpacing: 2,
          }}
        >
          {contentText(content, "copy2", "Total customers")}</div>
      )}
    </div>
  );
};
return UnitDotSwarmRegroupV2;
}
