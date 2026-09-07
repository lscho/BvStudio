import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
} from "./accent";

export interface WordFlankParams {
  /** 词块,| 分隔(1-4 块,依次落在 左→右→左下→右下) */
  words: string;
  /** 字色:gold 黄(参考款)/ accent 用点缀色 */
  tone?: "gold" | "accent";
  /** 逐块砸入间隔 */
  stepMs?: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

/** 四个夹脸槽位:人物在中间,词块一左一右(再往下错开) */
const SPOTS = [
  { x: "22%", y: "34%", r: -4 },
  { x: "78%", y: "36%", r: 4 },
  { x: "18%", y: "68%", r: 3 },
  { x: "82%", y: "70%", r: -3 },
];

/**
 * 巨字夹脸:一两个巨型大字一左一右"砸"在人物两侧
 * (如 字|幕、免|费),带果冻弹入和轻微歪斜——比 char-assemble 更闹、
 * 更综艺,适合点名关键词的搞笑/强调时刻。人物会被字压到时
 * 配剪映"智能抠像"把人叠回最上层。
 */
function WordFlank({ params, playToken }: EffectProps<WordFlankParams>) {
  const entered = useEnter(playToken);
  const { words, tone, stepMs, accent } = params;
  const list = words
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  const step = stepMs ?? 320;

  return (
    <div
      className={`hud wfk ${entered ? "is-in" : ""} ${tone === "accent" ? "wfk--acc" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      {list.map((w, i) => (
        <div
          className="wfk-word"
          key={i}
          style={{
            left: SPOTS[i].x,
            top: SPOTS[i].y,
            transitionDelay: `${i * step}ms`,
            ["--wfk-rot" as string]: `${SPOTS[i].r}deg`,
          }}
        >
          {w}
        </div>
      ))}
    </div>
  );
}

export const wordFlankDef: EffectDef<WordFlankParams> = {
  id: "word-flank",
  name: "WordFlank",
  description: "巨字夹脸 · 巨型大字一左一右砸在人物两侧(综艺感)",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    words: "大|字",
    tone: "gold",
    stepMs: 320,
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "words", label: "词块(| 分隔,1-4 块,落位 左→右→左下→右下)", type: "text" },
    {
      key: "tone",
      label: "字色",
      type: "select",
      options: [
        { label: "综艺黄", value: "gold" },
        { label: "跟点缀色", value: "accent" },
      ],
    },
    { key: "stepMs", label: "逐块砸入间隔", type: "range", min: 0, max: 1500, step: 20, unit: "ms" },
    { key: "accent", label: "点缀色(字色选「跟点缀色」时生效)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: WordFlank,
};
