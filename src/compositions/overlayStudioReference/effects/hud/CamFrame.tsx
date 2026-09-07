import type { EffectDef, EffectProps } from "../types";
import { camFrameGeom } from "./camGeom";
import { useStageRatio } from "../../stage";
import { useEnter } from "../useAnimation";
import { FxVideo } from "./MediaImg";
import { ACCENT_OPTIONS, ACCENT_VAR } from "./accent";

export interface CamFrameParams {
  theme: "dark" | "light";
  /** 取景形状:circle 圆 · portrait 3:4 竖框 · square 圆角方 */
  shape: "circle" | "portrait" | "square";
  /** 落位:画面左侧 / 右侧 */
  side: "left" | "right";
  /** 框宽(px),高度按形状自动算 */
  size: number;
  /** 落位微调 */
  camDX: number;
  camDY: number;
  /** 描边:框边一圈强调色 */
  ring: boolean;
  /** 口播视频(H264):填了就烤进导出;预览走 PIP 用导入的那条 */
  camSrc?: string;
  accent: string;
  __start?: number;
}

/**
 * 取景框几何:预览的 PIP 和导出烤入的视频共用这一份计算,
 * 两边永远对得上(改一处就够,不会出现"预览是圆的导出是方的")。
 */

/**
 * 人物取景框:把整块 A-Roll 收成一个圆 / 3:4 竖框 / 圆角方,挪到画面左边或右边,
 * 另一半空出来给内容卡。讲"流程/清单/结构"这种需要大块版面的段落时用。
 *
 * 预览走 PIP(直接搬你导入的那条口播,所见即所得);导出时如果填了「口播视频」
 * 就把画面烤进透明层——那一段在剪映里要把原始口播轨盖掉,否则会看到两层人。
 */
function CamFrame({ params, playToken }: EffectProps<CamFrameParams>) {
  const { ring, camSrc, accent } = params;
  const entered = useEnter(playToken);
  const g = camFrameGeom(params, useStageRatio());

  return (
    <div
      className={`hud cfr ${entered ? "is-in" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ["--cfr-x" as string]: `${g.x}px`,
        ["--cfr-y" as string]: `${g.y}px`,
        ["--cfr-w" as string]: `${g.w}px`,
        ["--cfr-h" as string]: `${g.h}px`,
        ["--cfr-r" as string]: `${g.r}px`,
      }}
    >
      {/* 烤入导出:满屏起步 → 收进取景框,和预览的 PIP 走同一份几何 */}
      {camSrc ? <FxVideo className="cfr-cam" src={camSrc} tStart={0} /> : <div className="cfr-cam cfr-placeholder" />}
      {ring && <div className="cfr-ring" />}
    </div>
  );
}

export const camFrameDef: EffectDef<CamFrameParams> = {
  id: "cam-frame",
  name: "CamFrame",
  description: "人物取景框 · A-Roll 收成圆/3:4竖框/圆角方并挪到一侧,另一半留给内容",
  tags: ["取景重构"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    shape: "circle",
    side: "left",
    size: 520,
    camDX: 0,
    camDY: 0,
    ring: true,
    camSrc: "",
    accent: "blue",
  },
  controls: [
    {
      key: "shape",
      label: "取景形状",
      type: "select",
      options: [
        { label: "圆", value: "circle" },
        { label: "3:4 竖框(人物)", value: "portrait" },
        { label: "圆角方", value: "square" },
      ],
    },
    {
      key: "side",
      label: "落位",
      type: "select",
      options: [
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "size", label: "框宽", type: "range", min: 260, max: 900, step: 10, unit: "px" },
    { key: "camDX", label: "横向微调", type: "range", min: -400, max: 400, step: 5, unit: "px" },
    { key: "camDY", label: "纵向微调", type: "range", min: -300, max: 300, step: 5, unit: "px" },
    { key: "ring", label: "描边", type: "toggle" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    { key: "camSrc", label: "口播视频(烤进导出)", type: "text" },
  ],
  Component: CamFrame,
};
