import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PresenterSafeAreaOverlay } from "@/components/PresenterSafeAreaOverlay";

const settings = { position: "custom" as const, xPercent: 34, yPercent: 6, widthPercent: 32, heightPercent: 72 };

function setup() {
  const onCommit = vi.fn();
  const onHide = vi.fn();
  const onClear = vi.fn();
  const view = render(<div><PresenterSafeAreaOverlay settings={settings} onCommit={onCommit} onHide={onHide} onClear={onClear} /></div>);
  const move = screen.getByRole("button", { name: "移动人物避让区" });
  const group = screen.getByRole("group", { name: "人物避让区" });
  vi.spyOn(group.parentElement!, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 500));
  move.setPointerCapture = vi.fn();
  return { ...view, onCommit, onHide, onClear, move, group };
}

describe("PresenterSafeAreaOverlay", () => {
  it("previews a drag and commits once on release", () => {
    const { move, group, onCommit } = setup();
    fireEvent.pointerDown(move, { pointerId: 1, button: 0, clientX: 500, clientY: 200 });
    fireEvent.pointerMove(move, { pointerId: 1, clientX: 600, clientY: 225 });
    expect(group).toHaveStyle({ left: "44%", top: "11%" });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(move, { pointerId: 1, clientX: 650, clientY: 250 });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ ...settings, xPercent: 49, yPercent: 16 });
  });

  it("resizes directly using canvas dimensions", () => {
    const { onCommit, group } = setup();
    const handle = screen.getByRole("button", { name: "调整人物避让区右下角" });
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 650, clientY: 390 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 750, clientY: 440 });
    expect(group).toHaveStyle({ width: "42%", height: "82%" });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 750, clientY: 440 });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ ...settings, widthPercent: 42, heightPercent: 82 });
  });

  it("cancels an interrupted gesture and ignores a click without movement", () => {
    const { move, group, onCommit } = setup();
    fireEvent.pointerDown(move, { pointerId: 1, button: 0, clientX: 500, clientY: 200 });
    fireEvent.pointerMove(move, { pointerId: 1, clientX: 600, clientY: 250 });
    fireEvent.pointerCancel(move, { pointerId: 1 });
    expect(group).toHaveStyle({ left: "34%", top: "6%" });
    fireEvent.pointerDown(move, { pointerId: 2, button: 0, clientX: 500, clientY: 200 });
    fireEvent.pointerUp(move, { pointerId: 2, clientX: 500, clientY: 200 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("supports keyboard movement, resizing, hiding and clearing", () => {
    const { move, onCommit, onHide, onClear } = setup();
    fireEvent.keyDown(move, { key: "ArrowRight", shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith({ ...settings, xPercent: 39 });
    fireEvent.keyDown(screen.getByRole("button", { name: "调整人物避让区右下角" }), { key: "ArrowDown" });
    expect(onCommit).toHaveBeenLastCalledWith({ ...settings, heightPercent: 73 });
    fireEvent.keyDown(move, { key: "Escape" });
    expect(onHide).toHaveBeenCalledOnce();
    fireEvent.keyDown(move, { key: "Delete" });
    expect(onClear).toHaveBeenCalledOnce();
  });
});
