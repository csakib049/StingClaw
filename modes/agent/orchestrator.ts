import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executer";
import { createAgentTools } from "./agent-tool";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { runApprovalFlow } from "./approval";


export async function runAgentMode() {
    console.log(chalk.bold("\n Agent Mode \n"))

    const goal = await text({
        message: "What would you like the agent to do?",
        placeholder: "Concrete task for this codebase.",
    });


    if (isCancel(goal) || !goal.trim()) return;

    const config = defaultAgentConfig()
    const tracker = new ActionTracker()
    const executer = new ToolExecutor(tracker, config)
    const tools = createAgentTools(executer)


    const agent = new ToolLoopAgent({
        model:getAgentModel(),
        stopWhen:stepCountIs(40),
        instructions:[
            `Workspace root: ${config.codebasePath}`,
            "All mutations are staged untill approval.",
        ].join("\n"),
        tools,
    });


    const result = await agent.generate({
        prompt:goal.trim(),
        onStepFinish:({toolCalls})=>{
            for(const tc of toolCalls){
                const preview = JSON.stringify(tc.input).slice(0,160);
                console.log(
                    chalk.green(' ✅'),
                    chalk.bold(String(tc.toolName)),
                    chalk.dim(preview + (preview.length>= 160? "..." : "") )
                )
            }
        }
    });


     if (result.text?.trim()) console.log(renderTerminalMarkdown(result.text));

  const ok = await runApprovalFlow(tracker);
  if (!ok) return executer.clearStaging();

  const { applied, failed, shellOutput } = executer.applyApprovedFromTracker();
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

  executer.clearStaging()



}
