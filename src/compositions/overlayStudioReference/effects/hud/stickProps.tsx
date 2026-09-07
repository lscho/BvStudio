/* 火柴人道具库 —— stick-fall 卡的道具数据
 *
 * 每个道具三件事:画成什么样、挂在身体哪个点、对应什么口播说法。
 * 「口播说法」不是注释,是给 overlay-fx-generator 选道具用的 ——
 * SKILL.md 的道具表由 sync:cards 从这个文件生成,加道具文档自动跟上。
 *
 * draw(x, y) 以 (x, y) 为中心画,坐标系跟姿势库一致(viewBox 60 10 180 214)。
 */
import type { Pose } from "./stickPoses";

/** 挂点:手上 / 双手中间 / 头顶 / 地面固定 */
export type PropAnchor = "hand" | "hands" | "head" | "ground";

export type PropDef = {
  zh: string;
  says: string;
  anchor: PropAnchor;
  /** 画在人后面(椅子这类要被人挡住) */
  behind?: boolean;
  draw: (x: number, y: number) => React.ReactElement;
};

const ink = "var(--hud-ink)";
const acc = "var(--hud-acc)";
const node = "var(--hud-node)";
const faint = "var(--hud-faint)";

export const PROPS: Record<string, PropDef> = {
  camera: {
    zh: "相机", says: "拍视频 / 一直拍 / 录素材", anchor: "hands",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4}>
        <rect x={x - 16} y={y - 11} width={32} height={22} rx={5} fill={node} />
        <circle cx={x + 2} cy={y} r={6} strokeWidth={3.5} />
        <rect x={x - 12} y={y - 15} width={9} height={5} rx={2} fill={ink} stroke="none" />
      </g>
    ),
  },
  phone: {
    zh: "手机", says: "刷手机 / 看消息 / 盯着屏幕", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4}>
        <rect x={x - 9} y={y - 16} width={18} height={32} rx={4} fill={node} />
        <line x1={x - 4} y1={y - 8} x2={x + 4} y2={y - 8} stroke={acc} strokeWidth={3} />
        <line x1={x - 4} y1={y - 1} x2={x + 4} y2={y - 1} stroke={acc} strokeWidth={3} />
      </g>
    ),
  },
  laptop: {
    zh: "电脑", says: "干活 / 写东西 / 剪片子 / 敲代码", anchor: "hands",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round">
        <path d={`M${x - 16} ${y + 4} L${x - 13} ${y - 16} L${x + 17} ${y - 16} L${x + 14} ${y + 4} Z`} fill={node} />
        <path d={`M${x - 20} ${y + 4} L${x + 18} ${y + 4} L${x + 21} ${y + 11} L${x - 23} ${y + 11} Z`} />
      </g>
    ),
  },
  coffee: {
    zh: "咖啡", says: "提神 / 熬夜 / 续命 / 歇一下", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round">
        <path d={`M${x - 11} ${y - 10} L${x + 11} ${y - 10} L${x + 8} ${y + 13} L${x - 8} ${y + 13} Z`} fill={node} />
        <path d={`M${x + 11} ${y - 5} q7 0 7 6 t-8 5`} />
        <path d={`M${x - 4} ${y - 18} q4 -5 0 -9`} stroke={acc} strokeWidth={3} />
        <path d={`M${x + 4} ${y - 18} q4 -5 0 -9`} stroke={acc} strokeWidth={3} />
      </g>
    ),
  },
  book: {
    zh: "书", says: "读书 / 学东西 / 查资料", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round">
        <path d={`M${x} ${y - 8} L${x - 17} ${y - 13} L${x - 17} ${y + 10} L${x} ${y + 14} Z`} fill={node} />
        <path d={`M${x} ${y - 8} L${x + 17} ${y - 13} L${x + 17} ${y + 10} L${x} ${y + 14} Z`} fill={node} />
      </g>
    ),
  },
  mic: {
    zh: "麦克风", says: "口播 / 开麦 / 录音 / 讲给你听", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round">
        <rect x={x - 7} y={y - 20} width={14} height={22} rx={7} fill={node} />
        <path d={`M${x - 12} ${y - 2} q12 14 24 0`} />
        <line x1={x} y1={y + 8} x2={x} y2={y + 16} />
      </g>
    ),
  },
  paper: {
    zh: "稿纸", says: "写稿 / 改稿 / 列清单", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round">
        <rect x={x - 12} y={y - 16} width={24} height={31} rx={2} fill={node} />
        <g stroke={acc} strokeWidth={3} strokeLinecap="round">
          <line x1={x - 6} y1={y - 8} x2={x + 6} y2={y - 8} />
          <line x1={x - 6} y1={y - 1} x2={x + 6} y2={y - 1} />
          <line x1={x - 6} y1={y + 6} x2={x + 1} y2={y + 6} />
        </g>
      </g>
    ),
  },
  bulb: {
    zh: "灯泡", says: "想通了 / 有灵感 / 开窍 / 原来如此", anchor: "head",
    draw: (x, y) => (
      <g fill="none" stroke={acc} strokeWidth={4} strokeLinecap="round">
        <circle cx={x} cy={y} r={11} fill={node} />
        <line x1={x - 5} y1={y + 13} x2={x + 5} y2={y + 13} />
        <line x1={x - 4} y1={y + 19} x2={x + 4} y2={y + 19} />
        <g strokeWidth={3}>
          <line x1={x} y1={y - 20} x2={x} y2={y - 26} />
          <line x1={x - 15} y1={y - 13} x2={x - 21} y2={y - 18} />
          <line x1={x + 15} y1={y - 13} x2={x + 21} y2={y - 18} />
        </g>
      </g>
    ),
  },
  money: {
    zh: "钱", says: "赚钱 / 花钱 / 成本 / 变现", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round">
        <rect x={x - 17} y={y - 11} width={34} height={22} rx={3} fill={node} />
        <text x={x} y={y + 6} fontSize={16} fill={acc} stroke="none" textAnchor="middle">¥</text>
      </g>
    ),
  },
  clock: {
    zh: "闹钟", says: "赶时间 / deadline / 又熬到几点", anchor: "head",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round">
        <circle cx={x} cy={y} r={13} fill={node} />
        <line x1={x} y1={y} x2={x} y2={y - 8} stroke={acc} strokeWidth={3.5} />
        <line x1={x} y1={y} x2={x + 6} y2={y + 3} stroke={acc} strokeWidth={3.5} />
        <line x1={x - 12} y1={y - 12} x2={x - 16} y2={y - 17} />
        <line x1={x + 12} y1={y - 12} x2={x + 16} y2={y - 17} />
      </g>
    ),
  },
  trophy: {
    zh: "奖杯", says: "拿到结果 / 成了 / 拿奖", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={acc} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round">
        <path d={`M${x - 10} ${y - 15} L${x + 10} ${y - 15} L${x + 8} ${y - 1} q-8 6 -16 0 Z`} fill={node} />
        <path d={`M${x - 10} ${y - 12} q-7 1 -6 7`} />
        <path d={`M${x + 10} ${y - 12} q7 1 6 7`} />
        <line x1={x} y1={y + 3} x2={x} y2={y + 10} />
        <line x1={x - 8} y1={y + 12} x2={x + 8} y2={y + 12} />
      </g>
    ),
  },
  bag: {
    zh: "购物袋", says: "买买买 / 剁手 / 下单了", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round">
        <path d={`M${x - 13} ${y - 6} L${x + 13} ${y - 6} L${x + 10} ${y + 17} L${x - 10} ${y + 17} Z`} fill={node} />
        <path d={`M${x - 6} ${y - 6} q0 -11 6 -11 t6 11`} stroke={acc} />
      </g>
    ),
  },
  box: {
    zh: "箱子", says: "搬东西 / 扛着干 / 一堆活", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={ink} strokeWidth={5} strokeLinejoin="round">
        <rect x={x - 23} y={y - 32} width={46} height={32} rx={3} fill={node} />
        <line x1={x - 23} y1={y - 16} x2={x + 23} y2={y - 16} />
      </g>
    ),
  },
  cone: {
    zh: "冰淇淋", says: "犒劳自己 / 爽 / 奖励一下", anchor: "hand",
    draw: (x, y) => (
      <g fill="none" stroke={acc} strokeWidth={4.5} strokeLinejoin="round">
        <path d={`M${x - 9} ${y - 8} L${x + 9} ${y - 8} L${x} ${y + 13} Z`} />
        <circle cx={x} cy={y - 13} r={7.5} fill={node} />
      </g>
    ),
  },
  chair: {
    zh: "椅子", says: "坐下来 / 歇着", anchor: "ground", behind: true,
    draw: () => (
      <g fill="none" stroke={faint} strokeWidth={5} strokeLinecap="round">
        <line x1={120} y1={150} x2={186} y2={150} />
        <line x1={120} y1={150} x2={113} y2={88} />
        <line x1={126} y1={152} x2={121} y2={206} />
        <line x1={180} y1={152} x2={185} y2={206} />
      </g>
    ),
  },
  rock: {
    zh: "大石头", says: "推不动 / 太沉了 / 卡在这", anchor: "ground", behind: true,
    draw: () => (
      <g fill="none" stroke={ink} strokeWidth={5} strokeLinejoin="round">
        <path d="M196 210 L188 178 L200 162 L222 168 L230 194 L222 210 Z" fill={node} />
      </g>
    ),
  },
};

/** 中文 → 英文道具名;剧本里两种写法都收 */
export const PROP_ALIAS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PROPS).map(([en, d]) => [d.zh, en])),
  无: "", 空手: "", 没有: "",
};

/** 道具挂在身体哪个点 */
export function propXY(anchor: PropAnchor, p: Pose): [number, number] {
  switch (anchor) {
    case "hands": return [(p.haL[0] + p.haR[0]) / 2 + 12, (p.haL[1] + p.haR[1]) / 2];
    case "head": return [p.head[0] + 34, p.head[1] - 22];
    case "ground": return [0, 0];
    default: return [p.haR[0], p.haR[1]];
  }
}
