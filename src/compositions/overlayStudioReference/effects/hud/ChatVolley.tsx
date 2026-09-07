import type { EffectDef, EffectProps } from "../types";
import { easeOutExpo, useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface ChatVolleyParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  /** 两端头徽文字(填了图就只显示图) */
  leftLabel: string;
  rightLabel: string;
  /** 左端头像图(/demo/xxx.png,空=显示文字) */
  leftImg?: string;
  /** 右端头像图(/logos/xxx.png,空=显示文字) */
  rightImg?: string;
  /** 收尾戳旁边的小图标(如 /logos/chatcut.png) */
  stampIcon?: string;
  /** 消息,一行一条:「L|文字」从左发出,「R|文字」从右发回 */
  msgs: string;
  /** 卡点(相对本卡 start,秒):每条消息的发出时刻;可多给一位 = 收尾戳的时刻 */
  times: string;
  /** 顶部往返计数标签(空 = 不显示) */
  counter: string;
  /** 收尾戳文字(绿色,空 = 不显示) */
  stampText: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const W = 620;
const LANE_Y = 58;
const LX = 56;
const RX = W - 56;
const FLY = 0.85;

function ChatVolley({ params, playToken }: EffectProps<ChatVolleyParams>) {
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params as unknown as { __t?: number; __start?: number }, playToken);
  const { leftLabel, rightLabel, counter, stampText, accent, position } = params;

  const msgs = (params.msgs ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [dir = "L", ...rest] = l.split("|");
      return { fromLeft: dir.trim().toUpperCase() !== "R", text: rest.join("|").trim() };
    });
  const ts = (params.times ?? "")
    .split("|")
    .map((s) => parseFloat(s.trim()))
    .filter((v) => Number.isFinite(v));
  const launch = msgs.map((_, i) => ts[i] ?? 0.3 + i * 2);
  const stampAt = ts[msgs.length] ?? (launch.length ? Math.max(...launch) + 1.2 : 1.2);

  const bob = Math.sin(elapsed * 2.1) * 3;
  // 接收端脉冲:任一消息刚落地 0.3s 内
  const pulseL = msgs.some((m, i) => !m.fromLeft && elapsed >= launch[i] + FLY && elapsed < launch[i] + FLY + 0.3);
  const pulseR = msgs.some((m, i) => m.fromLeft && elapsed >= launch[i] + FLY && elapsed < launch[i] + FLY + 0.3);
  const stampOn = elapsed >= stampAt;
  const stampK = easeOutExpo(clamp01((elapsed - stampAt) / 0.45));

  return (
    <div
      className={`hud cvl hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="cvl-box" style={{ width: W }}>
        {counter && <div className="cvl-counter">{counter}</div>}
        <div className="cvl-lane" style={{ top: LANE_Y }} />
        <div
          className={`cvl-chip cvl-chip--l ${pulseL ? "is-pulse" : ""} ${params.leftImg ? "has-img" : ""}`}
          style={{ left: LX, top: LANE_Y + bob }}
        >
          {params.leftImg ? <img className="cvl-face" src={params.leftImg} alt="" /> : leftLabel}
        </div>
        <div
          className={`cvl-chip cvl-chip--r ${pulseR ? "is-pulse" : ""} ${params.rightImg ? "has-img" : ""}`}
          style={{ left: RX, top: LANE_Y - bob }}
        >
          {params.rightImg ? <img className="cvl-face" src={params.rightImg} alt="" /> : rightLabel}
        </div>

        {msgs.map((m, i) => {
          const t = launch[i];
          const d = clamp01((elapsed - t) / FLY);
          if (d <= 0) return null;
          const e = easeOutExpo(d);
          const x0 = m.fromLeft ? LX : RX;
          const x1 = m.fromLeft ? RX : LX;
          if (d < 1) {
            // 飞行中:弧线穿梭
            const x = x0 + (x1 - x0) * e;
            const y = LANE_Y - Math.sin(e * Math.PI) * 40;
            return (
              <div
                key={i}
                className={`cvl-bub is-fly ${m.fromLeft ? "" : "is-r"}`}
                style={{ left: x, top: y }}
              >
                {m.text}
              </div>
            );
          }
          // 落地:叠进中间的对话记录,新的亮、旧的压暗
          const settle = easeOutExpo(clamp01((elapsed - t - FLY) / 0.35));
          const newerLanded = msgs.filter((_, j) => j > i && elapsed >= launch[j] + FLY).length;
          return (
            <div
              key={i}
              className={`cvl-bub is-dock ${m.fromLeft ? "" : "is-r"}`}
              style={{
                left: W / 2,
                top: 118 + i * 56,
                opacity: (newerLanded > 0 ? 0.45 : 1) * settle,
                transform: `translate(-50%, -50%) scale(${(0.9 + 0.1 * settle).toFixed(3)})`,
              }}
            >
              {m.text}
            </div>
          );
        })}

        {stampOn && stampText && (
          <div
            className="cvl-stamp"
            style={{
              top: 118 + msgs.length * 56,
              opacity: stampK.toFixed(2),
              transform: `translate(-50%, -50%) scale(${(0.7 + 0.3 * stampK).toFixed(3)})`,
            }}
          >
            {params.stampIcon ? <img className="cvl-stamp-ic" src={params.stampIcon} alt="" /> : "✓"} {stampText}
          </div>
        )}
      </div>
    </div>
  );
}

export const chatVolleyDef: EffectDef<ChatVolleyParams> = {
  id: "chat-volley",
  vTier: "half",
  name: "ChatVolley",
  description: "对话往返 · 气泡在两端头徽间穿梭,落成记录,绿戳收尾(卡点)",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    leftLabel: "我",
    rightLabel: "AI",
    leftImg: "",
    rightImg: "",
    stampIcon: "",
    msgs: "L|左边说的话写这行\nR|右边回的话写这行",
    times: "0.3|2",
    counter: "来回 2 轮",
    stampText: "达成",
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "leftLabel", label: "左端头徽(文字)", type: "text" },
    { key: "leftImg", label: "左端头像图(填了就用图)", type: "text" },
    { key: "rightLabel", label: "右端头徽(文字)", type: "text" },
    { key: "rightImg", label: "右端图标(填了就用图)", type: "text" },
    { key: "stampIcon", label: "收尾戳小图标(空=用✓)", type: "text" },
    {
      key: "msgs",
      label: "消息(一行一条:L|文字 左发出,R|文字 右发回)",
      type: "textarea",
      rows: 3,
    },
    { key: "times", label: "卡点秒:每条发出时刻,末尾可多给一位=收尾戳", type: "text" },
    { key: "counter", label: "顶部计数标签(空=不显示)", type: "text" },
    { key: "stampText", label: "收尾戳文字(绿,空=不显示)", type: "text" },
    { key: "theme", label: "底色", type: "select", options: THEME_OPTIONS },
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
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: ChatVolley,
};
