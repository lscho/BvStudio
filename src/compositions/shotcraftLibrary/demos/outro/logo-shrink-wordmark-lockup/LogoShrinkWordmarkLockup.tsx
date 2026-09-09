// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: measured brand lockup, real logo and length-independent timing.
import { useEffect, useRef, useState } from "react";
import { DesignStage, E, lerp, seg, useT } from "@/compositions/shotcraftLibrary/demos/_fixtures/Motion";
import { contentAppearance, contentText, useShotcraftContent, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
  const wordmark = contentText(content, "copy1", "品牌名称");
  const letters = Array.from(wordmark);
  const theme = contentAppearance(content);
  return function LogoShrinkWordmarkLockup() {
    const t = useT();
    const { brandMark } = useShotcraftContent();
    const row = useRef<HTMLDivElement>(null);
    const [wordWidth, setWordWidth] = useState<number>();
    useEffect(() => { if (row.current) setWordWidth(row.current.offsetWidth); }, []);
    const icon = brandMark ? 32 : 0;
    const gap = brandMark ? 12 : 0;
    const width = wordWidth ?? letters.length * 18;
    const groupWidth = icon + gap + width;
    const fit = Math.min(1, 400 / Math.max(1, groupWidth));
    const move = seg(t, 0.34, 0.47, E.inOutCubic);
    const shrink = lerp(seg(t, 0.02, 0.28, E.inOutCubic), 5.4, 1) * (1 + Math.sin(seg(t, 0.26, 0.37) * Math.PI) * 0.06);
    return <DesignStage bg={theme.surface}>
      <div data-shotcraft-pending={wordWidth === undefined ? "measure" : undefined} style={{ position: "absolute", inset: 0, color: theme.color, fontFamily: theme.fontFamily, letterSpacing: 0, opacity: wordWidth === undefined ? 0 : 1 }}>
        <div style={{ position: "absolute", left: "50%", top: "46%", width: groupWidth, height: 36, transform: `translate(-50%, -50%) scale(${fit})` }}>
          {brandMark && <img src={brandMark} alt="" style={{ position: "absolute", left: (groupWidth - icon) / 2 * (1 - move), top: 2, width: icon, height: icon, objectFit: "contain", transform: `scale(${shrink})` }} />}
          <div ref={row} style={{ position: "absolute", left: icon + gap, top: 0, display: "flex", alignItems: "center", height: 36, width: "max-content", fontSize: 27, fontWeight: 800, lineHeight: 1, whiteSpace: "pre" }}>
            {letters.map((letter, i) => {
              const start = (brandMark ? 0.46 : 0.06) + i / Math.max(1, letters.length - 1) * 0.14;
              const p = seg(t, start, start + 0.1, E.outCubic);
              return <span key={i} style={{ opacity: p, transform: `translateX(${lerp(p, 8, 0)}px)` }}>{letter}</span>;
            })}
          </div>
        </div>
        <div style={{ position: "absolute", left: 32, right: 32, top: "calc(46% + 34px)", color: theme.accent, fontSize: 15, fontWeight: 600, lineHeight: 1.4, textAlign: "center", whiteSpace: "pre-line", overflowWrap: "anywhere", opacity: seg(t, 0.6, 0.72, E.outQuad) }}>
          {contentText(content, "copy0", "")}
        </div>
      </div>
    </DesignStage>;
  };
}
