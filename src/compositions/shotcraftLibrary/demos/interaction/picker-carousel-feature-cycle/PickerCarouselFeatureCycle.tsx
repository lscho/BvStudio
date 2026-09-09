// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const PAPER = '#F3F3F1';
const INK = '#111113';
const MID = '#8A8A8F';
const ROW_H = 34;
const ITEMS = [
  contentText(content, "copy0", "Data Cleanup"),
  contentText(content, "copy1", "Direct Message"),
  contentText(content, "copy2", "Smart Segments"),
  contentText(content, "copy3", "Batch Actions"),
  contentText(content, "copy4", "Reward Program"),
  contentText(content, "copy5", "Automated Flows"),
  contentText(content, "copy6", "Variant Testing"),
];
const ICONS = ['◎', '✉', '◧', '◈', '★', '↺', '⚑'];
const STEPS = 5;
const HOLD = 5 / 14;
const PickerCarouselFeatureCycle: React.FC = () => {
  const t = useT();

  // 主时间轴：t∈[0.05,0.95] 均分 5 步；步内前 (1-HOLD) 用 outQuint 吸附，末段静止
  const g = seg(t, 0.05, 0.95) * STEPS;
  const step = Math.min(STEPS - 1, Math.floor(g));
  const local = Math.min(1, g - step);
  const mv = E.outQuint(Math.min(1, local / (1 - HOLD)));
  const pos = step + mv;

  // 落定呼吸：吸附完成进入 HOLD 后，药丸 scaleY 1→1.06→1 极轻脉冲
  const land = Math.max(0, (local - (1 - HOLD)) / HOLD);
  const breath = land > 0 ? Math.sin(Math.min(1, land / 0.6) * Math.PI) * 0.06 : 0;

  return (
    <DesignStage bg={PAPER}>
      {/* 纸面底 —— 与原采集页 paper() 容器一致 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: PAPER,
          fontFamily: "-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif",
        }}
      >
        {/* 选择器视口：300×(34×5) 居中，整体在开头 5% 内淡入 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 300,
            height: ROW_H * 5,
            transform: 'translate(-50%,-50%)',
            overflow: 'hidden',
            opacity: seg(t, 0, 0.05),
          }}
        >
          {/* 焦点药丸：位置不动，仅落定时 scaleY 呼吸。
              原采集页是 content-box，带 1px 边框需显式声明，否则高度差 2px */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: ROW_H * 2,
              height: ROW_H,
              boxSizing: 'content-box',
              borderRadius: 999,
              background: '#fff',
              border: '1px solid #E3E3E6',
              boxShadow: '0 2px 8px rgba(0,0,0,.06)',
              transform: `scaleY(${1 + breath})`,
            }}
          />
          {/* 内容列：整列 translateY 穿过焦点药丸 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              transform: `translateY(${ROW_H * 2 - pos * ROW_H}px)`,
            }}
          >
            {ITEMS.map((txt, i) => {
              // 按到中心距离分层：透明度两段线性、字号 17→14、颜色三档灰度
              const d = Math.abs(i - pos);
              const k2 = Math.min(2, d);
              const o = k2 <= 1 ? lerp(k2, 1, 0.55) : lerp(k2 - 1, 0.55, 0.18);
              return (
                <div
                  key={i}
                  style={{
                    height: ROW_H,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontWeight: 600,
                    fontSize: lerp(Math.min(1, d / 2), 17, 14),
                    lineHeight: 1,
                    fontFamily: "-apple-system,'Helvetica Neue',sans-serif",
                    color: d < 0.5 ? INK : d < 1.5 ? MID : '#B9B9BE',
                    opacity: o,
                  }}
                >
                  {/* 图标仅在贴近焦点时浮现（d<0.625 内可见） */}
                  <span style={{ fontSize: 14, opacity: Math.max(0, 1 - d * 1.6) }}>
                    {ICONS[i]}
                  </span>
                  <span>{txt}</span>
                </div>
              );
            })}
          </div>
          {/* 上下渐隐罩：纸色→透明→纸色，盖在列表之上 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `linear-gradient(180deg,${PAPER} 0%,rgba(243,243,241,0) 26%,rgba(243,243,241,0) 74%,${PAPER} 100%)`,
            }}
          />
        </div>
        {/* 左外侧固定 AI 徽标：黑底白字方形圆角，开头略滞后淡入 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            margin: '-11px 0 0 -186px',
            width: 26,
            height: 22,
            borderRadius: 6,
            background: INK,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 10,
            lineHeight: 1,
            fontFamily: '-apple-system,sans-serif',
            letterSpacing: 0.5,
            opacity: seg(t, 0.02, 0.09),
          }}
        >
          {contentText(content, "copy7", "AI")}</div>
      </div>
    </DesignStage>
  );
};
return PickerCarouselFeatureCycle;
}
