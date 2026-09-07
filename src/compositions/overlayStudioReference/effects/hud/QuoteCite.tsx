import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface QuoteCiteParams {
  theme: "dark" | "light";
  position: "left" | "right";
  media: "none" | "image" | "video";
  quote: string;
  avatar: string; // 头像占位(一个字/emoji;传了 img1 时不用)
  img1: string; // 真头像图片(Twitter 头像等,右栏上传;优先于文字占位)
  author: string;
  source: string;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

function QuoteCite({ params, playToken }: EffectProps<QuoteCiteParams>) {
  const { theme, position, media, quote, avatar, img1, author, source, accent } = params;
  void theme;
  const entered = useEnter(playToken);
  // 没有引用内容 = 人物介绍模式:只剩头像 + 名字 + 身份,整体放大一档
  const intro = !quote?.trim();

  return (
    <div
      className={`hud qc hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className={`qc-card hud-glass ${intro ? "qc-card--intro" : ""}`}>
        {media !== "none" && (
          <div className="qc-media">{media === "video" ? "▶" : "🖼"}</div>
        )}
        {!intro && (
          <>
            <div className="qc-mark">&ldquo;</div>
            <div className="qc-text">{quote}</div>
          </>
        )}
        <div className="qc-foot">
          {img1 ? (
            <img
              className="qc-avatar qc-avatar--img"
              src={img1}
              alt=""
              /* 刚上传完的文件偶发第一次请求落空:自动重试(与 proof-shot 一致) */
              onError={(e) => {
                const im = e.currentTarget;
                const n = Number(im.dataset.retry || 0);
                if (n < 3) {
                  im.dataset.retry = String(n + 1);
                  setTimeout(() => {
                    im.src = `${img1}${img1.includes("?") ? "&" : "?"}r=${n + 1}`;
                  }, 400);
                }
              }}
            />
          ) : (
            <div className="qc-avatar">{avatar}</div>
          )}
          <div className="qc-who">
            <span className="qc-author">{author}</span>
            {source && <span className="qc-source">{source}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export const quoteCiteDef: EffectDef<QuoteCiteParams> = {
  id: "quote-cite",
  vTier: "half",
  name: "QuoteCite",
  description: "引用卡 · 引用他人话/图/视频 + 来源",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "right",
    media: "none",
    quote: "引用谁的话,原文放这里。",
    avatar: "名",
    img1: "",
    author: "被引用的人",
    source: "身份头衔 · 内容出处",
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
        { label: "右侧", value: "right" },
        { label: "左侧", value: "left" },
      ],
    },
    {
      key: "media",
      label: "配图/视频",
      type: "select",
      options: [
        { label: "只引用话", value: "none" },
        { label: "带图片占位", value: "image" },
        { label: "带视频占位", value: "video" },
      ],
    },
    { key: "quote", label: "引用的话(空 = 纯人物介绍)", type: "text" },
    { key: "img1", label: "头像图片(Twitter 头像等)", type: "text" },
    { key: "avatar", label: "头像占位(没传图时用,字/emoji)", type: "text" },
    { key: "author", label: "作者", type: "text" },
    { key: "source", label: "来源/头衔", type: "text" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: QuoteCite,
};
