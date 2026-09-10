import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { CompositionDefinition } from "@/domain/effects";
import { isDesktopRuntime } from "@/services/runtime";

export interface EffectPackageManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
}

export interface EffectPackageInfo {
  schemaVersion: number;
  manifest: EffectPackageManifest;
  effects: CompositionDefinition[];
  soundCount: number;
  verified: boolean;
  signerFingerprint?: string;
  path: string;
}

type NativeEffectPackageInfo = Omit<EffectPackageInfo, "effects"> & {
  effects: (Omit<CompositionDefinition, "sceneLayers" | "kind"> & {
    kind?: "effect" | "scene";
    sceneLayers?: (Omit<NonNullable<CompositionDefinition["sceneLayers"]>[number], "compositionId"> & { effectId: string })[];
  })[];
};

// The signed package format keeps its wire names; only the editor model changes.
export function adaptEffectPackage(info: NativeEffectPackageInfo): EffectPackageInfo {
  return { ...info, effects: info.effects.map(({ sceneLayers, kind, ...definition }) => ({
    ...definition, kind: kind === "effect" ? "composition" : kind, renderer: "react",
    sceneLayers: sceneLayers?.map(({ effectId, ...layer }) => ({ ...layer, compositionId: effectId }))
  })) };
}

export async function selectEffectPackage(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  const selected = await open({ multiple: false, directory: false, filters: [{ name: "BFrame 动效包", extensions: ["bveffect"] }] });
  return typeof selected === "string" ? selected : null;
}

export async function inspectEffectPackage(path: string): Promise<EffectPackageInfo> {
  return adaptEffectPackage(await invoke<NativeEffectPackageInfo>("inspect_effect_package", { path }));
}

export async function listEffectPackages(): Promise<EffectPackageInfo[]> {
  if (!isDesktopRuntime()) return [];
  return (await invoke<NativeEffectPackageInfo[]>("list_effect_packages")).map(adaptEffectPackage);
}

export async function installEffectPackage(path: string, allowUnsigned: boolean): Promise<EffectPackageInfo> {
  return adaptEffectPackage(await invoke<NativeEffectPackageInfo>("install_effect_package", { path, allowUnsigned }));
}

export function uninstallEffectPackage(packageId: string): Promise<void> {
  return invoke("uninstall_effect_package", { packageId });
}
