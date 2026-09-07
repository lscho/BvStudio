import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { MediaImg } from "./MediaImg";
import { ACCENT_OPTIONS, ACCENT_VAR, THEME_OPTIONS, OFFSET_CONTROLS, OFFSET_DEFAULTS, offsetVars } from "./accent";

/** 图片槽位上限:改这一个数,参数、控件、布局全跟着走 */
export const PWL_SLOTS = 10;

export interface ProofWallParams {
  theme: "dark" | "light";
  /** 墙贴在哪半边;另半边留给人 */
  side: "left" | "right";
  /** 最多 10 张:网友夸赞截图、复刻成果截图……(图或短视频都行) */
  img1: string;
  img2: string;
  img3: string;
  img4: string;
  img5: string;
  img6: string;
  img7: string;
  img8: string;
  img9: string;
  img10: string;
  /** 每张弹出的秒数(距卡片 start,| 分隔);留空 = 按「弹出间隔」匀速噔噔噔 */
  times: string;
  /** 第一张比卡片 start 晚多久弹(秒) */
  firstAt: number;
  /** 弹出间隔(ms);times 填了就不看这个 */
  stepMs: number;
  /** 墙占屏幕多宽(%);50 = 正好半屏 */
  width: number;
  /** 每张的歪斜幅度(度),0 = 摆正 */
  tilt: number;
  /** 截图怎么塞进格子:cover 填满(细长图会被裁) · contain 完整显示(留边) */
  fit: "cover" | "contain";
  /** 角标(空 = 不显示) */
  tag: string;
  /** 右下角计数:填了就显示「+N」滚上去 */
  countZh: string;
  /** 底部字幕安全区(%画面高) */
  safeBottom: number;
  /** 垫一层暗底(压在亮画面上时要开) */
  bg: "dark" | "none";
  accent: string;
  /** 整墙缩放:面板通用的「卡片大小」滑杆 / 画布上滚轮,都改它 */
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  __t?: number;
  __start?: number;
}

/**
 * 一张图在 12×12 网格里占哪块:[列起, 行起, 跨列, 跨行]。
 * 按张数换布局,张数越多铺得越满;12 等分能整除 2/3/4 列,横竖都排得开。
 */
const LAYOUTS: Record<number, [number, number, number, number][]> = {
  1: [[1, 1, 12, 12]],
  2: [[1, 1, 12, 6], [1, 7, 12, 6]],
  3: [[1, 1, 12, 6], [1, 7, 6, 6], [7, 7, 6, 6]],
  4: [[1, 1, 6, 6], [7, 1, 6, 6], [1, 7, 6, 6], [7, 7, 6, 6]],
  5: [[1, 1, 8, 6], [9, 1, 4, 6], [1, 7, 4, 6], [5, 7, 4, 6], [9, 7, 4, 6]],
  6: [[1, 1, 6, 4], [7, 1, 6, 4], [1, 5, 6, 4], [7, 5, 6, 4], [1, 9, 6, 4], [7, 9, 6, 4]],
  // 7 = 2 + 2 + 3
  7: [[1, 1, 6, 4], [7, 1, 6, 4], [1, 5, 6, 4], [7, 5, 6, 4], [1, 9, 4, 4], [5, 9, 4, 4], [9, 9, 4, 4]],
  // 8 = 2 + 3 + 3
  8: [[1, 1, 6, 4], [7, 1, 6, 4], [1, 5, 4, 4], [5, 5, 4, 4], [9, 5, 4, 4], [1, 9, 4, 4], [5, 9, 4, 4], [9, 9, 4, 4]],
  // 9 = 3 × 3
  9: [[1, 1, 4, 4], [5, 1, 4, 4], [9, 1, 4, 4], [1, 5, 4, 4], [5, 5, 4, 4], [9, 5, 4, 4], [1, 9, 4, 4], [5, 9, 4, 4], [9, 9, 4, 4]],
  // 10 = 3 + 3 + 2 + 2(后两行放宽格子,横构图的截图落这儿最好看)
  10: [
    [1, 1, 4, 3], [5, 1, 4, 3], [9, 1, 4, 3],
    [1, 4, 4, 3], [5, 4, 4, 3], [9, 4, 4, 3],
    [1, 7, 6, 3], [7, 7, 6, 3],
    [1, 10, 6, 3], [7, 10, 6, 3],
  ],
};

/** 定死的歪斜序列:每张歪的方向不一样,才像"随手贴上去的",但每次渲染都一样(导出可复现) */
const SKEW = [-1, 1.4, -1.8, 0.9, 1.7, -1.2, 1.1, -1.5, 0.7, -0.8];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 弹出曲线:0.38s 冲到位,中途冲过头一点点,就是那个"噔"的手感 */
function pop(age: number) {
  if (age <= 0) return { k: 0, o: 0 };
  const p = clamp01(age / 0.38);
  const e = 1 - Math.pow(1 - p, 3);
  return { k: e + Math.sin(p * Math.PI) * 0.11, o: clamp01(age / 0.16) };
}

function parseTimes(raw: string, n: number, firstAt: number, stepMs: number): number[] {
  const list = (raw ?? "")
    .split(/[|,，\s]+/)
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
  const step = Math.max(stepMs ?? 260, 60) / 1000;
  return Array.from({ length: n }, (_, i) =>
    Number.isFinite(list[i]) ? list[i] : (firstAt ?? 0) + i * step,
  );
}

/**
 * 截图墙:网友截图一张接一张"噔噔噔"弹出来,弹完拼满半边屏,人在另半边继续说。
 * 和 proof-shot 的区别是**累积**——proof-shot 是翻页,前一张会被换掉;
 * 这张是一张压一张地堆,讲完整面墙都还在,观众看到的是"这么多人"。
 * 用途:好评/私信/复刻成果的社会证明。图少就铺大块,图多就铺满格。
 */
