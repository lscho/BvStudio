import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { MediaImg } from "./MediaImg";
import { OFFSET_CONTROLS, OFFSET_DEFAULTS, offsetVars } from "./accent";

export interface PhotoHaloParams {
  img1?: string;
  img2?: string;
  img3?: string;
  img4?: string;
  img5?: string;
  img6?: string;
  /** 逐张弹入间隔 */
  stepMs?: number;
  /** 绕人公转一圈的秒数(0 = 不转) */
  orbitSec?: number;
  /** 原地摆动幅度(px,0 = 不摆) */
  bob?: number;
  offsetX?: number;
  offsetY?: number;
}

/** 六张卡的基准角(均分一圈)+ 各自宽度/歪斜 */
const SLOTS = [
  { a0: -2.62, w: 250, r: -6 },
  { a0: -1.57, w: 220, r: 4 },
  { a0: -0.52, w: 235, r: -3 },
  { a0: 0.52, w: 235, r: 5 },
  { a0: 1.57, w: 240, r: -5 },
  { a0: 2.62, w: 225, r: 6 },
];

/**
 * 照片环绕(素材光环):最多 6 张圆角照片绕着人物缓缓公转
 * (椭圆轨道,转到下方近、转到上方远,近大远小),外加轻微摆动——
 * 一堆素材/案例/截图"集体亮相"的开场时刻。
 * 人物会被部分卡片盖住:配合剪映"智能抠像"把人叠回最上层,
 * 就是"照片绕着人转"的效果(和终端背景板同一打法)。
 */
function PhotoHalo({ params, playToken }: EffectProps<PhotoHaloParams>) {
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken); // 秒
  const { stepMs, orbitSec, bob } = params;
  const imgs = [params.img1, params.img2, params.img3, params.img4, params.img5, params.img6];
  const step = stepMs ?? 260;
  const spin =
    orbitSec && orbitSec > 0 ? (elapsed / orbitSec) * Math.PI * 2 : 0;
  const amp = bob ?? 10;

  return (
    <div className={`hud pho ${entered ? "is-in" : ""}`} style={offsetVars(params)}>
      {SLOTS.map((s, i) => {
        const src = imgs[i]?.trim();
        const a = s.a0 + spin;
        // 椭圆轨道:人物在中心;下方(sin>0)近、上方远 → 近大远小
        const x = 50 + 41 * Math.cos(a);
        const y = 56 + 30 * Math.sin(a);
        const depth = (Math.sin(a) + 1) / 2; // 0 远(上) → 1 近(下)
        const wob = amp ? Math.sin(elapsed * 1.4 + i * 2.1) * amp : 0;
        return (
          <div
            className="pho-slot"
            key={i}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: s.w,
              zIndex: Math.round(10 + depth * 10),
              transform: `translate(-50%, -50%) translateY(${wob.toFixed(1)}px) rotate(${s.r}deg) scale(${(0.8 + 0.28 * depth).toFixed(3)})`,
            }}
          >
            <div className="pho-card" style={{ transitionDelay: entered ? `${i * step}ms` : "0ms" }}>
              {src ? (
                <MediaImg src={src} tStart={params.__start} />
              ) : (
                <span className="pho-empty">图 {i + 1}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const photoHaloDef: EffectDef<PhotoHaloParams> = {
  id: "photo-halo",
  name: "PhotoHalo",
  description: "照片环绕 · 一圈素材卡绕人物缓缓公转(配抠像在人身后)",
  tags: ["聚散飞行"],
  selfPosition: true,
  defaults: {
    img1: "",
    img2: "",
    img3: "",
    img4: "",
    img5: "",
    img6: "",
    stepMs: 260,
    orbitSec: 36,
    bob: 10,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "img1", label: "照片 1(空 = 该槽不显示)", type: "text" },
    { key: "img2", label: "照片 2", type: "text" },
    { key: "img3", label: "照片 3", type: "text" },
    { key: "img4", label: "照片 4", type: "text" },
    { key: "img5", label: "照片 5", type: "text" },
    { key: "img6", label: "照片 6", type: "text" },
    { key: "stepMs", label: "逐张弹入间隔", type: "range", min: 0, max: 1200, step: 20, unit: "ms" },
    { key: "orbitSec", label: "公转一圈秒数(0 = 不转)", type: "range", min: 0, max: 90, step: 2, unit: "s" },
    { key: "bob", label: "摆动幅度(0 = 不摆)", type: "range", min: 0, max: 30, step: 1, unit: "px" },
    ...OFFSET_CONTROLS,
  ],
  Component: PhotoHalo,
};
