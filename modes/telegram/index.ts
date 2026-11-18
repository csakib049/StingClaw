import { Telegraf } from "telegraf";
import chalk from "chalk";
import { WELCOME } from "./constants";
import { registerHandlers } from "./handlers";
import { startTelegramTaskSync } from "./shared-tasks";

export async function runTelegramMode(options: { announceWelcome?: boolean } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ownerId = process.env.TELEGRAM_OWNER_ID;

  if (!token || !ownerId) {
    throw new Error("Telegram mode requires TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_ID.");
  }

  const bot = new Telegraf(token);
  registerHandlers(bot)

  if (options.announceWelcome !== false) {
    await bot.telegram.sendMessage(ownerId, WELCOME, { parse_mode: "Markdown" });
    console.log(chalk.green("Sent welcome message to Telegram.\n"));
  }


  try{
    await bot.launch();
    console.log(chalk.green("Telegram bot is running. Press Ctrl+C to stop. \n"))
  }catch(err){
    console.error(chalk.red("Failed to start Telegram bot: "),err);
    return;
  }

  const stopTaskSync = startTelegramTaskSync(bot, Number(ownerId));

  await new Promise<void>((resolve) => {
    const stop = () => {
      stopTaskSync();
      bot.stop("SIGINT");
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
