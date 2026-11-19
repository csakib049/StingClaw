export type ScheduleFrequency = "daily" | "weekly";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

function localTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = wanted;
  for (let attempt = 0; attempt < 5; attempt++) {
    const actual = zonedParts(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const difference = wanted - actualAsUtc;
    if (difference === 0) break;
    guess += difference;
  }
  return new Date(guess);
}

export function nextScheduledRun(input: {
  frequency: ScheduleFrequency;
  timeLocal: string;
  weekday?: number | null;
  timeZone: string;
  after?: Date;
}): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeLocal)) throw new Error("Run time must use 24-hour HH:mm format.");
  if (!isValidTimeZone(input.timeZone)) throw new Error("Choose a valid IANA time zone.");
  if (input.frequency === "weekly" && (!Number.isInteger(input.weekday) || input.weekday! < 0 || input.weekday! > 6)) {
    throw new Error("Choose a weekday for a weekly schedule.");
  }

  const after = input.after ?? new Date();
  const localNow = zonedParts(after, input.timeZone);
  const baseDate = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
  const [hour, minute] = input.timeLocal.split(":").map(Number) as [number, number];

  for (let offset = 0; offset <= 8; offset++) {
    const date = new Date(baseDate.getTime() + offset * 86_400_000);
    if (input.frequency === "weekly" && date.getUTCDay() !== input.weekday) continue;
    const candidate = localTimeToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute, input.timeZone);
    if (candidate.getTime() > after.getTime()) return candidate.toISOString();
  }
  throw new Error("Could not calculate the next run for this schedule.");
}
