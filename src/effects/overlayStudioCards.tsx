import type { CSSProperties, ReactNode } from "react";
import type { EffectRenderProps } from "@/effects/registry";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function progressAt(timeUs: number, startUs = 0, durationUs = 520_000) {
  const progress = clamp01((timeUs - startUs) / Math.max(1, durationUs));
  return 1 - (1 - progress) ** 3;
}

function enterStyle(timeUs: number, startUs = 0, durationUs = 520_000, x = 0, y = 16): CSSProperties {
  const progress = progressAt(timeUs, startUs, durationUs);
  return { opacity: progress, transform: `translate(${(1 - progress) * x}px, ${(1 - progress) * y}px)` };
}

function paramString(props: EffectRenderProps, key: string, fallback = "") {
  const value = props.params?.[key];
  return typeof value === "string" ? value : fallback;
}

function paramNumber(props: EffectRenderProps, key: string, fallback: number) {
  const value = props.params?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function paramBoolean(props: EffectRenderProps, key: string, fallback: boolean) {
  const value = props.params?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function pipeParts(value: string) {
  return value.split(/[|｜]/u).map((part) => part.trim()).filter(Boolean);
}

function effectVars(accentColor: string): CSSProperties {
  return { "--effect-accent": accentColor } as CSSProperties;
}

function highlightedText(value: string, className = "os-key"): ReactNode[] {
  return value.split(/(\*[^*]+\*)/u).filter(Boolean).map((part, index) => (
    part.startsWith("*") && part.endsWith("*")
      ? <em className={className} key={`${index}-${part}`}>{part.slice(1, -1)}</em>
      : <span key={`${index}-${part}`}>{part}</span>
  ));
}

export function QuoteLockupCard(props: EffectRenderProps) {
  const quote = paramString(props, "quote", props.text);
  const author = paramString(props, "author", "");
  const lines = pipeParts(quote);
  const ruleProgress = progressAt(props.timeUs, 260_000, 700_000);

  return <div className="os-hud ql" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}>
    <div className="ql-card hud-glass">
      <div className="ql-mark" style={enterStyle(props.timeUs)}>&ldquo;</div>
      <div className="ql-body">
        {lines.map((line, index) => {
          const progress = progressAt(props.timeUs, 140_000 + index * 150_000, 760_000);
          return <span className="ql-line" key={`${index}-${line}`}><span style={{ transform: `translateY(${(1 - progress) * 112}%)` }}>{line}</span></span>;
        })}
      </div>
      <div className="ql-rule" style={{ transform: `scaleX(${ruleProgress})` }} />
      {author && <div className="ql-author" style={enterStyle(props.timeUs, 320_000, 640_000)}>{author}</div>}
    </div>
  </div>;
}

const stepColors = ["#5fa0fa", "#45c6cf", "#8f86ea"];

export function StepTimelineCard(props: EffectRenderProps) {
  const title = paramString(props, "title", "《本期*章节*大纲》");
  const steps = pipeParts(paramString(props, "steps", props.text)).slice(0, 6);
  const revealed = Math.max(0, Math.min(steps.length, Math.round(paramNumber(props, "revealed", steps.length))));
  const fromX = paramString(props, "position", "right") === "right" ? 48 : -48;

  return <div className="os-hud st" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}>
    <div className="st-title" style={enterStyle(props.timeUs)}><span className="st-bar" style={{ transform: `scaleY(${progressAt(props.timeUs, 0, 560_000)})` }} /><span>{highlightedText(title, "st-key")}</span></div>
    <div className="st-list">
      {steps.map((step, index) => {
        const progress = progressAt(props.timeUs, index * 240_000, 560_000);
        const color = stepColors[index % stepColors.length];
        return <div className="st-step" key={`${index}-${step}`} style={{ opacity: progress, transform: `translateX(${(1 - progress) * fromX}px)`, "--step-color": color } as CSSProperties}>
          <div className="st-node" style={{ transform: `scale(${progress})` }} />
          <div className={`st-chip ${index >= revealed ? "is-empty" : ""}`}>{index < revealed ? step : ""}</div>
        </div>;
      })}
    </div>
  </div>;
}

