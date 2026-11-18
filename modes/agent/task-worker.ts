import { spawn } from "node:child_process";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai";
import {
  addTaskEvent,
  claimQueuedTask,
  createMessage,
  createTaskNotification,
  getAgent,
  listMessages,
  listAgentMemories,
  getTask,
  recordTaskApproval,
  updateTaskStatus,
} from "../../storage/repository";
import { ActionTracker } from "./action-tracker";
import { createAgentTools } from "./agent-tool";
import { ToolExecutor } from "./tool-executer";
import { defaultAgentConfig } from "./types";

export async function launchTaskWorker(taskId: string): Promise<number> {
  const entryPoint = process.argv[1];
  if (!entryPoint) throw new Error("Cannot find the StingClaw CLI entry point.");

  const child = spawn(
    process.execPath,
    ["run", entryPoint, "task-worker", taskId],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );

  return await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve(child.pid ?? -1);
    });
  });
}

export async function runStoredTask(taskId: string): Promise<void> {
  const initialTask = getTask(taskId);
  if (!initialTask || initialTask.status !== "queued") return;
  if (!claimQueuedTask(taskId, process.pid)) return;

  const task = getTask(taskId);
  if (!task) return;

  const agentRecord = getAgent(task.agent_id);
  if (!agentRecord) {
    updateTaskStatus({ taskId, status: "failed", error: "Agent not found." });
    addTaskEvent({ taskId, eventType: "failed", message: "Agent not found." });
    createTaskNotification({ taskId, type: "failed", title: "Task failed", message: "This task could not run because its agent is missing. Open task details for more information." });
    return;
  }

  addTaskEvent({ taskId, eventType: "started", message: "Background worker started." });

  const handleStop = () => {
    updateTaskStatus({
      taskId,
      status: "cancelled",
      error: "Task stopped by the user.",
    });
    addTaskEvent({ taskId, eventType: "cancelled", message: "Task stopped by the user." });
    createTaskNotification({ taskId, type: "cancelled", title: "Task stopped", message: "The task was stopped." });
    process.exit(0);
  };
  process.once("SIGINT", handleStop);
  process.once("SIGTERM", handleStop);

  const tracker = new ActionTracker();
  const config = defaultAgentConfig();
  config.codebasePath = task.workspace_path || process.cwd();
  config.tools = { ...config.tools, ...agentRecord.permissions };
  const executor = new ToolExecutor(tracker, config);

  try {
    const memories = listAgentMemories(task.agent_id);
    const goalTerms = new Set(task.goal.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
    const relevantMemories = memories
      .map((memory) => {
        const terms = new Set(memory.content.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
        const score = [...terms].filter((term) => goalTerms.has(term)).length;
        return { memory, score };
      })
      .filter(({ memory, score }) => memory.important || score > 0)
      .sort((a, b) => Number(b.memory.important) - Number(a.memory.important) || b.score - a.score)
      .slice(0, 8)
      .map(({ memory }) => `- ${memory.important ? "[Important] " : ""}${memory.content.slice(0, 1000)}`);
    const agent = new ToolLoopAgent({
      model: getAgentModel(agentRecord, (from, to, status) => {
        addTaskEvent({
          taskId,
          eventType: "api_key_fallback",
          message: `API key “${from}” returned HTTP ${status}; switched to “${to}”.`,
        });
      }),
      stopWhen: stepCountIs(40),
      instructions: [
        agentRecord.instructions,
        relevantMemories.length
          ? `User-saved memories that may help with this task. Use them only when relevant and follow the current request if it differs:\n${relevantMemories.join("\n")}`
          : "No saved memories are relevant to this task.",
        `Workspace root: ${config.codebasePath}`,
        "All mutations are staged for user approval.",
      ].join("\n"),
      tools: createAgentTools(executor),
    });

    const history = listMessages(task.conversation_id).slice(-16);
    const prompt = history.length
      ? history
          .map((message) => {
            const speaker = message.sender === "user" ? "User" : "Agent";
            return `${speaker}: ${message.content}`;
          })
          .join("\n\n")
      : task.goal;

    const result = await agent.generate({
      prompt,
      onStepFinish: ({ toolCalls }) => {
        for (const call of toolCalls) {
          addTaskEvent({
            taskId,
            eventType: "tool_used",
            message: `Agent used ${String(call.toolName)}.`,
          });
        }
      },
    });

    const answer = result.text?.trim() || "(no response)";
    const responseSource = [...history].reverse().find((message) => message.sender === "user")?.source ?? "cli";
    createMessage({
      conversationId: task.conversation_id,
      sender: "agent",
      source: responseSource,
      content: answer,
    });

    const pending = tracker.getPendingMutations();
    if (pending.length > 0) {
      // Save the approval payload and task state in one transaction so a
      // restart cannot leave the task waiting without its proposed changes.
      recordTaskApproval(
        taskId,
        tracker.getActions(),
        "waiting_approval",
        answer,
        null,
      );
      addTaskEvent({
        taskId,
        eventType: "approval_requested",
        message: `${pending.length} proposed operation(s) need approval.`,
      });
      createTaskNotification({
        taskId,
        type: "approval",
        title: "Agent needs your approval",
        message: `${pending.length} proposed operation(s) are waiting for review.`,
      });
      return;
    }

    updateTaskStatus({ taskId, status: "completed", result: answer });
    addTaskEvent({ taskId, eventType: "completed", message: "Task completed." });
    createTaskNotification({ taskId, type: "completed", title: "Task completed", message: "Your agent finished this task. Open the conversation to read the result." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateTaskStatus({ taskId, status: "failed", error: message });
    addTaskEvent({ taskId, eventType: "failed", message });
    createTaskNotification({ taskId, type: "failed", title: "Task failed", message: "Your agent could not finish this task. Open task details to see the error." });
  } finally {
    process.removeListener("SIGINT", handleStop);
    process.removeListener("SIGTERM", handleStop);
    executor.clearStaging();
  }
}
