import type { Telegraf } from "telegraf";
import { isOwner } from "./auth";
import { WELCOME } from "./constants";
import { clip, commandArg } from "./text";
import { runAgent, runAsk, runPlanSteps } from "./agent-run";
import { generatePlan } from "../plan/planner";
import { planKeyboard, planMessage, planSessions, refreshPlanUi, type PlanSession } from "./plan-session";
import { approvalDiff, approvalSessions } from "./approval-session";

const planRequests = new Set<number>();

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
    await ctx.reply("🤖 Agent is working on your task…");
    void runAgent(ctx, ctx.chat.id, goal).catch(console.error);
  });
  bot.command("plan", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    if (planSessions.has(ctx.chat.id) || planRequests.has(ctx.chat.id)) {
      return ctx.reply("A plan is already awaiting selection. Use its buttons first.");
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
        await ctx.reply(planMessage(session), {
          parse_mode: "Markdown",
          ...planKeyboard(session),
        });
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

    const { plan } = s;
    planSessions.delete(ctx.chat!.id);
    const list = steps.map((step, i) => `${i + 1}. ${step.title}`).join('\n');
    await ctx.editMessageText(`🚀 Executing ${steps.length} step(s)…\n\n${list}`);
    await ctx.answerCbQuery();

    void runPlanSteps(ctx, ctx.chat!.id, plan, steps).catch(console.error);
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
    const { errors, shellOutput } = s.executor.applyApprovedFromTracker();
    s.executor.clearStaging();

    const output = shellOutput.join('\n\n').slice(0, 3000);
    await ctx.editMessageText(`✅ All changes applied.${errors.length ? `\n\n⚠️ ${errors.join('\n')}` : ''}${output ? `\n\n${output.replace(/`/g, "'")}` : ''}`);
    await ctx.answerCbQuery('Applied!');
    if (errors.length) console.error(errors);
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