interface DataRow { name: string; value: number }

function parseRows(raw: string): DataRow[] {
  return pipeParts(raw).flatMap((row) => {
    const [name = "", rawValue = ""] = row.split(/[，,]/u);
    const value = Number(rawValue.trim());
    return name.trim() && Number.isFinite(value) ? [{ name: name.trim(), value }] : [];
  }).slice(0, 6);
}

export function RankBarsCard(props: EffectRenderProps) {
  const rows = parseRows(paramString(props, "rows", props.text));
  const suffix = paramString(props, "suffix", "%");
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="os-hud rb" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}>
    <div className="hud-kicker" style={enterStyle(props.timeUs)}>{paramString(props, "title", "多项数据 · 对比排名")}</div>
    {rows.map((row, index) => {
      const rowProgress = progressAt(props.timeUs, index * 140_000, 560_000);
      const barProgress = progressAt(props.timeUs, index * 140_000, 900_000);
      const top = row.value === max;
      return <div className={`rb-row ${top ? "is-top" : "is-dim"}`} key={`${index}-${row.name}`} style={{ opacity: rowProgress, transform: `translateY(${(1 - rowProgress) * 12}px)` }}>
        <div className="rb-head"><span className="rb-name">{row.name}</span><span className="rb-val">{Math.round(row.value * barProgress).toLocaleString("en-US")}{suffix}</span></div>
        <div className="rb-track"><div className="rb-fill" style={{ transform: `scaleX(${row.value / max * barProgress})` }} /></div>
      </div>;
    })}
  </div>;
}

export function PunchPillCard(props: EffectRenderProps) {
  const progress = progressAt(props.timeUs, 0, 460_000);
  return <div className="os-hud pp" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}><div className="pp-pill" style={{ opacity: progress, transform: `scale(${0.9 + progress * 0.1})` }}><span className="pp-dot" />{paramString(props, "pillText", paramString(props, "text", props.text))}</div></div>;
}

export function TermCard(props: EffectRenderProps) {
  const progress = progressAt(props.timeUs, 0, 520_000);
  return <div className="os-hud tc" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}><div className="tc-card hud-glass" style={{ opacity: progress, transform: `translateY(${(1 - progress) * 16}px) scale(${0.98 + progress * 0.02})` }}>
    {paramString(props, "en", "TERM CARD") && <div className="tc-en">{paramString(props, "en", "TERM CARD")}</div>}
    <div className="tc-term">{paramString(props, "term", props.text)}</div>
    <div className="tc-def">{paramString(props, "definition", paramString(props, "def", "用一句容易理解的话解释这个术语。"))}</div>
  </div></div>;
}

type TokenClass = "prompt" | "flag" | "str" | "cmt" | "ok" | "bad" | "ink";
interface TokenCharacter { character: string; className: TokenClass }

