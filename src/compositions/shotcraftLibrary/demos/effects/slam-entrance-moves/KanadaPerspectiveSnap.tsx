// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { G, Card, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const h = (n: number): number => {
  const s = Math.sin(n * 127.3) * 43758.5453;
  return s - Math.floor(s);
};
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const CARD_W = 520;
const CARD_H = 340;
const CX = (1920 - CARD_W) / 2;
const CY = (1080 - CARD_H) / 2;
const KanadaPerspectiveSnap: React.FC = () => {
  const frame = useCurrentFrame();

  // 0–18f 甩入主通道（out cubic：先猛后缓，急停感）
  const p = interpolate(frame, [0, 18], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const persp = interpolate(p, [0, 1], [300, 1500]); // 短焦鱼眼→长焦收平
  const angle3d = interpolate(p, [0, 1], [58, 0]); // rotate3d(0.5,1,0.1)
  const scale = interpolate(p, [0, 1], [1.7, 1]);
  const tx = interpolate(p, [0, 1], [-700, 0]);

  // rotateY 过冲通道：14–18f 冲到 +5°，18–22f "啪"地回 0
  const rotY =
    frame < 18
      ? interpolate(frame, [14, 18], [0, 5], CLAMP)
      : interpolate(frame, [18, 22], [5, 0], { ...CLAMP, easing: Easing.out(Easing.cubic) });

  // 落定震屏：18f 起 6px，2f 内衰减到 0（21f 后恒为 0，保证真静止）
  const shakeAmp = frame >= 18 ? interpolate(frame, [18, 21], [6, 0], CLAMP) : 0;
  const shakeX = shakeAmp * (h(frame * 7 + 1) * 2 - 1);
  const shakeY = shakeAmp * (h(frame * 13 + 2) * 2 - 1);

  // 阴影：飞行期拉长斜影（大偏移大模糊）→ 落定收为正常投影（18–22f 收拢）
  const shOff = frame < 18 ? interpolate(p, [0, 1], [1, 0.35]) : interpolate(frame, [18, 22], [0.35, 0], { ...CLAMP, easing: Easing.out(Easing.quad) });
  const shX = interpolate(shOff, [0, 1], [0, 70]);
  const shY = interpolate(shOff, [0, 1], [8, 52]);
  const shBlur = interpolate(shOff, [0, 1], [14, 36]);
  const shAlpha = interpolate(shOff, [0, 1], [0.16, 0.3]);

  // 甩速 blur：透视扭曲期叠 2px，落定（18f）即摘，收尾无逐帧滤镜
  const blur = frame < 18 ? 2 : 0;

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: shakeX, top: shakeY, width: 1920, height: 1080 }}>
        <div style={{ position: 'absolute', left: 120, top: 96 }}>
          <TitleBlock text={contentText(content, "copy0", "KANADA PERSPECTIVE SNAP")} size={54} />
        </div>
        {/* 落点槽位（虚线框，给"甩到哪"一个参照） */}
        <div
          style={{
            position: 'absolute',
            left: CX - 20,
            top: CY - 20,
            width: CARD_W + 40,
            height: CARD_H + 40,
            border: `3px dashed ${G.bar}`,
            borderRadius: 22,
            boxSizing: 'border-box',
          }}
        />
        {/* 透视容器：perspective 随落定从鱼眼收敛到长焦 */}
        <div style={{ position: 'absolute', left: CX, top: CY, perspective: `${persp}px`, perspectiveOrigin: '30% 50%' }}>
          <div
            style={{
              transform: `translateX(${tx}px) scale(${scale}) rotate3d(0.5, 1, 0.1, ${angle3d}deg) rotateY(${rotY}deg)`,
              transformOrigin: '20% 50%',
              filter: `drop-shadow(${shX}px ${shY}px ${shBlur}px rgba(0,0,0,${shAlpha}))${blur ? ` blur(${blur}px)` : ''}`,
            }}
          >
            <Card w={CARD_W} h={CARD_H} seed={3} />
          </div>
        </div>
      </div>
    </div>
  );
};
return KanadaPerspectiveSnap;
}
