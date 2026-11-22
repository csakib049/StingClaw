import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const ENTRY_NAME = "StingClaw Backend.vbs";
export const BACKEND_HANDOFF_ENV = "STINGCLAW_BACKEND_HANDOFF";

export async function isBackendAvailable(port = Number(process.env.PORT ?? 3210)): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/service`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

export function launchBackendInBackground(): Promise<void> {
  const projectPath = resolve(import.meta.dir, "../..");
  const entryPoint = join(projectPath, "index.ts");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["run", entryPoint, "backend"], {
      cwd: projectPath,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, [BACKEND_HANDOFF_ENV]: "1" },
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolvePromise();
    });
  });
}

function startupEntryPath(): string {
  if (process.platform !== "win32") {
    throw new Error("Automatic startup is currently supported on Windows only.");
  }
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("Windows did not provide the current user's AppData folder.");
  return join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", ENTRY_NAME);
}

export function isStartupEnabled(): boolean {
  try {
    return existsSync(startupEntryPath());
  } catch {
    return false;
  }
}

export function setStartupEnabled(enabled: boolean): void {
  const entryPath = startupEntryPath();
  if (!enabled) {
    if (existsSync(entryPath)) unlinkSync(entryPath);
    return;
  }

  const appData = process.env.APPDATA!;
  const bunPath = resolve(process.execPath);
  const entryPoint = process.argv[1];
  if (!entryPoint) throw new Error("Cannot find the StingClaw application entry point.");
  const projectPath = resolve(import.meta.dir, "../..");
  const quoteVbs = (value: string) => value.replaceAll('"', '""');
  const script = [
    'Set shell = CreateObject("WScript.Shell")',
    `shell.CurrentDirectory = "${quoteVbs(projectPath)}"`,
    `command = Chr(34) & "${quoteVbs(bunPath)}" & Chr(34) & " run " & Chr(34) & "${quoteVbs(resolve(entryPoint))}" & Chr(34) & " backend"`,
    "shell.Run command, 0, False",
    "",
  ].join("\r\n");
  const directory = join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  mkdirSync(directory, { recursive: true });
  writeFileSync(entryPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(script, "utf16le")]));
}
