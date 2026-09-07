import type { EffectDef, EffectProps } from "../types";
import { useElapsed } from "../useAnimation";
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

export interface DecryptTextParams {
  theme: "dark" | "light";
  position: "center" | "top" | "bottom" | "left" | "right";
  kicker: string;
  text: string; // *关键词* 高亮
  lockMs: number; // 每个字符锁定间隔
  accent: string;
  offsetX?: number;
  offsetY?: number;
  glass?: "none" | "dark" | "light";
  glassAlpha?: number;
}

const CHARSET = "!<>-_\\/[]{}—=+*^?#01";

/** 确定性乱码:同一(字符位, 时刻)每次渲染结果一致,导出稳定 */
function scrambleChar(i: number, tick: number) {
  return CHARSET[(i * 31 + tick * 17) % CHARSET.length];
}

/** React Bits「Decrypted Text」风格:乱码逐字解密(科技款) */
function DecryptText({ params, playToken }: EffectProps<DecryptTextParams>) {
  const { position, kicker, text, lockMs, accent } = params;
  const elapsed = useElapsed(playToken, 30000);
  const tick = Math.floor(elapsed / 55); // 乱码翻动频率

  // 解析 *关键词*:标记每个字符是否属于关键词
  const chars: { c: string; key: boolean }[] = [];
  text.split(/(\*[^*]+\*)/).forEach((seg) => {
    const isKey = seg.startsWith("*") && seg.endsWith("*");
    for (const c of isKey ? seg.slice(1, -1) : seg) chars.push({ c, key: isKey });
  });

  const lockedCount = Math.max(0, Math.floor((elapsed - 350) / lockMs));

  return (
    <div
      className={`hud ${glassClass(params.glass)} dt hud-anchor hud-anchor--${position}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params), ...glassVars(params.glassAlpha) }}
    >
      {kicker && <div className="dt-kicker">{kicker}</div>}
      <div className="dt-line">
        {chars.map((ch, i) => {
          const locked = i < lockedCount;
          if (ch.c === " " || ch.c === "　") return <span key={i}> </span>;
          return (
            <span
              className={`dt-ch ${locked ? "is-locked" : "is-scramble"} ${ch.key ? "dt-key" : ""}`}
              key={i}
            >
              {locked ? ch.c : scrambleChar(i, tick)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const decryptTextDef: EffectDef<DecryptTextParams> = {
  id: "decrypt-text",
  name: "DecryptText",
  description: "解密文字 · 乱码逐字解密成真文字",
  tags: ["故障噪点", "逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    kicker: "REVEAL",
    text: "科技感揭晓:*乱码里解出答案*",
    lockMs: 90,
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
        { label: "居中", value: "center" },
        { label: "顶部", value: "top" },
        { label: "底部", value: "bottom" },
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "kicker", label: "小标签(可空)", type: "text" },
    { key: "text", label: "文字(*关键词* 高亮)", type: "text" },
    { key: "lockMs", label: "解密速度(每字)", type: "range", min: 30, max: 300, step: 10, unit: "ms" },
    { key: "accent", label: "关键词颜色", type: "select", options: ACCENT_OPTIONS },
    ...GLASS_CONTROLS,
    ...OFFSET_CONTROLS,
  ],
  Component: DecryptText,
};
