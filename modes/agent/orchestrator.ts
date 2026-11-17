import chalk from "chalk";
import { isCancel, text } from "@clack/prompts";
import {
  addTaskEvent,
  createAgent,
  createConversation,
  createMessage,
  createTask,
  listAgents,
  updateTaskStatus,
} from "../../storage/repository";
import { launchTaskWorker } from "./task-worker";

export async function runAgentMode(): Promise<void> {
  console.log(chalk.bold("\n Agent Mode \n"));

  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "Concrete task for this codebase.",
  });

  if (isCancel(goal) || !goal.trim()) return;

  const cleanGoal = goal.trim();
  const savedAgent =
    listAgents().find((item) => item.name === "CLI Agent") ??
    createAgent({
      name: "CLI Agent",
      description: "The default agent used from the command line.",
      instructions: "",
    });

  const conversation = createConversation(
    savedAgent.id,
    cleanGoal.slice(0, 80),
  );
  const task = createTask({
    agentId: savedAgent.id,
    conversationId: conversation.id,
    goal: cleanGoal,
    workspacePath: process.cwd(),
  });

  createMessage({
    conversationId: conversation.id,
    sender: "user",
    source: "cli",
    content: cleanGoal,
  });
  addTaskEvent({
    taskId: task.id,
    eventType: "queued",
    message: "Task saved and waiting for a background worker.",
  });

  try {
    await launchTaskWorker(task.id);
    console.log(chalk.green("Task started in the background."));
    console.log(chalk.dim(`Task ID: ${task.id}`));
    console.log(chalk.dim("Open Task Center to review progress or approve changes."));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateTaskStatus({ taskId: task.id, status: "failed", error: message });
    addTaskEvent({ taskId: task.id, eventType: "failed", message });
    console.error(chalk.red(`Could not start the task worker: ${message}`));
  }
}
