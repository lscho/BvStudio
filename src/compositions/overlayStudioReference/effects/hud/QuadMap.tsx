import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { motionItemStartUs } from "@/domain/overlayStudioMotion";
import { useCardElapsed } from "./useTimelineTime";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface QuadMapParams {
  revealTimesUs?: string;
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 四行,每行「EN标题|EN斜体小注|中文名|中文一句话」 */
  cells: string;
  /** 每格开画时刻(距卡片 start 的秒数),| 分隔,按 SRT 卡点填 */
  times: string;
  /** 讲解运镜:每格"缩到左边开讲"的时刻(秒,| 分隔;留空 = 不运镜)。
      到点整图滑向左侧,右边弹出黑玻璃讲解框;下一格开画时自动回中。 */
  dockTimes?: string;
  /** 讲解条目:一行一格,格内条目用 | 分隔(与 dockTimes 配套) */
  notes?: string;
  /** 讲解条目逐条间隔 */
  noteStepMs?: number;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

interface Cell {
  en: string;
  sub: string;
  zh: string;
  desc: string;
}

function parseCells(raw: string): Cell[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((l) => {
      const [en = "", sub = "", zh = "", desc = ""] = l.split("|").map((s) => s.trim());
      return { en, sub, zh, desc };
    });
}

/* 四个手绘感图标:文档 / 虚线问号框 / 眼睛 / 波浪+问号 */
function CellIcon({ idx }: { idx: number }) {
  if (idx === 0) {
    return (
      <svg viewBox="0 0 64 64" className="qmp-ic">
        <rect x="14" y="8" width="36" height="48" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
        <line x1="22" y1="22" x2="42" y2="22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="22" y1="31" x2="42" y2="31" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".75" />
        <line x1="22" y1="40" x2="42" y2="40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".55" />
        <line x1="22" y1="48" x2="34" y2="48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".4" />
      </svg>
    );
  }
  if (idx === 1) {
    return (
      <svg viewBox="0 0 64 64" className="qmp-ic">
        <rect x="12" y="10" width="40" height="44" rx="4" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="7 6" />
        <text x="32" y="42" textAnchor="middle" fontSize="28" fontWeight="700" fill="currentColor" fontFamily="Georgia, serif">?</text>
      </svg>
    );
  }
  if (idx === 2) {
    return (
      <svg viewBox="0 0 64 64" className="qmp-ic">
        <path d="M6 32 Q32 10 58 32 Q32 54 6 32 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="32" cy="32" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="32" cy="32" r="3.6" className="qmp-ic-acc" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="qmp-ic">
      <path d="M8 22 q6 -7 12 0 q6 7 12 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <path d="M8 34 q6 -7 12 0 q6 7 12 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      <path d="M8 46 q6 -7 12 0 q6 7 12 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".4" />
      <text x="48" y="46" textAnchor="middle" fontSize="34" fontWeight="700" className="qmp-ic-acc-t" fontFamily="Georgia, serif">?</text>
    </svg>
  );
}

/**
 * 四象限认知图:纸面质感的四宫格 —
 * 每格按 times 卡点依次"描边画出"(边框先描一圈,内容随后浮现),
 * 第四格(未知的未知)自动黑底反白。
 */
function QuadMap({ params, playToken }: EffectProps<QuadMapParams>) {
  const { position, cells, times, dockTimes, notes, noteStepMs, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const list = parseCells(cells);
  const ts = times.split("|").map((s) => parseFloat(s.trim()));

  // 讲解运镜:第 i 格从 dockT[i] 起缩左开讲,到下一格开画时刻(ts[i+1])自动回中
  const dockT = (dockTimes ?? "").split("|").map((s) => parseFloat(s.trim()));
  const noteRows = (notes ?? "")
    .split("\n")
    .map((l) => l.split("|").map((s) => s.trim()).filter(Boolean));
  const step = (noteStepMs ?? 2400) / 1000;
  let dockIdx = -1;
  for (let i = 0; i < list.length; i++) {
    const from = dockT[i];
    if (!Number.isFinite(from) || !(noteRows[i]?.length > 0)) continue;
    const until = Number.isFinite(ts[i + 1]) ? ts[i + 1] : Infinity;
    if (elapsed >= from && elapsed < until) dockIdx = i;
  }
  const noteCell = dockIdx >= 0 ? list[dockIdx] : null;

  return (
    <div
      className={`hud qmp hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""} ${
        dockIdx >= 0 ? "is-dock" : ""
      }`}
      style={{ ["--hud-acc" as string]: ACCENT_VAR[accent], ...offsetVars(params) }}
    >
      {/* 讲解框:整图缩左后,右侧黑玻璃逐条弹讲解 */}
      {noteCell && (
        <div className="qmp-note" key={dockIdx}>
          <div className="qmp-note-en">{noteCell.en}</div>
          <div className="qmp-note-zh">{noteCell.zh}</div>
          {(noteRows[dockIdx] ?? []).map((pt, j) => (
            <div
              className={`qmp-note-pt ${elapsed >= dockT[dockIdx] + 0.5 + j * step ? "is-on" : ""}`}
              key={j}
            >
              <i />
              <span>{pt}</span>
            </div>
          ))}
        </div>
      )}
      <div className="qmp-move">
      <div className="qmp-panel">
        {list.map((c, i) => {
          const on = elapsed * 1_000_000 >= motionItemStartUs({ revealTimesUs: params.revealTimesUs ?? "" }, i, (Number.isFinite(ts[i]) ? ts[i] : i * 2.5) * 1_000_000);
          return (
            <div className={`qmp-cell ${i === 3 ? "qmp-cell--dark" : ""} ${on ? "is-on" : ""}`} key={i}>
              {/* 边框描画层:pathLength 归一,stroke 从 0 描到整圈 */}
              <svg className="qmp-draw" preserveAspectRatio="none" viewBox="0 0 100 100">
                <rect x="1" y="1.4" width="98" height="97.2" rx="5" ry="7" pathLength={100} />
              </svg>
              <div className="qmp-body">
                <div className="qmp-en">{c.en}</div>
                <div className="qmp-sub">{c.sub}</div>
                <div className="qmp-row">
                  <CellIcon idx={i} />
                  <div className="qmp-txt">
                    <div className="qmp-zh">{c.zh}</div>
                    <div className="qmp-desc">{c.desc}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

export const quadMapDef: EffectDef<QuadMapParams> = {
  id: "quad-map",
  vTier: "half",
  name: "QuadMap",
  description: "四象限图 · 纸面四宫格按卡点依次描边画出(末格黑底)",
  tags: ["生长描画"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    cells:
      "CELL ONE|italic side note|第一格中文名|每格按卡点描边画出\n" +
      "CELL TWO|draws on your cue|第二格中文名|讲到哪格 哪格出现\n" +
      "CELL THREE|icons are built in|第三格中文名|四个手绘图标自动配\n" +
      "CELL FOUR|auto dark|第四格中文名|末格自动黑底反白",
    times: "0.3|2.6|4.9|7.2",
    dockTimes: "",
    notes: "",
    noteStepMs: 2400,
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
        { label: "居中", value: "center" },
        { label: "左侧", value: "left" },
        { label: "右侧", value: "right" },
      ],
    },
    { key: "cells", label: "四格(一行一格:EN标题|EN小注|中文名|一句话)", type: "textarea", rows: 4 },
    { key: "times", label: "每格开画秒数(距卡片开始,| 分隔,卡点用)", type: "text" },
    { key: "dockTimes", label: "每格缩左开讲秒数(| 分隔,空 = 不运镜)", type: "text" },
    { key: "notes", label: "讲解条目(一行一格,格内 | 分隔)", type: "textarea", rows: 4 },
    { key: "noteStepMs", label: "讲解逐条间隔(卡点用)", type: "range", min: 500, max: 6000, step: 100, unit: "ms" },
    { key: "accent", label: "点缀色(瞳孔/问号)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: QuadMap,
};
