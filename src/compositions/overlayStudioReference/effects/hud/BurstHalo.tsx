import type { EffectDef, EffectProps } from "../types";
import { useElapsed, useEnter } from "../useAnimation";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface BurstHaloParams {
  theme: "dark" | "light";
  /** 爆点大字,如 "哈哈哈哈!"(空 = 只要光环) */
  text: string;
  /** 光环+放射线(关掉 = 只留仪表方块) */
  showRing?: boolean;
  /** 左上角仪表小卡 */
  showMeter: boolean;
  meterEn: string;
  meterZh: string;
  /** 仪表百分比(滚动计数到这里) */
  pct: number;
  accent: string;
  /** 仪表小卡的独立落位(相对它的默认位置):让它能和光环分开摆 */
  meterX?: number;
  meterY?: number;
  offsetX?: number;
  offsetY?: number;
}

const SPOKES = Array.from({ length: 12 }, (_, i) => i * 30);

/**
 * 爆点光环:直接"碰"人物的效果——光环+放射线锚定在人物身上,
 * 配笑点/爆点/高能时刻。
 * 用法:卡片挂在爆点句上(2-3s),拖动卡片让光环套住人物上半身。
 */
function BurstHalo({ params, playToken }: EffectProps<BurstHaloParams>) {
  const { text, showMeter, meterEn, meterZh, pct, accent } = params;
  const showRing = params.showRing ?? true;
  const entered = useEnter(playToken);

  // 仪表百分比滚动(600ms 后开始,1s 内到位);
  // useElapsed 吃倍速且在导出虚拟时间下走对拍
  const target = Number(pct) || 0;
  const ms = useElapsed(playToken, 1700);
  const p = Math.min(1, Math.max(0, (ms - 600) / 1000));
  const n = Math.round(target * (1 - Math.pow(1 - p, 3)));

  return (
    <div
      className={`hud bhl ${entered ? "is-in" : ""}`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      {showRing && (
        <div className="bhl-core">
          <i className="bhl-ring bhl-r1" />
          <i className="bhl-ring bhl-r2" />
          {SPOKES.map((deg, i) => (
            <i
              className="bhl-spoke"
              key={deg}
              style={{
                transform: `rotate(${deg}deg) translateY(-330px)`,
                animationDelay: `${(i % 4) * 140}ms`,
              }}
            />
          ))}
        </div>
      )}
      {text && <div className="bhl-text">{text}</div>}
      {showMeter && (
        <div
          className="bhl-meter"
          data-drag-x="meterX"
          data-drag-y="meterY"
          style={{
            left: -620 + (Number(params.meterX) || 0),
            top: -260 + (Number(params.meterY) || 0),
          }}
        >
          <div className="bhl-meter-en">
            {meterEn}
            <i className="bhl-live">LIVE</i>
          </div>
          <div className="bhl-bars">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
          <div className="bhl-meter-zh">
            {meterZh}
            <b>{n}%</b>
          </div>
        </div>
      )}
    </div>
  );
}

export const burstHaloDef: EffectDef<BurstHaloParams> = {
  id: "burst-halo",
  vTier: "half",
  name: "BurstHalo",
  description: "爆点光环 · 光环+放射线锚定人物,笑点必炸",
  tags: ["光效发光"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    text: "笑点那句话",
    showRing: true,
    showMeter: true,
    meterEn: "PUNCH · DETECTED",
    meterZh: "爆发点已锁定",
    pct: 97,
    accent: "blue",
    meterX: 0,
    meterY: 0,
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    { key: "text", label: "爆点大字(空 = 只要光环)", type: "text" },
    { key: "showRing", label: "光环+放射线", type: "toggle" },
    { key: "showMeter", label: "爆点仪表小卡", type: "toggle" },
    { key: "meterEn", label: "仪表 kicker(英文)", type: "text" },
    { key: "meterZh", label: "仪表中文", type: "text" },
    { key: "pct", label: "锁定百分比", type: "range", min: 50, max: 100, step: 1, unit: "%" },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    { key: "meterX", label: "仪表小卡 水平(也可直接拖它)", type: "range", min: -900, max: 900, step: 10, unit: "px" },
    { key: "meterY", label: "仪表小卡 垂直", type: "range", min: -700, max: 700, step: 10, unit: "px" },
    ...OFFSET_CONTROLS,
  ],
  Component: BurstHalo,
};