function ProofWall({ params, playToken }: EffectProps<ProofWallParams>) {
  const { side, times, firstAt, stepMs, width, tilt, fit, tag, countZh, safeBottom, bg, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const values = params as unknown as Record<string, unknown>;
  const imgs = Array.from({ length: PWL_SLOTS }, (_, i) => values[`img${i + 1}`])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, PWL_SLOTS);
  const n = Math.max(imgs.length, 1);
  const cells = LAYOUTS[n] ?? LAYOUTS[PWL_SLOTS];
  const at = parseTimes(times, n, firstAt, stepMs);
  const shown = imgs.length ? at.filter((t) => elapsed >= t).length : 0;

  return (
    <div
      className={`hud pwl pwl--${side} pwl--${fit === "contain" ? "contain" : "cover"} ${entered ? "is-in" : ""}`}
      style={{
        ...offsetVars(params),
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--pwl-w" as string]: `${width}%`,
        ["--pwl-safe" as string]: `${safeBottom}%`,
      }}
    >
      {/* 暗底贴着画面边缘不动:整墙缩放/挪位时,压底的渐变不该跟着歪 */}
      {bg === "dark" && <div className="pwl-bg" />}
      {/* 墙本体(图 + 角标 + 计数)整体吃「位置微调」和「整体大小」 */}
      <div className="pwl-body">
        <div className="pwl-grid">
          {(imgs.length ? imgs : [""]).map((src, i) => {
            const [c, r, cs, rs] = cells[i] ?? [1, 1, 12, 12];
            const { k, o } = pop(elapsed - at[i]);
            const deg = (SKEW[i % SKEW.length] * (tilt ?? 0)) / 2;
            const isNew = i === shown - 1;
            return (
              <div
                key={i}
                className={`pwl-cell ${isNew ? "is-new" : ""}`}
                style={{
                  gridColumn: `${c} / span ${cs}`,
                  gridRow: `${r} / span ${rs}`,
                  opacity: o,
                  transform: `translateY(${((1 - Math.min(k, 1)) * 26).toFixed(2)}px) scale(${(0.62 + k * 0.38).toFixed(4)}) rotate(${(deg * Math.min(k, 1)).toFixed(2)}deg)`,
                }}
              >
                {src ? (
                  <MediaImg src={src} className="pwl-img" tStart={params.__start} />
                ) : (
                  <div className="pwl-empty">证据素材 {i + 1}</div>
                )}
              </div>
            );
          })}
        </div>
        {tag && <span className="pwl-tag">{tag}</span>}
        {countZh && shown > 0 && (
          <span className="pwl-count">
            <b>{shown}</b>
            {countZh}
          </span>
        )}
      </div>
    </div>
  );
}

export const proofWallDef: EffectDef<ProofWallParams> = {
  id: "proof-wall",
  name: "ProofWall",
  description: "截图墙 · 网友截图一张张弹出来,越堆越多,拼满半边屏",
  tags: ["堆叠累积"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    side: "left",
    img1: "",
    img2: "",
    img3: "",
    img4: "",
    img5: "",
    img6: "",
    img7: "",
    img8: "",
    img9: "",
    img10: "",
    times: "",
    firstAt: 0.15,
    stepMs: 260,
    width: 50,
    tilt: 2,
    fit: "cover",
    tag: "网友反馈 · FEEDBACK",
    countZh: " 条好评",
    safeBottom: 12,
    bg: "dark",
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "side",
      label: "贴哪半边",
      type: "select",
      options: [
        { label: "左半屏", value: "left" },
        { label: "右半屏", value: "right" },
      ],
    },
    { key: "img1", label: "截图 1", type: "text" },
    { key: "img2", label: "截图 2", type: "text" },
    { key: "img3", label: "截图 3", type: "text" },
    { key: "img4", label: "截图 4", type: "text" },
    { key: "img5", label: "截图 5", type: "text" },
    { key: "img6", label: "截图 6", type: "text" },
    { key: "img7", label: "截图 7", type: "text" },
    { key: "img8", label: "截图 8", type: "text" },
    { key: "img9", label: "截图 9", type: "text" },
    { key: "img10", label: "截图 10", type: "text" },
    { key: "times", label: "每张弹出秒(| 分隔;留空 = 匀速)", type: "text" },
    { key: "firstAt", label: "第一张晚多久弹", type: "range", min: 0, max: 4, step: 0.05, unit: "s" },
    { key: "stepMs", label: "弹出间隔(times 填了就无效)", type: "range", min: 80, max: 900, step: 20, unit: "ms" },
    { key: "width", label: "墙占屏宽", type: "range", min: 34, max: 62, step: 1, unit: "%" },
    { key: "tilt", label: "歪斜幅度", type: "range", min: 0, max: 8, step: 0.5, unit: "°" },
    {
      key: "fit",
      label: "截图怎么塞进格子",
      type: "select",
      options: [
        { label: "填满(细长图会被裁)", value: "cover" },
        { label: "完整显示(留边)", value: "contain" },
      ],
    },
    { key: "tag", label: "角标(空 = 不显示)", type: "text" },
    { key: "countZh", label: "计数后缀(空 = 不显示 +N)", type: "text" },
    { key: "safeBottom", label: "底部字幕安全区", type: "range", min: 0, max: 26, step: 1, unit: "%" },
    {
      key: "bg",
      label: "暗底",
      type: "select",
      options: [
        { label: "垫一层暗底", value: "dark" },
        { label: "不垫", value: "none" },
      ],
    },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: ProofWall,
};
