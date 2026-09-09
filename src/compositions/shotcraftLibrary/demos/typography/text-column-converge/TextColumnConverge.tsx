// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "@/compositions/shotcraftLibrary/runtime";
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const STEPS: { word: string; dur: number }[] = [
  { word: contentText(content, "copy0", "LAUNCHER DESIGN"), dur: 16 },
  { word: contentText(content, "copy1", "COMPACT MODE"), dur: 12 },
  { word: contentText(content, "copy2", "HOTKEY RECORDER"), dur: 9 },
  { word: contentText(content, "copy3", "HOTKEY TYPES"), dur: 8 },
  { word: contentText(content, "copy4", "VOICE FEATURES"), dur: 7 },
  { word: contentText(content, "copy5", "SETTINGS DESIGN"), dur: 8 },
  { word: contentText(content, "copy6", "AI CHAT"), dur: 10 },
  { word: contentText(content, "copy7", "FILE SEARCH"), dur: 12 },
  { word: contentText(content, "copy8", "RAYCAST"), dur: 999 }, // 最后一词：停稳后触发唯一一次合拢
];
const START = 8;
const NEW_LEFT_EDGE = 618;
const WORD_RIGHT_EDGE = 1302;
const FS = 42;
const LSP = 3;
const ADV = 0.6 * FS + LSP;
const LINE_W = 11 * ADV;
const MERGED_LEFT = 960 - LINE_W / 2;
const MERGED_RIGHT = 960 + LINE_W / 2;
const CONVERGE_DUR = 36;
const CONVERGE_DELAY = 10;
const SUB_DELAY = 18;
const TextColumnConverge: React.FC = () => {
  const f = useCurrentFrame();
  const t = f - START;

  // 定位当前步
  let acc = 0;
  let idx = 0;
  let stepStart = 0;
  for (let i = 0; i < STEPS.length; i++) {
    if (t >= acc) { idx = i; stepStart = acc; }
    acc += STEPS[i].dur;
  }
  const cur = STEPS[idx];
  const isLast = idx === STEPS.length - 1;
  const local = t - stepStart;

  // 唯一一次合拢：RAYCAST 停稳 CONVERGE_DELAY 帧后，ease-in-out 连续滑动
  const cvT = isLast ? local - CONVERGE_DELAY : -1;
  const cv = interpolate(cvT, [0, CONVERGE_DUR], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // NEW 左缘：618 → 831；特性词右缘：1302 → 1088
  const newLeft = interpolate(cv, [0, 1], [NEW_LEFT_EDGE, MERGED_LEFT]);
  const wordRight = interpolate(cv, [0, 1], [WORD_RIGHT_EDGE, MERGED_RIGHT]);

  const converged = cv >= 1;

  // 斜体小字：合拢定格后 SUB_DELAY 帧，近乎硬切（4 帧快速淡入，无位移）
  const subT = converged ? cvT - CONVERGE_DUR - SUB_DELAY : -1;
  const subOp = interpolate(subT, [0, 4], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const visible = t >= 0;

  const font: React.CSSProperties = {
    fontFamily: '"SF Mono", Menlo, monospace',
    fontWeight: 500,
    fontSize: FS,
    letterSpacing: 3,
    color: '#f2f2f4',
    whiteSpace: 'nowrap',
    lineHeight: 1,
  };

  return (
    <AbsoluteFill style={{ background: '#050506', overflow: 'hidden' }}>
      {visible && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {/* NEW：左缘定位（轮换期间钉死在左屏边距处） */}
          <div style={{
            ...font, position: 'absolute',
            left: newLeft, top: 519,
          }}>
            {contentText(content, "copy9", "NEW")}</div>
          {/* 特性词：右缘定位（词换长换短，右缘不动） */}
          <div style={{
            ...font, position: 'absolute',
            right: 1920 - wordRight, top: 519,
          }}>
            {cur.word}
          </div>

          {/* 斜体小字：合拢后在整行正下方浮现，与整行同左缘 */}
          <div style={{
            ...font,
            fontStyle: 'italic',
            color: '#d8d8dc',
            position: 'absolute',
            left: MERGED_LEFT, top: 519 + FS + 14,
            opacity: subOp,
          }}>
            {contentText(content, "copy10", "COMING 2026")}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
return TextColumnConverge;
}
