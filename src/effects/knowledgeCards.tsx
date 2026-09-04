import type { CSSProperties } from "react";
import { ArrowRight, Check, Lightbulb, Quote, X } from "lucide-react";
import type { EffectRenderProps } from "@/effects/registry";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function revealAt(timeUs: number, startUs: number, durationUs = 360_000) {
  const progress = clamp01((timeUs - startUs) / durationUs);
  return 1 - (1 - progress) ** 3;
}

function revealStyle(timeUs: number, startUs: number, offsetEm = 0.35): CSSProperties {
  const progress = revealAt(timeUs, startUs);
  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * offsetEm}em)`
  };
}

function structuredParts(text: string) {
  return text
    .split(/\n|[｜|]|\s*→\s*|\s*->\s*|[；;]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ConceptMapCard({ text, accentColor, timeUs }: EffectRenderProps) {
  const [concept = text, ...details] = structuredParts(text);
  const branches = details.slice(0, 3);
  const conceptProgress = revealAt(timeUs, 0, 420_000);

  return (
    <div className="knowledge-motion-card knowledge-concept-map">
      <div className="knowledge-card-heading" style={{ ...revealStyle(timeUs, 0), color: accentColor }}>
        <Lightbulb aria-hidden size="0.78em" strokeWidth={2.2} />
        <span>核心概念</span>
      </div>
      <strong
        className="knowledge-concept-core"
        style={{ opacity: conceptProgress, transform: `scale(${0.88 + conceptProgress * 0.12})` }}
      >
        {concept}
      </strong>
      {branches.length > 0 && <div className="knowledge-concept-branches">
        {branches.map((branch, index) => {
          const startUs = 280_000 + index * 190_000;
          const progress = revealAt(timeUs, startUs);
          return <div key={`${index}-${branch}`} style={revealStyle(timeUs, startUs, 0.24)}>
            <i style={{ color: accentColor }}>{String(index + 1).padStart(2, "0")}</i>
            <span>{branch}</span>
            <b aria-hidden style={{ backgroundColor: accentColor, transform: `scaleX(${progress})` }} />
          </div>;
        })}
      </div>}
    </div>
  );
}

export function CausalChainCard({ text, accentColor, timeUs }: EffectRenderProps) {
  const nodes = structuredParts(text).slice(0, 4);
  return (
    <div className="knowledge-motion-card knowledge-causal-chain">
      <div className="knowledge-card-heading" style={{ ...revealStyle(timeUs, 0), color: accentColor }}>
        <span>因果链</span>
      </div>
      <div className="knowledge-chain-row">
        {nodes.map((node, index) => {
          const startUs = 120_000 + index * 230_000;
          const progress = revealAt(timeUs, startUs);
          return <div className="knowledge-chain-step" key={`${index}-${node}`}>
            <div style={{ opacity: progress, transform: `translateX(${(1 - progress) * -0.35}em)` }}>
              <i style={{ borderColor: accentColor, color: accentColor }}>{index + 1}</i>
              <span>{node}</span>
            </div>
            {index < nodes.length - 1 && <ArrowRight aria-hidden style={{ color: accentColor, opacity: revealAt(timeUs, startUs + 150_000) }} />}
          </div>;
        })}
      </div>
    </div>
  );
}

export function ArgumentBoardCard({ text, accentColor, timeUs }: EffectRenderProps) {
  const [claim = text, ...evidence] = structuredParts(text);
  return (
    <div className="knowledge-motion-card knowledge-argument-board">
      <div className="knowledge-card-heading" style={{ ...revealStyle(timeUs, 0), color: accentColor }}>
        <Lightbulb aria-hidden size="0.78em" strokeWidth={2.2} />
        <span>观点</span>
      </div>
      <strong style={revealStyle(timeUs, 80_000)}>{claim}</strong>
      {evidence.length > 0 && <div className="knowledge-evidence-list">
        {evidence.slice(0, 3).map((item, index) => <div key={`${index}-${item}`} style={revealStyle(timeUs, 340_000 + index * 190_000, 0.22)}>
          <i style={{ color: accentColor }}>{String(index + 1).padStart(2, "0")}</i>
          <span>{item}</span>
        </div>)}
      </div>}
    </div>
  );
}

export function MythFactCard({ text, accentColor, timeUs }: EffectRenderProps) {
  const parts = structuredParts(text);
  const myth = parts.length > 1 ? parts[0] : null;
  const fact = parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? text;
  const dividerProgress = revealAt(timeUs, 260_000);
  return (
    <div className={`knowledge-motion-card knowledge-myth-fact ${myth ? "" : "single"}`}>
      {myth && <div className="knowledge-myth-side" style={revealStyle(timeUs, 0)}>
        <div><X aria-hidden /><span>常见误区</span></div>
        <strong>{myth}</strong>
      </div>}
      <i className="knowledge-myth-divider" aria-hidden style={{ backgroundColor: accentColor, transform: `scaleY(${dividerProgress})` }} />
      <div className="knowledge-fact-side" style={revealStyle(timeUs, myth ? 420_000 : 80_000)}>
        <div style={{ color: accentColor }}><Check aria-hidden /><span>{myth ? "正确认知" : "核心结论"}</span></div>
        <strong>{fact}</strong>
      </div>
    </div>
  );
}

export function QuoteLinesCard({ text, accentColor, timeUs }: EffectRenderProps) {
  const parts = structuredParts(text);
  const hasTitle = parts.length > 1;
  const title = hasTitle ? parts[0] : "核心观点";
  const lines = hasTitle ? parts.slice(1) : [parts[0] ?? text];
  const staggerUs = Math.min(190_000, Math.floor(820_000 / Math.max(1, lines.length - 1)));
  const ruleProgress = revealAt(timeUs, 180_000, 440_000);

  return (
    <div className={`knowledge-motion-card knowledge-quote-lines ${lines.length > 4 ? "dense" : ""}`}>
      <div className="knowledge-quote-title" style={revealStyle(timeUs, 0, 0.24)}>
        <Quote aria-hidden style={{ color: accentColor }} />
        <strong>{title}</strong>
      </div>
      <i className="knowledge-quote-rule" aria-hidden style={{ backgroundColor: accentColor, transform: `scaleX(${ruleProgress})` }} />
      <div className="knowledge-quote-copy">
        {lines.map((line, index) => {
          const startUs = 340_000 + index * staggerUs;
          const progress = revealAt(timeUs, startUs, 380_000);
          return <span key={`${index}-${line}`} style={{ opacity: progress, transform: `translateX(${(1 - progress) * 0.45}em)` }}>
            {line}
          </span>;
        })}
      </div>
    </div>
  );
}
