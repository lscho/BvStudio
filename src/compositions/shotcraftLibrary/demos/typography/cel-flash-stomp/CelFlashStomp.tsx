// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
type Word = {
  text: string;
  start: number; // 硬切入场帧
  end: number; // 显示到此帧前（下一词硬切）
  rot: number; // 图章歪斜角
  flashLen: number; // 落定后背景闪总帧数
  flashDark: string; // 闪切的加深灰
};
const LAND = 6;
const WORDS: Word[] = [
  { text: contentText(content, "copy0", "SHIP"), start: 0, end: 30, rot: 2.5, flashLen: 6, flashDark: '#cfcfca' },
  { text: contentText(content, "copy1", "FASTER"), start: 30, end: 60, rot: -2.5, flashLen: 6, flashDark: '#cfcfca' },
  { text: contentText(content, "copy2", "TODAY"), start: 60, end: 9999, rot: 0, flashLen: 8, flashDark: '#c4c4c0' },
];
const CelFlashStomp: React.FC = () => {
  const frame = useCurrentFrame();
  const word = WORDS.find((w) => frame >= w.start && frame < w.end)!;
  const t = frame - word.start;

  // 弹落：scale 1.18 → 0.98(2% 过冲) → 1，6f 内完成，poly(5) 出缓
  const scale =
    t < 4
      ? interpolate(t, [0, 4], [1.18, 0.98], {
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.poly(5)),
        })
      : interpolate(t, [4, LAND], [0.98, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.quad),
        });

  // 背景闪：落定帧(start+LAND)起，每 2f 在加深灰与 G.bg 间交替，共 flashLen 帧
  const ft = t - LAND;
  const flashing = ft >= 0 && ft < word.flashLen;
  const bg = flashing && Math.floor(ft / 2) % 2 === 0 ? word.flashDark : G.bg;

  // 第三词落定同帧起底部标签条淡入（66–80）
  const labelOp = interpolate(frame, [66, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  return (
    <div style={{ width: 1920, height: 1080, background: bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy3", "CEL FLASH STOMP")} size={54} />
      </div>
      {/* 文字层独立在背景之上：背景闪切时它纹丝不动 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 800,
            fontSize: 210,
            color: G.ink,
            letterSpacing: -4,
            transform: `scale(${scale}) rotate(${word.rot}deg)`,
          }}
        >
          {word.text}
        </div>
      </div>
      {/* 底部标签条：第三词落定同帧淡入 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 96,
          background: G.ink,
          opacity: labelOp,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 120px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 10, background: G.sideBar }} />
        <div style={{ height: 16, width: 320, background: G.mid, borderRadius: 8 }} />
        <div style={{ marginLeft: 'auto', height: 16, width: 180, background: G.sideBar, borderRadius: 8 }} />
      </div>
    </div>
  );
};
return CelFlashStomp;
}
