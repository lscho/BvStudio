// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
const A_VIEW_Y = -180;
const SERIF = 'ui-serif, Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const PAPER_LIGHT = 'oklch(92% 0.01 82)';
const AMBER = 'oklch(68% 0.12 65)';
const DIM = 'oklch(72% 0.01 82)';
const WORDS: { text: string; accent?: boolean }[] = [
  { text: contentText(content, "copy0", "Every") },
  { text: contentText(content, "copy1", "project,") },
  { text: contentText(content, "copy2", "linked") },
  { text: contentText(content, "copy3", "to") },
  { text: contentText(content, "copy4", "your"), accent: true },
  { text: contentText(content, "copy5", "weekly") },
  { text: contentText(content, "copy6", "report.") },
];
const Scene: React.FC = () => {
  const frame = useCurrentFrame();

  // A 景收尾：0→8 淡出到黑场（定义要求 6–10 帧，此处 8）
  const aOut = interpolate(frame, [0, 8], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.5, 0, 0.4, 1),
  });

  // 字卡：20 起逐词压印（delay=20+i·3，最后词 i=6 delay=38 完成 47）
  const cardOpacity = interpolate(frame, [18, 26], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.7, 0.3, 1),
  });
  // 完整标题 47f 落定，hold 到 62 再退场（保留 ~15 帧完整展示）
  const cardOut = interpolate(frame, [62, 70], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.4, 0, 0.5, 1),
  });

  // 后镜 B 淡入：70→78（字卡 62→70 完全淡出后再交棒）
  const bIn = interpolate(frame, [70, 78], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0c10', overflow: 'hidden' }}>
      {/* A 景 */}
      {frame < 14 ? (
        <div style={{ position: 'absolute', opacity: aOut }}>
          <Img
            src={staticFile('textures/live/projects-full.png')}
            style={{ position: 'absolute', left: 0, top: A_VIEW_Y, width: 1920 }}
          />
        </div>
      ) : null}

      {/* 黑场字卡（18–74） */}
      {frame >= 18 && frame < 74 ? (
        <AbsoluteFill
          style={{
            justifyContent: 'center', alignItems: 'center',
            opacity: cardOpacity * (1 - cardOut), pointerEvents: 'none',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 1500 }}>
            <div
              style={{
                fontFamily: SERIF, fontSize: 96, fontWeight: 600, lineHeight: 1.16,
                color: PAPER_LIGHT, letterSpacing: '-0.012em',
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.26em',
              }}
            >
              {WORDS.map((w, i) => {
                const delay = 20 + i * 3;
                const t = interpolate(frame, [delay, delay + 9], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.75, 0.3, 1),
                });
                return (
                  <span
                    key={i}
                    style={{
                      opacity: t, transform: `scale(${1.3 - 0.3 * t})`,
                      filter: `blur(${(1 - t) * 7}px)`, display: 'inline-block',
                      fontStyle: w.accent ? 'italic' : 'normal',
                      color: w.accent ? AMBER : undefined,
                    }}
                  >
                    {w.text}
                  </span>
                );
              })}
            </div>
            <div
              style={{
                height: 4, width: 180, margin: '30px auto 0', borderRadius: 2,
                background: AMBER, transform: `scaleX(${interpolate(frame, [32, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1) })})`,
              }}
            />
            <div
              style={{
                fontFamily: MONO, fontSize: 20, letterSpacing: '0.14em', color: DIM,
                marginTop: 26, textTransform: 'uppercase',
                opacity: interpolate(frame, [26, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              }}
            >
              {contentText(content, "copy7", "Weekly Brief · 2026-W28")}</div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* B 景（70 起淡入） */}
      {frame >= 70 ? (
        <div style={{ position: 'absolute', opacity: bIn }}>
          <Img
            src={staticFile('textures/live/wbr-full.png')}
            style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }}
          />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
const BlackCardTransition: React.FC = () => (
  <Scene />
);
return BlackCardTransition;
}
