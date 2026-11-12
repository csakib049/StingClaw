import type { Telegraf } from "telegraf";
import { isOwner } from "./auth";
import { WELCOME } from "./constants";
import { clip, commandArg } from "./text";
import { runAgent, runAsk, runPlanSteps } from "./agent-run";
import { generatePlan } from "../plan/planner";
import { planKeyboard, planMessage, planSessions, refreshPlanUi, type PlanSession } from "./plan-session";
import { approvalDiff, approvalSessions } from "./approval-session";

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

    await ctx.reply("🔍 Researching your question…");
    void runAsk(ctx, q).catch(console.error);
  });

  bot.command("agent", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const goal = commandArg(ctx.message.text, "agent");
    if (!goal)
      return ctx.reply("Usage: `/agent <task description>`", {
        parse_mode: "Markdown",
      });
    const chatId = ctx.chat.id;
    if (chatIsBusy(chatId)) {
      return ctx.reply("Finish the current task or approval first.");
    }

    activeTaskChats.add(chatId);
    try {
      await ctx.reply("🤖 Agent is working on your task…");
      await runAgent(ctx, chatId, goal);
    } catch (error) {
      console.error(error);
      await ctx.reply("The agent task failed.");
    } finally {
      activeTaskChats.delete(chatId);
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
      await runPlanSteps(ctx, chatId, plan, steps);
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
