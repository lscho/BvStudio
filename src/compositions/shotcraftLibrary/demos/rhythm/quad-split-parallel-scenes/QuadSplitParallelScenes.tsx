// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React from 'react';
import { DesignStage, E, lerp, seg, useT } from '@/compositions/shotcraftLibrary/demos/_fixtures/Motion';
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const ACCENT = '#7c5cff';
const ACCENT_SOFT = '#c9bcff';
const F = 'system-ui,-apple-system,sans-serif';
const BGS = ['#c3c6cc', '#f2f1ef', '#e7e6e3', '#b8bcc3'];
const TRAFFIC = ['#ff5f57', '#febc2e', '#28c840'];
const TABNAMES = ['Tab One', 'Tab Two', 'Tab Three', 'Tab Four', 'Tab Five', 'Tab Six'];
const TXT1 = 'Placeholder headline text';
const TXT2 = 'and a second line of copy';
const WORDS = [contentText(content, "copy0", "One"), contentText(content, "copy1", "clear"), contentText(content, "copy2", "message")];
const qBez = (a: number[], b: number[], c: number[], t: number): [number, number] => {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
    u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
  ];
};
const QuadTL: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const n1 = Math.floor(seg(t, 0.02, 0.95) * TXT1.length);
  return (
    <div
      style={{
        position: 'absolute',
        left: '10%',
        top: '22%',
        width: '80%',
        height: '60%',
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(20,40,80,.25)',
        fontFamily: F,
        transform: `scale(${lerp(E.inQuad(t), 1, 1.45)})`,
        transformOrigin: '50% 78%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px 4px' }}>
        {TRAFFIC.map((c) => (
          <i key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
        ))}
        <div style={{ display: 'flex', flex: 1, gap: 3, marginLeft: 6, minWidth: 0 }}>
          {TABNAMES.map((n, i) => {
            const k = seg(t, 0.08 + i * 0.13, 0.08 + i * 0.13 + 0.09, E.outBack);
            return (
              <div
                key={n}
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  fontSize: 8,
                  color: '#555',
                  background: '#e8eaee',
                  borderRadius: '5px 5px 0 0',
                  padding: '2px 5px',
                  transform: `scale(${k})`,
                }}
              >
                {n}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          margin: '6px 10px',
          height: 22,
          borderRadius: 11,
          background: '#f0f2f5',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          fontSize: 10,
          color: '#333',
        }}
      >
        <b style={{ color: '#8a8f98', marginRight: 6 }}>◆</b>
        <span>{TXT1.slice(0, n1)}</span>
        {/* 光标按帧闪烁：16 帧一个周期 */}
        <i style={{ width: 1, height: 12, background: '#333', marginLeft: 1, opacity: frame % 16 < 8 ? 1 : 0 }} />
      </div>
    </div>
  );
};
const QuadTR: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const n2 = Math.floor(seg(t, 0.06, 0.9) * TXT2.length);
  const zip = seg(t, 0.42, 0.54, E.inOutCubic);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        fontFamily: '"SF Mono",Menlo,monospace',
        transform: `scale(${lerp(zip, 1, 2.1)})`,
        transformOrigin: '46% 42%',
        filter: `blur(${Math.sin(zip * Math.PI) * 4}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '12%',
          top: '24%',
          width: '76%',
          background: '#fbf8f1',
          borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,.12)',
          padding: '8px 12px 14px',
          // 原渲染无全局 border-box：76% 是内容宽，padding 外扩（Remotion 注入
          // 了 * { box-sizing:border-box }，显式还原 content-box 才对得上原片）
          boxSizing: 'content-box',
        }}
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {TRAFFIC.map((c) => (
            <i key={c} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ fontSize: 8, color: '#8a8f98', marginBottom: 5 }}>{contentText(content, "copy3", "✦ Section label ›")}</div>
        <div style={{ fontSize: 11, color: '#111' }}>
          <span>{TXT2.slice(0, n2)}</span>
          {/* 光标错拍闪烁：与 TL 相位差 5 帧、周期 14 帧 */}
          <span style={{ opacity: (frame + 5) % 14 < 7 ? 1 : 0 }}>_</span>
        </div>
      </div>
    </div>
  );
};
const QuadBL: React.FC<{ t: number }> = ({ t }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      fontFamily: F,
      fontWeight: 800,
      fontSize: 19,
      color: '#1a1a1a',
    }}
  >
    {WORDS.map((w, i) => {
      const k = seg(t, [0.24, 0.46, 0.56][i], [0.24, 0.46, 0.56][i] + 0.1, E.outBack);
      return (
        <span
          key={w}
          style={{
            transform: `scale(${k}) translateY(${(1 - k) * 8}px)`,
            opacity: Math.min(1, k * 2),
          }}
        >
          {w}
        </span>
      );
    })}
  </div>
);
const QuadBR: React.FC<{ t: number }> = ({ t }) => {
  const slide = seg(t, 0.12, 0.3, E.outBack);
  const m1 = seg(t, 0.3, 0.42, E.inOutCubic);
  const m2 = seg(t, 0.62, 0.74, E.inOutCubic);
  // 光标路径：先飞向 pill，再二段飞向发送键
  const p = m2 > 0 ? qBez([44, 66], [66, 52], [82, 68], m2) : qBez([88, 30], [50, 40], [44, 66], m1);
  const c1 = seg(t, 0.42, 0.47);
  const c2 = seg(t, 0.74, 0.79);
  const n4 = Math.floor(seg(t, 0.46, 0.62) * 9);
  const pop = seg(t, 0.8, 0.88, E.outBack);
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: F }}>
      {/* 评论卡片：点击发送后弹出 */}
      <div
        style={{
          position: 'absolute',
          left: '12%',
          bottom: '46%',
          width: '66%',
          background: 'rgba(255,255,255,.92)',
          borderRadius: 8,
          padding: '6px 9px',
          boxSizing: 'content-box', // 同上：66% 为内容宽
          fontSize: 8,
          color: '#222',
          transform: `scale(${pop})`,
          transformOrigin: '20% 100%',
          boxShadow: '0 5px 16px rgba(20,40,90,.25)',
        }}
      >
        <b>{contentText(content, "copy4", "You · just now")}</b>
        <br />
        {contentText(content, "copy5", "All good!")}</div>
      {/* 输入 pill：从右侧滑入 */}
      <div
        style={{
          position: 'absolute',
          left: '8%',
          bottom: '26%',
          width: '84%',
          height: 26,
          borderRadius: 13,
          background: 'rgba(255,255,255,.55)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          boxSizing: 'content-box', // 同上：84% 为内容宽
          gap: 6,
          fontSize: 8,
          boxShadow: '0 4px 14px rgba(20,40,90,.2)',
          transform: `translateX(${(1 - slide) * 120}%)`,
          marginBottom: -pop * 4,
        }}
      >
        <span style={{ background: ACCENT, color: '#fff', borderRadius: 8, padding: '1px 5px' }}>{contentText(content, "copy6", "00:00")}</span>
        <span style={{ flex: 1, color: t < 0.44 ? '#666' : '#111' }}>
          {t < 0.44 ? 'Leave your comment...' : 'All good!'.slice(0, n4)}
        </span>
        <span style={{ color: n4 >= 9 ? ACCENT : ACCENT_SOFT }}>➤</span>
      </div>
      {/* 光标圆点：两段点击各缩一次 */}
      <div
        style={{
          position: 'absolute',
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: '#fff',
          border: '1.5px solid #333',
          zIndex: 5,
          boxShadow: '0 1px 4px rgba(0,0,0,.3)',
          left: `${p[0]}%`,
          top: `${p[1]}%`,
          transform: `scale(${1 - Math.sin(c1 * Math.PI) * 0.3 - Math.sin(c2 * Math.PI) * 0.3})`,
        }}
      />
    </div>
  );
};
const QuadSplitParallelScenes: React.FC = () => {
  const t = useT();
  const frame = Math.floor(t * 63); // dur 2100ms @30fps
  const scenes = [
    <QuadTL key={0} t={t} frame={frame} />,
    <QuadTR key={1} t={t} frame={frame} />,
    <QuadBL key={2} t={t} />,
    <QuadBR key={3} t={t} />,
  ];
  return (
    <DesignStage bg="#000" raster="zoom">
      {scenes.map((scene, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${(i % 2) * 50}%`,
            top: `${(i >> 1) * 50}%`,
            width: '50%',
            height: '50%',
            overflow: 'hidden',
            background: BGS[i],
          }}
        >
          {scene}
        </div>
      ))}
    </DesignStage>
  );
};
return QuadSplitParallelScenes;
}
