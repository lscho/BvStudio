import { useEffect, useRef } from "react";
import type { ChartSpec } from "@/domain/effects";
import { drawChartFrame, measureChartBox } from "@/domain/chartEffects";

/**
 * Frame-exact preview of a procedural chart overlay: every paint is
 * `drawChartFrame(progress)` so scrubbing backwards shows the same pixels
 * the FFmpeg frame-sequence export will produce.
 */
export function EffectChartCanvas({ spec, caption, textColor, accentColor, fontSize, progress, cssWidth }: {
  spec: ChartSpec;
  caption?: string;
  textColor: string;
  accentColor: string;
  fontSize: number;
  /** Clamped 0..1 reveal driven by the timeline playhead. */
  progress: number;
  /** Width expression relative to the preview canvas (container query units). */
  cssWidth: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const box = measureChartBox(spec, Math.max(10, fontSize));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.ceil(box.width * scale);
    canvas.height = Math.ceil(box.height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, box.width, box.height);
    drawChartFrame(context, box, spec, { textColor, accentColor }, { caption: caption?.trim() || undefined, fontSize }, Math.max(0, Math.min(1, progress)));
  }, [accentColor, box.height, box.width, caption, fontSize, progress, spec, textColor]);

  return <canvas ref={canvasRef} className="effect-chart-canvas" style={{ width: cssWidth, aspectRatio: `${box.width} / ${box.height}` }} aria-hidden="true" />;
}
