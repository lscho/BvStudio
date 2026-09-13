import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { motionItemStartUs, overlayStudioProgress } from "@/domain/overlayStudioMotion";
import {
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface PainPointsParams {
  revealTimesUs?: string;
  stepMs?: number;
  theme: "dark" | "light";
  position: "left" | "right";
  kicker: string; // 共鸣设问 / 小标签
  pains: string; // 痛点,用 | 分隔
  result: string; // 扎心后果
  mark: string; // ✕ 标记色
  resAccent: string; // 后果强调色
  offsetX?: number;
  offsetY?: number;
}

const STAGGER = 180;

function PainPoints({ params, playToken }: EffectProps<PainPointsParams>) {
  const { theme, position, kicker, pains, result, mark, resAccent } = params;
  void theme;
  const entered = useEnter(playToken);
  const timeUs = useCardElapsed(params, playToken) * 1_000_000;
  const revealStyle = (index: number, offsetUs = 0) => params.revealTimesUs ? {
    opacity: overlayStudioProgress(timeUs, motionItemStartUs({ revealTimesUs: params.revealTimesUs }, index, index * (params.stepMs ?? STAGGER) * 1_000) + offsetUs, 360_000),
    transform: "none", transition: "none"
  } : { transitionDelay: `${index * (params.stepMs ?? STAGGER) + offsetUs / 1_000}ms` };
  const list = pains.split("|").map((p) => p.trim()).filter(Boolean);
  const dx = position === "right" ? "22px" : "-22px";

  return (
    <div
      className={`hud pn hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--pn-mark" as string]: ACCENT_VAR[mark],
        ["--pn-res" as string]: ACCENT_VAR[resAccent],
        ["--pn-dx" as string]: dx,
        ...offsetVars(params),
      }}
    >
      {kicker && <div className="pn-kicker hud-fade">{kicker}</div>}

      {list.map((pain, i) => (
        <div className="pn-item" key={i} style={revealStyle(i)}>
          <span className="pn-x">✕</span>
          <span>{pain}</span>
        </div>
      ))}

      {result && (
        <>
          <div className="pn-rule" style={revealStyle(list.length)} />
          <div
            className="pn-result"
            style={revealStyle(list.length, 120_000)}
          >
            <span className="pn-arrow">→</span>
            {result}
          </div>
        </>
      )}
    </div>
  );
}

const MARK_OPTIONS = [
  { label: "警示红", value: "alert" },
  { label: "中性灰", value: "lav" },
  { label: "亮粉", value: "pink" },
];

export const painPointsDef: EffectDef<PainPointsParams> = {
  id: "pain-points",
  vTier: "half",
  name: "PainPoints",
  description: "痛点清单卡 · 问题逐条累积 + 扎心后果",
  tags: ["逐条落位", "堆叠累积"],
  selfPosition: true,
  defaults: {
    stepMs: 180,
    theme: "dark",
    position: "left",
    kicker: "你是不是也这样?",
    pains: "痛点一:一句话扎心|痛点二:层层递进|痛点三:推向那个后果",
    result: "后果,一句话砸实",
    mark: "alert",
    resAccent: "alert",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "stepMs", label: "每条间隔(卡点用)", type: "range", min: 100, max: 8000, step: 100, unit: "ms" },
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "kicker", label: "共鸣设问 / 小标签", type: "text" },
    { key: "pains", label: "痛点(用 | 分隔)", type: "text" },
    { key: "result", label: "扎心后果", type: "text" },
    { key: "mark", label: "✕ 标记色", type: "select", options: MARK_OPTIONS },
    { key: "resAccent", label: "后果强调色", type: "select", options: MARK_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: PainPoints,
};
