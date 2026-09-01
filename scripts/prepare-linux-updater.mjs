import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function exactlyOne(paths, description) {
  if (paths.length !== 1) {
    throw new Error(`Expected exactly one ${description}, found ${paths.length}: ${paths.map((path) => basename(path)).join(", ")}`);
  }
  return paths[0];
}

function nonEmptyFile(path) {
  return existsSync(path) && statSync(path).size > 0;
}

function run(command, args, runner) {
  const result = runner(command, args, { encoding: "utf8", env: process.env });
  if (result.error) throw new Error(`Failed to run ${basename(command)}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${basename(command)} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  }
}

export function prepareLinuxUpdater({
  directory,
  runner = spawnSync,
  tauriPath = join(repoRoot, "node_modules", ".bin", "tauri"),
  signingKeyAvailable = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY?.trim() || process.env.TAURI_SIGNING_PRIVATE_KEY_PATH?.trim()),
  signingPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? ""
}) {
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(directory, entry.name));
  const appImage = exactlyOne(files.filter((path) => path.endsWith(".AppImage")), "Linux AppImage");
  const updater = `${appImage}.tar.gz`;
  const signature = `${updater}.sig`;

  if (!nonEmptyFile(updater)) {
    run("tar", ["-czf", updater, "-C", directory, basename(appImage)], runner);
  }
  if (!nonEmptyFile(updater)) throw new Error(`Linux updater package was not created: ${updater}`);

  if (!nonEmptyFile(signature)) {
    if (!signingKeyAvailable) throw new Error("Missing TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH");
    run(tauriPath, ["signer", "sign", "--password", signingPassword, updater], runner);
  }
  if (!nonEmptyFile(signature)) throw new Error(`Linux updater signature was not created: ${signature}`);

  return { appImage, updater, signature };
}

function isMainModule() {
  return process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  const directory = resolve(process.env.LINUX_UPDATER_DIRECTORY?.trim() || "");
  if (!process.env.LINUX_UPDATER_DIRECTORY?.trim()) {
    throw new Error("Missing required environment variable: LINUX_UPDATER_DIRECTORY");
  }
  const result = prepareLinuxUpdater({ directory });
  console.log(`Prepared ${result.updater}`);
  console.log(`Prepared ${result.signature}`);
}
