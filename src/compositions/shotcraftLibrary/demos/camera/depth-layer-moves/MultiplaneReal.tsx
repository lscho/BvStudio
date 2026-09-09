// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import layout from '@/compositions/shotcraftLibrary/demos/_textures/live-layout.json';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const CARDS = layout.projects.cards.slice(0, 6);
const MultiplaneReal: React.FC = () => {
  const frame = useCurrentFrame();
  const drive = interpolate(frame, [10, 125], [0, 1000], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.bezier(0.35, 0, 0.25, 1),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: '#efece6', overflow: 'hidden' }}>
      {/* 背景层 0.35x：整页微退焦 */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-drive * 0.35}px) scale(1.05)`, filter: 'blur(2px) saturate(0.92)', opacity: 0.85 }}>
        <Img src={staticFile('textures/live/projects-full.png')} style={{ position: 'absolute', left: 0, top: -300, width: 2100 }} />
      </div>
      {/* 中景层 0.7x：真实卡组横排（主阅读层） */}
      <div style={{ position: 'absolute', top: 330, transform: `translateX(${-drive * 0.7}px)` }}>
        {CARDS.map((c, k) => (
          <Img
            key={c.file}
            src={staticFile(`textures/live/${c.file}`)}
            style={{
              position: 'absolute', left: 200 + k * 480, top: (k % 2) * 40,
              width: 420, borderRadius: 12,
              boxShadow: '0 8px 28px rgba(31,28,23,0.14)',
            }}
          />
        ))}
      </div>
      {/* 前景层 1.4x：浮块掠过（search 切片 + 高清卡），轻 blur */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-drive * 1.4}px)`, filter: 'blur(3px)' }}>
        <Img src={staticFile('textures/live/float-search.png')} style={{ position: 'absolute', left: 900, top: 150, width: 700, borderRadius: 22, boxShadow: '0 12px 36px rgba(31,28,23,0.18)' }} />
        <Img src={staticFile('textures/live/card4-hires.png')} style={{ position: 'absolute', left: 2100, top: 700, width: 380, borderRadius: 12, boxShadow: '0 12px 36px rgba(31,28,23,0.20)' }} />
      </div>
    </AbsoluteFill>
  );
};
return MultiplaneReal;
}
