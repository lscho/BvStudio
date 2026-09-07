import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { hasVecIcon, VecIcon } from "./vecIcons";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface FormulaPillParams {
  theme: "dark" | "light";
  position: "left" | "right" | "bottom" | "center";
  /** 左侧小图标(矢量图标名,如 people/bolt/target;空=不显示) */
  icon: string;
  /** 公式文本,用 = 和 → 分节,如 "邀请好友 = 额度重置 → 需求被点燃" */
  text: string;
  /** 结果节(→ 之后)颜色,默认达成绿 */
  resAccent?: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

interface Seg {
  op: string | null;
  text: string;
}

/** 按 = 和 → 切成节,操作符单独渲染 */
function parseFormula(raw: string): Seg[] {
  const segs: Seg[] = [];
  let buf = "";
  let op: string | null = null;
  for (const ch of raw) {
    if (ch === "=" || ch === "→") {
      segs.push({ op, text: buf.trim() });
      buf = "";
      op = ch;
    } else {
      buf += ch;
    }
  }
  segs.push({ op, text: buf.trim() });
  return segs.filter((s) => s.text || s.op);
}

/**
 * 公式药丸(图表脚注式):图标 + A = B → C 一行讲完一个机制。
 * 自动配色:首节白、中间节跟点缀色、→ 后的结果节绿——"因果链"看颜色就懂。
 * 钉在图表/证据块下方,块讲完一起退场。
 */
function FormulaPill({ params, playToken }: EffectProps<FormulaPillParams>) {
  const { position, icon, text, resAccent, accent } = params;
  const entered = useEnter(playToken);
  const segs = parseFormula(text);
  const lastArrow = segs.map((s) => s.op).lastIndexOf("→");

  return (
    <div
      className={`hud fpl hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--fpl-c" as string]: ACCENT_VAR[resAccent ?? ""] ?? "#46d07c",
        ...offsetVars(params),
      }}
    >
      <div className="fpl-pill">
        {icon && hasVecIcon(icon) && (
          <span className="fpl-icon">
            <VecIcon name={icon} size={21} />
          </span>
        )}
        {segs.map((s, i) => (
          <span key={i} className="fpl-seg">
            {s.op && <em className="fpl-op">{s.op}</em>}
            <b className={i === 0 ? "fpl-a" : lastArrow >= 0 && i >= lastArrow ? "fpl-c" : "fpl-b"}>
              {s.text}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}

export const formulaPillDef: EffectDef<FormulaPillParams> = {
  id: "formula-pill",
  name: "FormulaPill",
  description: "公式药丸 · 图标 + A = B → C,一行讲完一个机制",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "bottom",
    icon: "people",
    text: "起因写这 = 机制写这 → 结果写这",
    resAccent: "green",
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
        { label: "底部", value: "bottom" },
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
        { label: "居中", value: "center" },
      ],
    },
    { key: "icon", label: "小图标(矢量名:people/bolt/target…,空=无)", type: "text" },
    { key: "text", label: "公式(用 = 和 → 分节,自动配色)", type: "text" },
    { key: "accent", label: "中间节颜色", type: "select", options: ACCENT_OPTIONS },
    { key: "resAccent", label: "结果节颜色(→ 之后)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: FormulaPill,
};
