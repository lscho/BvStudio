// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const LABELS = [contentText(content, "copy0", "Dashboard"), contentText(content, "copy1", "Projects"), contentText(content, "copy2", "Analytics"), contentText(content, "copy3", "Messages"), contentText(content, "copy4", "Settings"), contentText(content, "copy5", "Sign out")];
const HUES = [225, 250, 275, 300, 210, 340];
const ListReveal: React.FC = () => {
  const t = useT();
  return (
    <DesignStage bg="#0a0b10">
      {/* 居中容器：flex 撑起列表垂直水平居中 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#0a0b10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 整体漂移层：全程线性缓慢上移 */}
        <div
          style={{
            position: 'relative',
            width: 240,
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            // -0.5px：原样片浏览器 flex 居中落在整数位（列表高 255 → 顶部 7.0），
            // Remotion 渲染落在 7.5，补回半个设计像素对齐原片
            transform: `translateY(${lerp(t, 16, -16) - 0.5}px)`,
          }}
        >
          {LABELS.map((s, i) => {
            // 逐项入场：outBack 轻微过冲找位
            const p = seg(t, 0.06 + i * 0.09, 0.06 + i * 0.09 + 0.24, E.outBack);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 13px',
                  borderRadius: 10,
                  background: '#161a26',
                  border: '1px solid #262c40',
                  opacity: Math.min(1, p * 2.2),
                  transform: `scale(${0.78 + Math.max(0, p) * 0.22}) translateY(${lerp(Math.max(0, p), 14, 0)}px)`,
                }}
              >
                <div
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 5,
                    flex: 'none',
                    background: `linear-gradient(140deg,hsl(${HUES[i]},75%,64%),hsl(${HUES[i]},70%,46%))`,
                  }}
                />
                <div
                  style={{
                    fontFamily: '-apple-system,sans-serif',
                    fontWeight: 500,
                    fontSize: 13,
                    lineHeight: 1,
                    color: '#c6cde2',
                  }}
                >
                  {s}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DesignStage>
  );
};
return ListReveal;
}