function tokenizeLine(line: string): TokenCharacter[] {
  const output: TokenCharacter[] = [];
  const parts = line.split(/(\s+)/u);
  let comment = false;
  for (const part of parts) {
    if (!part) continue;
    let className: TokenClass = "ink";
    if (!part.trim()) className = "ink";
    else if (comment) className = "cmt";
    else if (part.startsWith("#")) { comment = true; className = "cmt"; }
    else if (part === "$" || part === "❯" || part === ">") className = "prompt";
    else if (/^-{1,2}[\w-]+$/u.test(part)) className = "flag";
    else if (/^["'].*["']$/u.test(part)) className = "str";
    else if (part.startsWith("✓")) className = "ok";
    else if (part.startsWith("✗") || part.startsWith("✕")) className = "bad";
    for (const character of part) output.push({ character, className });
  }
  return output;
}

function terminalCharacters(raw: string) {
  const characters: TokenCharacter[] = [];
  pipeParts(raw).forEach((line, index, lines) => {
    characters.push(...tokenizeLine(line));
    if (index < lines.length - 1) characters.push({ character: "\n", className: "ink" });
  });
  return characters;
}

export function Terminal3DCard(props: EffectRenderProps) {
  const characters = terminalCharacters(paramString(props, "lines", props.text));
  const revealed = Math.min(characters.length, Math.max(0, Math.floor(props.timeUs / 1_000_000 * paramNumber(props, "cps", 26))));
  const lines: TokenCharacter[][] = [[]];
  for (const token of characters.slice(0, revealed)) {
    if (token.character === "\n") lines.push([]);
    else lines[lines.length - 1].push(token);
  }
  const cardProgress = progressAt(props.timeUs, 0, 720_000);

  return <div className="os-hud t3" data-theme={paramString(props, "theme", "dark")}><div className="t3-card" style={{ opacity: cardProgress, transform: `rotateY(${-9 + (1 - cardProgress) * -4}deg) rotateX(${4.5 + (1 - cardProgress) * 2}deg) scale(${0.94 + cardProgress * 0.06})` }}>
    <div className="t3-bar"><span className="t3-dot r" /><span className="t3-dot y" /><span className="t3-dot g" /><span className="t3-file">{paramString(props, "file", "demo - terminal")}</span></div>
    <div className="t3-body"><div className="t3-scroll">{lines.map((line, lineIndex) => {
      const spans: Array<{ text: string; className: TokenClass }> = [];
      line.forEach((token) => {
        const last = spans.at(-1);
        if (last?.className === token.className) last.text += token.character;
        else spans.push({ text: token.character, className: token.className });
      });
      return <div className="t3-line" key={lineIndex}>{spans.map((span, index) => <span className={`tk-${span.className}`} key={`${index}-${span.text}`}>{span.text}</span>)}{lineIndex === lines.length - 1 && <span className="t3-caret" />}{!line.length && lineIndex < lines.length - 1 ? " " : ""}</div>;
    })}</div></div>
  </div></div>;
}

export function RingMetricCard(props: EffectRenderProps) {
  const value = paramNumber(props, "value", 92.4);
  const max = Math.max(1, paramNumber(props, "max", 100));
  const decimals = Math.max(0, Math.min(2, Math.round(paramNumber(props, "decimals", 1))));
  const progress = progressAt(props.timeUs, 0, 1_100_000);
  const circumference = 2 * Math.PI * 138;
  return <div className="os-hud rm" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}>
    <div className="rm-kicker" style={enterStyle(props.timeUs)}>{paramString(props, "kicker", "比例指标")}</div>
    <div className="rm-ring"><svg viewBox="0 0 320 320" aria-hidden><circle className="rm-track" cx="160" cy="160" r="138" strokeWidth="18" /><circle className="rm-prog" cx="160" cy="160" r="138" strokeWidth="18" style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - clamp01(value / max) * progress) }} /></svg>
      <div className="rm-center"><div className="rm-num">{(value * progress).toLocaleString("zh-CN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}<span className="rm-unit">{paramString(props, "unit", "%")}</span></div><div className="rm-label">{paramString(props, "label", props.text)}</div></div>
    </div>
  </div>;
}

export function UICalloutCard(props: EffectRenderProps) {
  const ringW = Math.max(80, paramNumber(props, "ringW", 300));
  const ringH = Math.max(60, paramNumber(props, "ringH", 170));
  const side = paramString(props, "side", "right");
  const line = 130;
  const width = ringW + line + 60;
  const height = Math.max(ringH, 80);
  const ringX = side === "right" ? 0 : line + 60;
  const lineStartX = side === "right" ? ringW : ringX;
  const lineEndX = side === "right" ? ringW + line : 60;
  const middleY = height / 2;
  const ringProgress = progressAt(props.timeUs, 0, 460_000);
  const lineProgress = progressAt(props.timeUs, 220_000, 620_000);

  return <div className="os-hud uc" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}><div className="uc-box" style={{ width, height }}>
    <div className="uc-ring" style={{ left: ringX, top: middleY - ringH / 2, width: ringW, height: ringH, opacity: ringProgress, transform: `scale(${1.12 - ringProgress * 0.12})` }} />
    <svg width={width} height={height} aria-hidden><line className="uc-line" x1={lineStartX} y1={middleY} x2={lineEndX} y2={middleY} pathLength="1" style={{ strokeDasharray: 1, strokeDashoffset: 1 - lineProgress }} /></svg>
    <div className="uc-tag" style={{ ...(side === "right" ? { left: ringW + line + 14 } : { right: width - 60 + 14 }), top: middleY, ...enterStyle(props.timeUs, 620_000, 460_000, 0, 12) }}>{paramString(props, "label", props.text)}</div>
  </div></div>;
}

