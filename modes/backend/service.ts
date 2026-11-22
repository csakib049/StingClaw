import { resolve } from "node:path";
import { startWebServer } from "../../web/server";
import { startConfiguredTelegramService } from "../telegram";
import { BACKEND_HANDOFF_ENV, isBackendAvailable, isStartupEnabled } from "./startup";
import { startScheduledJobRunner } from "../scheduler/runner";
import { startLandingServer } from "../../landing/server";

export async function runBackendService(): Promise<void> {
  const projectPath = resolve(import.meta.dir, "../..");
  process.chdir(projectPath);
  const handoff = process.env[BACKEND_HANDOFF_ENV] === "1";
  if (!handoff && await isBackendAvailable()) {
    console.log("StingClaw background service is already running.");
    return;
  }

  await startLandingServer();

  let serverStarted = false;
  const deadline = Date.now() + (handoff ? 30_000 : 0);
  while (!serverStarted) {
    try {
      startWebServer(undefined, false);
      serverStarted = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const addressInUse = /EADDRINUSE|address already in use|port.*in use/i.test(message);
      if (!handoff || !addressInUse || Date.now() >= deadline) throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 300));
    }
  }
  startScheduledJobRunner();
  console.log(`Automatic startup: ${isStartupEnabled() ? "enabled" : "disabled"}`);

  try {
    const started = await startConfiguredTelegramService();
    if (!started) console.log("Telegram is not configured; connect it from local Settings.");
  } catch (error) {
    console.error("Telegram background service could not start:", error);
  }
}
