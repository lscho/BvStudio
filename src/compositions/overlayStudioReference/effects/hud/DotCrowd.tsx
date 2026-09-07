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
} from "./accent";

export interface DotCrowdParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 标题「名目|大数字」,如 横店在册群演|13.4 万 */
  title: string;
  /** 点阵规模:总点数(每行 28 个自动换行) */
  dots?: number;
  /** 红条行「强调|小注|0-100」,如 超六成|月收入 <¥2,000|62 */
  sub1?: string;
  /** 黄字行「名目|大数字|单位」,如 每天有效通告 · 只有|700-800|个 */
  sub2?: string;
  /** 收尾巨型比率「比率|小注」,如 167:1|人 · 抢同一个岗位 */
  ratio?: string;
  /** 四段出现时刻(秒,| 分隔):点阵|红条|黄字|比率 */
  times: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const COLS = 28;

/**
 * 点阵人群比("数人头"式):一个大数字先铺成一片点阵
 * (每个点=一群人,逐个亮起,规模感扑面而来),再压上一条红比例、
 * 一行黄数字,最后砸出巨型对比比率(如 167:1)收尾。
 * 适合"人多机会少"这类供需悬殊的论点。
 */
function DotCrowd({ params, playToken }: EffectProps<DotCrowdParams>) {
  const { position, title, dots, sub1, sub2, ratio, times, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);

  const [tName = "", tNum = ""] = title.split("|").map((s) => s.trim());
  const n = Math.max(COLS, Math.min(600, dots ?? 280));
  const [s1a = "", s1b = "", s1p = "60"] = (sub1 ?? "").split("|").map((s) => s.trim());
  const [s2a = "", s2b = "", s2c = ""] = (sub2 ?? "").split("|").map((s) => s.trim());
  const [rBig = "", rNote = ""] = (ratio ?? "").split("|").map((s) => s.trim());
  const ts = times.split("|").map((s) => parseFloat(s.trim()));
  const at = (i: number, fb: number) => (Number.isFinite(ts[i]) ? ts[i] : fb);

  const p0 = elapsed >= at(0, 0.3); // 标题 + 点阵
  const p1 = sub1 && elapsed >= at(1, 2.5); // 红条
  const p2 = sub2 && elapsed >= at(2, 5); // 黄字
  const p3 = ratio && elapsed >= at(3, 7.5); // 巨型比率

  const pct = Math.max(0, Math.min(100, parseFloat(s1p) || 0));

  return (
    <div
      className={`hud dcw hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className={`dcw-title ${p0 ? "is-on" : ""}`}>
        <span className="dcw-title-name">{tName}</span>
        <span className="dcw-title-num">{tNum}</span>
      </div>
      <div className="dcw-grid" style={{ width: COLS * 15 }}>
        {Array.from({ length: n }, (_, i) => (
          <i
            className={p0 ? "is-on" : ""}
            style={{ transitionDelay: `${(i % COLS) * 14 + Math.floor(i / COLS) * 90}ms` }}
            key={i}
          />
        ))}
      </div>
      {sub1 && (
        <div className={`dcw-sub1 ${p1 ? "is-on" : ""}`}>
          <span className="dcw-sub1-track">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="dcw-sub1-em">{s1a}</span>
          <span className="dcw-sub1-note">· {s1b}</span>
        </div>
      )}
      {sub2 && (
        <div className={`dcw-sub2 ${p2 ? "is-on" : ""}`}>
          <i />
          <span className="dcw-sub2-label">{s2a}</span>
          <span className="dcw-sub2-num">{s2b}</span>
          {s2c && <span className="dcw-sub2-unit">{s2c}</span>}
        </div>
      )}
      {ratio && (
        <div className={`dcw-ratio ${p3 ? "is-on" : ""}`}>
          <span className="dcw-ratio-big">{rBig}</span>
          <span className="dcw-ratio-note">{rNote}</span>
        </div>
      )}
    </div>
  );
}

export const dotCrowdDef: EffectDef<DotCrowdParams> = {
  id: "dot-crowd",
  vTier: "half",
  name: "DotCrowd",
  description: "点阵人群比 · 大数字铺成点阵,红条黄字递进,巨型比率收尾",
  tags: ["粒子流场", "滚动计数"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    title: "总量的名目|10 万+",
    dots: 280,
    sub1: "红条写占比|小注跟在后面|62",
    sub2: "黄字行的名目 · 只有|三五百|个",
    ratio: "100:1|巨型比率 · 一锤收尾",
    times: "0.3|2.5|5|7.5",
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
        { label: "居中", value: "center" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "title", label: "标题(名目|大数字)", type: "text" },
    { key: "dots", label: "点阵总点数", type: "range", min: 56, max: 600, step: 28 },
    { key: "sub1", label: "红条行(强调|小注|0-100 比例)", type: "text" },
    { key: "sub2", label: "黄字行(名目|大数字|单位)", type: "text" },
    { key: "ratio", label: "收尾比率(比率|小注),留空 = 不要", type: "text" },
    { key: "times", label: "四段出现秒数:点阵|红条|黄字|比率", type: "text" },
    { key: "accent", label: "强调色(红条/比率)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: DotCrowd,
};
