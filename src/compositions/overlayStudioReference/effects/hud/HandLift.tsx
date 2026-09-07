import type { EffectDef, EffectProps } from "../types";
import { useCardElapsed } from "./useTimelineTime";
import { isMediaUrl, MediaImg } from "./MediaImg";
import { hasVecIcon, VecIcon } from "./vecIcons";
import { ACCENT_OPTIONS, ACCENT_VAR, THEME_OPTIONS } from "./accent";
import { useStageRatio } from "../../stage";

export interface HandLiftParams {
  theme: "dark" | "light";
  /** 左手托起的图标:矢量图标名(aperture/code…)或图片路径(/logos/xxx.svg) */
  leftIcon: string;
  leftName: string;
  /** 名字下面的一行小注(可空) */
  leftNote: string;
  rightIcon: string;
  rightName: string;
  rightNote: string;
  /** 左/右各自升起的时刻(秒,距卡片 start;对齐你说到这个名字的那一刻) */
  leftAt: number;
  rightAt: number;
  /** 落位微调(px,相对画面中心):对准你手掌的位置 */
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  /** 交换左右:一键把两块对调(不用重设坐标) */
  swap: boolean;
  /** 掌心托举光晕 */
  glow: boolean;
  /** 托起后的上下悬浮幅度(px,0 = 不浮) */
  float: number;
  accent: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 托起手感:先冲上去再轻轻落稳(回弹),不是匀速升 */
const easeBack = (t: number) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function Palm({
  icon,
  name,
  note,
  at,
  x,
  y,
  keyX,
  keyY,
  glow,
  float,
  elapsed,
}: {
  icon: string;
  name: string;
  note: string;
  at: number;
  x: number;
  y: number;
  /** 这块在画布上拖动时要改的参数名(编辑台按它直接写回) */
  keyX: string;
  keyY: string;
  glow: boolean;
  float: number;
  elapsed: number;
}) {
  if (!name && !icon) return null;
  const p = clamp01((elapsed - at) / 0.72);
  const e = p <= 0 ? 0 : p >= 1 ? 1 : easeBack(p);
  // 托稳之后才开始悬浮:呼吸幅度跟 float 走,导出用绝对时间算,逐帧一致
  const bob = p >= 1 && float ? Math.sin((elapsed - at - 0.72) * 1.7) * float : 0;
  const isImg = isMediaUrl(icon);

  return (
    <div
      className="hlf-palm"
      data-drag-x={keyX}
      data-drag-y={keyY}
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        opacity: clamp01(p * 1.6),
        transform: `translate(-50%, -50%) translateY(${(1 - e) * 96 + bob}px) scale(${0.78 + e * 0.22})`,
      }}
    >
      {glow && <div className="hlf-glow" style={{ opacity: clamp01((p - 0.15) * 1.4) }} />}
      <div className="hlf-card">
        <div className="hlf-ico">
          {isImg ? (
            <MediaImg src={icon} className="hlf-img" />
          ) : hasVecIcon(icon) ? (
            <VecIcon name={icon} size={62} />
          ) : (
            <span className="hlf-emoji">{icon}</span>
          )}
        </div>
        <div className="hlf-txt">
          <b>{name}</b>
          {note && <i>{note}</i>}
        </div>
      </div>
    </div>
  );
}

/**
 * 手托展示:两个 App/工具的图标 + 名字,分别从你左右手掌心"托"起来
 * (回弹升起 + 掌心光晕 + 托稳后轻轻悬浮)。
 * 用途:口播里"这个和这个我都试过了"、左右手各托一个的同步动画;
 * leftAt/rightAt 对齐你念到各自名字的时刻;两块在画布上可以各自拖动
 * (直接拖那一块就行,不用调滑块),「交换左右」一键对调两边内容。
 */
function HandLift({ params, playToken }: EffectProps<HandLiftParams>) {
  const elapsed = useCardElapsed(params, playToken);
  const { accent, glow, float, swap } = params;
  // 交换左右:只换内容和进场时刻,坐标仍归各自那一侧(拖过的位置不会跟着乱跑)
  const a = swap
    ? { icon: params.rightIcon, name: params.rightName, note: params.rightNote, at: params.rightAt }
    : { icon: params.leftIcon, name: params.leftName, note: params.leftNote, at: params.leftAt };
  const b = swap
    ? { icon: params.leftIcon, name: params.leftName, note: params.leftNote, at: params.leftAt }
    : { icon: params.rightIcon, name: params.rightName, note: params.rightNote, at: params.rightAt };

  // 竖版:两块改成上下排 —— 默认左右各偏 520px,在 1080 宽里左边那块会被推出画外。
  // 只在用户没调过坐标时接管(判断依据是还等于横版默认值),调过就听用户的。
  const V = useStageRatio() === "v";
  const untouched = params.leftX === -520 && params.rightX === 520;
  const P =
    V && untouched
      ? { lx: 0, ly: -300, rx: 0, ry: 300 }
      : { lx: params.leftX, ly: params.leftY, rx: params.rightX, ry: params.rightY };

  return (
    <div className="hud hlf" style={{ ["--hud-acc" as string]: ACCENT_VAR[accent] }}>
      <Palm
        {...a}
        x={P.lx}
        y={P.ly}
        keyX="leftX"
        keyY="leftY"
        glow={glow}
        float={float}
        elapsed={elapsed}
      />
      <Palm
        {...b}
        x={P.rx}
        y={P.ry}
        keyX="rightX"
        keyY="rightY"
        glow={glow}
        float={float}
        elapsed={elapsed}
      />
    </div>
  );
}

export const handLiftDef: EffectDef<HandLiftParams> = {
  id: "hand-lift",
  name: "HandLift",
  description: "手托展示 · 左右手各托起一个图标+名字",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    leftIcon: "aperture",
    leftName: "LEFT",
    leftNote: "左手托这个",
    rightIcon: "code",
    rightName: "RIGHT",
    rightNote: "右手托这个",
    leftAt: 0.2,
    rightAt: 1.2,
    leftX: -520,
    leftY: 40,
    rightX: 520,
    rightY: 40,
    swap: false,
    glow: true,
    float: 7,
    accent: "blue",
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "leftIcon", label: "左·图标(矢量名或 /logos/x.svg)", type: "text" },
    { key: "leftName", label: "左·名字", type: "text" },
    { key: "leftNote", label: "左·小注", type: "text" },
    { key: "leftAt", label: "左·托起时刻(s)", type: "range", min: 0, max: 12, step: 0.1, unit: "s" },
    { key: "rightIcon", label: "右·图标(矢量名或 /logos/x.svg)", type: "text" },
    { key: "rightName", label: "右·名字", type: "text" },
    { key: "rightNote", label: "右·小注", type: "text" },
    { key: "rightAt", label: "右·托起时刻(s)", type: "range", min: 0, max: 12, step: 0.1, unit: "s" },
    { key: "swap", label: "交换左右两块", type: "toggle" },
    { key: "leftX", label: "左·横向(px)", type: "range", min: -900, max: 900, step: 10, unit: "px" },
    { key: "leftY", label: "左·纵向(px)", type: "range", min: -460, max: 460, step: 10, unit: "px" },
    { key: "rightX", label: "右·横向(px)", type: "range", min: -900, max: 900, step: 10, unit: "px" },
    { key: "rightY", label: "右·纵向(px)", type: "range", min: -460, max: 460, step: 10, unit: "px" },
    { key: "glow", label: "掌心光晕", type: "toggle" },
    { key: "float", label: "悬浮幅度(px)", type: "range", min: 0, max: 18, step: 1, unit: "px" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
  ],
  Component: HandLift,
};
