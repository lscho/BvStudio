// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, rand, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const BG = '#F1F1F3';
const INK = '#0B0B0C';
const LINE = '#E6E6EA';
const SKEL = '#DEDEE3';
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const inOutSin = (x: number) => 0.5 - Math.cos(Math.PI * clamp01(x)) / 2;
const DW = 300;
const DH = 178;
const DX = (440 - DW) / 2;
const DY = (240 - DH) / 2;
const COLS = 4;
const COL_W = (DW - 28 - (COLS - 1) * 10) / COLS;
const SKEL_COLS = Array.from({ length: COLS }, (_, c) => ({
  x: 14 + c * (COL_W + 10),
  rows: Array.from({ length: 7 }, (_, r) => ({
    top: 58 + r * 13,
    w: Number((COL_W * (0.55 + rand(c * 13 + r * 7) * 0.45)).toFixed(1)),
  })),
}));
const CS = 34;
const CB = `2px solid ${INK}`;
const CORNERS: { pos: React.CSSProperties; dx: number; dy: number }[] = [
  { pos: { left: -7, top: -7, borderLeft: CB, borderTop: CB }, dx: 1, dy: 1 },
  { pos: { right: -7, top: -7, borderRight: CB, borderTop: CB }, dx: -1, dy: 1 },
  { pos: { right: -7, bottom: -7, borderRight: CB, borderBottom: CB }, dx: -1, dy: -1 },
  { pos: { left: -7, bottom: -7, borderLeft: CB, borderBottom: CB }, dx: 1, dy: -1 },
];
const PASSES = 5;
const ScanBracketSweep: React.FC = () => {
  const t = useT();

  // 文档弹入：scale 0.86→1 + 快速淡入
  const dp = seg(t, 0, 0.11, E.outCubic);

  // 扫描往复：5 趟，每趟末尾留 12% 停顿，两端慢中间快（inOutSine）
  const sp = seg(t, 0.17, 0.95, E.linear);
  const raw = sp * PASSES;
  const pi = Math.min(PASSES - 1, Math.floor(raw));
  const local = clamp01((raw - pi) / 0.88);
  const dir = pi % 2 === 0 ? 1 : -1;
  const prog = inOutSin(local);
  const y = dir > 0 ? prog * DH : DH - prog * DH;
  // 光带整体淡入（0.16–0.2）淡出（0.93–0.99）
  const clipOp = Number((seg(t, 0.16, 0.2) * (1 - seg(t, 0.93, 0.99))).toFixed(3));

  return (
    <DesignStage bg={BG}>
      {/* 440×240 定尺画布（mkSheet），居中于 480×270 设计坐标 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 440,
          height: 240,
          margin: '-120px 0 0 -220px',
        }}
      >
        {/* holder：文档 + 光带 + 括号共用的定位容器 */}
        <div style={{ position: 'absolute', left: DX, top: DY, width: DW, height: DH }}>
          {/* 骨架文档卡片（原采集页为 content-box：1px 边框长在 300×178 之外） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: DW,
              height: DH,
              boxSizing: 'content-box',
              background: '#fff',
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              boxShadow: '0 8px 26px rgba(0,0,0,.06)',
              overflow: 'hidden',
              transformOrigin: '50% 50%',
              transform: `scale(${lerp(dp, 0.86, 1)})`,
              opacity: clamp01(dp * 3),
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, right: 0 }}>
              {/* 标题条 + 副标题条 */}
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  top: 12,
                  width: Math.round(DW * 0.34),
                  height: 7,
                  borderRadius: 3,
                  background: INK,
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  top: 25,
                  width: Math.round(DW * 0.2),
                  height: 5,
                  borderRadius: 3,
                  background: SKEL,
                }}
              />
              {/* 4 列骨架：列头 + 7 行随机宽占位条 */}
              {SKEL_COLS.map((col, c) => (
                <React.Fragment key={c}>
                  <div
                    style={{
                      position: 'absolute',
                      left: col.x,
                      top: 44,
                      width: Number((COL_W * 0.72).toFixed(1)),
                      height: 6,
                      borderRadius: 3,
                      background: '#9A9AA2',
                    }}
                  />
                  {col.rows.map((row, r) => (
                    <div
                      key={r}
                      style={{
                        position: 'absolute',
                        left: col.x,
                        top: row.top,
                        width: row.w,
                        height: 5,
                        borderRadius: 2.5,
                        background: SKEL,
                      }}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* 扫描光带（裁在文档圆角内）：2.5px 黑实线 + 82px 朝来向的渐变拖尾 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: DW,
              height: DH,
              borderRadius: 10,
              overflow: 'hidden',
              pointerEvents: 'none',
              opacity: clipOp,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: 0,
                transform: `translateY(${y.toFixed(2)}px)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: 82,
                  top: dir > 0 ? -82 : 2.5,
                  background:
                    dir > 0
                      ? 'linear-gradient(180deg,rgba(20,20,22,0),rgba(20,20,22,.5))'
                      : 'linear-gradient(180deg,rgba(20,20,22,.5),rgba(20,20,22,0))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 2.5,
                  background: INK,
                }}
              />
            </div>
          </div>

          {/* 四角取景括号：交错落位，向内收 8px（原页 content-box，2px 边长在 34×34 之外） */}
          {CORNERS.map((c, i) => {
            const p = seg(t, 0.08 + i * 0.022, 0.08 + i * 0.022 + 0.055, E.outCubic);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: CS,
                  height: CS,
                  boxSizing: 'content-box',
                  opacity: p,
                  transform: `translate(${(1 - p) * 8 * c.dx}px,${(1 - p) * 8 * c.dy}px)`,
                  ...c.pos,
                }}
              />
            );
          })}
        </div>
      </div>
    </DesignStage>
  );
};
return ScanBracketSweep;
}
