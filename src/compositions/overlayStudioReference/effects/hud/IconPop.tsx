import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { imgRetry } from "./imgRetry";
import { OFFSET_CONTROLS, OFFSET_DEFAULTS, offsetVars } from "./accent";

export interface IconPopParams {
  img1?: string;
  position: "left" | "right";
  /** 图标边长(px) */
  size?: number;
  /** 漂浮幅度(0 = 不漂) */
  bob?: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * App 图标弹出:提到某个应用/产品时,大号圆角图标
 * 在人物头旁"啵"地弹出来,轻轻上下漂——比文字念名字直观得多。
 * 传 App 图标图(方形),自动切圆角+投影。
 */
function IconPop({ params, playToken }: EffectProps<IconPopParams>) {
  const entered = useEnter(playToken);
  const { img1, position, size, bob } = params;
  const src = img1?.trim();
  const s = size ?? 260;

  return (
    <div
      className={`hud icp icp--${position} ${entered ? "is-in" : ""}`}
      style={{ ["--icp-amp" as string]: `${bob ?? 8}px`, ...offsetVars(params) }}
    >
      <div className="icp-card" style={{ width: s, height: s }}>
        {src ? (
          <img src={src} alt="" onError={imgRetry(src)} />
        ) : (
          <span className="icp-empty">传 App 图标(方图)</span>
        )}
      </div>
    </div>
  );
}

export const iconPopDef: EffectDef<IconPopParams> = {
  id: "icon-pop",
  name: "IconPop",
  description: "App 图标弹出 · 大圆角图标在头旁弹出轻漂",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    img1: "",
    position: "left",
    size: 260,
    bob: 8,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "img1", label: "App 图标(方形图)", type: "text" },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "头左侧", value: "left" },
        { label: "头右侧", value: "right" },
      ],
    },
    { key: "size", label: "图标大小", type: "range", min: 120, max: 460, step: 10, unit: "px" },
    { key: "bob", label: "漂浮幅度(0 = 不漂)", type: "range", min: 0, max: 24, step: 1, unit: "px" },
    ...OFFSET_CONTROLS,
  ],
  Component: IconPop,
};
