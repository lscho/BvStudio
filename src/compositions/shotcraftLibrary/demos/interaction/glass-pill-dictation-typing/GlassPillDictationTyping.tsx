// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const ACCENT_RGB = '146,126,212';
const UI = '-apple-system,system-ui,"Segoe UI",sans-serif';
const PH = 46;
const ICON = 30;
const BASE = [13, 7, 10, 6, 9];
const TEXT = contentText(content, "copy0", "Speak or type here");
const GlassPillDictationTyping: React.FC = () => {
  const t = useT();

  // 定宽：原片胶囊宽度约为整句文本宽度的 2 倍，不随词伸缩——挂载时实测一次整句宽度
  const measRef = useRef<HTMLDivElement>(null);
  const [textW, setTextW] = useState(180); // 兜底估算值，useLayoutEffect 实测后覆盖（先于首帧绘制）
  useLayoutEffect(() => {
    if (measRef.current) setTextW(measRef.current.offsetWidth);
  }, []);
  const PW = Math.round(textW + 168);

  // 出场：整体略大（~1.25x）快速浮现，约 0.45s 内缓落到位
  const s = lerp(seg(t, 0, 0.22, E.outCubic), 1.25, 1);
  // 打字：caret 先行（~t0.03），字符 t0.06→0.73 匀速铺完，尾段保持
  const n = Math.floor(seg(t, 0.06, 0.73) * TEXT.length + 1e-6);
  const caretO = seg(t, 0.025, 0.045) * (1 - seg(t, 0.75, 0.8));
  // 强调色光随打字进度渐熄；同步收掉描边亮度的一点富余
  const g = 1 - seg(t, 0.08, 0.76, E.inOutQuad);

  return (
    <DesignStage bg="#000">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000',
          overflow: 'hidden',
          // 暗部校色：原样片 x264 把外泛光的暗尾（1~2 级灰）压成纯 0，本渲染的
          // 泛光尾巴因此比样片亮一档、拖得更远。contrast(1.008) 等价于黑端减 ~1 级
          // （255*0.008/2≈1）、中间调不动，按对照帧实测校准（f1 0.9205→0.9844）。
          filter: 'contrast(1.008)',
        }}
      >
        {/* 居中走 translateX：PW 为奇数时圆心在 .5 半像素上，left/flex 会被布局
            取整偏 0.5 设计像素；transform 矩阵不吸附，能与原片圆心逐像素对齐 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: (270 - PH) / 2,
            height: PH,
            width: PW,
            borderRadius: PH / 2,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px 0 16px',
            overflow: 'hidden',
            background: '#0d0d13',
            willChange: 'transform,opacity',
            opacity: seg(t, 0, 0.025),
            transform: `translateX(${(480 - PW) / 2}px) scale(${s})`,
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,${0.16 + 0.1 * g}), inset 0 14px 22px rgba(255,255,255,${0.03 + 0.04 * g}), 0 0 ${26 * g}px rgba(${ACCENT_RGB},${0.28 * g})`,
          }}
        >
          {/* 内嵌强调色光：左暗右亮的渐层，随打字进度熄灭（原片光在胶囊内部，无外部光晕） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: g,
              background: `linear-gradient(90deg,rgba(${ACCENT_RGB},0) 0%,rgba(${ACCENT_RGB},.35) 42%,rgba(${ACCENT_RGB},.95) 100%)`,
            }}
          />
          <div
            style={{
              position: 'relative',
              font: `400 21px ${UI}`,
              color: '#f4f4f5',
              whiteSpace: 'pre',
              letterSpacing: 0.3,
              flex: 'none',
            }}
          >
            {TEXT.slice(0, n)}
          </div>
          <div
            style={{
              position: 'relative',
              width: 2,
              height: 23,
              borderRadius: 1,
              background: '#eaeaec',
              marginLeft: 2,
              flex: 'none',
              opacity: caretO,
            }}
          />
          <div
            style={{
              position: 'relative',
              marginLeft: 'auto',
              width: ICON,
              height: ICON,
              borderRadius: 9,
              boxSizing: 'border-box',
              border: '1.5px solid rgba(255,255,255,.5)',
              background: 'rgba(255,255,255,.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            {/* 声波竖条轻微呼吸（原片几乎静止，仅微动） */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2.2, height: '100%' }}>
              {BASE.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 1.5,
                    borderRadius: 1.5,
                    background: '#ececee',
                    height: h + 1.6 * Math.sin(t * 18 + i * 1.7),
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        {/* 隐藏测量条：与正文同字体同字距，量一次整句宽度以定胶囊定宽 */}
        <div
          ref={measRef}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'pre',
            font: `400 21px ${UI}`,
            letterSpacing: 0.3,
            top: -999,
          }}
        >
          {TEXT}
        </div>
      </div>
    </DesignStage>
  );
};
return GlassPillDictationTyping;
}
