import chalk from "chalk";
import { isCancel, select } from "@clack/prompts";
import {
  addTaskEvent,
  getTask,
  listRecentTasks,
  listTaskActions,
  listTaskEvents,
  recordTaskApproval,
  retryTask,
  updateTaskStatus,
} from "../../storage/repository";
import { ActionTracker } from "./action-tracker";
import { runApprovalFlow } from "./approval";
import { ToolExecutor } from "./tool-executer";
import { defaultAgentConfig } from "./types";
import { launchTaskWorker } from "./task-worker";

function workerIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function showTaskDetails(taskId: string): void {
  const task = getTask(taskId);
  if (!task) return;

  console.log(chalk.bold(`\n${task.goal}`));
  console.log(`Status: ${task.status}`);
  console.log(`Created: ${task.created_at}`);
  if (task.result) console.log(`\nResult:\n${task.result}`);
  if (task.error) console.log(chalk.red(`\nError:\n${task.error}`));

  const events = listTaskEvents(taskId);
  if (events.length) {
    console.log(chalk.bold("\nProgress:"));
    for (const event of events) {
      console.log(`• ${event.created_at} — ${event.message}`);
    }
  }
  console.log();
}

async function startTask(taskId: string): Promise<void> {
  try {
    await launchTaskWorker(taskId);
    console.log(chalk.green("Task worker started in the background."));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateTaskStatus({ taskId, status: "failed", error: message });
    addTaskEvent({ taskId, eventType: "failed", message });
    console.error(chalk.red(`Could not start the task worker: ${message}`));
  }
}

async function reviewTask(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task) return;

  const tracker = new ActionTracker();
  tracker.restore(listTaskActions(taskId));
  const executor = new ToolExecutor(tracker, {
    ...defaultAgentConfig(),
    codebasePath: task.workspace_path || process.cwd(),
  });

  const approved = await runApprovalFlow(tracker);

  if (!approved) {
    recordTaskApproval(
      taskId,
      tracker.getActions(),
      "completed",
      task.result,
      null,
    );
    executor.clearStaging();
    addTaskEvent({
      taskId,
      eventType: "approval_rejected",
      message: "The proposed operations were not applied.",
    });
    console.log(chalk.yellow("Proposed changes were rejected; none were applied."));
    return;
  }

  // Mark the task as active while applying approvals. If the process stops
  // mid-apply, recovery will flag it for review instead of applying twice.
  recordTaskApproval(
    taskId,
    tracker.getActions(),
    "running",
    task.result,
    process.pid,
  );
  addTaskEvent({
    taskId,
    eventType: "applying_approved_changes",
    message: "Applying approved operations.",
  });

  const { applied, failed } = executor.applyApprovedFromTracker();
  executor.clearStaging();

  if (failed.length) {
    const failureText = failed
      .map((item) => `${item.target}: ${item.error}`)
      .join("\n");
    updateTaskStatus({
      taskId,
      status: "failed",
      result: task.result,
      error: failureText,
    });
    addTaskEvent({
      taskId,
      eventType: "failed",
      message: `Some approved operations failed: ${failureText}`,
    });
    console.error(chalk.red("Some approved operations failed:"));
    for (const item of failed) {
      console.error(chalk.red(`• ${item.target}: ${item.error}`));
    }
    return;
  }

  updateTaskStatus({
    taskId,
    status: "completed",
    result: task.result,
  });
  addTaskEvent({
    taskId,
    eventType: "completed",
    message: `Approved operations applied: ${applied.join(", ") || "none"}.`,
  });
  console.log(chalk.green("Approved operations applied."));
}

function recoverDeadWorkers(): void {
  const now = Date.now();
  for (const task of listRecentTasks()) {
    if (task.status !== "running") continue;

    // Give a newly launched worker time to write its PID to the database.
    if (!task.worker_pid && now - Date.parse(task.updated_at) < 30_000) continue;
    if (task.worker_pid && workerIsAlive(task.worker_pid)) continue;

    const message = "Background worker stopped unexpectedly. Retry this task to run it again.";
    updateTaskStatus({ taskId: task.id, status: "failed", error: message });
    addTaskEvent({ taskId: task.id, eventType: "failed", message });
  }
}

export async function runTaskCenter(): Promise<void> {
  while (true) {
    recoverDeadWorkers();
    const tasks = listRecentTasks();
    if (tasks.length === 0) {
      console.log(chalk.dim("\nNo saved tasks yet.\n"));
      return;
    }

    const selected = await select({
      message: "Choose a saved task",
      options: [
        ...tasks.map((task) => ({
          value: task.id,
          label: `[${task.status}] ${task.goal.slice(0, 70)}`,
        })),
        { value: "back", label: "← Back" },
      ],
    });

    if (isCancel(selected) || selected === "back") return;
    const task = getTask(selected);
    if (!task) continue;

    const choices: { value: string; label: string }[] = [
      { value: "details", label: "Show task details and progress" },
    ];
    if (task.status === "queued") {
      choices.push({ value: "start", label: "Start task" });
      choices.push({ value: "cancel", label: "Cancel queued task" });
    }
    if (task.status === "running") {
      choices.push({ value: "stop", label: "Stop task" });
    }
    if (task.status === "waiting_approval") {
      choices.push({ value: "review", label: "Review proposed changes" });
    }
    if (task.status === "failed" || task.status === "cancelled") {
      choices.push({ value: "retry", label: "Retry task" });
    }
    choices.push({ value: "back", label: "← Back to task list" });

    const action = await select({
      message: `Task is ${task.status}`,
      options: choices,
    });
    if (isCancel(action) || action === "back") continue;

    if (action === "details") showTaskDetails(task.id);
    if (action === "start") await startTask(task.id);
    if (action === "review") await reviewTask(task.id);
    if (action === "retry") {
      retryTask(task.id);
      addTaskEvent({
        taskId: task.id,
        eventType: "retry_started",
        message: "Task queued for retry.",
      });
      await startTask(task.id);
    }
    if (action === "cancel") {
      updateTaskStatus({
        taskId: task.id,
        status: "cancelled",
        error: "Cancelled before the worker started.",
      });
      addTaskEvent({
        taskId: task.id,
        eventType: "cancelled",
        message: "Cancelled before the worker started.",
      });
    }
    if (action === "stop") {
      if (!task.worker_pid || !workerIsAlive(task.worker_pid)) {
        const message = "Worker is no longer running. Retry the task if needed.";
        updateTaskStatus({ taskId: task.id, status: "failed", error: message });
        addTaskEvent({ taskId: task.id, eventType: "failed", message });
      } else {
        try {
          process.kill(task.worker_pid, "SIGTERM");
          console.log(chalk.yellow("Stop signal sent to the task worker."));
        } catch (error) {
          console.error(chalk.red(`Could not stop worker: ${String(error)}`));
        }
      }
    }
  }
}
