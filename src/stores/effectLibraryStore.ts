import { create } from "zustand";
import { allCompositions, setInstalledEffects, type CompositionDefinition } from "@/domain/effects";
import { installEffectPackage, listEffectPackages, uninstallEffectPackage, type EffectPackageInfo } from "@/services/effectPackages";

interface EffectLibraryState {
  effects: CompositionDefinition[];
  packages: EffectPackageInfo[];
  loaded: boolean;
  load: () => Promise<void>;
  install: (path: string, allowUnsigned: boolean) => Promise<void>;
  uninstall: (packageId: string) => Promise<void>;
}

async function refresh(set: (patch: Partial<EffectLibraryState>) => void) {
  const packages = await listEffectPackages();
  setInstalledEffects(packages.flatMap((item) => item.effects));
  set({ packages, effects: allCompositions(), loaded: true });
}

export const useEffectLibraryStore = create<EffectLibraryState>((set) => ({
  effects: allCompositions(),
  packages: [],
  loaded: false,
  load: () => refresh(set),
  install: async (path, allowUnsigned) => {
    await installEffectPackage(path, allowUnsigned);
    await refresh(set);
  },
  uninstall: async (packageId) => {
    await uninstallEffectPackage(packageId);
    await refresh(set);
  }
}));
