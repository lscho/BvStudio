// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, FakeDashboard, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const S = content.linked ? 1 : 0.82;
const W = 1920 * S;
const H = 1080 * S;
const Face: React.FC<{
  variant: 'A' | 'B';
  rot: number; // 面自身的 rotateY（A=0，B=90）
  brightness: number;
  seam: number; // 接缝阴影不透明度 0–1
  seamSide: 'right' | 'left'; // 阴影贴在哪条竖边（即共享棱一侧）
}> = ({ variant, rot, brightness, seam, seamSide }) => (
  <div
    style={{
      position: 'absolute',
      width: W,
      height: H,
      overflow: 'hidden',
      backfaceVisibility: 'hidden',
      transform: `rotateY(${rot}deg) translateZ(${W / 2}px)`,
      filter: `brightness(${brightness})`,
      background: G.bg,
    }}
  >
    <div style={{ transform: `scale(${S})`, transformOrigin: '0 0' }}>
      <FakeDashboard variant={variant} />
    </div>
    {seam > 0.01 && (
      <div
        style={{
          position: 'absolute',
          top: 0,
          [seamSide]: 0,
          width: 150,
          height: H,
          opacity: seam,
          background:
            seamSide === 'right'
              ? 'linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.55))'
              : 'linear-gradient(to left, rgba(0,0,0,0), rgba(0,0,0,0.55))',
        }}
      />
    )}
  </div>
);
const CubeRotate: React.FC = () => {
  const frame = useCurrentFrame();
  // 翻转进度：30–68f，inOut cubic；两端 clamp 保证 hold 段逐帧恒定
  const p = interpolate(frame, [30, 68], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const theta = -90 * p;
  const brightA = 1 - 0.45 * p; // 旧面转出压暗 1→0.55
  const brightB = 0.55 + 0.45 * p; // 新面转入亮起 0.55→1
  const mid = Math.sin(p * Math.PI); // 0→1→0，45° 时最深
  const seam = mid * 0.9;
  const blur = mid * 1.5;

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      {/* blur 外包一层：>0.02 才挂 filter，落定后收尾帧完全相同 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: blur > 0.02 ? `blur(${blur}px)` : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: (1920 - W) / 2,
            top: (1080 - H) / 2,
            width: W,
            height: H,
            perspective: 1400,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transformStyle: 'preserve-3d',
              transform: `translateZ(${-W / 2}px) rotateY(${theta}deg)`,
            }}
          >
            {/* 面 A：正面出发，绕左而去；接缝棱在其右边 */}
            <Face variant="A" rot={0} brightness={brightA} seam={seam} seamSide="right" />
            {/* 面 B：从 +90° 侧面转进来；接缝棱在其左边 */}
            <Face variant="B" rot={90} brightness={brightB} seam={seam} seamSide="left" />
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 120, top: 60 }}>
        <TitleBlock text={contentText(content, "copy0", "CUBE ROTATE")} size={54} />
      </div>
    </div>
  );
};
return CubeRotate;
}
