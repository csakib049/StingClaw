import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agent/action-tracker.ts";
import { ToolExecutor } from "../agent/tool-executer.ts";
import { createAgentTools } from "../agent/agent-tool.ts";
import { defaultAgentConfig } from "../agent/types.ts";
import { runApprovalFlow } from "../agent/approval.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";
import { generatePlan } from "./planner.ts";
import { printPlan, selectSteps } from "./selection.ts";
import type { PlanStep } from "./types.ts";
import { createWebTools } from "./web-tools.ts";


function stepPrompt(goal: string, step: PlanStep): string {
  return [`Goal: ${goal}`, `Step: ${step.title}`, step.description].join('\n');
}


export async function runPlanMode(): Promise<void> {
  console.log(chalk.bold("\n🧭 Plan Mode\n"));

  const goal = await text({ message: "What is your goal?" });
  if (isCancel(goal) || !goal.trim()) return;

  const plan = await generatePlan(goal);

  printPlan(plan);

  const selected = await selectSteps(plan);
  if (selected.length === 0) return;

  const proceed = await confirm({
    message: `Execute ${selected.length} step(s)`,
    initialValue: true,
  });
  if (isCancel(proceed) || !proceed) return;

  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);


  const tools = {
    ...createAgentTools(executor),
    ...(process.env.FIRECRAWL_API_KEY ? createWebTools(tracker) : {})
  };

  for (const step of selected) {
    console.log(chalk.bold(`\n🔧 ${step.title}\n`));

    const agent = new ToolLoopAgent({
      model:getAgentModel(),
      stopWhen:stepCountIs(30),
      tools
    });

    const r = await agent.generate({prompt:stepPrompt(plan.goal , step)})

    if (r.text?.trim()) console.log(renderTerminalMarkdown(r.text));

  }

  const ok = await runApprovalFlow(tracker);

  if(!ok) return executor.clearStaging();

   const { applied, failed, shellOutput } = executor.applyApprovedFromTracker();
  for (const output of shellOutput) console.log(`\n${output}`);
  if (applied.length) {
    console.log(chalk.green("\nApplied successfully:"));
    for (const item of applied) console.log(chalk.green(`  • ${item}`));
  }
  if (failed.length) {
    console.log(chalk.red("\nFailed:"));
    for (const item of failed) console.log(chalk.red(`  • ${item.target}: ${item.error}`));
  }
  if (!failed.length) console.log(chalk.green("\n✓ All approved operations completed.\n"));
  executor.clearStaging();
}
