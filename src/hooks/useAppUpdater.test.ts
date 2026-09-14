import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppUpdater } from "@/hooks/useAppUpdater";
import {
  checkDesktopUpdate,
  type DesktopUpdateHandle
} from "@/services/updater";

vi.mock("@/services/updater", () => ({
  checkDesktopUpdate: vi.fn()
}));

function updateHandle(isForceUpdate: boolean): DesktopUpdateHandle {
  return {
    info: {
      currentVersion: "0.3.8",
      version: "0.3.10",
      platform: "macos-arm",
      fileName: "BFrame Studio_arm64.app.tar.gz",
      fileSize: 33_675_137,
      notes: "",
      publishTime: "2026-09-14T03:27:17.099Z",
      isForceUpdate
    },
    install: vi.fn(async () => undefined),
    restart: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined)
  };
}

describe("useAppUpdater", () => {
  beforeEach(() => {
    vi.mocked(checkDesktopUpdate).mockReset();
  });

  it("shows a dismissible dialog when a regular update is available", async () => {
    vi.mocked(checkDesktopUpdate).mockResolvedValue(updateHandle(false));
    const { result } = renderHook(() => useAppUpdater());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe("available");
    expect(result.current.visible).toBe(true);
    expect(result.current.canDismiss).toBe(true);
    expect(result.current.info?.version).toBe("0.3.10");
  });

  it("shows a non-dismissible dialog when a forced update is available", async () => {
    vi.mocked(checkDesktopUpdate).mockResolvedValue(updateHandle(true));
    const { result } = renderHook(() => useAppUpdater());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.canDismiss).toBe(false);
  });

  it("keeps the dialog hidden when no update is available", async () => {
    vi.mocked(checkDesktopUpdate).mockResolvedValue(null);
    const { result } = renderHook(() => useAppUpdater());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.visible).toBe(false);
    expect(result.current.info).toBeUndefined();
  });
});
