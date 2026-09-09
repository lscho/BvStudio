// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { FakeDashboard } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, contentAppearance, useShotcraftContent, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const theme = contentAppearance(content);
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const TitleCard: React.FC<{ text: string; local: number; underline?: boolean }> = ({
  text,
  local,
  underline = false,
}) => {
  const scale = interpolate(local, [0, 5], [1.05, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{ background: theme.surface, alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 26,
        }}
      >
        <div
          style={{
            fontFamily: theme.fontFamily,
            fontWeight: 800,
            fontSize: Math.min(170, 1500 / Math.max(1, Array.from(text).length)),
            color: theme.color,
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          {text}
        </div>
        {underline && (
          <div style={{ width: 560, height: 14, background: theme.accent, borderRadius: 7 }} />
        )}
      </div>
    </AbsoluteFill>
  );
};
const UiShot: React.FC<{
  variant: 'A' | 'B';
  transform: string;
  origin?: string;
}> = ({ variant, transform, origin = '50% 50%' }) => (
  <AbsoluteFill style={{ overflow: 'hidden', background: '#ececea' }}>
    <div style={{ width: 1920, height: 1080, transform, transformOrigin: origin }}>
      <FakeDashboard variant={variant} />
    </div>
  </AbsoluteFill>
);
const CardFootageCadence: React.FC = () => {
  const frame = useCurrentFrame();
  const { images, incoming } = useShotcraftContent();
  // Without footage this is a three-part graphic statement, never a fixture UI.
  if (!images.length && !incoming) {
    const index = frame < 42 ? 0 : frame < 84 ? 1 : 2;
    return <TitleCard text={contentText(content, `copy${index}`, "")} local={frame - index * 42} underline={index === 2} />;
  }

  // ---- 分段：切点 14 / 22 / 34 / 42 / 52 / 62，总长 150 ----

  // 段1 0–14f：UI A 全景缓推 1.0→1.08
  if (frame < 14) {
    const s = interpolate(frame, [0, 14], [1, 1.08], CLAMP);
    return <UiShot variant="A" transform={`scale(${s})`} />;
  }

  // 段2 14–22f：字卡 SHIP
  if (frame < 22) {
    return <TitleCard text={contentText(content, "copy0", "SHIP")} local={frame - 14} />;
  }

  // 段3 22–34f：UI B 1.6x 裁切 + 横向缓移（120px 内容位移，屏上 ~192px）。
  // origin 偏左让列表行图标入画，读得出是 UI（QA 后调：50%→35%）
  if (frame < 34) {
    const tx = interpolate(frame - 22, [0, 12], [60, -60], CLAMP);
    return (
      <UiShot variant="B" transform={`scale(1.6) translateX(${tx}px)`} origin="35% 50%" />
    );
  }

  // 段4 34–42f：字卡 FASTER
  if (frame < 42) {
    return <TitleCard text={contentText(content, "copy1", "FASTER")} local={frame - 34} />;
  }

  // 段5 42–52f：UI A 另一处 2x 裁切（左上卡片区）+ 继续缓推 2.0→2.14
  if (frame < 52) {
    const s = interpolate(frame - 42, [0, 10], [2, 2.14], CLAMP);
    return <UiShot variant="A" transform={`scale(${s})`} origin="32% 30%" />;
  }

  // 段6 52–62f：字卡 TODAY + 下划线
  if (frame < 62) {
    return <TitleCard text={contentText(content, "copy2", "TODAY")} local={frame - 52} underline />;
  }

  // 段7 62–150f：收尾全景 UI 定格。62–105f 极缓推收完（out-cubic），
  // 105f 后 transform 值恒为 1.02，105–150f 真静止 45f。
  const s = interpolate(frame, [62, 105], [1, 1.02], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  return <UiShot variant="B" transform={`scale(${s})`} />;
};
return CardFootageCadence;
}
