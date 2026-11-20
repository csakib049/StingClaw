import { Telegraf } from "telegraf";
import chalk from "chalk";
import { WELCOME } from "./constants";
import { registerHandlers } from "./handlers";
import { startTelegramTaskSync } from "./shared-tasks";
import { getTelegramBotToken, getTelegramOwnerId } from "../../storage/repository";

let activeBot: Telegraf | null = null;
let activeToken: string | null = null;
let stopTaskSync: (() => void) | null = null;
let activeUsername = "bot";

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function retryStartupRequest<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } })?.code
        ?? (error as { cause?: { code?: string } })?.cause?.code;
      const isTransient = code === "ECONNRESET" || code === "ETIMEDOUT" || error instanceof TypeError;
      if (!isTransient || attempt >= 4) throw error;
      await delay(Math.min(8_000, 1_000 * 2 ** attempt));
    }
  }
}

async function runPollingWithReconnect(bot: Telegraf): Promise<void> {
  let retry = 0;
  while (activeBot === bot) {
    try {
      await bot.launch();
      if (activeBot === bot) return;
    } catch (error) {
      if (activeBot !== bot) return;
      retry += 1;
      const waitMs = Math.min(30_000, 1_000 * 2 ** Math.min(retry - 1, 5));
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Telegram connection lost (${message}). Retrying in ${Math.ceil(waitMs / 1000)}s.`);
      await delay(waitMs);
    }
  }
}

export async function startTelegramService(token: string): Promise<{ username: string; paired: boolean }> {
  if (activeBot && activeToken === token) {
    return { username: activeUsername, paired: Boolean(getTelegramOwnerId()) };
  }
  await stopTelegramService();

  const bot = new Telegraf(token);
  const me = await retryStartupRequest(() => bot.telegram.getMe());
  bot.botInfo = me;
  registerHandlers(bot, (ownerId) => {
    stopTaskSync?.();
    stopTaskSync = startTelegramTaskSync(bot, ownerId);
  });
  bot.catch((error) => {
    console.error("Telegram update handler failed:", error);
  });
  activeBot = bot;
  activeToken = token;
  activeUsername = me.username ?? "bot";
  const ownerId = getTelegramOwnerId();
  if (ownerId) stopTaskSync = startTelegramTaskSync(bot, Number(ownerId));
  // Telegraf's long-polling launch promise only resolves when polling stops.
  // Run it in the background so the shared-task sync is started immediately.
  void runPollingWithReconnect(bot);
  return { username: me.username ?? "bot", paired: Boolean(ownerId) };
}

export async function stopTelegramService(): Promise<void> {
  stopTaskSync?.();
  stopTaskSync = null;
  if (activeBot) {
    try { activeBot.stop("settings_disconnect"); } catch { /* bot was already stopped */ }
  }
  activeBot = null;
  activeToken = null;
  activeUsername = "bot";
}

export async function startConfiguredTelegramService(): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) return false;
  await startTelegramService(token);
  return true;
}

export async function runTelegramMode(options: { announceWelcome?: boolean } = {}) {
  const token = getTelegramBotToken();
  const ownerId = getTelegramOwnerId();
  if (!token) throw new Error("Telegram mode requires a bot token. Add it in StingClaw Settings.");
  if (!ownerId) throw new Error("Telegram is not paired yet. Open Settings in the local StingClaw interface and connect Telegram there.");

  const connection = await startTelegramService(token);
  if (options.announceWelcome !== false && ownerId) {
    await activeBot!.telegram.sendMessage(ownerId, WELCOME, { parse_mode: "Markdown" });
    console.log(chalk.green("Sent welcome message to Telegram.\n"));
  }

  console.log(chalk.green(`Telegram bot @${connection.username} is running. Press Ctrl+C to stop.\n`));
  await new Promise<void>((resolve) => {
    const stop = () => {
      void stopTelegramService().then(resolve);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
