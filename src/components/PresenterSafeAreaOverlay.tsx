import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import type { CustomPresenterSafeArea, PresenterSafeAreaSettings } from "@/domain/project";
import { adjustPresenterSafeArea, presenterSafeAreaGeometry, type PresenterAreaHandle } from "@/domain/presenterSafeArea";

interface Props {
  settings: PresenterSafeAreaSettings;
  onCommit: (settings: CustomPresenterSafeArea) => void;
  onHide: () => void;
  onClear: () => void;
}

const handles = [
  { id: "nw", label: "调整人物避让区左上角" },
  { id: "ne", label: "调整人物避让区右上角" },
  { id: "sw", label: "调整人物避让区左下角" },
  { id: "se", label: "调整人物避让区右下角" }
] as const;

interface Gesture {
  pointerId: number;
  handle: PresenterAreaHandle;
  startX: number;
  startY: number;
  width: number;
  height: number;
  start: CustomPresenterSafeArea;
}

export function PresenterSafeAreaOverlay({ settings, onCommit, onHide, onClear }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<CustomPresenterSafeArea | null>(null);
  const area = draft ?? presenterSafeAreaGeometry(settings);

  function cancelGesture() {
    gesture.current = null;
    setDraft(null);
  }

  useEffect(() => {
    cancelGesture();
  }, [settings]);

  function startGesture(event: React.PointerEvent<HTMLButtonElement>, handle: PresenterAreaHandle) {
    if (event.button !== 0 || gesture.current) return;
    const bounds = overlayRef.current?.parentElement?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, handle, startX: event.clientX, startY: event.clientY, width: bounds.width, height: bounds.height, start: area };
  }

  function fromPointer(event: React.PointerEvent) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return null;
    return adjustPresenterSafeArea(active.start, active.handle, (event.clientX - active.startX) / active.width * 100, (event.clientY - active.startY) / active.height * 100);
  }

  function finishGesture(event: React.PointerEvent) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    const next = fromPointer(event);
    const start = gesture.current?.start;
    cancelGesture();
    if (next && start && (next.xPercent !== start.xPercent || next.yPercent !== start.yPercent || next.widthPercent !== start.widthPercent || next.heightPercent !== start.heightPercent)) onCommit(next);
  }

  function handleKey(event: React.KeyboardEvent<HTMLButtonElement>, handle: PresenterAreaHandle) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (gesture.current) cancelGesture();
      else onHide();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      cancelGesture();
      onClear();
      return;
    }
    const delta = event.shiftKey ? 5 : 1;
    const dx = event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0;
    const dy = event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    event.stopPropagation();
    cancelGesture();
    onCommit(adjustPresenterSafeArea(area, handle, dx, dy));
  }

  return <div
    ref={overlayRef}
    className="presenter-safe-area"
    role="group"
    aria-label="人物避让区"
    style={{ left: `${area.xPercent}%`, top: `${area.yPercent}%`, width: `${area.widthPercent}%`, height: `${area.heightPercent}%` }}
    onPointerMove={(event) => { const next = fromPointer(event); if (next) setDraft(next); }}
    onPointerUp={finishGesture}
    onPointerCancel={cancelGesture}
    onLostPointerCapture={cancelGesture}
  >
    <button type="button" className="presenter-area-move" aria-label="移动人物避让区" title="拖动人物避让区" onPointerDown={(event) => startGesture(event, "move")} onKeyDown={(event) => handleKey(event, "move")}>
      <UserRound className="presenter-outline" aria-hidden="true" />
    </button>
    {handles.map((handle) => <button key={handle.id} type="button" className={`presenter-area-handle handle-${handle.id}`} aria-label={handle.label} title={handle.label} onPointerDown={(event) => startGesture(event, handle.id)} onKeyDown={(event) => handleKey(event, handle.id)} />)}
  </div>;
}
