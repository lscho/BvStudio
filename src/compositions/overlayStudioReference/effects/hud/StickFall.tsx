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
import { ACT_ZH, BONES, impactAt, LOOP_MS, lerpPoseFollow, normAct, POSES, poseAt, squash, withAnticipation } from "./stickPoses";
import { PROP_ALIAS, PROPS, propXY } from "./stickProps";

export interface StickFallParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  /** 剧本:一行一拍「秒|动作[+道具]」 */
  acts: string;
  /** 背景场景 */
  scene: "none" | "pile" | "track";
  /** 场景标签(mono 小字) */
  label: string;
  /** 素材堆堆到多少块 */
  pileMax?: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

/** 这些动作不写道具时自动带上 —— 没有道具就不成立 */
// 这几个动作不配道具就不成立(坐的椅子不在这:它跟坐姿绑定,不占道具槽)
const AUTO_PROP: Record<string, string> = { shoot: "camera", carry: "box", push: "rock" };

/** 切拍缓动:反向蓄力 → 缓入缓出 */
const BEAT_EASE = withAnticipation(easeOutExpo);

type Beat = { at: number; act: string; prop: string };

/** 剧本文本 → 拍子表。一行一拍:「秒|动作」或「秒|动作+道具」 */
function parseActs(src: string): Beat[] {
  const out: Beat[] = [];
  for (const line of (src ?? "").split("\n")) {
    const [tRaw, bodyRaw] = line.split("|");
    const at = parseFloat((tRaw ?? "").trim());
    if (!Number.isFinite(at)) continue;
    const [actRaw, propRaw] = (bodyRaw ?? "").split("+");
    const act = normAct(actRaw ?? "");
    if (!act) continue;
    const p = (propRaw ?? "").trim();
    const prop = p ? (PROP_ALIAS[p] ?? p) : (AUTO_PROP[act] ?? "");
    out.push({ at, act, prop });
  }
  return out.sort((a, b) => a.at - b.at);
}

const stroke = "var(--hud-ink)";

function StickFall({ params, playToken }: EffectProps<StickFallParams>) {
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params as unknown as { __t?: number; __start?: number }, playToken);
  const { label, accent, position, scene } = params;

  const beats = parseActs(params.acts);
  const script: Beat[] = beats.length ? beats : [{ at: 0, act: "stand", prop: "" }];

  // 当前演到第几拍
  let i = 0;
  for (let k = 0; k < script.length; k++) if (elapsed >= script[k].at) i = k;
  const cur = script[i];
  const prevAct = i > 0 ? script[i - 1].act : "stand";

  // 循环相位:正弦来回,每个动作有自己的节奏
  const loopMs = LOOP_MS[cur.act] ?? 520;
  const ph = (Math.sin((elapsed * 1000 * Math.PI) / loopMs) + 1) / 2;
  // 上一拍取固定帧(不跟着相位动),否则切拍瞬间会抖
  const from = POSES[prevAct] ?? POSES[prevAct + "A"] ?? POSES.stand;
  // 切拍:先反向蓄力再出发(第 2 条 预备动作),各关节按自己的滞后独立缓动,
  // 躯干先到位、手脚最后停(第 5 条 跟随与重叠),落地/起跳再压一下(第 1 条 挤压拉伸)
  const beatU = (elapsed - cur.at) / 0.6;
  const pose = squash(
    lerpPoseFollow(from, poseAt(cur.act, ph), beatU, BEAT_EASE),
    impactAt(cur.act, beatU),
  );

  // 素材堆:在第一拍到第二拍之间一块块堆起来
  const pileMax = params.pileMax ?? 18;
  const pileEnd = Math.max(0.4, (script[1]?.at ?? 3) - script[0].at);
  const pileN = Math.min(pileMax, Math.floor((elapsed / pileEnd) * pileMax) + 1);
  const COLS = 3;
  const BW = 30;
  const BH = 17;

  const prop = PROPS[cur.prop];
  // 坐着就得有地方坐 —— 椅子跟姿势走,不跟道具抢槽位
  const sitting = cur.act === "sit" && cur.prop !== "chair";
  const [px, py] = prop ? propXY(prop.anchor, pose) : [0, 0];
  const L = (a: string, b: string) => (
    <line key={a + b} x1={pose[a][0]} y1={pose[a][1]} x2={pose[b][0]} y2={pose[b][1]} />
  );

  return (
    <div
      className={`hud stk hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="stk-wrap">
        {scene === "pile" && (
          <div className="stk-pile">
            <div className="stk-lb">{label}</div>
            <div className="stk-blocks" style={{ width: COLS * (BW + 5) }}>
              {Array.from({ length: pileN }).map((_, n) => (
                <div
                  key={n}
                  className="stk-blk"
                  style={{ width: BW, height: BH, transform: `rotate(${((n * 37) % 7) - 3}deg)` }}
                >
                  ▸
                </div>
              ))}
            </div>
          </div>
        )}
        <svg className="stk-man" viewBox="60 10 180 214" width="230" height="273">
          {sitting && PROPS.chair.draw(0, 0)}
          {prop?.behind && prop.draw(px, py)}
          {/* 地面 */}
          <line x1="66" y1="212" x2="234" y2="212" stroke="var(--hud-faint)" strokeWidth="3" strokeLinecap="round" />
          {/* 赛道:地面标记向左滚,表示人在往前跑 */}
          {scene === "track" && (
            <g stroke="var(--hud-faint)" strokeWidth="4" strokeLinecap="round" opacity="0.75">
              {Array.from({ length: 8 }).map((_, n) => {
                // 周期 156 = 地面线可用宽度,标记末端(+9)刚好不越过右端 234
                const x = 66 + ((((n * 19.5 - elapsed * 96) % 156) + 156) % 156);
                return <line key={n} x1={x} y1={219} x2={x + 9} y2={219} />;
              })}
            </g>
          )}
          <g stroke={stroke} strokeWidth="7" strokeLinecap="round" fill="none">
            <circle cx={pose.head[0]} cy={pose.head[1]} r={16} fill="none" />
            {BONES.map(([a, b]) => L(a, b))}
          </g>
          {prop && !prop.behind && prop.draw(px, py)}
        </svg>
        {scene === "track" && label && <div className="stk-lb stk-lb--free">{label}</div>}
      </div>
    </div>
  );
}

const ACT_LIST = Object.values(ACT_ZH).join("/");
const PROP_LIST = Object.values(PROPS).map((p) => p.zh).join("/");

export const stickFallDef: EffectDef<StickFallParams> = {
  id: "stick-fall",
  name: "StickFall",
  description: "火柴人小剧场 · 28 个动作任意串成一段戏,配道具和场景(卡点)",
  tags: ["堆叠累积"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    acts: "0|举相机拍\n3|跪\n4.4|趴",
    scene: "pile",
    label: "堆起来的东西写这里",
    pileMax: 18,
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    {
      key: "acts",
      label: `剧本(一行一拍:秒|动作,带道具写 秒|动作+道具)。动作:${ACT_LIST}。道具:${PROP_LIST}`,
      type: "textarea",
      rows: 4,
    },
    {
      key: "scene",
      label: "背景",
      type: "select",
      options: [
        { label: "素材堆(越堆越高)", value: "pile" },
        { label: "赛道(地面往后滚)", value: "track" },
        { label: "不要背景", value: "none" },
      ],
    },
    { key: "label", label: "背景标签", type: "text" },
    { key: "pileMax", label: "堆几块(素材堆)", type: "range", min: 6, max: 36, step: 1 },
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
  Component: StickFall,
};
