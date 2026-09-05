import type { CSSProperties } from "react";
import type { EffectRenderProps } from "@/effects/registry";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function progressAt(timeUs: number, startUs = 0, durationUs = 560_000) {
  const progress = clamp01((timeUs - startUs) / Math.max(1, durationUs));
  return 1 - (1 - progress) ** 3;
}

function enterStyle(timeUs: number, startUs = 0, durationUs = 560_000, x = 0, y = 20): CSSProperties {
  const progress = progressAt(timeUs, startUs, durationUs);
  return {
    opacity: progress,
    transform: `translate(${(1 - progress) * x}px, ${(1 - progress) * y}px)`
  };
}

function paramString(props: EffectRenderProps, key: string, fallback = "") {
  const value = props.params?.[key];
  return typeof value === "string" ? value : fallback;
}

function paramNumber(props: EffectRenderProps, key: string, fallback: number) {
  const value = props.params?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pipeParts(value: string) {
  return value.split(/[|｜]/u).map((part) => part.trim()).filter(Boolean);
}

function legacyParts(text: string) {
  return text
    .split(/\n|[｜|]|\s*→\s*|\s*->\s*|[；;]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cardStyle(accentColor: string): CSSProperties {
  return { "--effect-accent": accentColor } as CSSProperties;
}

export function PinBoardCard(props: EffectRenderProps) {
  const legacy = legacyParts(props.text);
  const title = paramString(props, "title", legacy.length > 2 ? legacy[0] : "本段主题写这里");
  const subtitle = paramString(props, "subtitle", "小标题:");
  const items = pipeParts(paramString(props, "items", (legacy.length > 2 ? legacy.slice(1) : legacy).join("|"))).slice(0, 8);
  const stepUs = paramNumber(props, "stepMs", 4_000) * 1_000;

  return <div className="os-hud pbd" data-theme={paramString(props, "theme", "dark")} data-position={paramString(props, "position", "top-right")} style={cardStyle(props.accentColor)}>
    <div className="pbd-col">
      {title && <div className="pbd-title" style={enterStyle(props.timeUs, 0)}>{title}</div>}
      {subtitle && <div className="pbd-sub" style={enterStyle(props.timeUs, 120_000)}>{subtitle}</div>}
      {items.map((item, index) => <div className="pbd-chip" key={`${index}-${item}`} style={enterStyle(props.timeUs, 400_000 + index * stepUs, 560_000, 0, -28)}>{item}</div>)}
    </div>
  </div>;
}

export function ChecklistCard(props: EffectRenderProps) {
  const legacy = legacyParts(props.text);
  const title = paramString(props, "title", legacy.length > 2 ? legacy[0] : "步骤打勾");
  const items = pipeParts(paramString(props, "items", (legacy.length > 2 ? legacy.slice(1) : legacy).join("|"))).slice(0, 8);
  const checked = Math.max(0, Math.min(items.length, Math.round(paramNumber(props, "checked", Math.min(3, items.length)))));
  const stepUs = paramNumber(props, "stepMs", 160) * 1_000;
  const fromX = paramString(props, "position", "left") === "right" ? 20 : -20;

  return <div className="os-hud ck" data-theme={paramString(props, "theme", "dark")} data-position={paramString(props, "position", "left")} style={cardStyle(props.accentColor)}>
    {title && <div className="hud-kicker" style={enterStyle(props.timeUs)}>{title}</div>}
    {items.map((item, index) => {
      const done = index < checked;
      return <div className={`ck-item ${done ? "is-done" : "is-todo"}`} key={`${index}-${item}`} style={enterStyle(props.timeUs, index * stepUs, 480_000, fromX, 0)}>
        <span className="ck-box">{done ? "✓" : ""}</span>
        <span>{item}</span>
      </div>;
    })}
  </div>;
}

export function VersusCard(props: EffectRenderProps) {
  const legacy = legacyParts(props.text);
  const winner = paramString(props, "winner", "a");
  const aProgress = progressAt(props.timeUs, 0, 560_000);
  const bProgress = progressAt(props.timeUs, 140_000, 560_000);
  const badgeProgress = progressAt(props.timeUs, 500_000, 460_000);
  const aDim = winner === "b";
  const bDim = winner === "a";

  return <div className="os-hud vs" data-theme={paramString(props, "theme", "dark")} style={cardStyle(props.accentColor)}>
    <div className={`vs-side a ${aDim ? "is-dim" : ""}`} style={{ opacity: aProgress, transform: `translateX(${(1 - aProgress) * -48}px)` }}>
      <div className="vs-kicker">{paramString(props, "aKicker", "主推 · 会点亮")}</div>
      <div className="vs-title">{paramString(props, "aTitle", legacy[0] ?? "选项 A")}</div>
      <div className="vs-sub">{paramString(props, "aSub", "胜出的一边高亮")}</div>
    </div>
    <div className="vs-badge" style={{ opacity: badgeProgress, transform: `scale(${0.5 + badgeProgress * 0.5})` }}>VS</div>
    <div className={`vs-side b ${bDim ? "is-dim" : ""}`} style={{ opacity: bProgress, transform: `translateX(${(1 - bProgress) * 48}px)` }}>
      <div className="vs-kicker">{paramString(props, "bKicker", "对照 · 会变灰")}</div>
      <div className="vs-title">{paramString(props, "bTitle", legacy[1] ?? "选项 B")}</div>
      <div className="vs-sub">{paramString(props, "bSub", legacy[2] ?? "落败的一边压暗")}</div>
    </div>
  </div>;
}

interface EntityChip {
  style: "light" | "dark";
  name: string;
  sub: string;
}

function parseEntityChips(raw: string): EntityChip[] {
  return raw.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).slice(0, 3).map((line) => {
    const [style = "light", name = "", sub = ""] = line.split("|").map((part) => part.trim());
    return { style: style === "dark" ? "dark" : "light", name, sub };
  });
}

export function EntityChipsCard(props: EffectRenderProps) {
  const legacy = legacyParts(props.text);
  const fallbackChips = legacy.length
    ? `light|${legacy[0] ?? "人物或机构"}|${legacy[1] ?? "身份说明"}\ndark|${legacy[2] ?? legacy[0] ?? "人物"}|${legacy[3] ?? "关键经历"}`
    : "light|白牌写机构名|EN OR ROLE\ndark|黑牌写人名|头衔 · 点缀色";
  const chips = parseEntityChips(paramString(props, "chips", fallbackChips));
  const [noteA = "", noteB = ""] = pipeParts(paramString(props, "note", "侧注上行|下行写代码或身份"));
  const stepUs = paramNumber(props, "stepMs", 500) * 1_000;

  return <div className="os-hud etc" data-theme={paramString(props, "theme", "dark")} data-position={paramString(props, "position", "left")} style={cardStyle(props.accentColor)}>
    <div className="etc-row">
      {chips.map((chip, index) => <div className={`etc-chip etc-chip--${chip.style}`} key={`${index}-${chip.name}`} style={enterStyle(props.timeUs, index * stepUs, 600_000, -30, 0)}>
        <div className="etc-name">{chip.name}</div>
        {chip.sub && <div className="etc-sub">{chip.sub}</div>}
      </div>)}
      {(noteA || noteB) && <div className="etc-note" style={enterStyle(props.timeUs, chips.length * stepUs, 600_000, -20, 0)}>
        {noteA && <div className="etc-note-a">{noteA}</div>}
        {noteB && <div className="etc-note-b">{noteB}</div>}
      </div>}
    </div>
  </div>;
}

function statParts(raw: string) {
  const match = /^([^\d+\-.]*)([+\-]?\d[\d,.]*)(.*)$/u.exec(raw.trim());
  if (!match) return { prefix: "", value: 0, suffix: raw };
  const explicitPlus = match[2].startsWith("+");
  return {
    prefix: `${match[1]}${explicitPlus ? "+" : ""}`,
    value: Number(match[2].replaceAll(",", "")) || 0,
    suffix: match[3]
  };
}

export function StatProofCard(props: EffectRenderProps) {
  const legacy = legacyParts(props.text);
  const parsed = statParts(legacy[0] ?? "10000+");
  const target = paramNumber(props, "value", parsed.value);
  const durationUs = Math.max(1, paramNumber(props, "countMs", 1_600) * 1_000);
  const progress = progressAt(props.timeUs, 0, durationUs);
  const decimals = Number.isInteger(target) ? 0 : 1;
  const shown = (target * progress).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return <div className="os-hud spf" data-theme={paramString(props, "theme", "dark")} data-position={paramString(props, "position", "left")} style={{ ...cardStyle(props.accentColor), ...enterStyle(props.timeUs, 0, 550_000) }}>
    <div className="spf-box">
      <div className="spf-kicker"><i className="spf-bar" /><span className="spf-kicker-en">{paramString(props, "kicker", "EN KICKER · HERE")}</span></div>
      {paramString(props, "kickerZh", legacy[1] ?? "中文小注写在这") && <div className="spf-kicker-zh">{paramString(props, "kickerZh", legacy[1] ?? "中文小注写在这")}</div>}
      <div className="spf-num">
        {paramString(props, "prefix", parsed.prefix) && <span className="spf-fix">{paramString(props, "prefix", parsed.prefix)}</span>}
        {shown}
        {paramString(props, "suffix", parsed.suffix) && <span className="spf-fix spf-suffix">{paramString(props, "suffix", parsed.suffix)}</span>}
      </div>
      {paramString(props, "footEn", "EN FOOTNOTE · SOURCE") && <div className="spf-foot-en">{paramString(props, "footEn", "EN FOOTNOTE · SOURCE")}</div>}
      {paramString(props, "footZh", legacy[2] ?? "数字的出处写在这") && <div className="spf-foot-zh">{paramString(props, "footZh", legacy[2] ?? "数字的出处写在这")}</div>}
    </div>
  </div>;
}
