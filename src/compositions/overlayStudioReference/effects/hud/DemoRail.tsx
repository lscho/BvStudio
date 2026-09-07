import type { EffectDef, EffectProps } from "../types";
import { easeOutExpo } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { FxVideo, isVideoSrc } from "./MediaImg";
import { useVideoDurs } from "./videoDur";
import { imgRetry } from "./imgRetry";
import { hasVecIcon, VecIcon } from "./vecIcons";
import { ACCENT_OPTIONS, ACCENT_VAR, THEME_OPTIONS } from "./accent";
import { useStageRatio, useStageSize } from "../../stage";

export interface DemoRailParams {
  theme: "dark" | "light";
  /** 场号(SCENE 01);空 = 不显示 */
  scene: string;
  /** 场号下的中文小字 */
  sceneZh: string;
  /** 左侧步骤链,一行一步:「中文 | EN 小字 | 图标名(可空)」 */
  steps: string;
  /** 每步点亮时刻(秒,距卡片 start,| 分隔;按你讲到那一步的时刻填) */
  times: string;
  /** 录屏路径(/demo/xxx.mp4)或截图;空 = 占位框 */
  videoSrc: string;
  /** 素材从第几秒开始播 */
  clipStart: number;
  /** 第 2 / 3 段录屏:填了就在同一个窗里接着播(拼成一条演示) */
  videoSrc2?: string;
  clipStart2?: number;
  videoSrc3?: string;
  clipStart3?: number;
  /** 每段各播多少秒,逗号分隔(如 3,4,3);留空 = 每段按素材自己的时长播完就换下一段 */
  segSecs?: string;
  /** 录屏播放倍速:长录屏塞进短窗口时用(1.5 / 2 / 3 …) */
  vidRate?: number;
  /** 录屏窗 3D 倾斜(度) */
  tilt: number;
  /** 录屏窗宽度(px,1920 画布):拉大就盖得更满 */
  winW: number;
  /** 录屏窗的画幅比例:要和你的录屏一致,否则不是裁掉就是留黑边 */
  winAspect: "16/9" | "16/10" | "3/2" | "4/3" | "1/1" | "9/16";
  /** 画面怎么塞进窗口:contain 完整显示(留边) · cover 填满(会裁切) */
  fit: "contain" | "cover";
  /** 录屏窗位置微调(px):也可以直接在画布上拖这个窗 */
  winX: number;
  winY: number;
  /** 编号样式:数字圆圈 / 只有图标 */
  bullet: "num" | "icon";
  /** 分段变焦:一行「起秒|焦点X%|焦点Y%|倍率|过渡秒」 */
  zooms?: string;
  /** 底部字幕安全区(%画面高) */
  safeBottom: number;
  /** 全屏底(盖住原片) */
  bg: "dark" | "none";
  accent: string;
}

interface Step {
  zh: string;
  en: string;
  icon: string;
}

