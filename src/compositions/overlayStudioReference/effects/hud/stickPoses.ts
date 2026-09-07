/* 火柴人姿势库 —— stick-fall 卡的动作数据(与骨架渲染分开,加动作只是加一张坐标表)
 *
 * 坐标系沿用原卡:viewBox 60 10 180 210,地面线 y=212,站立中心 x≈150
 * 关节:head 头 neck 脖 hip 胯 elL/elR 肘 haL/haR 手 knL/knR 膝 ftL/ftR 脚
 * 名字带 A/B 的是循环动作的两个关键帧,渲染时在两帧之间来回插值。
 */
export type Pose = Record<string, [number, number]>;

export const POSES: Record<string, Pose> = {
  stand:{head:[150,50],neck:[150,70],hip:[150,130],elL:[134,100],haL:[130,128],elR:[166,100],haR:[170,128],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  walkA:{head:[150,52],neck:[150,72],hip:[150,131],elL:[136,101],haL:[126,124],elR:[164,100],haR:[176,122],knL:[168,160],ftL:[180,196],knR:[134,164],ftR:[120,200]},
  walkB:{head:[150,52],neck:[150,72],hip:[150,131],elL:[136,100],haL:[124,122],elR:[164,101],haR:[178,124],knL:[134,164],ftL:[120,200],knR:[168,160],ftR:[180,196]},
  runA:{head:[160,52],neck:[155,72],hip:[144,128],elL:[128,88],haL:[110,60],elR:[164,108],haR:[188,128],knL:[170,150],ftL:[178,174],knR:[124,160],ftR:[106,186]},
  runB:{head:[160,52],neck:[155,72],hip:[144,128],elL:[140,106],haL:[164,124],elR:[150,88],haR:[132,58],knL:[126,158],ftL:[108,184],knR:[172,152],ftR:[180,176]},
  sprintA:{head:[172,58],neck:[164,76],hip:[142,126],elL:[128,84],haL:[108,48],elR:[156,110],haR:[184,134],knL:[178,142],ftL:[188,166],knR:[116,158],ftR:[94,180]},
  sprintB:{head:[172,58],neck:[164,76],hip:[142,126],elL:[144,108],haL:[172,128],elR:[148,82],haR:[126,46],knL:[118,152],ftL:[96,176],knR:[180,146],ftR:[190,168]},
  squat:{head:[150,106],neck:[150,126],hip:[152,166],elL:[126,144],haL:[112,164],elR:[178,144],haR:[192,164],knL:[120,180],ftL:[128,204],knR:[184,180],ftR:[176,204]},
  kneel:{head:[152,86],neck:[149,105],hip:[140,150],elL:[152,128],haL:[157,157],elR:[146,130],haR:[151,159],knL:[136,197],ftL:[104,205],knR:[145,199],ftR:[113,207]},
  lie:{head:[86,190],neck:[106,194],hip:[152,197],elL:[116,204],haL:[100,208],elR:[124,200],haR:[112,206],knL:[180,199],ftL:[208,202],knR:[186,202],ftR:[214,206]},
  sit:{head:[148,74],neck:[147,94],hip:[140,147],elL:[152,120],haL:[170,143],elR:[147,122],haR:[165,145],knL:[178,148],ftL:[181,196],knR:[171,151],ftR:[174,198]},
  bend:{head:[186,110],neck:[172,116],hip:[142,132],elL:[180,140],haL:[184,168],elR:[172,142],haR:[176,170],knL:[138,168],ftL:[136,202],knR:[152,168],ftR:[154,202]},
  raise:{head:[150,50],neck:[150,70],hip:[150,130],elL:[134,100],haL:[130,128],elR:[172,88],haR:[178,50],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  cheerA:{head:[150,48],neck:[150,68],hip:[150,128],elL:[128,88],haL:[118,54],elR:[172,88],haR:[182,54],knL:[142,164],ftL:[140,200],knR:[158,164],ftR:[160,200]},
  cheerB:{head:[150,34],neck:[150,54],hip:[150,114],elL:[124,70],haL:[112,34],elR:[176,70],haR:[188,34],knL:[138,150],ftL:[128,180],knR:[162,150],ftR:[172,180]},
  shrug:{head:[150,52],neck:[150,72],hip:[150,130],elL:[128,104],haL:[110,92],elR:[172,104],haR:[190,92],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  scratchA:{head:[150,52],neck:[150,72],hip:[150,130],elL:[132,100],haL:[128,128],elR:[176,78],haR:[160,42],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  scratchB:{head:[150,52],neck:[150,72],hip:[150,130],elL:[132,100],haL:[128,128],elR:[178,80],haR:[148,40],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  pushA:{head:[166,66],neck:[160,82],hip:[140,132],elL:[176,88],haL:[194,92],elR:[176,96],haR:[194,100],knL:[130,168],ftL:[116,202],knR:[146,170],ftR:[140,202]},
  pushB:{head:[172,70],neck:[165,86],hip:[138,134],elL:[180,92],haL:[200,96],elR:[180,100],haR:[200,104],knL:[124,170],ftL:[104,202],knR:[142,172],ftR:[132,202]},
  carry:{head:[142,62],neck:[145,82],hip:[155,134],elL:[131,108],haL:[127,136],elR:[166,88],haR:[173,58],knL:[147,170],ftL:[141,204],knR:[165,170],ftR:[171,204]},
  jumpA:{head:[150,88],neck:[150,108],hip:[150,152],elL:[130,132],haL:[124,158],elR:[170,132],haR:[176,158],knL:[130,174],ftL:[134,202],knR:[170,174],ftR:[166,202]},
  jumpB:{head:[150,26],neck:[150,46],hip:[150,106],elL:[128,64],haL:[120,30],elR:[172,64],haR:[180,30],knL:[136,142],ftL:[128,170],knR:[164,142],ftR:[172,170]},
  fall:{head:[104,140],neck:[118,150],hip:[156,172],elL:[104,124],haL:[92,104],elR:[118,120],haR:[108,98],knL:[176,146],ftL:[196,124],knR:[182,160],ftR:[204,142]},
  facepalm:{head:[154,60],neck:[150,78],hip:[150,132],elL:[132,104],haL:[128,132],elR:[178,86],haR:[164,56],knL:[142,168],ftL:[140,204],knR:[158,168],ftR:[160,204]},
  coverface:{head:[150,56],neck:[150,76],hip:[150,132],elL:[126,94],haL:[140,54],elR:[174,94],haR:[160,54],knL:[142,168],ftL:[140,204],knR:[158,168],ftR:[160,204]},
  flop:{head:[92,176],neck:[112,184],hip:[162,192],elL:[98,164],haL:[80,162],elR:[104,170],haR:[84,170],knL:[188,174],ftL:[210,164],knR:[192,192],ftR:[218,198]},
  curl:{head:[150,128],neck:[150,148],hip:[152,180],elL:[124,152],haL:[132,126],elR:[176,152],haR:[168,126],knL:[124,190],ftL:[130,206],knR:[180,190],ftR:[174,206]},
  surrender:{head:[150,50],neck:[150,70],hip:[150,130],elL:[126,88],haL:[124,52],elR:[174,88],haR:[176,52],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  beg:{head:[157,108],neck:[152,127],hip:[142,168],elL:[165,148],haL:[186,123],elR:[158,152],haR:[181,127],knL:[138,201],ftL:[108,207],knR:[146,203],ftR:[116,209]},
  clapA:{head:[150,52],neck:[150,72],hip:[150,130],elL:[134,102],haL:[143,88],elR:[166,102],haR:[157,88],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  clapB:{head:[150,52],neck:[150,72],hip:[150,130],elL:[128,104],haL:[124,84],elR:[172,104],haR:[176,84],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  waveA:{head:[150,52],neck:[150,72],hip:[150,130],elL:[134,100],haL:[130,128],elR:[176,88],haR:[190,60],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  waveB:{head:[150,52],neck:[150,72],hip:[150,130],elL:[134,100],haL:[130,128],elR:[174,90],haR:[162,58],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  akimbo:{head:[150,50],neck:[150,70],hip:[150,130],elL:[124,100],haL:[139,126],elR:[176,100],haR:[161,126],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  foldarms:{head:[150,52],neck:[150,72],hip:[150,130],elL:[126,100],haL:[170,106],elR:[174,100],haR:[130,108],knL:[142,166],ftL:[140,202],knR:[158,166],ftR:[160,202]},
  shoot:{head:[146,50],neck:[146,70],hip:[150,130],elL:[166,86],haL:[184,68],elR:[168,98],haR:[186,76],knL:[138,166],ftL:[130,202],knR:[162,166],ftR:[170,202]},
};

/** 中文名(参数面板和剧本里都能用中文写) */
export const ACT_ZH: Record<string, string> = {stand:"站",walk:"走",run:"跑",sprint:"冲刺",squat:"蹲",kneel:"跪",lie:"趴",sit:"坐",
  bend:"弯腰",raise:"举手",cheer:"欢呼",shrug:"摊手",scratch:"挠头",push:"推",carry:"扛",
  jump:"跳",fall:"摔",shoot:"举相机拍",
  facepalm:"扶额",coverface:"捂脸",flop:"躺平",curl:"抱头蹲",surrender:"投降",beg:"跪求",
  clap:"鼓掌",wave:"摆手",akimbo:"叉腰",foldarms:"抱臂"};

/** 每个动作对应的口播说法 —— 生成动效时靠这个匹配口播原话 */
export const ACT_SAYS: Record<string, string> = {facepalm:"无语 / 醉了 / 服了",coverface:"社死 / 尴尬到抠地",flop:"躺平 / 摆烂",
  curl:"破防 / emo 了",surrender:"我不干了 / 认输",beg:"求求了 / 卑微",clap:"牛 / 鼓掌",
  wave:"算了 / 不要",akimbo:"理直气壮 / 得意",foldarms:"看戏 / 我不信",
  lie:"累趴了",kneel:"跪了",run:"连轴转",sprint:"赶死线",shrug:"我能怎么办",
  scratch:"想不通",bend:"翻找",push:"推不动",carry:"扛着干",squat:"蹲下看",
  sit:"坐下来",jump:"上头了",fall:"翻车",cheer:"爽了",raise:"我来",
  stand:"待机",walk:"日常",shoot:"一直拍"};

/** 循环动作的一个来回用多久(毫秒);跑得快、走得慢、鼓掌更快 */
export const LOOP_MS: Record<string, number> = {
  run: 300, sprint: 240, walk: 460, clap: 260, wave: 420,
  cheer: 560, scratch: 760, push: 540, jump: 640,
};

/** 中文 → 英文动作名;剧本里两种写法都收 */
export const ACT_ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(ACT_ZH).map(([en, cn]) => [cn, en]),
);

/** 归一化一个动作名:中文转英文,认不出来的返回空 */
export function normAct(raw: string): string {
  const k = (raw ?? "").trim();
  const en = ACT_ALIAS[k] ?? k;
  return POSES[en] || POSES[en + "A"] ? en : "";
}

/** 取某个动作在 loop 相位 ph(0~1) 时的姿势;非循环动作忽略 ph */
export function poseAt(act: string, ph: number): Pose {
  const a = POSES[act + "A"], b = POSES[act + "B"];
  if (!a || !b) return POSES[act] ?? POSES.stand;
  // 循环动作同样要钉长度:跑/冲刺/跳的手臂摆幅最大,直线插值下小臂会被抽掉七成
  return fixBones(lerpPose(a, b, ph), a, b, () => ph);
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const k of Object.keys(a)) {
    out[k] = [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t];
  }
  return out;
}

/* ─── 第 5 条:跟随与重叠动作 ───────────────────────────────
 * 「主体停下,附属部分还在动。全身一起刹停,看着就像塑料。」
 *
 * 关节滞后系数,单位是「切拍窗口的几成」:胯不滞后,躯干几乎不滞后,
 * 肘膝跟上,手脚最后停。数值不是拍脑袋 —— 排序对应人体从重到轻:
 * 胯是重心先走,末端质量小、被带动,所以最后到位。
 * 只用在拍与拍之间的切换;循环动作(walkA/walkB 这种)不用,
 * 那两帧的相位是手工排好的,再加滞后会把排好的相位搅乱。 */
const LAG: Record<string, number> = {
  hip: 0, neck: 0.05, head: 0.11,
  knL: 0.10, knR: 0.10, elL: 0.13, elR: 0.13,
  ftL: 0.20, ftR: 0.20, haL: 0.35, haR: 0.35,
};

/* ─── 第 2 条:预备动作 ───────────────────────────────
 * 「正式动作前先往反方向蓄一下力。少了这一下,动作就没有说服力。」
 *
 * 包在缓动外面:前 span 段先往回走 amount,再正式出发。
 * 往回走 = 负的插值参数 —— 从起始姿势朝「远离目标」的方向外推一点,那就是蓄力。
 * amount 必须小:火柴人身上 0.12 已经看得出来,再大就不像蓄力,
 * 像是先做了另一个动作。
 */
export function withAnticipation(
  ease: (t: number) => number,
  amount = 0.12,
  span = 0.18,
): (t: number) => number {
  return (t) => {
    if (t <= 0) return 0;
    if (t < span) return -amount * Math.sin((Math.PI * t) / span);
    return ease((t - span) / (1 - span));
  };
}

/* ─── 第 7 条:弧线运动 ───────────────────────────────
 * 「自然界的运动都沿弧线走,只有机器才走直线。」
 *
 * 手绕肘转、肘绕肩转,轨迹本来是**弧**;两点直线插值走的是**弦**。
 * 弦比弧短,所以直线插值会让骨头在过渡中途变短或变长 —— 实测小臂
 * 最多被拉到原长的 2.5 倍(站→趴)。加了跟随之后更明显:父关节先走、
 * 子关节滞后,中间那段被生生拽开。
 *
 * 修法不是"加一道弧",而是**把骨头长度钉住**:从胯往外逐节把子关节
 * 沿"父→子"方向推到应有的长度上。长度锁死之后,末端自然只能绕着父关节
 * 转 —— 弧线是这么出来的,不是画出来的。
 */
const PARENT: Record<string, string> = {
  neck: "hip", head: "neck",
  elL: "neck", haL: "elL", elR: "neck", haR: "elR",
  knL: "hip", ftL: "knL", knR: "hip", ftR: "knR",
};
/** 必须从根(胯)往外算:修子关节要先知道父关节修好后在哪 */
const CHAIN = ["neck", "head", "elL", "haL", "elR", "haR", "knL", "ftL", "knR", "ftR"];

const seg = (p: Pose, a: string, b: string) =>
  Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]);

/**
 * 带跟随的插值。
 * u 是**没有截断**的原始进度(0 → 1 以上) —— 这是关键:
 * 如果先把 u 截到 1 再给各关节减滞后,所有关节仍然在同一刻到达 1,
 * 还是一起刹停,滞后就白加了。必须让末端的进度在窗口结束后继续往前跑。
 * 手在躯干到位后还要再动 0.35 × 窗口(约 210ms)才停 —— 那 210ms 就是「跟随」。
 */
export function lerpPoseFollow(
  a: Pose,
  b: Pose,
  u: number,
  ease: (t: number) => number,
): Pose {
  const out: Pose = {};
  const tOf: Record<string, number> = {};
  for (const k of Object.keys(a)) {
    const t = ease(Math.max(0, Math.min(1, u - (LAG[k] ?? 0))));
    tOf[k] = t;
    out[k] = [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t];
  }
  return fixBones(out, a, b, (k) => tOf[k]);
}

/**
 * 逐节把骨头长度钉回应有值 —— 第 7 条弧线运动的实现。
 * 必须从根(胯)往外走:修子关节的前提是父关节已经修好。
 * 两端姿势原样保留(t=0/1 时长度就等于端点长度),所以对手排的循环相位无损。
 */
function fixBones(out: Pose, a: Pose, b: Pose, tOf: (k: string) => number): Pose {
  for (const k of CHAIN) {
    const par = PARENT[k];
    if (!out[par] || !a[k] || !b[k]) continue;
    const want = seg(a, k, par) + (seg(b, k, par) - seg(a, k, par)) * tOf(k);
    const dx = out[k][0] - out[par][0];
    const dy = out[k][1] - out[par][1];
    const d = Math.hypot(dx, dy);
    if (d < 0.001) continue; // 完全重合时方向未定义,保持原样
    out[k] = [out[par][0] + (dx / d) * want, out[par][1] + (dy / d) * want];
  }
  return out;
}

/* ─── 第 1 条:挤压与拉伸 ───────────────────────────────
 * 「物体一形变,观众就读出弹性和重量。关键:形变时体积保持不变。」
 *
 * 火柴人是线条,没有体积可挤 —— 挤压体现为**整体高度的瞬时压缩**:
 * 落地那一下压扁、起跳那一下拉长。横向按 1/sy 补回来,体积才不变
 * (压扁时变宽、拉长时变窄);只压不补会变成"整个人缩水",那是缩放不是挤压。
 *
 * 只给有冲击的动作。走路、说话这类没有冲击,加了就是无端抖动。
 */
const IMPACT: Record<string, number> = {
  fall: 0.10, flop: 0.10, lie: 0.08, kneel: 0.07, squat: 0.06, sit: 0.05, // 落地压扁
  jump: -0.08, sprint: -0.04,                                             // 起跳/前冲拉长
};

/** 形变量随切拍进度走一个来回:u≈0.4 达峰(躯干刚好到位),u≥0.8 归零 */
export function impactAt(act: string, u: number): number {
  const amt = IMPACT[act];
  if (!amt || u <= 0 || u >= 0.8) return 0;
  return amt * Math.sin((Math.PI * u) / 0.8);
}

/**
 * 绕地面线做垂直挤压 + 等体积的水平补偿。
 * 支点取地面而不是重心 —— 落地时脚是不动的,压的是脚以上那一截。
 */
export function squash(p: Pose, amt: number, groundY = 212): Pose {
  if (!amt) return p;
  const sy = 1 - amt;
  const sx = 1 / sy;
  const cx = p.hip[0];
  const out: Pose = {};
  for (const k of Object.keys(p))
    out[k] = [cx + (p[k][0] - cx) * sx, groundY - (groundY - p[k][1]) * sy];
  return out;
}

/** 骨架连线顺序 */
export const BONES: [string, string][] = [
  ["neck", "hip"], ["neck", "elL"], ["elL", "haL"], ["neck", "elR"], ["elR", "haR"],
  ["hip", "knL"], ["knL", "ftL"], ["hip", "knR"], ["knR", "ftR"],
];
