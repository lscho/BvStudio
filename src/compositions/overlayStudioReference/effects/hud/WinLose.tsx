import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface WinLoseParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  winName: string;
  /** 胜者中文小注(选它的理由) */
  winNote: string;
  winTag: string;
  loseName: string;
  loseNote: string;
  loseTag: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

/**
 * 胜负对比卡:视觉层级直接编码作者观点 —
 * 胜者大而亮(绿框 + ✓ WINNER 章),败者小而暗(NOT YET 章)。
 * 用在"我选了 A 没选 B"的取舍时刻,让观众一眼读出结论。
 */
function WinLose({ params, playToken }: EffectProps<WinLoseParams>) {
  const { position, winName, winNote, winTag, loseName, loseNote, loseTag, accent } = params;
  const entered = useEnter(playToken);

  return (
    <div
      className={`hud wnl hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="wnl-box">
        <div className="wnl-win">
          <span className="wnl-win-tag">✓ {winTag}</span>
          <div className="wnl-name">{winName}</div>
          {winNote && <div className="wnl-note">{winNote}</div>}
        </div>
        <div className="wnl-lose">
          <span className="wnl-lose-tag">{loseTag}</span>
          <div className="wnl-name">{loseName}</div>
          {loseNote && <div className="wnl-note">{loseNote}</div>}
        </div>
      </div>
    </div>
  );
}

export const winLoseDef: EffectDef<WinLoseParams> = {
  id: "win-lose",
  name: "WinLose",
  description: "胜负对比 · 胜者亮败者暗,层级即观点",
  tags: ["对撞并置"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    winName: "胜者写这里",
    winNote: "选它的理由 · 小注一行",
    winTag: "WINNER",
    loseName: "败者写这里",
    loseNote: "没选它的原因 · 小注一行",
    loseTag: "NOT YET",
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
        { label: "居中", value: "center" },
      ],
    },
    { key: "winName", label: "胜者名称", type: "text" },
    { key: "winNote", label: "胜者小注", type: "text" },
    { key: "winTag", label: "胜者章(WINNER)", type: "text" },
    { key: "loseName", label: "败者名称", type: "text" },
    { key: "loseNote", label: "败者小注", type: "text" },
    { key: "loseTag", label: "败者章(NOT YET)", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: WinLose,
};
