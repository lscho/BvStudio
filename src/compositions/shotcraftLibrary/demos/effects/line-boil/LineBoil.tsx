// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React, { useId } from 'react';
import { useCurrentFrame, interpolate } from "@/compositions/shotcraftLibrary/runtime";
import { G, TitleBlock } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const BOIL_START = 35;
const BOIL_END = 105;
const BOIL_SCALE = 8;
const CornerTag: React.FC<{ text: string; opacity: number }> = ({ text, opacity }) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 56,
      padding: '10px 22px',
      border: `3px solid ${G.ink}`,
      borderRadius: 999,
      color: G.ink,
      background: G.bg,
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontWeight: 700,
      fontSize: 30,
      letterSpacing: 2,
      opacity,
    }}
  >
    {text}
  </div>
);
const LineBoil: React.FC = () => {
  const f = useCurrentFrame();
  // 滤镜 ID 按实例生成，多实例同场不串引（useId 的 «:» 在 url() 里非法，需清洗）
  const boilId = `boil-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const boiling = f >= BOIL_START && f < BOIL_END;
  // seed 每 3 帧阶梯换 → 8~10Hz 的手绘颤动感；帧确定，无随机源
  const seed = Math.floor(f / 3);

  // 角标：boil on 只在沸腾段淡入淡出；boil off 与之互补。
  // 全部过渡在 105f 前完成 → 105–140 逐帧完全相同
  const onOp = interpolate(f, [35, 40, 100, 105], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const offOp = 1 - onOp;

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>
      {/* 沸腾段才渲染 filter 定义——摘罩即整个 SVG def 消失，收尾天然真静止 */}
      {boiling && (
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <defs>
            <filter id={boilId} x="-15%" y="-15%" width="130%" height="130%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency={0.015}
                numOctaves={2}
                seed={seed}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={BOIL_SCALE}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      )}

      {/* 手法名标签：不入滤镜层，作为静止参照物 */}
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <TitleBlock text={contentText(content, "copy0", "LINE BOIL")} size={54} />
      </div>

      {/* 被沸腾的整层：大标题 + 描边卡 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
          filter: boiling ? `url(#${boilId})` : undefined,
        }}
      >
        <div
          style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 800,
            fontSize: 170,
            color: G.ink,
            letterSpacing: 4,
            lineHeight: 1,
          }}
        >
          {contentText(content, "copy1", "ALIVE")}</div>
        {/* 描边卡：透明底 3px ink 描边 520×300 圆角框 + 几条灰线 */}
        <div
          style={{
            width: 520,
            height: 300,
            border: `3px solid ${G.ink}`,
            borderRadius: 20,
            boxSizing: 'border-box',
            padding: '36px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
          }}
        >
          <div style={{ height: 16, width: '62%', background: G.mid, borderRadius: 8 }} />
          <div style={{ height: 12, width: '88%', background: G.bar, borderRadius: 6 }} />
          <div style={{ height: 12, width: '74%', background: G.bar, borderRadius: 6 }} />
          <div style={{ height: 12, width: '81%', background: G.bar, borderRadius: 6 }} />
          <div style={{ marginTop: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, border: `3px solid ${G.ink}`, boxSizing: 'border-box' }} />
            <div style={{ height: 12, width: 120, background: G.mid, borderRadius: 6 }} />
          </div>
        </div>
      </div>

      {/* 状态角标：沸腾段 boil on，静止段 boil off */}
      <CornerTag text={contentText(content, "copy2", "boil on")} opacity={onOp} />
      <CornerTag text={contentText(content, "copy3", "boil off")} opacity={offOp} />
    </div>
  );
};
return LineBoil;
}
