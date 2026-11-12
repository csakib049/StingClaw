export const clip = (text: string, max = 4000) =>
  text.length <= max ? text : text.slice(0, max) + '\n…[truncated]';

export async function replyMd(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  text: string,
) {
  const message = clip(text);
  try {
    return await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch {
    // LLM output often contains Markdown Telegram cannot parse. Retry as plain text.
    return ctx.reply(message);
  }
}

/** Text after `/name …` */
export function commandArg(fullText: string, name: string): string {
  return fullText.replace(new RegExp(`^/${name}\\s*`, 'i'), '').trim();
}
