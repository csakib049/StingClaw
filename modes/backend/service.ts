import { resolve } from "node:path";
import { startWebServer } from "../../web/server";
import { startConfiguredTelegramService } from "../telegram";
import { isStartupEnabled } from "./startup";
import { startScheduledJobRunner } from "../scheduler/runner";

export async function runBackendService(): Promise<void> {
  const projectPath = resolve(import.meta.dir, "../..");
  process.chdir(projectPath);
  startWebServer();
  startScheduledJobRunner();
  console.log(`Automatic startup: ${isStartupEnabled() ? "enabled" : "disabled"}`);

  try {
    const started = await startConfiguredTelegramService();
    if (!started) console.log("Telegram is not configured; connect it from local Settings.");
  } catch (error) {
    console.error("Telegram background service could not start:", error);
  }
}
