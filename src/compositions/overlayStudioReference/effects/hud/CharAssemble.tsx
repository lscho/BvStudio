import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
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

export interface CharAssembleParams {
  theme: "dark" | "light";
  position: "center" | "top" | "bottom";
  lead: string; // 引导小字(可空)
  word: string; // 聚拢的关键词;夹 *词* 的那几个字换成第二个颜色
  /** 大字开始聚拢的时刻(相对本卡 start,秒;0 = 进场就拼)——卡口播稿用 */
  wordAt?: number;
  accent: string;
  /** *词* 的颜色:ink = 跟主题的墨色(暗片白/亮片深),其余同强调色 */
  hotAccent?: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

/** 拆成「字 + 是不是 *词* 里的」:一句里挑一个词换色,对比才立得住 */
function markChars(word: string) {
  const out: { ch: string; hot: boolean }[] = [];
  for (const seg of (word ?? "").split(/(\*[^*]+\*)/)) {
    if (!seg) continue;
    const hot = seg.startsWith("*") && seg.endsWith("*") && seg.length > 2;
    for (const ch of Array.from(hot ? seg.slice(1, -1) : seg)) out.push({ ch, hot });
  }
  return out;
}

/** 确定性伪随机:同一索引每次散开位置一致(不会闪变) */
function scatter(i: number) {
  const dx = Math.sin(i * 12.9898) * 260;
  const dy = Math.cos(i * 78.233) * 180 - 60;
  const rot = Math.sin(i * 43.7) * 24;
  return { dx, dy, rot };
}

/** 关键词的字从四散飞聚成词;wordAt 让大字等到口播开口那一刻才聚拢 */
function CharAssemble({ params, playToken }: EffectProps<CharAssembleParams>) {
  const { position, lead, word, accent, hotAccent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params as unknown as { __t?: number; __start?: number }, playToken);
  const wordOn = elapsed >= (params.wordAt ?? 0);
  const chars = markChars(word);
  const hotVar =
    !hotAccent || hotAccent === "ink" ? "var(--hud-ink)" : ACCENT_VAR[hotAccent] ?? "var(--hud-ink)";

  return (
    <div
      className={`hud ${glassClass(params.glass)} ca hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""} ${wordOn ? "is-word" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--ca-hot" as string]: hotVar,
        ...offsetVars(params),
        ...glassVars(params.glassAlpha),
      }}
    >
      {lead && <div className="ca-lead">{lead}</div>}
      <div className="ca-word">
        {chars.map(({ ch, hot }, i) => {
          const s = scatter(i);
          return (
            <span
              className={`ca-ch ${hot ? "is-hot" : ""}`}
              key={i}
              style={{
                ["--ca-dx" as string]: `${s.dx}px`,
                ["--ca-dy" as string]: `${s.dy}px`,
                ["--ca-rot" as string]: `${s.rot}deg`,
                transitionDelay: `${200 + i * 90}ms`,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const charAssembleDef: EffectDef<CharAssembleParams> = {
  id: "char-assemble",
  name: "CharAssemble",
  description: "字符聚拢 · 关键词的字四散飞聚",
  tags: ["聚散飞行"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    lead: "重磅关键词,聚拢出场",
    word: "一锤定音",
    wordAt: 0,
    accent: "blue",
    hotAccent: "ink",
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
        { label: "居中", value: "center" },
        { label: "顶部", value: "top" },
        { label: "底部", value: "bottom" },
      ],
    },
    { key: "lead", label: "引导小字(可空)", type: "text" },
    { key: "word", label: "聚拢关键词", type: "text" },
    { key: "wordAt", label: "大字聚拢时刻(相对卡start,卡口播用)", type: "range", min: 0, max: 20, step: 0.1, unit: "s" },
    { key: "accent", label: "关键词颜色", type: "select", options: ACCENT_OPTIONS },
    {
      key: "hotAccent",
      label: "*词* 的颜色(一句里挑一个词换色)",
      type: "select",
      options: [{ label: "墨色(暗片白 / 亮片深)", value: "ink" }, ...ACCENT_OPTIONS],
    },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: CharAssemble,
};