export function TypeShiftCard(props: EffectRenderProps) {
  const lines = pipeParts(paramString(props, "lines", props.text));
  const shifted = props.timeUs >= paramNumber(props, "shiftAtMs", 1_600) * 1_000;
  const rags = [-180, 40, -80, 120, -30];
  return <div className={`os-hud ts ${shifted ? "pB" : "pA"}`} data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}>{lines.map((raw, index) => {
    const role = raw.startsWith("*") ? "hero" : raw.startsWith("-") || raw.startsWith("—") ? "small" : "mid";
    const text = raw.startsWith("*") ? raw.slice(1) : raw;
    const progress = progressAt(props.timeUs, 150_000 + index * 160_000, 420_000);
    const shiftProgress = shifted ? progressAt(props.timeUs, paramNumber(props, "shiftAtMs", 1_600) * 1_000 + index * 70_000, 620_000) : 0;
    return <div className="ts-line" data-role={role} key={`${index}-${text}`} style={{ opacity: progress, transform: `translateX(${rags[index % rags.length] * (1 - shiftProgress)}px)` }}>{text}</div>;
  })}</div>;
}

export function BlurTextCard(props: EffectRenderProps) {
  const chunks = pipeParts(paramString(props, "blurText", paramString(props, "text", props.text)));
  const staggerUs = paramNumber(props, "staggerMs", 420) * 1_000;
  return <div className="os-hud bt" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}><div className="bt-line">{chunks.map((chunk, index) => {
    const progress = progressAt(props.timeUs, 200_000 + index * staggerUs, 640_000);
    return <span className="bt-w" key={`${index}-${chunk}`} style={{ opacity: progress, filter: `blur(${(1 - progress) * 11}px)`, transform: `translateY(${(1 - progress) * 18}px)` }}>{highlightedText(chunk, "bt-key")}</span>;
  })}</div></div>;
}

const digits = "0123456789".split("");

export function OdometerCard(props: EffectRenderProps) {
  const value = Math.max(0, Math.round(paramNumber(props, "value", 500)));
  const chars = String(value).split("");
  return <div className="os-hud od" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}>
    {paramString(props, "kicker", "整数计数") && <div className="od-kicker">{paramString(props, "kicker", "整数计数")}</div>}
    <div className="od-row">{chars.map((char, index) => {
      const progress = progressAt(props.timeUs, (chars.length - index) * 110_000, 900_000);
      return <span className="od-slot" key={`${index}-${char}`}><span className="od-reel" style={{ transform: `translateY(${-Number(char) * 1.15 * progress}em)` }}>{digits.map((digit) => <span className="od-d" key={digit}>{digit}</span>)}</span></span>;
    })}{paramString(props, "unit", "万") && <span className="od-unit">{paramString(props, "unit", "万")}</span>}</div>
    {paramString(props, "label", props.text) && <div className="od-label" style={enterStyle(props.timeUs, 420_000, 640_000)}>{paramString(props, "label", props.text)}</div>}
  </div>;
}

