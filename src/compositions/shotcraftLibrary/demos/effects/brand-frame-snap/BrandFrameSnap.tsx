// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: two real states, editable labels, project colors.
import { useCurrentFrame, spring, interpolate, Img, useShotcraftContent, contentText, contentAppearance, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(content: ShotcraftContent) {
  const theme = contentAppearance(content);
  return function BrandFrameSnap() {
    const f = useCurrentFrame();
    const { images } = useShotcraftContent();
    const second = f >= 78;
    const frameColor = second ? theme.color : theme.accent;
    const label = contentText(content, second ? "copy1" : "copy0", "");
    const frameGrow = 1 - (1 - Math.min(1, Math.max(0, f / 18))) ** 3;
    const sinceFlip = f - 78;
    const pulse = sinceFlip >= 0 ? Math.exp(-sinceFlip * 0.22) * Math.cos(sinceFlip * 0.9) * 10 : 0;
    const drop = spring({ frame: f - 14, fps: 30, config: { damping: 16, stiffness: 110, mass: 1 } });
    const flash = sinceFlip >= 0 && sinceFlip < 3 ? 0.55 - sinceFlip * 0.18 : 0;
    const thickness = 44 * frameGrow + pulse;
    return <div style={{ width: 1920, height: 1080, background: theme.surface, color: theme.color, fontFamily: theme.fontFamily, position: "relative", overflow: "hidden", letterSpacing: 0 }}>
      {[{ left: 0, right: 0, top: 0, height: thickness }, { left: 0, right: 0, bottom: 0, height: thickness }, { top: 0, bottom: 0, left: 0, width: thickness }, { top: 0, bottom: 0, right: 0, width: thickness }].map((band, index) => <div key={index} data-shotcraft-frame-band style={{ position: "absolute", background: frameColor, ...band }} />)}
      <div style={{ position: "absolute", inset: thickness, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 64, right: 64, top: 120, bottom: 56, transform: `translateY(${interpolate(drop, [0, 1], [560, 0])}px) scale(${interpolate(drop, [0, 1], [0.82, 1])})`, opacity: Math.min(1, Math.max(0, drop * 4)) }}>
          <Img src={images[second ? 1 : 0] ?? images[0] ?? ""} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ position: "absolute", top: 30, left: 64, right: 64, fontSize: 56, lineHeight: 1.2, fontWeight: 700 }}>{label}</div>
      </div>
      {flash > 0 && <div style={{ position: "absolute", inset: 0, background: theme.color, opacity: flash }} />}
    </div>;
  };
}
