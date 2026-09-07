import type { CSSProperties } from "react";
import type { EffectDef, EffectProps } from "../types";
import { easeOutExpo, useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { hasVecIcon, VecIcon } from "./vecIcons";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface ClipFlowParams {
  theme: "dark" | "light";
  position: "left" | "right" | "center";
  /** conveyor 传送带(素材→机器→成片) / drop 拖拽入库 / pick 扫描选中飞出 */
  mode: "conveyor" | "drop" | "pick";
  /** 素材块:emoji,或「emoji 标签」;| 分隔 */
  items: string;
  /** 机器 / 落袋区 / 素材库 的名字 */
  label: string;
  /** conveyor 左侧小标 / pick 产出条小标 */
  inLabel?: string;
  /** conveyor 右侧小标 / pick 产出条标签 */
  outLabel?: string;
  /** 卡点(相对本卡 start,秒):drop = 每块落袋时刻;pick = 扫描增强|选中飞出 */
  times?: string;
  /** conveyor 单块通过周期 / drop 无 times 时的间隔(秒) */
  periodSec?: number;
  /** pick 模式选中的两个格序号(0 起,| 分隔) */
  picks?: string;
  /** drop 模式:落袋区中间的 App 图标(图路径);素材块会被它"吸进去" */
  zoneIcon?: string;
  /** feed 版:图标中枢的横向位置(px,越小离来源卡越近) */
  hubX?: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const frac = (v: number) => v - Math.floor(v);

function parseItems(items: string) {
  return items
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const sp = s.indexOf(" ");
      return sp > 0 ? { ic: s.slice(0, sp), lb: s.slice(sp + 1).trim() } : { ic: s, lb: "" };
    });
}

function parseTimes(times?: string) {
  return (times ?? "")
    .split("|")
    .map((s) => parseFloat(s.trim()))
    .filter((v) => Number.isFinite(v));
}

/* ---------- conveyor:全自动流水线 —— 素材块穿过多个工位(label 用 | 分隔),
     每过一站被"处理"一次(摆正→描边→打勾),工位齿轮常转、块经过时脉冲发光,
     尾端吐出成品条。单工位时就是老的「素材→机器→成片」。 ---------- */
