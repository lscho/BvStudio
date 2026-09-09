// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, FakeDashboard } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const CUT_1 = 0;
const CUT_2 = 9;
const CUT_3 = 18;
const BLACK = 27;
const TITLE = 33;
const TITLE_IN = 16;
const push = (frame: number, start: number) =>
  interpolate(frame, [start, start + 9], [1, 1.04], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
const TrailerBumper: React.FC = () => {
  const frame = useCurrentFrame();

  // —— 段落 1–3：三连速剪 ——
  if (frame < BLACK) {
    let inner: React.ReactNode;
    if (frame < CUT_2) {
      // 镜头1：A 整页 + 轻推近
      inner = (
        <div style={{ width: 1920, height: 1080, transform: `scale(${push(frame, CUT_1)})`, transformOrigin: '50% 50%' }}>
          <FakeDashboard variant="A" />
        </div>
      );
    } else if (frame < CUT_3) {
      // 镜头2：B 整页 + 轻推近
      inner = (
        <div style={{ width: 1920, height: 1080, transform: `scale(${push(frame, CUT_2)})`, transformOrigin: '50% 50%' }}>
          <FakeDashboard variant="B" />
        </div>
      );
    } else {
      // 镜头3：A 的 2.2x 放大裁切怼脸特写（对准中列卡片），叠加同样的轻推近
      const s = 2.2 * push(frame, CUT_3);
      inner = (
        <div style={{ width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '58% 40%' }}>
          <FakeDashboard variant="A" />
        </div>
      );
    }
    return (
      <div style={{ width: 1920, height: 1080, overflow: 'hidden', background: G.bg }}>
        {inner}
      </div>
    );
  }

  // —— 段落 4：纯黑静默 6f，必须纯黑无物 ——
  if (frame < TITLE) {
    return <div style={{ width: 1920, height: 1080, background: '#000000' }} />;
  }

  // —— 段落 5：正式开场——浅底大标题淡入+微升 16f 后定格 ——
  const opacity = interpolate(frame, [TITLE, TITLE + TITLE_IN], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rise = interpolate(frame, [TITLE, TITLE + TITLE_IN], [44, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: G.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${rise}px)`,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: 168,
          color: G.ink,
          letterSpacing: -2,
          textAlign: 'center',
        }}
      >
        {contentText(content, "copy0", "THE LAUNCH")}</div>
    </div>
  );
};
return TrailerBumper;
}
