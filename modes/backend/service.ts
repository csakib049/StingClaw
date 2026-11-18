import { resolve } from "node:path";
import { startWebServer } from "../../web/server";
import { runTelegramMode } from "../telegram";
import { isStartupEnabled } from "./startup";

export async function runBackendService(): Promise<void> {
  const projectPath = resolve(import.meta.dir, "../..");
  process.chdir(projectPath);
  startWebServer();
  console.log(`Automatic startup: ${isStartupEnabled() ? "enabled" : "disabled"}`);

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_OWNER_ID) {
    try {
      await runTelegramMode({ announceWelcome: false });
    } catch (error) {
      console.error("Telegram background service could not start:", error);
    }
  } else {
    console.log("Telegram is not configured; the local web backend will still run.");
  }
}