function Conveyor({ p, elapsed }: { p: ClipFlowParams; elapsed: number }) {
  const its = parseItems(p.items);
  const n = Math.max(2, its.length);
  const stations = (p.label || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const ns = Math.max(1, stations.length);
  const PRE = 116; // 入料段
  const GAPX = 126; // 站距
  const trackW = PRE + (ns - 1) * GAPX + 64; // chip 在这里被吸收
  const stationXs = stations.map((_, i) => PRE + i * GAPX);
  const period = (p.periodSec ?? 2.2) * n;
  const OUT_W = 170;
  const FRAME_W = 62;
  const scroll = frac((elapsed / (p.periodSec ?? 2.2)) * 0.5) * FRAME_W;
  const gearDeg = (elapsed * 140) % 360;

  // 每块 chip 的位置与"已被几站处理过"
  const chips = its.map((it, i) => {
    const u = frac(elapsed / period + i / n);
    if (u > 0.94) return null;
    const x = clamp01(u / 0.84) * trackW;
    const absorb = clamp01((u - 0.84) / 0.1);
    const passed = stationXs.filter((sx) => x > sx + 8).length;
    const near = stationXs.some((sx) => Math.abs(x - sx) < 18);
    return { it, x, absorb, passed, near, tilt: ((i * 53) % 13) - 6 };
  });

  return (
    <div className="cfw-flowline">
      <div className="cfw-flow-top">
        <span className="cfw-mini">{p.inLabel || ""}</span>
        <span className="cfw-auto">
          AUTOMATION
          <span className="cfw-gear" style={{ transform: `rotate(${gearDeg.toFixed(0)}deg)` }}>
            ⚙
          </span>
        </span>
        <span className="cfw-mini">{p.outLabel || ""}</span>
      </div>
      <div className="cfw-flow-row">
        <div className="cfw-track" style={{ width: trackW }}>
          <div
            className="cfw-belt-dash"
            style={{ backgroundPositionX: `${-frac(elapsed * 0.55) * 36}px` }}
          />
          {stationXs.map((sx, i) => {
            const hot = chips.some((c) => c && Math.abs(c.x - sx) < 18);
            return (
              <div key={i} className={`cfw-station ${hot ? "is-hot" : ""}`} style={{ left: sx }}>
                <span
                  className="cfw-gear cfw-gear--st"
                  style={{ transform: `rotate(${gearDeg.toFixed(0)}deg)` }}
                >
                  ⚙
                </span>
                <span className="cfw-ringgate" />
                <div className="cfw-st-lb">{stations[i]}</div>
              </div>
            );
          })}
          {chips.map(
            (c, i) =>
              c && (
                <div
                  key={i}
                  className={`cfw-chip ${c.passed >= 1 ? "is-neat" : ""}`}
                  style={{
                    left: `${c.x.toFixed(1)}px`,
                    opacity: (1 - c.absorb).toFixed(2),
                    transform: `translate(-50%, -50%) rotate(${c.passed >= 1 ? 0 : c.tilt}deg) scale(${(
                      (c.near ? 1.14 : 1) *
                      (1 - 0.45 * c.absorb)
                    ).toFixed(3)})`,
                  }}
                >
                  {c.passed >= ns ? "✓" : c.it.ic}
                </div>
              ),
          )}
        </div>
        <div className="cfw-out" style={{ width: OUT_W }}>
          <div className="cfw-strip" style={{ transform: `translateX(${(-scroll).toFixed(1)}px)` }}>
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="cfw-frame" style={{ width: FRAME_W - 10 }}>
                <span className="cfw-sprk" />
                ✓
                <span className="cfw-sprk" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- feed:语义流程版 —— 来源卡沿弧线飞进 App 图标(外环旋转=运转中),
     全部交付后右侧吐出成片帧。zoneIcon 填了图标时 drop 模式走这里。 ---------- */
function FeedHub({ p, elapsed }: { p: ClipFlowParams; elapsed: number }) {
  const its = parseItems(p.items);
  const ts = parseTimes(p.times);
  const gap = p.periodSec ?? 1.6;
  const lands = its.map((_, i) => ts[i] ?? 0.6 + i * gap);
  const outAt = ts[its.length] ?? Math.max(...lands, 0) + 0.5;
  const FLY = 0.9;
  const HUB: [number, number] = [p.hubX ?? 320, 150];
  const srcPos = (i: number): [number, number] => [88, 56 + i * 95];

  const gulp =
    1 + 0.24 * Math.max(0, ...lands.map((t) => (elapsed >= t ? 1 - clamp01((elapsed - t) / 0.3) : 0)));
  const ringDeg = (elapsed * 50) % 360;
  const landed = lands.filter((t) => elapsed >= t).length;
  const outK = elapsed - outAt;

  return (
    <div className="cfw-feed">
      <div className="cfw-mini cfw-feed-in">{p.inLabel || ""}</div>
      {/* 来源列:交付后留浅残影 + 橙勾 */}
      {its.map((it, i) => {
        const t = lands[i];
        const gone = elapsed >= t;
        const [x, y] = srcPos(i);
        return (
          <div
            key={`s${i}`}
            className={`cfw-src ${gone ? "is-given" : ""}`}
            style={{ left: x - 75, top: y - 34 }}
          >
            <span className="cfw-src-ic">{it.ic}</span>
            <span className="cfw-src-lb">{it.lb || it.ic}</span>
            {gone && <span className="cfw-src-ok">✓</span>}
          </div>
        );
      })}
      {/* 飞行中的块:贝塞尔弧线滑向图标 */}
      {its.map((it, i) => {
        const t = lands[i];
        const d = clamp01((elapsed - (t - FLY)) / FLY);
        if (d <= 0 || elapsed >= t) return null;
        const e = easeOutExpo(d);
        const [x0, y0] = srcPos(i);
        const mx = (x0 + HUB[0]) / 2;
        const u = 1 - e;
        const x = u * u * (x0 + 60) + 2 * u * e * mx + e * e * HUB[0];
        const y = u * u * y0 + 2 * u * e * (y0 - 46) + e * e * HUB[1];
        return (
          <div
            key={`f${i}`}
            className="cfw-fly"
            style={{ left: x, top: y, transform: `translate(-50%, -50%) scale(${(1 - 0.3 * e).toFixed(3)})` }}
          >
            {it.ic}
          </div>
        );
      })}
      {/* 中枢:图标 + 旋转虚线环 + 计数 */}
      <div className="cfw-hub" style={{ left: HUB[0], top: HUB[1] }}>
        <svg className="cfw-hub-ring" viewBox="0 0 150 150" width="150" height="150">
          <circle
            cx="75"
            cy="75"
            r="64"
            fill="none"
            stroke="var(--hud-acc)"
            strokeWidth="3"
            strokeDasharray="10 12"
            strokeLinecap="round"
            transform={`rotate(${ringDeg.toFixed(1)} 75 75)`}
            opacity="0.85"
          />
        </svg>
        <img
          className="cfw-hub-ic"
          src={(p.zoneIcon ?? "").trim()}
          alt=""
          style={{ transform: `translate(-50%, -50%) scale(${gulp.toFixed(3)})` }}
        />
        <span className="cfw-count cfw-hub-count">×{landed}</span>
        <div className="cfw-hub-lb">{p.label}</div>
      </div>
      {/* 产出:成片帧从图标右侧滑出 */}
      {outK > 0 && (
        <div className="cfw-feed-out">
          {Array.from({ length: 4 }).map((_, j) => {
            const e = easeOutExpo(clamp01((outK - j * 0.32) / 0.55));
            if (e <= 0) return null;
            return (
              <div
                key={j}
                className="cfw-frame"
                style={{
                  position: "absolute",
                  left: HUB[0] + 72 + e * (42 + j * 58),
                  top: 122,
                  width: 50,
                  opacity: e.toFixed(2),
                }}
              >
                <span className="cfw-sprk" />
                ✓
                <span className="cfw-sprk" />
              </div>
            );
          })}
          <div
            className="cfw-mini cfw-feed-outlb"
            style={{ left: HUB[0] + 118, opacity: Math.min(1, outK * 1.6).toFixed(2) }}
          >
            {p.outLabel || ""}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- drop:光标把素材块一个个拖进落袋区;
     zoneIcon 填了 App 图标时,块会飞向图标被"吸进去",图标弹一下 +1 ---------- */
function Drop({ p, elapsed }: { p: ClipFlowParams; elapsed: number }) {
  if ((p.zoneIcon ?? "").trim()) return <FeedHub p={p} elapsed={elapsed} />;
  const its = parseItems(p.items);
  const ts = parseTimes(p.times);
  const gap = p.periodSec ?? 1.6;
  const lands = its.map((_, i) => ts[i] ?? 0.6 + i * gap);
  const DRAG = 1.0; // 拖拽时长
  const W = 560;
  const ZONE_Y = 176;
  const zi = (p.zoneIcon ?? "").trim();
  const landed = lands.filter((t) => elapsed >= t).length;

  let cursor: { x: number; y: number } | null = null;
  const chips = its.map((it, i) => {
    const t = lands[i];
    // 落点:有图标 → 全部飞向图标中心被吸收;无图标 → 排排坐进袋
    const x1 = zi ? W / 2 : 46 + (i % 4) * 122;
    const y1 = zi ? ZONE_Y + 52 : ZONE_Y + 46;
    if (elapsed >= t) {
      if (zi) {
        const sink = clamp01((elapsed - t) / 0.32); // 被吸进图标:缩小消失
        if (sink >= 1) return null;
        return { it, x: x1, y: y1, s: 1 - 0.75 * sink, o: 1 - sink };
      }
      const pop = 1 + 0.22 * Math.max(0, 1 - (elapsed - t) / 0.28);
      return { it, x: x1, y: y1, s: pop, o: 1 };
    }
    const d = clamp01((elapsed - (t - DRAG)) / DRAG);
    if (d <= 0) return null;
    const e = easeOutExpo(d);
    const x0 = W - 120 - (i % 2) * 46;
    const y0 = -6;
    const x = x0 + (x1 - x0) * e;
    const y = y0 + (y1 - y0) * e + Math.sin(e * Math.PI) * -34; // 拎起再放下的弧线
    cursor = { x: x + 30, y: y + 30 };
    return { it, x, y, s: 1.06, o: 0.98 };
  });
  if (!cursor) {
    const nextIdx = lands.findIndex((t) => elapsed < t - DRAG);
    if (nextIdx >= 0) cursor = { x: W - 96, y: 30 + Math.sin(elapsed * 2.4) * 8 };
  }
  const justLanded = lands.some((t) => elapsed >= t && elapsed - t < 0.3);
  // 图标吞下素材时弹一下
  const gulp = zi
    ? 1 + 0.28 * Math.max(0, ...lands.map((t) => (elapsed >= t ? 1 - clamp01((elapsed - t) / 0.3) : 0)))
    : 1;

  return (
    <div className="cfw-drop" style={{ width: W }}>
      {chips.map(
        (c, i) =>
          c && (
            <div
              key={i}
              className="cfw-chip cfw-chip--free"
              style={{
                left: c.x,
                top: c.y,
                opacity: c.o,
                transform: `translate(-50%, -50%) scale(${c.s.toFixed(3)})`,
              }}
            >
              {c.it.ic}
              {c.it.lb ? <span className="cfw-chip-lb">{c.it.lb}</span> : null}
            </div>
          ),
      )}
      <div
        className={`cfw-zone ${zi ? "cfw-zone--app" : ""} ${justLanded ? "is-hit" : ""}`}
        style={{ top: ZONE_Y }}
      >
        {zi && (
          <img
            className="cfw-zone-ic"
            src={zi}
            alt=""
            style={{ transform: `scale(${gulp.toFixed(3)})` }}
          />
        )}
        <span className="cfw-zone-lb">{p.label}</span>
        <span className="cfw-count">×{landed}</span>
      </div>
      {cursor && (
        <div className="cfw-cursor" style={{ left: cursor.x, top: cursor.y }}>
          ➤
        </div>
      )}
    </div>
  );
}

/* ---------- pick:扫描线扫素材库,两格被选中飞进产出条 ---------- */
function Pick({ p, elapsed }: { p: ClipFlowParams; elapsed: number }) {
  const its = parseItems(p.items);
  const ts = parseTimes(p.times);
  const scanAt = ts[0] ?? 0;
  const flyAt = ts[1] ?? scanAt + 4;
  const picks = (p.picks ?? "6|13")
    .split("|")
    .map((s) => parseInt(s.trim(), 10))
    .filter((v) => Number.isFinite(v))
    .slice(0, 2);

  const COLS = 5;
  const ROWS = 3;
  const CW = 104;
  const CH = 64;
  const GAP = 10;
  const GRID_W = COLS * CW + (COLS - 1) * GAP;
  const beamOn = elapsed >= scanAt;
  const beamX = frac(elapsed * 0.34) < 0.5 ? frac(elapsed * 0.34) * 2 : (1 - frac(elapsed * 0.34)) * 2;
  const STRIP_Y = ROWS * (CH + GAP) + 52;

  return (
    <div className="cfw-pick" style={{ width: GRID_W }}>
      <div className="cfw-mini">{p.label}</div>
      <div className="cfw-grid" style={{ height: ROWS * (CH + GAP) - GAP }}>
        {Array.from({ length: COLS * ROWS }).map((_, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const x0 = col * (CW + GAP);
          const y0 = row * (CH + GAP);
          const isPick = picks.includes(i);
          const shim = 0.42 + 0.18 * Math.sin(elapsed * 1.8 + i * 1.7);
          if (isPick && elapsed >= flyAt - 0.7) {
            const slot = picks.indexOf(i);
            const f = easeOutExpo(clamp01((elapsed - flyAt) / 0.8));
            const x1 = GRID_W / 2 - CW - 12 + slot * (CW + 24);
            const y1 = STRIP_Y;
            const ring = clamp01((elapsed - (flyAt - 0.7)) / 0.4);
            return (
              <div
                key={i}
                className="cfw-cell is-pick"
                style={{
                  left: x0 + (x1 - x0) * f,
                  top: y0 + (y1 - y0) * f,
                  width: CW,
                  height: CH,
                  opacity: 1,
                  boxShadow: `0 0 0 ${(3 * ring).toFixed(1)}px var(--hud-acc)`,
                  zIndex: 5,
                }}
              >
                <span className="cfw-cell-ic">
                  {(() => { const ic = its[i % Math.max(1, its.length)]?.ic ?? "aperture";
                    return hasVecIcon(ic) ? <VecIcon name={ic} size={30} /> : ic; })()}
                </span>
                <span className="cfw-cell-sprk" />
                {f >= 1 ? <span className="cfw-ok">✓</span> : null}
              </div>
            );
          }
          return (
            <div
              key={i}
              className="cfw-cell"
              style={{ left: x0, top: y0, width: CW, height: CH, opacity: shim.toFixed(2) }}
            >
              <span className="cfw-cell-ic">
                {(() => { const ic = its[i % Math.max(1, its.length)]?.ic ?? "aperture";
                  return hasVecIcon(ic) ? <VecIcon name={ic} size={30} /> : ic; })()}
              </span>
              <span className="cfw-cell-sprk" />
            </div>
          );
        })}
        <div
          className="cfw-beam"
          style={{
            left: `${(beamX * (GRID_W - 46)).toFixed(1)}px`,
            opacity: beamOn ? 0.6 : 0.22,
          }}
        />
        {/* 接收托盘 + 占位槽:和格子同一坐标系,飞落点 = 槽心 */}
        <div
          className="cfw-strip-bar"
          style={{ left: -2, top: STRIP_Y - 18, width: GRID_W, zIndex: 0 }}
        >
          <span className="cfw-mini">{p.outLabel || ""}</span>
        </div>
        {[0, 1].map((slot) => (
          <span
            key={`slot${slot}`}
            className="cfw-slot"
            style={{
              left: GRID_W / 2 - CW - 12 + slot * (CW + 24) - 4,
              top: STRIP_Y - 4,
              width: CW + 8,
              height: CH + 8,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ClipFlow({ params, playToken }: EffectProps<ClipFlowParams>) {
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params as unknown as { __t?: number; __start?: number }, playToken);
  const { position, mode, accent } = params;
  const style: CSSProperties = {
    ["--hud-acc" as string]: ACCENT_VAR[accent],
    ...offsetVars(params),
  };
  return (
    <div
      className={`hud cfw hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={style}
    >
      {mode === "conveyor" && <Conveyor p={params} elapsed={elapsed} />}
      {mode === "drop" && <Drop p={params} elapsed={elapsed} />}
      {mode === "pick" && <Pick p={params} elapsed={elapsed} />}
    </div>
  );
}

export const clipFlowDef: EffectDef<ClipFlowParams> = {
  id: "clip-flow",
  name: "ClipFlow",
  description: "素材流水线 · 传送带进机器/拖拽入库/扫描选中,全程连续动画",
  tags: ["聚散飞行"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    mode: "conveyor",
    items: "mountain 标签写这里|aperture 竖线分条|globe|map",
    label: "AI",
    inLabel: "素材",
    outLabel: "成片",
    times: "",
    periodSec: 2.2,
    picks: "6|13",
    zoneIcon: "",
    hubX: 320,
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    {
      key: "mode",
      label: "模式",
      type: "select",
      options: [
        { label: "传送带(素材→机器→成片)", value: "conveyor" },
        { label: "拖拽入库", value: "drop" },
        { label: "扫描选中飞出", value: "pick" },
      ],
    },
    { key: "items", label: "素材块(emoji 或「emoji 标签」,| 分隔)", type: "text" },
    { key: "label", label: "机器 / 落袋区 / 素材库名", type: "text" },
    { key: "inLabel", label: "入料小标(conveyor)", type: "text" },
    { key: "outLabel", label: "产出小标(conveyor/pick)", type: "text" },
    {
      key: "times",
      label: "卡点秒(drop=每块落袋 / pick=扫描增强|飞出)",
      type: "text",
    },
    { key: "periodSec", label: "节奏周期", type: "range", min: 0.8, max: 6, step: 0.1, unit: "s" },
    { key: "picks", label: "选中的格序号(pick,| 分隔)", type: "text" },
    { key: "zoneIcon", label: "落袋区 App 图标(drop,图路径,空=虚线袋)", type: "text" },
    { key: "hubX", label: "图标中枢距离(feed 版,越小越近)", type: "range", min: 220, max: 560, step: 10, unit: "px" },
    { key: "theme", label: "底色", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
        { label: "居中", value: "center" },
      ],
    },
    { key: "accent", label: "强调色", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: ClipFlow,
};
