import type { Telegraf } from "telegraf";
import { Markup } from "telegraf";
import { ActionTracker } from "../agent/action-tracker";
import { ToolExecutor } from "../agent/tool-executer";
import { defaultAgentConfig } from "../agent/types";
import { launchTaskWorker } from "../agent/task-worker";
import { approvalDiff } from "./approval-session";
import { clip } from "./text";
import {
  addTaskEvent,
  createAgent,
  createConversation,
  createMessage,
  createTask,
  createTaskNotification,
  getTask,
  listAgents,
  listConversations,
  listMessages,
  listTaskActions,
  listTaskEvents,
  listPendingScheduledNotifications,
  listTasks,
  markTaskNotificationsRead,
  markScheduledNotificationTelegramSent,
  recordTaskApproval,
  updateTaskStatus,
} from "../../storage/repository";

export function getTelegramConversation() {
  let agents = listAgents();
  if (!agents.length) {
    createAgent({ name: "Executive Assistant", description: "Your general-purpose StingClaw agent." });
    agents = listAgents();
  }
  const agent = agents[0]!;
  const conversations = listConversations(agent.id);
  const conversation = conversations.find((item) => item.title === "Telegram")
    ?? createConversation(agent.id, "Telegram");
  return { agent, conversation };
}

export async function submitTelegramMessage(content: string) {
  const { agent, conversation } = getTelegramConversation();
  const active = listTasks(conversation.id).find((task) =>
    task.status === "queued" || task.status === "running" || task.status === "waiting_approval",
  );
  if (active) throw new Error("A task is already active. Wait for it to finish or resolve its approval first.");

  createMessage({ conversationId: conversation.id, sender: "user", source: "telegram", content });
  const task = createTask({
    agentId: agent.id,
    conversationId: conversation.id,
    goal: content,
    workspacePath: process.cwd(),
  });
  addTaskEvent({ taskId: task.id, eventType: "queued", message: "Task queued from Telegram." });
  try {
    await launchTaskWorker(task.id);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    updateTaskStatus({ taskId: task.id, status: "failed", error: message });
    addTaskEvent({ taskId: task.id, eventType: "failed", message });
    createTaskNotification({ taskId: task.id, type: "failed", title: "Telegram task could not start", message: "StingClaw could not start the task worker. Check task details in the local web interface." });
    throw new Error(message);
  }
  return { task, conversation };
}

