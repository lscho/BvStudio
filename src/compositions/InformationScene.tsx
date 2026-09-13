import type { CompositionRenderProps } from "@/compositions/registry";
import { informationSceneItems, informationSceneLayout } from "@/domain/informationScenes";
import { motionItemStartUs, overlayStudioProgress } from "@/domain/overlayStudioMotion";
import { MOTION_THEME_COLOR_PRESETS } from "@/domain/motionTheme";
import { VecIcon } from "@/compositions/overlayStudioReference/effects/hud/vecIcons";

/** Full-stage variants of existing cards. Geometry and focus share the preview/export clock. */
export function InformationScene(props: CompositionRenderProps) {
  const layout = informationSceneLayout(props.compositionId, props.params);
  const items = informationSceneItems(props.compositionId, props.params);
  if (!layout || !items.length) return null;
  const height = props.canvasHeight ?? props.canvasWidth * 9 / 16;
  const portrait = height > props.canvasWidth;
  const unit = portrait ? props.canvasWidth / 900 : Math.min(props.canvasWidth / 1280, height / 720);
  const theme = MOTION_THEME_COLOR_PRESETS[props.params?.theme === "light" ? "light" : "dark"];
  const title = typeof props.params?.sceneTitle === "string" ? props.params.sceneTitle
    : typeof props.params?.tZh === "string" ? props.params.tZh : props.text.split(/[|｜\n]/u)[0];
  const fallbackTimes = typeof props.params?.times === "string" ? props.params.times.split("|").map(Number) : [];
  const starts = items.map((_, index) => motionItemStartUs(props.params, index,
    Number.isFinite(fallbackTimes[index]) ? Math.max(0, fallbackTimes[index]) * 1_000_000
      : index * Math.max(0, props.durationUs - 1_600_000) / Math.max(1, items.length - 1)));
  const lastStart = starts.at(-1) ?? 0;
  const overviewAtUs = Math.max(lastStart + 1_600_000, props.durationUs - 1_200_000);
  const active = props.timeUs >= overviewAtUs ? -1 : starts.reduce((last, start, index) => props.timeUs >= start ? index : last, -1);
  const columns = portrait ? 1 : layout === "matrix" || items.length === 4 ? 2 : items.length;
  const finiteParam = (key: string, fallback: number) => typeof props.params?.[key] === "number" && Number.isFinite(props.params[key]) ? props.params[key] : fallback;
  return <section data-scene-layout={layout} data-active-item={active} style={{ position: "absolute", left: "8%", top: "13%", width: "84%", height: "66%",
    display: "flex", flexDirection: "column", gap: 24 * unit, color: theme.text, fontFamily: "inherit", letterSpacing: 0,
    transform: `translate(${finiteParam("offsetX", 0)}px, ${finiteParam("offsetY", 0)}px) scale(${Math.max(0.3, Math.min(3, finiteParam("scale", 1)))})` }}>
    {title && <div style={{ fontSize: 52 * unit, fontWeight: 800, lineHeight: 1.2, overflowWrap: "anywhere" }}>{title}</div>}
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)", gap: 20 * unit, flex: 1, minHeight: 0 }}>
      {items.map((item, index) => {
        const reveal = overlayStudioProgress(props.timeUs, starts[index], 360_000);
        const focused = active === index;
        const focusEndUs = starts[index + 1] ?? overviewAtUs;
        const focus = overlayStudioProgress(props.timeUs, starts[index], 500_000)
          * (1 - overlayStudioProgress(props.timeUs, focusEndUs, 400_000));
        return <article key={index} data-information-item={index} data-visible={reveal > 0} style={{
          minWidth: 0, minHeight: 0, padding: 24 * unit, borderRadius: 12 * unit,
          background: theme.surface, border: `${2 * unit}px solid ${focused ? props.accentColor : theme.text + "30"}`,
          transform: `translateY(${(1 - reveal) * 12 * unit}px) scale(${1 + focus * 0.025})`,
          opacity: reveal, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 * unit,
          overflowWrap: "anywhere", lineHeight: 1.3
        }}>
          {(item.icon || item.label) && <div style={{ display: "flex", alignItems: "center", gap: 14 * unit, fontSize: 24 * unit, fontWeight: 600 }}>
            {item.icon && <span style={{ color: props.accentColor, display: "flex" }}><VecIcon name={item.icon} size={42 * unit} /></span>}
            {item.label && <span>{item.label}</span>}
          </div>}
          <div style={{ fontSize: (item.title.length > 18 ? 30 : 38) * unit, fontWeight: 750 }}>{item.title}</div>
          {item.detail && <div style={{ fontSize: (item.detail.length > 45 ? 22 : 26) * unit, lineHeight: 1.5 }}>{item.detail}</div>}
        </article>;
      })}
    </div>
  </section>;
}
