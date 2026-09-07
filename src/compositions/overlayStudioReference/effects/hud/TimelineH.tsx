import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
  GLASS_CONTROLS,
  GLASS_DEFAULTS,
  glassClass,
  glassVars,
} from "./accent";

export interface TimelineHParams {
  theme: "dark" | "light";
  position: "top" | "bottom";
  kicker: string;
  stops: string; // "日期,标题,副标|..."
  accent: string; // 进度线颜色
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

const CYCLE = ["blue", "teal", "violet", "pink"];
const STAGGER = 260;

function TimelineH({ params, playToken }: EffectProps<TimelineHParams>) {
  const { position, kicker, stops, accent } = params;
  const entered = useEnter(playToken);
  const list = stops.split("|").map((s) => {
    const [date, label, sub] = s.split(",");
    return {
      date: (date ?? "").trim(),
      label: (label ?? "").trim(),
      sub: (sub ?? "").trim(),
    };
  });

  return (
    <div
      className={`hud ${glassClass(params.glass)} th hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      {kicker && <div className="th-kicker hud-fade">{kicker}</div>}
      <div className="th-rail">
        <div className="th-rail-fill" />
      </div>
      <div className="th-stops">
        {list.map((stop, i) => (
          <div
            className="th-stop"
            key={i}
            style={{
              ["--th-c" as string]: ACCENT_VAR[CYCLE[i % CYCLE.length]],
              transitionDelay: `${200 + i * STAGGER}ms`,
            }}
          >
            <div className="th-dot" />
            <div className="th-date">{stop.date}</div>
            <div className="th-lb">{stop.label}</div>
            {stop.sub && <div className="th-sub">{stop.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export const timelineHDef: EffectDef<TimelineHParams> = {
  id: "timeline-h",
  name: "TimelineH",
  description: "横版时间线 · 进度线生长 + 节点逐个立起",
  tags: ["生长描画", "逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "top",
    kicker: "时间线 · 三天三件事",
    stops: "周一,事件一,一句副标|周二,事件二,一句副标|周三,事件三,一句副标",
    accent: "blue",
    ...GLASS_DEFAULTS,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "顶部", value: "top" },
        { label: "底部", value: "bottom" },
      ],
    },
    { key: "kicker", label: "小标题", type: "text" },
    { key: "stops", label: "节点(日期,标题,副标 用 | 分隔)", type: "text" },
    { key: "accent", label: "进度线颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: TimelineH,
};
