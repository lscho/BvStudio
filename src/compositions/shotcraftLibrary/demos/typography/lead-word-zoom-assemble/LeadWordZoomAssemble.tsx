// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React, { Fragment, useEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  Easing,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "@/compositions/shotcraftLibrary/runtime";
import { contentAppearance, contentText, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";
import { shotcraftWords } from "@/domain/shotcraftTypography";

export function createDemo(content: ShotcraftContent) {
const TEXT = contentText(content, "copy0", "Introducing Lumen Deck");
const HIGHLIGHT_WORD = contentText(content, "copy1", "Lumen");
const FONT_SIZE = Math.min(96, 1500 / Math.max(1, Array.from(TEXT).length));
const INITIAL_SCALE = 2.3;
const INTRO_DURATION = 6;
const HOLD_DURATION = 12;
const PUSH_SCALE = 1.06;
const RECEDE_DURATION = 12;
const ASSEMBLE_DURATION = 24;
const WORD_DELAY = 6;
const WORD_STAGGER = 4;
const WORD_DURATION = 12;
const WORD_PUSH = 0.5;
const WORD_FADE = 2;
const LETTER_SPACING = 0;
const LIFT: [number, number] = [34, 50];
const LIFT_DISTANCE = -56;
const SUBLINE = contentText(content, "copy2", "One shot card, one motion recipe — copy, paste, render.");
const CRASH_FRAMES = 12;
const CRASH_SCALE = 0.2;
const CRASH_BLUR = 9;
const { color: INK, accent: ACCENT, surface: MESH_BG, fontFamily: SANS } = contentAppearance(content);
const PUSH_EASE = Easing.bezier(0.25, 1, 0.5, 1);
const ZOOM_EASE = Easing.bezier(0.5, 0, 0.05, 1);
const WORD_EASE = Easing.bezier(0.22, 0.8, 0.36, 1);
const TextReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // 整行宽度、首词中心占比、基线位置：只在挂载时量一次，量到之前挂起渲染
  const lineRef = useRef<HTMLSpanElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState<{
    lineWidth: number;
    leadRatio: number;
    baseline: number;
  } | null>(null);

  useEffect(() => {
    const line = lineRef.current;
    const lead = leadRef.current;
    if (!line || !lead) {
      return;
    }
    setMetrics({
      lineWidth: line.offsetWidth,
      leadRatio: (lead.offsetLeft + lead.offsetWidth / 2) / line.offsetWidth,
      baseline: baselineRef.current?.offsetTop ?? line.offsetHeight * 0.8,
    });
  }, []);

  const words = shotcraftWords(TEXT, HIGHLIGHT_WORD);
  const ready = metrics !== null;
  const leadRatio = metrics?.leadRatio ?? 0.14;
  const lineWidth = metrics?.lineWidth ?? width * 0.5;
  const baseline = metrics?.baseline ?? FONT_SIZE * 0.88;

  const zoomStart = HOLD_DURATION;
  // 首词从"画面正中"走到"行内自己的位置"，位移就是这段偏心距
  const slideDistance = lineWidth * (0.5 - leadRatio);

  return (
    <AbsoluteFill data-shotcraft-pending={ready ? undefined : "measure"} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <span
        ref={lineRef}
        style={{
          position: 'relative',
          display: 'inline-block',
          fontSize: FONT_SIZE,
          fontWeight: 600,
          color: INK,
          letterSpacing: LETTER_SPACING,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          fontFamily: SANS,
          transformOrigin: `${leadRatio * 100}% ${baseline}px`,
          scale:
            interpolate(frame, [0, HOLD_DURATION], [INITIAL_SCALE, INITIAL_SCALE * PUSH_SCALE], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: PUSH_EASE,
            }) +
            interpolate(
              frame,
              [zoomStart, zoomStart + RECEDE_DURATION],
              [0, 1 - INITIAL_SCALE * PUSH_SCALE],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ZOOM_EASE },
            ),
          translate: `${interpolate(
            frame,
            [zoomStart, zoomStart + ASSEMBLE_DURATION],
            [slideDistance, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ZOOM_EASE },
          )}px`,
          opacity: ready ? 1 : 0,
          textRendering: 'geometricPrecision',
          ...(getRemotionEnvironment().isRendering ? null : { willChange: 'transform' as const }),
        }}
      >
        {words.map((word, i) => {
          const isLead = i === 0;
          const pushStart = zoomStart + WORD_DELAY + (i - 1) * WORD_STAGGER;
          const opacity = isLead
            ? interpolate(frame, [0, INTRO_DURATION], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : interpolate(frame, [pushStart, pushStart + WORD_FADE], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
          return (
            <Fragment key={i}>
              <span
                ref={isLead ? leadRef : undefined}
                style={{
                  display: 'inline-block',
                  opacity,
                  color: word.text === HIGHLIGHT_WORD ? ACCENT : undefined,
                  translate: isLead
                    ? undefined
                    : `${interpolate(
                        frame,
                        [pushStart, pushStart + WORD_DURATION],
                        [WORD_PUSH * FONT_SIZE, 0],
                        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: WORD_EASE },
                      )}px`,
                }}
              >
                {word.text}
              </span>
              {/* 词间空格必须放在 inline-block 之外——跟在词里会被行盒裁掉，词会黏在一起 */}
              {word.space}
            </Fragment>
          );
        })}
        {/* 基线尺：零尺寸 inline-block，它的 offsetTop 就是基线 */}
        <span ref={baselineRef} style={{ display: 'inline-block', width: 0, height: 0 }} />
      </span>
    </AbsoluteFill>
  );
};
const LeadWordZoomAssemble: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const lift = interpolate(frame, LIFT, [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const crash = interpolate(
    frame,
    [durationInFrames - CRASH_FRAMES, durationInFrames - 1],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) },
  );

  return (
    <AbsoluteFill style={{ background: MESH_BG, fontFamily: SANS }}>
      <AbsoluteFill
        style={{
          transform: `scale(${1 + crash * CRASH_SCALE})`,
          filter: crash > 0.01 ? `blur(${crash * CRASH_BLUR}px)` : undefined,
          opacity: 1 - crash * 0.55,
        }}
      >
        <AbsoluteFill style={{ transform: `translateY(${lift * LIFT_DISTANCE}px)` }}>
          <TextReveal />
        </AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: 120,
            right: 120,
            top: '50%',
            marginTop: 62,
            textAlign: 'center',
            fontSize: 56,
            lineHeight: 1.35,
            color: INK,
            opacity: lift,
            transform: `translateY(${(1 - lift) * 16}px)`,
          }}
        >
          {SUBLINE}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
return LeadWordZoomAssemble;
}
