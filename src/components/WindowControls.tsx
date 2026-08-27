import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import {
  closeWindow,
  isWindowMaximized,
  isWindowsRuntime,
  minimizeWindow,
  onWindowResized,
  toggleWindowMaximized
} from "@/services/runtime";

export function WindowControls() {
  const [windows, setWindows] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void isWindowsRuntime().then(async (value) => {
      if (!active) return;
      setWindows(value);
      if (!value) return;
      setMaximized(await isWindowMaximized());
      unlisten = await onWindowResized(() => void isWindowMaximized().then(setMaximized));
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  if (!windows) return null;
  return (
    <div className="window-controls" role="group" aria-label="窗口控制">
      <button type="button" aria-label="最小化窗口" title="最小化" onClick={() => void minimizeWindow()}><Minus size={15} /></button>
      <button type="button" aria-label={maximized ? "还原窗口" : "最大化窗口"} title={maximized ? "还原" : "最大化"} onClick={() => void toggleWindowMaximized().then(setMaximized)}>
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button className="window-close" type="button" aria-label="关闭窗口" title="关闭" onClick={() => void closeWindow()}><X size={16} /></button>
    </div>
  );
}
