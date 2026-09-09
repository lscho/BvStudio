// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const FONT = '-apple-system,system-ui,sans-serif';
const HALF = 148;
const Brace: React.FC<{ ch: string; x: number; sc: number; on: number }> = ({ ch, x, sc, on }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      fontWeight: 800,
      fontSize: 44,
      fontFamily: FONT,
      color: '#fff',
      transform: `translate(-50%,-50%) translateX(${x}px) scale(${sc})`,
      opacity: on,
    }}
  >
    {ch}
  </div>
);
const BraceExpand: React.FC = () => {
  const t = useT();
  const on = t >= 0.07 ? 1 : 0; // 先单独出现（小字号，约 2 帧后再动）
  const ex = seg(t, 0.13, 0.34, E.outBack); // 弹开：过冲约 8% 再回弹
  const sc = lerp(ex, 0.6, 1); // 字号同步放大到标题级
  const x = HALF * ex * sc;
  // 落定后 letterspacing 细微松弛
  const ls = lerp(seg(t, 0.42, 0.62, E.inOutQuad), 1, 2.6);
  return (
    <DesignStage bg="#0a0b10">
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
        {/* 文字揭示宽度严格绑括号间距（幕布感，而非打字） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: 'translate(-50%,-50%)',
            overflow: 'hidden',
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: Math.max(0, x * 2 - 34),
            opacity: on,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 38,
              fontFamily: FONT,
              color: '#fff',
              whiteSpace: 'nowrap',
              letterSpacing: `${ls}px`,
              transform: `scale(${sc})`,
            }}
          >
            {contentText(content, "copy0", "Your title")}</div>
        </div>
        <Brace ch="{" x={-x} sc={sc} on={on} />
        <Brace ch="}" x={x} sc={sc} on={on} />
      </div>
    </DesignStage>
  );
};
return BraceExpand;
}
