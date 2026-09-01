import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportDialog, exportDimensions } from "@/components/ExportDialog";

const canvas = { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 };

describe("ExportDialog", () => {
  it("preserves aspect ratio for common output resolutions", () => {
    expect(exportDimensions(canvas, "project")).toEqual({ width: 1920, height: 1080 });
    expect(exportDimensions(canvas, "720")).toEqual({ width: 1280, height: 720 });
    expect(exportDimensions({ ...canvas, width: 1080, height: 1920 }, "720")).toEqual({ width: 720, height: 1280 });
  });

  it("submits project defaults as explicit export parameters", () => {
    const onExport = vi.fn();
    render(<ExportDialog open canvas={canvas} defaultEncoder="auto" busy={false} onOpenChange={vi.fn()} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "开始导出" }));
    expect(onExport).toHaveBeenCalledWith({ format: "mp4", width: 1920, height: 1080, fps: 30, encoder: "auto" });
  });

  it("only offers 30 and 60 fps and normalizes a legacy project frame rate", () => {
    const onExport = vi.fn();
    const legacyCanvas = { ...canvas, fpsNumerator: 24 };
    render(<ExportDialog open canvas={legacyCanvas} defaultEncoder="auto" busy={false} onOpenChange={vi.fn()} onExport={onExport} />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "导出帧率" }), { key: "Enter" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["30 fps", "60 fps"]);
    fireEvent.click(screen.getByRole("option", { name: "30 fps" }));
    fireEvent.click(screen.getByRole("button", { name: "开始导出" }));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ fps: 30 }));
  });
});
