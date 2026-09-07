import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { MediaImg } from "./MediaImg";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface CoverStackParams {
  theme: "dark" | "light";
  position: "left" | "right";
  /** 封面画幅:wide 横版缩略 / tall 竖版完整(3:4 封面用) */
  shape?: "wide" | "tall";
  img1: string;
  cap1: string;
  img2: string;
  cap2: string;
  stepMs: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const IS_EXPORT =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("export") === "1";

/**
 * 封面叠放卡:提到"前几期视频/某篇文章"时,封面缩略图从侧边滑入竖着叠放,
 * 人保持全屏。图片用右栏「选择图片」上传(存 public/demo/)。
 */
function CoverStack({ params, playToken }: EffectProps<CoverStackParams>) {
  const { position, img1, cap1, img2, cap2, stepMs, accent } = params;
  const tall = params.shape === "tall";
  const entered = useEnter(playToken);
  const items = [
    { src: img1, cap: cap1 },
    { src: img2, cap: cap2 },
  ].filter((it) => it.src || it.cap);

  return (
    <div
      className={`hud cvs ${tall ? "cvs--tall" : ""} hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      <div className="cvs-col">
        {items.length === 0 && !IS_EXPORT && (
          <div className="cvs-item">
            <div className="cvs-thumb cvs-thumb-empty">封面素材</div>
          </div>
        )}
        {items.map((it, i) => (
          <div
            className="cvs-item"
            key={i}
            style={{ transitionDelay: `${i * stepMs}ms` }}
          >
            <div className="cvs-thumb">
              {it.src ? (
                <MediaImg src={it.src} tStart={params.__start} />
              ) : (
                <div className="cvs-thumb-empty">封面素材</div>
              )}
            </div>
            {it.cap && (
              <div className="cvs-cap">
                <span className="cvs-cap-bar" />
                {it.cap}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const coverStackDef: EffectDef<CoverStackParams> = {
  id: "cover-stack",
  name: "CoverStack",
  description: "封面叠放 · 引用往期/文章,缩略图侧滑入",
  tags: ["堆叠累积"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    shape: "wide",
    img1: "",
    cap1: "往期视频 · 标注放这里",
    img2: "",
    cap2: "",
    stepMs: 280,
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
      ],
    },
    {
      key: "shape",
      label: "封面画幅",
      type: "select",
      options: [
        { label: "横版缩略", value: "wide" },
        { label: "竖版完整(3:4)", value: "tall" },
      ],
    },
    { key: "img1", label: "封面图 1", type: "text" },
    { key: "cap1", label: "标注 1", type: "text" },
    { key: "img2", label: "封面图 2(可空)", type: "text" },
    { key: "cap2", label: "标注 2(可空)", type: "text" },
    { key: "stepMs", label: "每张间隔", type: "range", min: 100, max: 3000, step: 20, unit: "ms" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: CoverStack,
};
