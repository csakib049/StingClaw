import type { Telegraf } from "telegraf";
import { isOwner } from "./auth";
import { WELCOME } from "./constants";
import { clip, commandArg } from "./text";
import { generatePlan } from "../plan/planner";
import { planKeyboard, planMessage, planSessions, refreshPlanUi, type PlanSession } from "./plan-session";
import { approvalDiff, approvalSessions } from "./approval-session";
import { getTelegramConversation, sendTelegramTaskUpdate, submitTelegramMessage } from "./shared-tasks";
import { createAgentMemory, deleteAgentMemory, listAgentMemories, listTasks } from "../../storage/repository";

const planRequests = new Set<number>();
const activeTaskChats = new Set<number>();

function chatIsBusy(chatId: number): boolean {
  return (
    activeTaskChats.has(chatId) ||
    approvalSessions.has(chatId) ||
    planSessions.has(chatId) ||
    planRequests.has(chatId)
  );
}



export function registerHandlers(bot: Telegraf) {
  bot.command("start", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    await ctx.reply(WELCOME, { parse_mode: "Markdown" });
  });

  bot.command("ask", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const q = commandArg(ctx.message.text, "ask");
    if (!q)
      return ctx.reply("Usage: `/ask <your question>`", {
        parse_mode: "Markdown",
      });

    try {
      const { task } = await submitTelegramMessage(q);
      await ctx.reply(`🔍 Saved task started (${task.id.slice(0, 8)}). I’ll send the answer here when it finishes.`);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : "Could not start the task.");
    }
  });

  bot.command("agent", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const goal = commandArg(ctx.message.text, "agent");
    if (!goal)
      return ctx.reply("Usage: `/agent <task description>`", {
        parse_mode: "Markdown",
      });
    try {
      const { task } = await submitTelegramMessage(goal);
      await ctx.reply(`🤖 Task started (${task.id.slice(0, 8)}). I’ll send updates here as it runs.`);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : "Could not start the task.");
    }
  });

  bot.on("text", async (ctx) => {
    if (!isOwner(ctx.chat.id) || ctx.message.text.startsWith("/")) return;
    try {
      const { task } = await submitTelegramMessage(ctx.message.text.trim());
      await ctx.reply(`🤖 Task started (${task.id.slice(0, 8)}). I’ll send updates here as it runs.`);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : "Could not start the task.");
    }
  });

  bot.command("tasks", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const { conversation } = getTelegramConversation();
    const tasks = listTasks(conversation.id).slice(0, 8);
    if (!tasks.length) return ctx.reply("No saved Telegram tasks yet.");
    return ctx.reply(tasks.map((task) => `${task.status.toUpperCase()}: ${task.goal.slice(0, 120)}${task.error ? `\n${task.error}` : ""}`).join("\n\n"));
  });

  bot.command("remember", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const content = commandArg(ctx.message.text, "remember");
    if (!content) return ctx.reply("Usage: `/remember <important preference or instruction>`", { parse_mode: "Markdown" });
    try {
      const { agent } = getTelegramConversation();
      createAgentMemory(agent.id, content, true);
      await ctx.reply("Saved as an important memory for this agent. You can review or delete it in the web settings.");
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : "Could not save that memory.");
    }
  });

  bot.command("memory", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const { agent } = getTelegramConversation();
    const memories = listAgentMemories(agent.id);
    if (!memories.length) return ctx.reply("No saved memories yet. Use /remember to save an important preference.");
    const formatted = memories.map((memory, index) => `${memory.important ? "⭐ " : ""}${index + 1}. ${memory.content}`).join("\n\n");
    return ctx.reply(clip(formatted));
  });

  bot.command("forget", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const index = Number(commandArg(ctx.message.text, "forget"));
    if (!Number.isInteger(index) || index < 1) return ctx.reply("Usage: `/forget <number from /memory>`", { parse_mode: "Markdown" });
    const { agent } = getTelegramConversation();
    const memory = listAgentMemories(agent.id)[index - 1];
    if (!memory) return ctx.reply("No memory exists at that number. Use /memory to see the saved list.");
    deleteAgentMemory(agent.id, memory.id);
    return ctx.reply("Memory deleted.");
  });

  bot.action(/^shared_(diff|approve|reject):([\w-]+)$/, async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return ctx.answerCbQuery();
    const action = ctx.match[1]!;
    const taskId = ctx.match[2]!;
    try {
      await sendTelegramTaskUpdate(ctx.telegram, ctx.chat!.id, taskId,
        action === "approve" ? true : action === "reject" ? false : undefined);
      await ctx.answerCbQuery(action === "diff" ? "Diff sent" : action === "approve" ? "Approved" : "Rejected");
    } catch (error) {
      await ctx.answerCbQuery(error instanceof Error ? error.message : "Could not process approval.");
    }
  });
  bot.command("plan", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    if (chatIsBusy(ctx.chat.id)) {
      return ctx.reply("Finish the current task or approval first.");
    }

    const goal = commandArg(ctx.message.text, "plan");

    if (!goal)
      return ctx.reply("Usage: `/plan <your goal>`", {
        parse_mode: "Markdown",
      });

    planRequests.add(ctx.chat.id);
    try {
      await ctx.reply("🧭 Generating a plan…");
      const plan = await generatePlan(goal);
      const session: PlanSession = {
        id: crypto.randomUUID(),
        plan,
        selected: new Set(plan.steps.map((s) => s.id)),
      };

      // Store before sending the buttons so a fast callback can resolve its session.
      planSessions.set(ctx.chat.id, session);
      try {
        await ctx.reply(planMessage(session), planKeyboard(session));
      } catch (error) {
        planSessions.delete(ctx.chat.id);
        throw error;
      }
    } catch (error) {
      console.error(error);
      await ctx.reply("Could not generate the plan. Please try again.");
    } finally {
      planRequests.delete(ctx.chat.id);
    }
  });

  bot.action(/^plan_toggle:([^:]+):(.+)$/, async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return ctx.answerCbQuery();
    const s = planSessions.get(ctx.chat!.id);
    if (!s || s.id !== ctx.match[1]) return ctx.answerCbQuery("This plan has expired.");

    const id = ctx.match[2]!;
    if (s.selected.has(id)) s.selected.delete(id);
    else s.selected.add(id);

    await refreshPlanUi(ctx, s);
    await ctx.answerCbQuery();
  });


  bot.action(/^plan_all:([^:]+)$/, async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return ctx.answerCbQuery();
    const s = planSessions.get(ctx.chat!.id);
    if (!s || s.id !== ctx.match[1]) return ctx.answerCbQuery("This plan has expired.");
    for (const step of s.plan.steps) s.selected.add(step.id);
    await refreshPlanUi(ctx, s);
    await ctx.answerCbQuery();
  });

  bot.action(/^plan_none:([^:]+)$/, async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return ctx.answerCbQuery();
    const s = planSessions.get(ctx.chat!.id);
    if (!s || s.id !== ctx.match[1]) return ctx.answerCbQuery("This plan has expired.");
    s.selected.clear();
    await refreshPlanUi(ctx, s);
    await ctx.answerCbQuery();
  });

  bot.action(/^plan_proceed:([^:]+)$/, async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return ctx.answerCbQuery();
    const s = planSessions.get(ctx.chat!.id);
    if (!s || s.id !== ctx.match[1]) return ctx.answerCbQuery("This plan has expired.");

    const steps = s.plan.steps.filter((step) => s.selected.has(step.id));
    if (steps.length === 0) return ctx.answerCbQuery();

    const chatId = ctx.chat!.id;
    if (activeTaskChats.has(chatId)) {
      return ctx.answerCbQuery("A task is already running.");
    }
    activeTaskChats.add(chatId);
    const { plan } = s;
    planSessions.delete(chatId);
    const list = steps.map((step, i) => `${i + 1}. ${step.title}`).join('\n');
    try {
      await ctx.editMessageText(`🚀 Executing ${steps.length} step(s)…\n\n${list}`);
      await ctx.answerCbQuery();
      const taskGoal = [
        `Carry out the following user-approved plan for: ${plan.goal}`,
        ...steps.map((step, index) => `${index + 1}. ${step.title}\n${step.description}`),
      ].join("\n\n");
      const { task } = await submitTelegramMessage(taskGoal);
      await ctx.reply(`Plan execution started as saved task ${task.id.slice(0, 8)}. I’ll send progress and results here.`);
    } catch (error) {
      console.error(error);
      await ctx.reply("The plan execution failed.");
    } finally {
      activeTaskChats.delete(chatId);
    }
  });

  bot.action('approval_diff', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return ctx.answerCbQuery();
    const s = approvalSessions.get(ctx.chat!.id);
    if (!s) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    await ctx.reply(clip(approvalDiff(s.pending)));
  });

  bot.action('approval_accept', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return ctx.answerCbQuery();
    const s = approvalSessions.get(ctx.chat!.id);
    if (!s) return ctx.answerCbQuery();

    approvalSessions.delete(ctx.chat!.id);
    for (const a of s.pending) s.tracker.updateStatus(a.id, 'approved', true);
    const { applied, failed, shellOutput } = s.executor.applyApprovedFromTracker();
    s.executor.clearStaging();

    const sections = [
      applied.length ? `✅ Applied:\n${applied.map((item) => `• ${item}`).join('\n')}` : "",
      failed.length ? `⚠️ Failed:\n${failed.map((item) => `• ${item.target}: ${item.error}`).join('\n')}` : "",
      shellOutput.length ? `Command output:\n${shellOutput.join('\n\n')}` : "",
    ].filter(Boolean);
    const summary = sections.join("\n\n") || "No operations were applied.";
    await ctx.editMessageText(clip(summary));
    await ctx.answerCbQuery(failed.length ? "Completed with errors" : "Applied!");
    if (failed.length) console.error(failed);
  });

  bot.action('approval_reject', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return ctx.answerCbQuery();
    const s = approvalSessions.get(ctx.chat!.id);
    if (!s) return ctx.answerCbQuery();

    approvalSessions.delete(ctx.chat!.id);
    for (const a of s.pending) s.tracker.updateStatus(a.id, 'rejected', false);
    s.executor.clearStaging();

    await ctx.editMessageText('❌ All changes rejected. Nothing was applied.');
    await ctx.answerCbQuery('Rejected');
  });

}
