import { addTaskEvent, claimScheduledJobRun, createTaskNotification, listDueScheduledJobs, markScheduledRunStartFailed, skipMissedScheduledRun, updateTaskStatus } from "../../storage/repository";
import { launchTaskWorker } from "../agent/task-worker";
import { nextScheduledRun } from "./time";

function nextAfter(job: ReturnType<typeof listDueScheduledJobs>[number], after: Date): string {
  return nextScheduledRun({
    frequency: job.frequency,
    timeLocal: job.time_local,
    weekday: job.weekday,
    timeZone: job.timezone,
    after,
  });
}

function skipRunsMissedWhileOffline(): void {
  const now = new Date();
  const nowIso = now.toISOString();
  for (const job of listDueScheduledJobs(nowIso)) {
    try {
      const nextRunAt = nextAfter(job, now);
      if (skipMissedScheduledRun(job.id, nowIso, nextRunAt)) {
        console.log(`Skipped missed scheduled run “${job.name}”; the backend was offline.`);
      }
    } catch (error) {
      console.error(`Could not reschedule missed job “${job.name}”:`, error);
    }
  }
}

async function processDueSchedules(): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  for (const job of listDueScheduledJobs(nowIso)) {
    try {
      const nextRunAt = nextAfter(job, now);
      const claimed = claimScheduledJobRun(job.id, nowIso, nextRunAt);
      if (!claimed) continue;
      try {
        await launchTaskWorker(claimed.task.id);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        updateTaskStatus({ taskId: claimed.task.id, status: "failed", error: message });
        addTaskEvent({ taskId: claimed.task.id, eventType: "failed", message });
        markScheduledRunStartFailed(claimed.task.id, message);
        createTaskNotification({
          taskId: claimed.task.id,
          type: "failed",
          title: `Scheduled job failed to start: ${job.name}`,
          message: "StingClaw could not start this scheduled task. Open task details for more information.",
        });
      }
    } catch (error) {
      console.error(`Could not run scheduled job “${job.name}”:`, error);
    }
  }
}

export function startScheduledJobRunner(intervalMs = 15_000): () => void {
  skipRunsMissedWhileOffline();
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processDueSchedules();
    } catch (error) {
      console.error("Scheduled job check failed:", error);
    } finally {
      running = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
