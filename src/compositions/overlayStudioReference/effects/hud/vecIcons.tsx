import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { motionIconNames, normalizeMotionIcon } from "@/domain/informationScenes";

/**
 * 内置矢量图标库(线稿风,stroke = currentColor,跟强调色走)。
 * chip-cluster / glow-badges 的图标字段填这些名字就渲染矢量图;
 * 填其他内容(emoji/文字)则原样显示,向后兼容。
 */
const P = (d: string, key: number) => (
  <path d={d} key={key} fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" />
);

const ICONS: Record<string, ReactNode> = {
  /* 沟通/输入 */
  chat: [P("M4 5h16v11h-9l-4.5 3.5V16H4z", 0), P("M8 9h8M8 12.5h5", 1)],
  pen: [P("M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z", 0), P("M14.5 6.5l3 3", 1)],
  mic: [P("M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z", 0), P("M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6", 1)],
  /* 能力/工具 */
  bolt: [P("M13 2 5.5 13H11l-1 9 7.5-11H12z", 0)],
  gear: [
    <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />,
    P("M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1", 1),
  ],
  code: [P("M8 6 3 12l5 6M16 6l5 6-5 6", 0)],
  terminal: [P("M3 5h18v14H3z", 0), P("M7 9l3 3-3 3M12 15h5", 1)],
  search: [<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />, P("M16.2 16.2 21 21", 1)],
  key: [<circle cx="8" cy="14" r="4" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />, P("M11 11l9-8M17 6l3 3M14 9l2.5 2.5", 1)],
  /* 知识/资料 */
  books: [P("M4 19.5V5a2 2 0 0 1 2-2h13.5v17", 0), P("M4 19.5A2.5 2.5 0 0 1 6.5 17h13", 1), P("M9 7h7", 2)],
  doc: [P("M6 2h8l4 4v16H6z", 0), P("M14 2v4h4M9.5 12h5M9.5 16h5", 1)],
  folder: [P("M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z", 0)],
  bulb: [P("M12 3a6 6 0 0 1 3.6 10.8c-.7.55-1.1 1.2-1.1 2.2h-5c0-1-.4-1.65-1.1-2.2A6 6 0 0 1 12 3z", 0), P("M9.5 19.5h5M10.5 22h3", 1)],
  brain: [P("M9.5 4a3 3 0 0 0-3 3c-1.7.4-3 1.9-3 3.7 0 1.1.5 2.1 1.2 2.8A3.6 3.6 0 0 0 8 20c.6 0 1.1-.1 1.5-.4V4z", 0), P("M14.5 4a3 3 0 0 1 3 3c1.7.4 3 1.9 3 3.7 0 1.1-.5 2.1-1.2 2.8A3.6 3.6 0 0 1 16 20c-.6 0-1.1-.1-1.5-.4V4z", 1)],
  /* 世界/环境 */
  globe: [
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />,
    P("M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18", 1),
  ],
  map: [P("M3 5.5 9 3l6 2.5L21 3v15.5L15 21l-6-2.5L3 21z", 0), P("M9 3v15.5M15 5.5V21", 1)],
  mountain: [P("M3 20 10 6l4 7 2.5-3.5L21 20z", 0)],
  chain: [
    P("M10.5 13.5a4.2 4.2 0 0 1 0-6l1.8-1.8a4.2 4.2 0 0 1 6 6l-1.3 1.3", 0),
    P("M13.5 10.5a4.2 4.2 0 0 1 0 6l-1.8 1.8a4.2 4.2 0 0 1-6-6l1.3-1.3", 1),
  ],
  /* 目标/结果 */
  target: [
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />,
    <circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.9" key={1} />,
    <circle cx="12" cy="12" r="1.4" fill="currentColor" key={2} />,
  ],
  rocket: [
    P("M12 2.5c3 1.8 4.8 5.4 4.8 9.3l-2.3 2.7h-5L7.2 11.8c0-3.9 1.8-7.5 4.8-9.3z", 0),
    <circle cx="12" cy="9" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.9" key={1} />,
    P("M9.5 15.5 7 21l3.5-1.8M14.5 15.5 17 21l-3.5-1.8", 2),
  ],
  chart: [P("M4 20V11M10 20V4.5M16 20v-6.5M2.5 20h19", 0)],
  check: [P("M4 12.5l5 5L20 6.5", 0)],
  x: [P("M6 6l12 12M18 6 6 18", 0)],
  question: [P("M8.8 9a3.2 3.2 0 1 1 4.9 2.7c-1 .65-1.7 1.3-1.7 2.5", 0), <circle cx="12" cy="17.8" r="1.1" fill="currentColor" key={1} />],
  clock: [
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />,
    P("M12 6.5V12l3.5 2.5", 1),
  ],
  aperture: [
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />,
    P("m14.3 8 5.7 9.9M9.7 8h11.5M7.4 12l5.7-9.9M9.7 16 4 6.1M14.3 16H2.8M16.6 12l-5.7 9.9", 1),
  ],
  people: [
    <circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />,
    P("M3.5 20c.5-3.5 2.8-5.5 5.5-5.5s5 2 5.5 5.5", 1),
    P("M15.5 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.8c1.7.8 2.8 2.6 3 5.2", 2),
  ],
  phone: [P("M7 2.5h10v19H7z", 0), P("M10.5 18.5h3", 1)],
  /* 趋势/状态(第四轮拆解:结论卡↘、状态行⚠ 这类表意小图标) */
  "trend-up": [P("M3 17l6-6 4 4 8-8", 0), P("M15 7h6v6", 1)],
  train: [
    P("M6 3h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", 0),
    P("M4 10.5h16M8.5 3v7.5M15.5 3v7.5", 1),
    <circle cx="8.5" cy="14" r="1.2" fill="currentColor" key={2} />,
    <circle cx="15.5" cy="14" r="1.2" fill="currentColor" key={3} />,
    P("M7.5 17 5 21M16.5 17 19 21", 4),
  ],
  "trend-down": [P("M3 7l6 6 4-4 8 8", 0), P("M21 11v6h-6", 1)],
  /* 方向/指示(板内当箭头标签用) */
  "arrow-right": [P("M4 12h15M13 6l6 6-6 6", 0)],
  "arrow-down": [P("M12 4v15M6 13l6 6 6-6", 0)],
  "arrow-up": [P("M12 20V5M6 11l6-6 6 6", 0)],
  "arrow-turn": [P("M4 7h9a5 5 0 0 1 0 10H8", 0), P("M11 14l-3 3 3 3", 1)],
  /* 编辑台动作 */
  upload: [P("M12 16V4M7 9l5-5 5 5", 0), P("M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3", 1)],
  download: [P("M12 4v12M7 11l5 5 5-5", 0), P("M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3", 1)],
  layers: [P("M12 3 3 8l9 5 9-5-9-5z", 0), P("M3 13l9 5 9-5M3 17.5l9 5 9-5", 1)],
  palette: [
    P("M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.4-2-.7-1.2.2-2.4 1.6-2.4H17a4 4 0 0 0 4-4c0-5-4-9.6-9-9.6z", 0),
    <circle cx="7.5" cy="12" r="1.2" fill="currentColor" key={1} />,
    <circle cx="9.5" cy="7.8" r="1.2" fill="currentColor" key={2} />,
    <circle cx="14.5" cy="7.5" r="1.2" fill="currentColor" key={3} />,
  ],
  wand: [P("M4 20 15 9l-1.5-1.5L2.5 18.5z", 0), P("M17 3v3M20.5 6.5 18.5 8.5M21 12h-3M16 11l1.5 1.5", 1)],
  timer: [
    P("M12 8v5l3 2", 0),
    <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="1.9" key={1} />,
    P("M9 2h6", 2),
  ],
  drag: [P("M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01", 0)],
  save: [P("M5 4h11l3 3v13H5z", 0), P("M8 4v5h7V4M8 20v-6h8v6", 1)],
  sparkle: [
    P("M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", 0),
    P("M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z", 1),
  ],
  film: [P("M3 5h18v14H3z", 0), P("M3 9h4M3 15h4M17 9h4M17 15h4M9 5v14", 1)],
  copy: [P("M9 9h11v11H9z", 0), P("M5 15H4V4h11v1", 1)],
  cut: [
    <circle cx="7" cy="18" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" key={0} />,
    <circle cx="17" cy="18" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" key={1} />,
    P("M8.6 16.2 18 4M15.4 16.2 6 4", 2),
  ],
  warn: [P("M12 3.5 21.5 20h-19z", 0), P("M12 10v4.5", 1), <circle cx="12" cy="17.2" r="1.1" fill="currentColor" key={2} />],
  spin: [P("M12 3a9 9 0 1 1-8.6 6.3", 0), P("M3 4.5v5h5", 1)],
};

export const VEC_ICON_NAMES = [...motionIconNames];

/** 图标名 → 矢量线稿;不认识的名字返回 null(调用方自行 fallback 到文字/emoji) */
export function VecIcon({ name, size }: { name: string; size: number }) {
  const resolved = normalizeMotionIcon(name);
  if (resolved === "shield") return <Shield size={size} aria-hidden />;
  const glyph = ICONS[resolved];
  if (!glyph) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      {glyph}
    </svg>
  );
}

export function hasVecIcon(name: string): boolean {
  const resolved = normalizeMotionIcon(name);
  return resolved === "shield" || Boolean(ICONS[name.trim().toLowerCase()]) || (resolved !== "question" && Boolean(ICONS[resolved]));
}
