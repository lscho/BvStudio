// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "@/compositions/shotcraftLibrary/runtime";
import { VerticalTicker, TickerColumn } from '@/compositions/shotcraftLibrary/demos/ui-entrance/page-waterfall-wall/VerticalTicker';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const BG = '#101014';
const shot = (file: string) => (
  <div
    style={{
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      background: '#fff',
    }}
  >
    <Img src={staticFile(`textures/${file}`)} style={{ width: '100%', display: 'block' }} />
  </div>
);
const buildColumns = (loops: [number, number, number]): TickerColumn[] => [
  {
    items: ['card1.png', 'card2.png', 'card3.png', 'card10.png'].map(shot),
    durationInSeconds: loops[0],
    direction: -1,
  },
  {
    items: ['card4.png', 'card5.png', 'card6.png', 'projects-empty.png'].map(shot),
    durationInSeconds: loops[1],
    direction: 1,
  },
  {
    items: ['card7.png', 'card8.png', 'card9.png', 'float-search.png'].map(shot),
    durationInSeconds: loops[2],
    direction: -1,
  },
];
const PageWaterfallWall: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // 镜头缓推寄生在外层，墙自身循环、镜头单向
  const push = interpolate(frame, [0, durationInFrames], [1, 1.06]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <VerticalTicker
          columns={buildColumns([12, 9, 14])}
          backgroundColor={BG}
          columnWidth={560}
          gap={30}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
return PageWaterfallWall;
}
