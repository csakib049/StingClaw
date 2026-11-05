#!/usr/bin/env bun

import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { runWakeup } from "./tui/wakeup";


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


    await program.parseAsync(process.argv)







    