export function FocusCard(props: EffectRenderProps) {
  const items = pipeParts(paramString(props, "items", props.text)).slice(0, 6);
  const side = paramString(props, "side", "left");
  const bg = paramString(props, "bg", "dark");
  const stepUs = paramNumber(props, "stepMs", 600) * 1_000;
  const canvasHeight = Math.max(1, props.canvasHeight ?? props.canvasWidth * 9 / 16);
  const sx = props.canvasWidth / 1920;
  const sy = canvasHeight / 1080;
  const camW = paramNumber(props, "camW", 700) * sx;
  const camH = paramNumber(props, "camH", 700) * sy;
  const baseX = side === "right" ? props.canvasWidth - 110 * sx - camW : 110 * sx;
  const camX = baseX + paramNumber(props, "camDX", 0) * sx;
  const camY = 190 * sy + paramNumber(props, "camDY", 0) * sy;
  const bgProgress = progressAt(props.timeUs, 0, 520_000);
  const ringProgress = progressAt(props.timeUs, 380_000, 560_000);

  return <div className="os-hud fcd bvideo-full-canvas-effect" data-theme={paramString(props, "theme", "dark")} data-bg={bg} data-side={side} style={{ ...effectVars(props.accentColor), width: "100cqw", height: `${canvasHeight / props.canvasWidth * 100}cqw`, "--fcd-x": `${camX / props.canvasWidth * 100}cqw`, "--fcd-y": `${camY / props.canvasWidth * 100}cqw`, "--fcd-w": `${camW / props.canvasWidth * 100}cqw`, "--fcd-h": `${camH / props.canvasWidth * 100}cqw` } as CSSProperties}>
    <div className="fcd-bg" style={{ opacity: bgProgress }} />
    {paramBoolean(props, "showRing", true) && <div className="fcd-ring" style={{ opacity: ringProgress }} />}
    <div className="fcd-list">{items.map((item, index) => <div className="fcd-chip" key={`${index}-${item}`} style={enterStyle(props.timeUs, 520_000 + index * stepUs, 620_000, side === "left" ? 52 : -52, 0)}><span className="fcd-ic">✦</span><span>{item}</span></div>)}</div>
  </div>;
}

interface Chapter { label: string; start: number }

function parseChapters(raw: string): Chapter[] {
  return pipeParts(raw).map((part) => {
    const match = /^(.*?)\s+([\d.]+)$/u.exec(part);
    return match ? { label: match[1].trim(), start: Number(match[2]) } : { label: part, start: 0 };
  }).filter((chapter) => chapter.label && Number.isFinite(chapter.start)).sort((left, right) => left.start - right.start).slice(0, 8);
}

export function ChapterBarCard(props: EffectRenderProps) {
  const chapters = parseChapters(paramString(props, "chapters", props.text));
  if (!chapters.length) return null;
  const seconds = props.timeUs / 1_000_000;
  let active = 0;
  chapters.forEach((chapter, index) => { if (chapter.start <= seconds) active = index; });
  const start = chapters[active].start;
  const end = chapters[active + 1]?.start ?? props.durationUs / 1_000_000;
  const chapterProgress = clamp01((seconds - start) / Math.max(0.1, end - start));
  const fill = (active + chapterProgress) / chapters.length * 100;
  const showProgress = paramBoolean(props, "showProgress", true);
  const lineMode = paramString(props, "progressMode", paramString(props, "progMode", "fill")) === "line";
  const enter = progressAt(props.timeUs, 0, 700_000);

  return <div className="os-hud cbar bvideo-canvas-width-effect" data-theme={paramString(props, "theme", "dark")} style={{ ...effectVars(props.accentColor), transform: `translateY(${(1 - enter) * -110}%)` }}>
    {showProgress && !lineMode && <div className="cbar-fill" style={{ width: `${fill}%` }} />}
    {chapters.map((chapter, index) => <div className={`cbar-item ${index === active ? "is-on" : index < active ? "is-done" : ""}`} key={`${index}-${chapter.label}`}><span className="cbar-lb">{chapter.label}</span>{showProgress && lineMode && index === active && <i style={{ width: `${chapterProgress * 100}%` }} />}</div>)}
  </div>;
}

interface CaptionCue { start: number; end: number; zh: string; en: string }

function parseCaptionCues(raw: string): CaptionCue[] {
  return raw.split(/\r?\n/u).flatMap((line) => {
    const [start, end, zh = "", en = ""] = line.split("|");
    const cue = { start: Number(start), end: Number(end), zh: zh.trim(), en: en.trim() };
    return Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start && cue.zh ? [cue] : [];
  }).slice(0, 200);
}

