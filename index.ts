#!/usr/bin/env bun

import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { runWakeup } from "./tui/wakeup";
import { runStoredTask } from "./modes/agent/task-worker";
import { startWebServer } from "./web/server";


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
    .command("web")
    .description("start the local StingClaw web interface")
    .action(() => {
        startWebServer();
    });

program
    .command("task-worker <taskId>")
    .description("internal background task worker")
    .action(async (taskId: string) => {
        await runStoredTask(taskId);
    });


    await program.parseAsync(process.argv)