function parseSteps(raw: string): Step[] {
  return (raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => {
      const [zh = "", en = "", icon = ""] = l.split("|").map((s) => s.trim());
      return { zh, en, icon };
    });
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * 多段录屏接力:把填了的几段排成一条时间线,算出此刻该播第几段、那一段是从卡片
 * 的第几秒开始的。段起点要回传,因为导出是按"素材第几秒"逐帧取图的 —— 第二段
 * 必须从它自己的 0 秒(或 clipStart)重新起算,不能接着第一段数。
 *
 * 每段占多久:优先用手填的「每段各播几秒」;没填就用**素材自己的可播时长**
 * (减掉起播秒、除以倍速)—— 均分会让短素材在自己那一格里反复循环好几遍才换下一段。
 * 素材时长还没探到(预览刚打开那一瞬)才退回均分。
 * 整条链播完会从第一段重新开始,所以 at 里带上"第几轮"的偏移。
 */
function pickSeg(
  elapsed: number,
  srcs: string[],
  segSecs: string,
  total: number,
  vidDurs: number[],
  clips: unknown[],
  rate: number,
) {
  const parsed = (segSecs ?? "")
    .split(/[,,|\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  const even = total / Math.max(1, srcs.length);
  const durs = srcs.map((_, i) => {
    if (parsed[i] > 0) return parsed[i];
    const playable = (vidDurs[i] ?? 0) - (Number(clips[i]) || 0);
    return playable > 0.3 ? playable / rate : even;
  });
  const chain = durs.reduce((a, b) => a + b, 0);
  const lap = chain > 0.3 ? Math.floor(elapsed / chain) * chain : 0;
  const e = elapsed - lap;
  let at = 0;
  for (let i = 0; i < durs.length; i++) {
    if (e < at + durs[i] || i === durs.length - 1) return { i, at: lap + at };
    at += durs[i];
  }
  return { i: 0, at: lap };
}

/**
 * 演示轨:录屏窗靠右 3D 微倾,
 * 左侧一条编号竖线步骤链(①②③),讲到哪一步哪一步点亮、连线注水。
 * 录屏窗大小用「录屏窗放大」滑杆调,位置直接在画布上拖它。
 * 用途:演示自己的软件/工作流——观众左边看步骤、右边看真画面,
 * 比"整块录屏铺满"更容易跟上。独占全屏,勿与其他卡同屏。
 */

/** 分段变焦:一行一段「起秒|焦点X%|焦点Y%|倍率|过渡秒」,顺序生效 */
function zoomState(zooms: string | undefined, elapsed: number, ease: (t: number) => number) {
  let zx = 50, zy = 50, zk = 1;
  for (const line of (zooms ?? "").split(/[\n;]/)) {
    const seg = line.trim();
    if (!seg) continue;
    const [t, x, y, k, d] = seg.split("|").map((s) => parseFloat(s.trim()));
    if (!Number.isFinite(t) || elapsed < t) continue;
    const f = ease(Math.max(0, Math.min(1, (elapsed - t) / Math.max(0.1, d || 0.7))));
    zx += ((Number.isFinite(x) ? x : 50) - zx) * f;
    zy += ((Number.isFinite(y) ? y : 50) - zy) * f;
    zk += ((Number.isFinite(k) ? k : 1) - zk) * f;
  }
  return { zx, zy, zk };
}

function DemoRail({ params, playToken }: EffectProps<DemoRailParams>) {
  const { w: STAGE_W } = useStageSize();
  const V = useStageRatio() === "v";
  const elapsed = useCardElapsed(params, playToken);
  const { scene, sceneZh, videoSrc, clipStart, tilt, winW, winAspect, fit, winX, winY, bullet, safeBottom, bg, accent } =
    params;
  // 多段录屏:填了几段就在同一个窗里按顺序接力播
  const p = params;
  const srcs = [videoSrc, p.videoSrc2, p.videoSrc3]
    .map((x: unknown) => String(x ?? "").trim())
    .filter(Boolean);
  const clips = [clipStart, p.clipStart2, p.clipStart3];
  const total = Math.max(0.5, (p.__end ?? 0) - (p.__start ?? 0) || 8);
  const rate = Number(p.vidRate) || 1;
  const vidDurs = useVideoDurs(srcs);
  const seg = pickSeg(elapsed, srcs, p.segSecs ?? "", total, vidDurs, clips, rate);
  const segSrc = srcs[seg.i] ?? "";
  const segClip = Number(clips[seg.i]) || 0;
  const steps = parseSteps(params.steps);
  const times = (params.times ?? "")
    .split("|")
    .map((s) => parseFloat(s.trim()))
    .filter((v) => Number.isFinite(v));
  const at = (i: number) => (times[i] != null ? times[i] : 0.6 + i * 1.6);
  const safe = Math.max(0, Math.min(25, safeBottom));
  // 连线注水:走到最后一个已点亮的步骤
  const zm = zoomState(p.zooms, elapsed, easeOutExpo);
  const lit = steps.reduce((acc, _s, i) => (elapsed >= at(i) ? i : acc), -1);
  const railP = steps.length > 1 ? clamp01((lit + 1) / steps.length) : 1;

  return (
    <div
      className="hud dmr"
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--dmr-safe" as string]: `${safe}%`,
        ["--dmr-tilt" as string]: `${tilt}deg`,
      }}
    >
      {bg !== "none" && (
        <div className="dmr-backdrop" style={{ opacity: clamp01((elapsed + 0.2) / 0.5) }} />
      )}

      <div className="dmr-left">
        {(scene || sceneZh) && (
          <div className="dmr-scene" style={{ opacity: clamp01(elapsed / 0.5) }}>
            {scene && <b>{scene}</b>}
            {sceneZh && <i>{sceneZh}</i>}
          </div>
        )}
        <div className="dmr-rail">
          <span className="dmr-line" />
          <span className="dmr-line-fill" style={{ height: `${railP * 100}%` }} />
          {steps.map((s, i) => {
            const on = elapsed >= at(i);
            const p = clamp01((elapsed - at(i) + 0.35) / 0.5);
            return (
              <div key={i} className={`dmr-step ${on ? "is-on" : ""}`} style={{ opacity: p }}>
                <span className="dmr-bullet">
                  {bullet === "icon" && s.icon && hasVecIcon(s.icon) ? (
                    <VecIcon name={s.icon} size={20} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span className="dmr-txt">
                  <b>{s.zh}</b>
                  {s.en && <i>{s.en}</i>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="dmr-win"
        data-drag-x="winX"
        data-drag-y="winY"
        data-fit={fit ?? "contain"}
        style={{
          opacity: clamp01((elapsed - 0.15) / 0.6),
          width: `${V && (winW || 1180) === 1180 ? STAGE_W - 96 : winW || 1180}px`,
          aspectRatio: (winAspect ?? "16/9").replace("/", " / "),
          transform: `translate(${winX || 0}px, ${winY || 0}px) perspective(2400px) rotateY(${-(tilt || 0)}deg) rotateX(1.4deg)`,
        }}
      >
        <div
          className="dmr-zoom"
          style={{ transform: `scale(${zm.zk.toFixed(3)})`, transformOrigin: `${zm.zx.toFixed(1)}% ${zm.zy.toFixed(1)}%` }}
        >
        {segSrc ? (
          isVideoSrc(segSrc) ? (
            /* key=段号:换段时整个换掉 <video>,新的一段从自己的 clipStart 重新起播 */
            <FxVideo
              key={seg.i}
              src={segSrc}
              tStart={(params.__start ?? 0) + seg.at}
              clipStart={segClip}
              rate={rate}
              loop
            />
          ) : (
            <img src={segSrc} alt="" onError={imgRetry(segSrc)} />
          )
        ) : (
          <div className="dmr-empty">录屏片段</div>
        )}
        </div>
        {/* 两段以上才出:告诉观众这是拼接的几段,现在在第几段 */}
        {srcs.length > 1 && (
          <span className="dmr-segs">
            {srcs.map((_, i) => (
              <i key={i} className={i === seg.i ? "is-on" : ""} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export const demoRailDef: EffectDef<DemoRailParams> = {
  id: "demo-rail",
  name: "DemoRail",
  description: "演示轨 · 录屏靠右微倾 + 左侧编号步骤链逐步点亮",
  tags: ["3D 浮屏", "逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    scene: "",
    sceneZh: "",
    steps: "",
    times: "",
    videoSrc: "",
    clipStart: 0,
    tilt: 6,
    videoSrc2: "",
    clipStart2: 0,
    videoSrc3: "",
    clipStart3: 0,
    segSecs: "",
    vidRate: 1,
    winW: 1180,
    winAspect: "16/9",
    fit: "contain",
    winX: 0,
    winY: 0,
    bullet: "num",
    zooms: "",
    safeBottom: 12,
    bg: "dark",
    accent: "blue",
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "scene", label: "场号(SCENE 01)", type: "text" },
    { key: "sceneZh", label: "场号中文小字", type: "text" },
    { key: "steps", label: "步骤(一行一步:中文|EN|图标名)", type: "textarea" },
    { key: "times", label: "每步点亮秒(| 分隔)", type: "text" },
    { key: "videoSrc", label: "录屏路径(/demo/xxx.mp4)", type: "text" },
    { key: "clipStart", label: "素材起始秒", type: "range", min: 0, max: 300, step: 1, unit: "s" },
    { key: "videoSrc2", label: "第 2 段录屏(可空)", type: "text" },
    { key: "clipStart2", label: "第 2 段从第几秒开始播", type: "range", min: 0, max: 600, step: 1, unit: "s" },
    { key: "videoSrc3", label: "第 3 段录屏(可空)", type: "text" },
    { key: "clipStart3", label: "第 3 段从第几秒开始播", type: "range", min: 0, max: 600, step: 1, unit: "s" },
    { key: "segSecs", label: "每段各播几秒(逗号分隔,如 3,4,3;留空=素材播完就换下一段)", type: "text" },
    {
      key: "vidRate",
      label: "录屏播放倍速",
      type: "select",
      options: [
        { label: "1× 原速", value: "1" },
        { label: "1.25×", value: "1.25" },
        { label: "1.5×", value: "1.5" },
        { label: "2×", value: "2" },
        { label: "3×", value: "3" },
        { label: "4×", value: "4" },
      ],
    },
    { key: "tilt", label: "录屏窗倾斜(度)", type: "range", min: 0, max: 14, step: 1, unit: "°" },
    { key: "winW", label: "录屏窗放大(宽度 px)", type: "range", min: 700, max: 1900, step: 20, unit: "px" },
    {
      key: "winAspect",
      label: "录屏画幅(和你的录屏对齐)",
      type: "select",
      options: [
        { label: "16:9(常见录屏)", value: "16/9" },
        { label: "16:10(Mac 全屏)", value: "16/10" },
        { label: "3:2", value: "3/2" },
        { label: "4:3", value: "4/3" },
        { label: "1:1 方", value: "1/1" },
        { label: "9:16 竖", value: "9/16" },
      ],
    },
    {
      key: "fit",
      label: "画面怎么塞进窗口",
      type: "select",
      options: [
        { label: "完整显示(留边,不裁)", value: "contain" },
        { label: "填满(会裁掉边上)", value: "cover" },
      ],
    },
    { key: "winX", label: "录屏窗横移(px)", type: "range", min: -900, max: 400, step: 10, unit: "px" },
    { key: "winY", label: "录屏窗纵移(px)", type: "range", min: -200, max: 400, step: 10, unit: "px" },
    {
      key: "bullet",
      label: "步骤编号样式",
      type: "select",
      options: [
        { label: "数字圆圈", value: "num" },
        { label: "图标", value: "icon" },
      ],
    },
    {
      key: "safeBottom",
      label: "底部字幕安全区(%)",
      type: "range",
      min: 0,
      max: 25,
      step: 1,
      unit: "%",
    },
    {
      key: "bg",
      label: "全屏底",
      type: "select",
      options: [
        { label: "暗底(盖住原片)", value: "dark" },
        { label: "透明(透出原片)", value: "none" },
      ],
    },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
  ],
  Component: DemoRail,
};
