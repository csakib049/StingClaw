#!/usr/bin/env bun

import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { runWakeup } from "./tui/wakeup";
import { runStoredTask } from "./modes/agent/task-worker";
import { startWebServer } from "./web/server";
import { runBackendService } from "./modes/backend/service";
import { startScheduledJobRunner } from "./modes/scheduler/runner";
import { startConfiguredTelegramService } from "./modes/telegram";
import { isBackendAvailable, isStartupEnabled, launchBackendInBackground } from "./modes/backend/startup";
import { isLandingAvailable, launchLandingServerInBackground, startLandingServer } from "./landing/server";


const program = new Command();

program.name("StingClaw-build").description("StingClaw cli").version("0.0.1");


program
    .command("wakeup")
    .description("show the banner and pick cli or telegram mode")
    .action(
        async()=>{
            await runWakeup()
        }
     );

program
    .command("backend")
    .description("run the local web and Telegram background service")
    .action(async () => {
        await runBackendService();
    });

program
    .command("web")
    .description("start the local StingClaw web interface")
    .action(async () => {
        if (isStartupEnabled()) {
            const port = Number(process.env.PORT ?? 3210);
            console.log(`StingClaw web interface: http://127.0.0.1:${port}`);
            const landingPort = Number(process.env.LANDING_PORT ?? 4173);
            console.log(`StingClaw landing page: http://127.0.0.1:${landingPort}`);
            if (await isBackendAvailable()) {
                if (!(await isLandingAvailable())) await launchLandingServerInBackground();
                console.log("StingClaw is already running in the background.");
            } else {
                await launchBackendInBackground();
                console.log("StingClaw started in the background. You can close this terminal.");
            }
            process.exit(0);
        }
        await startLandingServer();
        startWebServer();
        startScheduledJobRunner();
        void startConfiguredTelegramService().catch((error) => console.error("Telegram service could not start:", error));
    });

program
    .command("task-worker <taskId>")
    .description("internal background task worker")
    .action(async (taskId: string) => {
        await runStoredTask(taskId);
    });


    await program.parseAsync(process.argv)








