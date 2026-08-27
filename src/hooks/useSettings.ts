import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, readSettings, writeSettings, type PersistedSettings } from "@/services/storage";

export function useSettings() {
  const [settings, setSettingsState] = useState<PersistedSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void readSettings().then((value) => {
      if (!active) return;
      setSettingsState(value);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setSettings = useCallback(async (value: PersistedSettings) => {
    setSettingsState(value);
    await writeSettings(value);
  }, []);

  return { settings, setSettings, loaded };
}
