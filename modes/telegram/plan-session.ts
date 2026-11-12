import { Markup } from 'telegraf';
import type { Plan } from '../plan/types.ts';


export interface PlanSession {
  id: string;
  plan: Plan;
  selected: Set<string>;
}

export const planSessions = new Map<number, PlanSession>();

export function planMessage(session: PlanSession): string {
  const lines = session.plan.steps.map((step, i) => {
    const mark = session.selected.has(step.id) ? '✅' : '⬜';
    const tag = step.complexity ? ` [${step.complexity}]` : '';
    return `${mark} ${i + 1}. ${step.title}${tag}`;
  });
  return [
    `📋 Plan for: ${session.plan.goal}`,
    '',
    ...lines,
    '',
    'Tap steps to toggle, then hit Proceed.',
  ].join('\n');
}

export function planKeyboard(session: PlanSession) {
  const rows = session.plan.steps.map((step, i) => {
    const mark = session.selected.has(step.id) ? '✅' : '⬜';
    const label = `${mark} Step ${i + 1}: ${step.title}`;
    return [Markup.button.callback(label, `plan_toggle:${session.id}:${step.id}`)];
  });
  return Markup.inlineKeyboard([
    ...rows,
    [
      Markup.button.callback('✅ Select All', `plan_all:${session.id}`),
      Markup.button.callback('⬜ Deselect All', `plan_none:${session.id}`),
    ],
    [Markup.button.callback('🚀 Proceed', `plan_proceed:${session.id}`)],
  ]);
}

export async function refreshPlanUi(
  ctx: { editMessageText: (t: string, o: object) => Promise<unknown> },
  s: PlanSession,
) {
  await ctx.editMessageText(planMessage(s), {
    reply_markup: planKeyboard(s).reply_markup,
  });
}