export async function sendTelegramTaskUpdate(
  telegram: { sendMessage: Telegraf["telegram"]["sendMessage"] },
  ownerId: number,
  taskId: string,
  approve?: boolean,
) {
  const task = getTask(taskId);
  if (!task || task.status !== "waiting_approval") throw new Error("This task is no longer waiting for approval.");
  const tracker = new ActionTracker();
  tracker.restore(listTaskActions(task.id));
  const pending = tracker.getPendingMutations();
  if (!pending.length) throw new Error("There are no pending changes to review.");

  if (approve === undefined) {
    await telegram.sendMessage(ownerId, clip(approvalDiff(pending), 3900));
    return;
  }

  if (!approve) {
    for (const action of pending) tracker.updateStatus(action.id, "rejected", false);
    recordTaskApproval(task.id, tracker.getActions(), "completed", task.result, null);
    addTaskEvent({ taskId: task.id, eventType: "approval_rejected", message: "The proposed changes were rejected from Telegram." });
    markTaskNotificationsRead(task.id);
    return;
  }

  for (const action of pending) tracker.updateStatus(action.id, "approved", true);
  recordTaskApproval(task.id, tracker.getActions(), "running", task.result, process.pid);
  addTaskEvent({ taskId: task.id, eventType: "applying_approved_changes", message: "Applying approved changes from Telegram." });
  const config = defaultAgentConfig();
  config.codebasePath = task.workspace_path || process.cwd();
  const executor = new ToolExecutor(tracker, config);
  try {
    const result = executor.applyApprovedFromTracker();
    if (result.failed.length) {
      const message = result.failed.map((item) => `${item.target}: ${item.error}`).join("\n");
      updateTaskStatus({ taskId: task.id, status: "failed", result: task.result, error: message });
      addTaskEvent({ taskId: task.id, eventType: "failed", message });
      markTaskNotificationsRead(task.id);
      createTaskNotification({ taskId: task.id, type: "failed", title: "Approved changes could not be applied", message: "StingClaw could not apply the approved changes. Check task details in the local web interface." });
    } else {
      updateTaskStatus({ taskId: task.id, status: "completed", result: task.result });
      addTaskEvent({ taskId: task.id, eventType: "completed", message: "Approved changes applied from Telegram." });
      markTaskNotificationsRead(task.id);
      createTaskNotification({ taskId: task.id, type: "completed", title: "Approved changes applied", message: "Your approved changes were applied." });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    updateTaskStatus({ taskId: task.id, status: "failed", result: task.result, error: message });
    addTaskEvent({ taskId: task.id, eventType: "failed", message });
    markTaskNotificationsRead(task.id);
    createTaskNotification({ taskId: task.id, type: "failed", title: "Approved changes could not be applied", message: "StingClaw could not apply the approved changes. Check task details in the local web interface." });
  } finally {
    executor.clearStaging();
  }
}

export function startTelegramTaskSync(bot: Telegraf, ownerId: number): () => void {
  let lastMessageAt = new Date().toISOString();
  const eventCursors = new Map<string, number>();
  const approvalApplying = new Set<string>();
  const { conversation: initialConversation } = getTelegramConversation();
  for (const task of listTasks(initialConversation.id)) {
    const events = listTaskEvents(task.id);
    eventCursors.set(task.id, events.length);
    if (task.status === "waiting_approval") {
      void bot.telegram.sendMessage(ownerId, `🔐 Changes need your review for: ${task.goal.slice(0, 180)}`, Markup.inlineKeyboard([
        [Markup.button.callback("Show diff", `shared_diff:${task.id}`)],
        [Markup.button.callback("Approve", `shared_approve:${task.id}`), Markup.button.callback("Reject", `shared_reject:${task.id}`)],
      ]));
    }
  }
  let busy = false;

  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const { conversation } = getTelegramConversation();
      const messages = listMessages(conversation.id);
      for (const message of messages) {
        if (message.created_at <= lastMessageAt || (message.sender === "user" && message.source === "telegram")) continue;
        await bot.telegram.sendMessage(ownerId, clip(`${message.sender === "user" ? "You (web)" : "Agent"}:\n${message.content}`, 3900));
      }
      if (messages.length) lastMessageAt = messages[messages.length - 1]!.created_at;

      for (const task of listTasks(conversation.id)) {
        const events = listTaskEvents(task.id);
        const cursor = eventCursors.get(task.id) ?? 0;
        for (const event of events.slice(cursor)) {
          if (event.event_type === "started" || event.event_type === "tool_used" || event.event_type === "api_key_fallback") {
            await bot.telegram.sendMessage(ownerId, `ℹ️ ${event.message}`);
          }
          if (event.event_type === "approval_requested" && task.status === "waiting_approval") {
            await bot.telegram.sendMessage(ownerId, `🔐 ${event.message}\nReview the proposed changes:`, Markup.inlineKeyboard([
              [Markup.button.callback("Show diff", `shared_diff:${task.id}`)],
              [Markup.button.callback("Approve", `shared_approve:${task.id}`), Markup.button.callback("Reject", `shared_reject:${task.id}`)],
            ]));
          }
          if (event.event_type === "applying_approved_changes") approvalApplying.add(task.id);
          if (event.event_type === "approval_rejected") {
            await bot.telegram.sendMessage(ownerId, "Changes rejected. Nothing was applied.");
          }
          if (event.event_type === "cancelled") {
            await bot.telegram.sendMessage(ownerId, `⏹️ ${event.message}`);
          }
          if (event.event_type === "completed" && approvalApplying.delete(task.id)) {
            await bot.telegram.sendMessage(ownerId, `✅ Approved changes applied.\n${event.message}`);
          }
          if (event.event_type === "failed") await bot.telegram.sendMessage(ownerId, clip(`❌ Task failed: ${event.message}`, 3900));
        }
        eventCursors.set(task.id, events.length);
      }

      for (const notification of listPendingScheduledNotifications()) {
        if (notification.type === "approval") {
          await bot.telegram.sendMessage(ownerId,
            `🔐 Scheduled job “${notification.schedule_name}” needs your approval. ${notification.message}`,
            Markup.inlineKeyboard([
              [Markup.button.callback("Show diff", `shared_diff:${notification.task_id}`)],
              [Markup.button.callback("Approve", `shared_approve:${notification.task_id}`), Markup.button.callback("Reject", `shared_reject:${notification.task_id}`)],
            ]),
          );
        } else {
          const result = notification.type === "completed" && notification.task_result
            ? `\n\n${notification.task_result}`
            : `\n${notification.message}`;
          await bot.telegram.sendMessage(ownerId, clip(`🔔 ${notification.title}\nScheduled job: ${notification.schedule_name}${result}`, 3900));
        }
        markScheduledNotificationTelegramSent(notification.id);
      }
    } catch (cause) {
      console.error("Telegram task sync failed:", cause);
    } finally {
      busy = false;
    }
  }, 1500);

  return () => clearInterval(timer);
}
