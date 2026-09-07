import type { EffectDef, EffectProps } from "../types";
import { PZ_ORIGIN } from "./camGeom";
import { FxVideo } from "./MediaImg";
import { ACCENT_OPTIONS, THEME_OPTIONS } from "./accent";

export interface PunchZoomParams {
  theme: "dark" | "light";
  /** 口播视频(H264):填了就把"镜头推近"直接烤进导出 */
  camSrc?: string;
  /** 推近幅度(1.15 = 放大 15%) */
  amount: number;
  /** 推向哪里(人物在画面哪侧) */
  focus: "center" | "left" | "right";
  /** 推近时长 */
  pushMs: number;
  accent: string;
  __start?: number;
}

/** 推近焦点 → transform-origin(偏上对准人物面部) */
/**
 * 镜头推近(punch-in):金句/爆点时刻镜头快推一下再定住。
 * 预览:Studio 里直接推近你导入的视频;
 * 导出:传入口播 H264(camSrc),推近画面烤进 MOV,剪映整段覆盖即可。
 * 常与 burst-halo 同窗使用(先推近,光环随后炸开)。
 */
function PunchZoom({ params }: EffectProps<PunchZoomParams>) {
  const { camSrc, amount, focus, pushMs, accent } = params;
  void accent;
  const style = {
    ["--pz-amount" as string]: amount,
    ["--pz-ms" as string]: `${pushMs}ms`,
    transformOrigin: PZ_ORIGIN[focus],
  };
  return camSrc
    ? <FxVideo className="pz-cam" src={camSrc} tStart={0} style={style} />
    : <div className="pz-cam pz-placeholder" style={style} />;
}

export const punchZoomDef: EffectDef<PunchZoomParams> = {
  id: "punch-zoom",
  name: "PunchZoom",
  description: "镜头推近 · 金句/爆点快推定住,烤进导出",
  tags: ["推近定格"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    camSrc: "",
    amount: 1.15,
    focus: "center",
    pushMs: 1400,
    accent: "blue",
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "camSrc", label: "口播视频(烤进导出)", type: "text" },
    { key: "amount", label: "推近幅度", type: "range", min: 1.05, max: 1.35, step: 0.01, unit: "×" },
    {
      key: "focus",
      label: "推向",
      type: "select",
      options: [
        { label: "居中", value: "center" },
        { label: "偏左", value: "left" },
        { label: "偏右", value: "right" },
      ],
    },
    { key: "pushMs", label: "推近时长", type: "range", min: 400, max: 4000, step: 100, unit: "ms" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
  ],
  Component: PunchZoom,
};
