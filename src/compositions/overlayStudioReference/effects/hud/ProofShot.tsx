import type { EffectDef, EffectProps } from "../types";
import { easeOutExpo, useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { MediaImg } from "./MediaImg";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface ProofShotParams {
  theme: "dark" | "light";
  position: "left" | "right" | "top-left" | "top-right";
  /** 证据图或视频片段(后台数据/评论/新闻画面);img2/img3 填了就按 stepMs 依次翻页 */
  img1: string;
  img2: string;
  img3: string;
  /** 多图翻页间隔(翻到最后一张停住) */
  stepMs: number;
  /** 认证章文字,默认 "REAL · 数据自查" */
  tag: string;
  /** 截图下方中文说明 */
  caption: string;
  /** 说明的英文小字(可空) */
  captionEn: string;
  /** 红笔标注,一行一条:「图序|line|左%|上%|宽%」或「图序|box|左%|上%|宽%|高%」 */
  marks: string;
  /** 窗口宽度(px,1920 画布):600 = 标准小窗,1400 ≈ 占满七成屏(演示录屏用) */
  w?: number;
  /** 进场方式:slide 滑入(默认)/ grow 由小放大 */
  enter?: "slide" | "grow";
  /** grow 放大时长(ms) */
  growMs?: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

/**
 * 截图实证卡:真实截图滑入 + 绿色认证章 + 双语说明。
 * "语义可视化"的核心武器——观点用真素材背书,而不是文字复述。
 * 用途:后台数据截图、评论区截图、引用他人视频画面(caption 写来源归因)。
 */
interface Mark {
  img: number;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function parseMarks(raw: string): Mark[] {
  return (raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [img = "1", kind = "line", x = "0", y = "0", w = "30", h = "10"] = l
        .split("|")
        .map((s) => s.trim());
      return {
        img: parseInt(img) || 1,
        kind,
        x: parseFloat(x) || 0,
        y: parseFloat(y) || 0,
        w: parseFloat(w) || 0,
        h: parseFloat(h) || 0,
      };
    });
}

function ProofShot({ params, playToken }: EffectProps<ProofShotParams>) {
  const { position, img1, img2, img3, stepMs, tag, caption, captionEn, marks, accent, w } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const imgs = [img1, img2, img3].filter(Boolean);
  // 多图依次翻页,翻到最后一张停住(证据序列讲完就定格)
  const idx = imgs.length > 1
    ? Math.min(Math.floor((elapsed * 1000) / Math.max(stepMs ?? 3000, 500)), imgs.length - 1)
    : 0;
  const shown = imgs[idx] ?? "";
  // 红笔标注:翻到该页后类名翻转画出(导出虚拟时间安全)
  const markIn = useEnter(idx);
  const pageMarks = parseMarks(marks).filter((m) => m.img === idx + 1);
  // grow 进出场:进场从小放大,临近 end 再从大缩小(elapsed 驱动,导出确定性)
  const grow = params.enter === "grow";
  const inSec = (params.growMs ?? 700) / 1000;
  const pAny = params as unknown as { __start?: number; __end?: number };
  const dur = typeof pAny.__end === "number" ? pAny.__end - (pAny.__start ?? 0) : null;
  const outSec = Math.min(0.6, inSec);
  const kIn = easeOutExpo(Math.min(1, elapsed / inSec));
  const kOut = dur != null ? easeOutExpo(Math.max(0, Math.min(1, (dur - elapsed) / outSec))) : 1;
  const gk = Math.min(kIn, kOut);
  const growScale = grow ? 0.25 + 0.75 * gk : 1;

  return (
    <div
      className={`hud psh hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--psh-w" as string]: `${w ?? 600}px`,
        ...offsetVars(params),
      }}
    >
      <div
        className="psh-box"
        style={grow ? { transform: `scale(${growScale.toFixed(3)})`, opacity: Math.min(1, gk * 2).toFixed(2), transformOrigin: "50% 100%" } : undefined}
      >
        <div className="psh-frame">
          {shown ? (
            <MediaImg key={idx} src={shown} className="psh-img" tStart={params.__start} />
          ) : (
            <div className="psh-empty">证据素材</div>
          )}
          {pageMarks.map((m, i) => (
            <i
              key={`${idx}-${i}`}
              className={`psh-mark psh-mark--${m.kind === "box" ? "box" : "line"} ${markIn ? "is-on" : ""}`}
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: `${m.w}%`,
                ...(m.kind === "box" ? { height: `${m.h}%` } : {}),
                transitionDelay: `${550 + i * 350}ms`,
              }}
            />
          ))}
          {tag && (
            <span className="psh-tag">
              <i>✓</i>
              {tag}
            </span>
          )}
        </div>
        {caption && <div className="psh-cap">{caption}</div>}
        {captionEn && <div className="psh-cap-en">{captionEn}</div>}
      </div>
    </div>
  );
}

export const proofShotDef: EffectDef<ProofShotParams> = {
  id: "proof-shot",
  vTier: "half",
  name: "ProofShot",
  description: "截图实证 · 真实截图 + 认证章,用素材背书",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "top-right",
    img1: "",
    img2: "",
    img3: "",
    stepMs: 3000,
    tag: "REAL · 角标写定性",
    caption: "图注写截图是什么、哪来的",
    captionEn: "SOURCE · EN NOTE",
    marks: "",
    enter: "slide",
    growMs: 700,
    w: 600,
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
        { label: "右侧", value: "right" },
        { label: "左上", value: "top-left" },
        { label: "右上", value: "top-right" },
      ],
    },
    { key: "img1", label: "证据图/视频 1", type: "text" },
    { key: "img2", label: "证据图/视频 2(可空,依次翻页)", type: "text" },
    { key: "img3", label: "证据图/视频 3(可空)", type: "text" },
    { key: "stepMs", label: "翻页间隔(卡点用)", type: "range", min: 1000, max: 8000, step: 100, unit: "ms" },
    { key: "tag", label: "认证章(空 = 不显示)", type: "text" },
    { key: "caption", label: "中文说明/来源归因", type: "text" },
    { key: "captionEn", label: "英文小字(可空)", type: "text" },
    {
      key: "marks",
      label: "红笔标注(一行一条:图序|line|左%|上%|宽% 或 图序|box|左%|上%|宽%|高%,翻到该页才画)",
      type: "textarea",
      rows: 2,
    },
    {
      key: "enter",
      label: "进场方式",
      type: "select",
      options: [
        { label: "滑入", value: "slide" },
        { label: "由小放大", value: "grow" },
      ],
    },
    { key: "growMs", label: "放大时长", type: "range", min: 300, max: 2000, step: 50, unit: "ms" },
    { key: "w", label: "窗口宽度(px)", type: "range", min: 480, max: 1560, step: 20, unit: "px" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: ProofShot,
};
