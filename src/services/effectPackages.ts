import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { EffectDefinition } from "@/domain/effects";
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
  effects: EffectDefinition[];
  soundCount: number;
  verified: boolean;
  signerFingerprint?: string;
  path: string;
}

export async function selectEffectPackage(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  const selected = await open({ multiple: false, directory: false, filters: [{ name: "BVideo 动效包", extensions: ["bveffect"] }] });
  return typeof selected === "string" ? selected : null;
}

export function inspectEffectPackage(path: string): Promise<EffectPackageInfo> {
  return invoke("inspect_effect_package", { path });
}

export function listEffectPackages(): Promise<EffectPackageInfo[]> {
  if (!isDesktopRuntime()) return Promise.resolve([]);
  return invoke("list_effect_packages");
}

export function installEffectPackage(path: string, allowUnsigned: boolean): Promise<EffectPackageInfo> {
  return invoke("install_effect_package", { path, allowUnsigned });
}

export function uninstallEffectPackage(packageId: string): Promise<void> {
  return invoke("uninstall_effect_package", { packageId });
}
