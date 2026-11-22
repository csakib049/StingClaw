import { extname, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.LANDING_PORT ?? 4173);
const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
};

export async function isLandingAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function startLandingServer(): Promise<void> {
  if (await isLandingAvailable()) {
    console.log(`StingClaw landing page: http://127.0.0.1:${port}`);
    return;
  }

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      let pathname: string;
      try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
      } catch {
        return new Response("Bad request", { status: 400 });
      }
      const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const filePath = resolve(root, relativePath);
      if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
        return new Response("Not found", { status: 404 });
      }
      const file = Bun.file(filePath);
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      return new Response(file, {
        headers: { "Content-Type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream" },
      });
    },
  });
  console.log(`StingClaw landing page: http://127.0.0.1:${server.port}`);
}

export function launchLandingServerInBackground(): Promise<void> {
  const entryPoint = fileURLToPath(import.meta.url);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["run", entryPoint], {
      cwd: resolve(root, ".."),
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: process.env,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolvePromise();
    });
  });
}

if (import.meta.main) await startLandingServer();