export function CaptionTrackCard(props: EffectRenderProps) {
  const cue = parseCaptionCues(paramString(props, "lines", props.text)).find((candidate) => props.timeUs / 1_000_000 >= candidate.start && props.timeUs / 1_000_000 < candidate.end);
  if (!cue) return null;
  const progress = progressAt(props.timeUs, cue.start * 1_000_000, 360_000);
  const strokeOn = paramBoolean(props, "strokeOn", false);
  const strokeWidth = Math.max(0, paramNumber(props, "strokeWidth", 3));
  return <div className="os-hud ctrack" data-theme={paramString(props, "theme", "dark")} style={{ ...effectVars(props.accentColor), opacity: progress, transform: `translateY(${(1 - progress) * 18}px)`, WebkitTextStroke: strokeOn ? `${strokeWidth}px ${paramString(props, "strokeColor", "#000000")}` : undefined, paintOrder: "stroke fill" }}>
    <div className="ctrack-cue"><div className="ctrack-zh">{highlightedText(cue.zh, "ctrack-key")}</div>{paramBoolean(props, "showEnglish", true) && cue.en && <div className="ctrack-en">{cue.en}</div>}</div>
  </div>;
}

interface CurvePoint { label: string; value: number }

function parseCurvePoints(raw: string): CurvePoint[] {
  return pipeParts(raw).flatMap((part) => {
    const match = /^(.*?)\s+(-?[\d.]+)$/u.exec(part);
    return match && Number.isFinite(Number(match[2])) ? [{ label: match[1].trim(), value: Number(match[2]) }] : [];
  }).slice(0, 8);
}

function smoothPath(nodes: Array<{ x: number; y: number }>) {
  if (nodes.length < 2) return "";
  let path = `M ${nodes[0].x} ${nodes[0].y}`;
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const p0 = nodes[index - 1] ?? nodes[index];
    const p1 = nodes[index];
    const p2 = nodes[index + 1];
    const p3 = nodes[index + 2] ?? p2;
    path += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export function GrowthCurveCard(props: EffectRenderProps) {
  const points = parseCurvePoints(paramString(props, "points", props.text));
  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const peak = Math.max(1, ...values);
  const nodes = points.map((point, index) => ({ x: 42 + index / Math.max(1, points.length - 1) * 536, y: 236 - (point.value - min) / Math.max(1, peak - min) * 176 }));
  const line = smoothPath(nodes);
  const draw = progressAt(props.timeUs, 0, Math.max(400_000, paramNumber(props, "drawMs", 1_600) * 1_000));
  const area = line ? `${line} L ${nodes.at(-1)?.x ?? 578} 250 L ${nodes[0]?.x ?? 42} 250 Z` : "";
  const boxProgress = progressAt(props.timeUs, 0, 650_000);

  return <div className="os-hud gcv" data-theme={paramString(props, "theme", "dark")} style={effectVars(props.accentColor)}><div className="gcv-box" style={{ opacity: boxProgress, transform: `translateY(${(1 - boxProgress) * 20}px)` }}>
    <div className="gcv-head"><div><div className="gcv-kicker"><i /><span>{paramString(props, "kicker", "GROWTH")}</span></div><div className="gcv-kicker-zh">{paramString(props, "kickerZh", "增长趋势")}</div></div><div className="gcv-peak">{Math.round(peak * draw)}<em>{paramString(props, "unit", "")}</em></div></div>
    <svg className="gcv-svg" viewBox="0 0 620 280" role="img" aria-label="增长曲线"><path className="gcv-area" d={area} style={{ opacity: draw }} /><path className="gcv-line" d={line} pathLength="1" style={{ strokeDasharray: 1, strokeDashoffset: 1 - draw }} />{nodes.map((node, index) => {
      const visible = clamp01((draw - index / Math.max(1, nodes.length - 1) * 0.9) / 0.15);
      return <g className="gcv-pt" opacity={visible} key={`${index}-${points[index].label}`}><text className="gcv-val" x={node.x} y={node.y - 18} textAnchor="middle">{points[index].value}</text><circle className="gcv-dot" cx={node.x} cy={node.y} r={7 * (0.4 + 0.6 * visible)} /><text className="gcv-lb" x={node.x} y="274" textAnchor="middle">{points[index].label}</text></g>;
    })}</svg>
    {paramString(props, "caption", "") && <div className="gcv-cap" style={{ opacity: draw }}>{paramString(props, "caption", "")}</div>}
  </div></div>;
}
