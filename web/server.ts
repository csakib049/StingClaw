import { join } from "node:path";
import { serve, type Server } from "bun";
import { Telegraf } from "telegraf";
import { ActionTracker } from "../modes/agent/action-tracker";
import { ToolExecutor } from "../modes/agent/tool-executer";
import { defaultAgentConfig } from "../modes/agent/types";
import type { AgentPermissions } from "../modes/agent/types";
import { launchTaskWorker } from "../modes/agent/task-worker";
import { isStartupEnabled, launchBackendInBackground, setStartupEnabled } from "../modes/backend/startup";
import { isValidTimeZone, nextScheduledRun, type ScheduleFrequency } from "../modes/scheduler/time";
import { startTelegramService, stopTelegramService } from "../modes/telegram";
import {
  addTaskEvent,
  createApiKey,
  createAgent,
  deleteAgent,
  createConversation,
  createMessage,
  createTask,
  createTaskNotification,
  createAgentMemory,
  getAgent,
  beginTelegramPairing,
  disconnectTelegramSettings,
  getTelegramBotToken,
  getTelegramOwnerId,
  getTelegramPairingStatus,
  getProviderSecretInfo,
  setProviderSecret,
  deleteProviderSecret,
  getConversation,
  getTask,
  listApiKeys,
  listAgents,
  listConversations,
  listMessages,
  listAgentMemories,
  listNotifications,
  countUnreadNotifications,
  listActiveTasks,
  listTaskActions,
  listChildTasks,
  listTaskEvents,
  listTasks,
  createScheduledJob,
  deleteScheduledJob,
  getScheduledJob,
  listScheduledJobs,
  listScheduledJobRuns,
  setScheduledJobEnabled,
  updateScheduledJob,
  deleteApiKey,
  deleteAgentMemory,
  markAllNotificationsRead,
  markNotificationRead,
  markTaskNotificationsRead,
  recordTaskApproval,
  retryTask,
  updateAgent,
  updateAgentMemory,
  updateTaskStatus,
} from "../storage/repository";

const MAX_BODY_BYTES = 128 * 1024;
const PUBLIC_DIR = join(import.meta.dir, "public");
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/assets/stingclaw-mark.png": { file: "assets/stingclaw-mark.png", type: "image/png" },
  "/assets/stingclaw-wordmark.png": { file: "assets/stingclaw-wordmark.png", type: "image/png" },
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

function telegramConnectionError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/\b404\b|not found/i.test(message)) {
    return "Telegram did not recognize that bot token. Revoke it with BotFather, create a fresh token, and paste the complete token from the BotFather message.";
  }
  if (/\b401\b|unauthorized|invalid token/i.test(message)) {
    return "Telegram rejected that bot token. Check that it is complete and has not been revoked, then try a fresh token from BotFather.";
  }
  if (/fetch failed|timeout|network|socket/i.test(message)) {
    return "StingClaw could not reach Telegram. Check your internet connection or VPN, then try again.";
  }
  return `Telegram connection failed: ${message}`;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error("Request body is too large.");

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function isAllowedHost(request: Request, port: number): boolean {
  const hostHeader = request.headers.get("host");
  if (!hostHeader) return false;

  try {
    const host = new URL(`http://${hostHeader}`);
    const allowedName = host.hostname === "127.0.0.1" || host.hostname === "localhost";
    return allowedName && Number(host.port || 80) === port;
  } catch {
    return false;
  }
}

function isSafeMutation(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function staticResponse(pathname: string): Response | null {
  const item = STATIC_FILES[pathname];
  if (!item) return null;

  return new Response(Bun.file(join(PUBLIC_DIR, item.file)), {
    headers: {
      "Content-Type": item.type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

async function handleApi(request: Request, port: number, onBackgroundHandoff?: () => Promise<void>): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (!isAllowedHost(request, port)) return error("Local requests only.", 403);
  if (method !== "GET" && !isSafeMutation(request)) {
    return error("Cross-site request rejected.", 403);
  }

  try {
    if (segments.length === 2 && segments[0] === "api" && segments[1] === "telegram") {
      const savedToken = getProviderSecretInfo("telegram_bot_token");
      if (method === "GET") {
        const pending = getTelegramPairingStatus();
        return json({
          configured: Boolean(getTelegramBotToken()),
          paired: Boolean(getTelegramOwnerId()),
          pending: pending.pending,
          expiresAt: pending.expiresAt,
          source: savedToken.configured ? "settings" : process.env.TELEGRAM_BOT_TOKEN?.trim() ? "environment" : null,
        });
      }
      if (method === "POST") {
        const body = await readJson(request);
        if (body.action === "disconnect") {
          await stopTelegramService();
          disconnectTelegramSettings();
          return json({ disconnected: true });
        }

        let token = "";
        if (body.action === "connect") {
          token = typeof body.token === "string" ? body.token.trim() : "";
          if (token.length < 20 || token.length > 512 || /\s/.test(token)) return error("Enter a valid Telegram bot token from BotFather.", 400);
          try {
            const probe = new Telegraf(token);
            await probe.telegram.getMe();
          } catch (cause) {
            return error(telegramConnectionError(cause), 400);
          }
          setProviderSecret("telegram_bot_token", token);
        } else if (body.action === "pair") {
          token = getTelegramBotToken() ?? "";
          if (!token) return error("Save a bot token first.", 409);
        } else {
          return error("Choose connect, pair, or disconnect.", 400);
        }

        await stopTelegramService();
        const pairing = beginTelegramPairing();
        try {
          const bot = await startTelegramService(token);
          const pairingUrl = `https://t.me/${bot.username}?start=${encodeURIComponent(pairing.code)}`;
          return json({ pairingUrl, botUsername: bot.username, expiresAt: pairing.expiresAt, pending: true });
        } catch (cause) {
          return error(telegramConnectionError(cause), 400);
        }
      }
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "provider-keys" && segments[2] === "firecrawl") {
      const saved = getProviderSecretInfo("firecrawl");
      if (method === "GET") return json({
        ...saved,
        configured: saved.configured || Boolean(process.env.FIRECRAWL_API_KEY?.trim()),
        source: saved.configured ? "settings" : process.env.FIRECRAWL_API_KEY?.trim() ? "environment" : null,
        environmentLastFour: !saved.configured && process.env.FIRECRAWL_API_KEY?.trim() ? process.env.FIRECRAWL_API_KEY.trim().slice(-4) : null,
      });
      if (method === "PUT") {
        const body = await readJson(request);
        const key = typeof body.key === "string" ? body.key.trim() : "";
        if (key.length < 16 || key.length > 512 || /\s/.test(key)) return error("The Firecrawl API key format is invalid.", 400);
        try { return json({ ...setProviderSecret("firecrawl", key), source: "settings" }); }
        catch (cause) { return error(cause instanceof Error ? cause.message : "Could not securely save the Firecrawl key.", 400); }
      }
      if (method === "DELETE") return json({ deleted: deleteProviderSecret("firecrawl") });
    }

    if (segments.length === 2 && segments[0] === "api" && segments[1] === "service" && method === "GET") {
      return json({ running: true, startupEnabled: isStartupEnabled(), startupSupported: process.platform === "win32" });
    }

    if (segments.length === 2 && segments[0] === "api" && segments[1] === "notifications" && method === "GET") {
      const notifications = listNotifications();
      return json({
        notifications,
        unreadCount: countUnreadNotifications(),
      });
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "notifications" && segments[2] === "read-all" && method === "POST") {
      return json({ updated: markAllNotificationsRead() });
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "notifications" && method === "POST") {
      return markNotificationRead(segments[2]!) ? json({ read: true }) : error("Notification not found.", 404);
    }

    if (segments.length === 2 && segments[0] === "api" && segments[1] === "service" && method === "POST") {
      const body = await readJson(request);
      if (body.action === "startup" && typeof body.enabled === "boolean") {
        try {
          setStartupEnabled(body.enabled);
          if (body.enabled && onBackgroundHandoff) {
            try {
              await onBackgroundHandoff();
            } catch (cause) {
              setStartupEnabled(false);
              throw cause;
            }
          }
          return json({ running: true, startupEnabled: isStartupEnabled(), startupSupported: process.platform === "win32", backgroundHandoff: body.enabled && Boolean(onBackgroundHandoff) });
        } catch (cause) {
          return error(cause instanceof Error ? cause.message : "Could not update startup settings.", 400);
        }
      }
      if (body.action === "stop") {
        for (const task of listActiveTasks()) {
          if (task.status === "queued") {
            updateTaskStatus({ taskId: task.id, status: "cancelled", error: "Backend stopped before this task started." });
            addTaskEvent({ taskId: task.id, eventType: "cancelled", message: "Backend stopped before this task started." });
          } else if (task.status === "running" && task.worker_pid) {
            try {
              process.kill(task.worker_pid, "SIGTERM");
            } catch {
              updateTaskStatus({ taskId: task.id, status: "cancelled", error: "Backend stopped while this task was running." });
              addTaskEvent({ taskId: task.id, eventType: "cancelled", message: "Backend stopped while this task was running." });
            }
          }
        }
        setTimeout(() => process.exit(0), 1200);
        return json({ stopping: true }, 202);
      }
      return error("Unknown service action.", 400);
    }

    if (segments.length === 2 && segments[0] === "api" && segments[1] === "keys" && method === "GET") {
      return json({ keys: listApiKeys(), environmentKeyAvailable: Boolean(process.env.OPENROUTER_API_KEY?.trim()) });
    }

    if (segments.length === 2 && segments[0] === "api" && segments[1] === "keys" && method === "POST") {
      const body = await readJson(request);
      const label = typeof body.label === "string" ? body.label.trim() : "";
      const key = typeof body.key === "string" ? body.key.trim() : "";
      if (!label || label.length > 60) return error("Enter a label up to 60 characters.", 400);
      if (key.length < 16 || key.length > 512 || /\s/.test(key)) return error("The API key format is invalid.", 400);
      if (body.provider !== undefined && body.provider !== "openrouter") return error("Only OpenRouter keys are supported in this phase.", 400);
      try {
        return json({ key: createApiKey(label, key) }, 201);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Could not securely save the API key.";
        return error(message, 400);
      }
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "keys" && method === "DELETE") {
      return deleteApiKey(segments[2]!) ? json({ deleted: true }) : error("API key not found.", 404);
    }

    if (segments.length === 2 && segments[0] === "api" && segments[1] === "agents" && method === "GET") {
      return json({ agents: listAgents() });
    }

    if (segments.length === 2 && segments[0] === "api" && segments[1] === "agents" && method === "POST") {
      const body = await readJson(request);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) return error("Name is required and must be under 80 characters.", 400);
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
      const modelId = typeof body.modelId === "string" ? body.modelId.trim() : process.env.OPENROUTER_DEFAULT_MODEL ?? "openrouter/free";
      if (description.length > 1000 || instructions.length > 8000) {
        return error("Description or instructions are too long.", 400);
      }
      if (!/^[\w./:-]{1,160}$/.test(modelId)) return error("Enter a valid OpenRouter model ID.", 400);
      return json({ agent: createAgent({ name, description, instructions, modelId }) }, 201);
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "agents" && method === "PATCH") {
      const agent = getAgent(segments[2]!);
      if (!agent) return error("Agent not found.", 404);
      const body = await readJson(request);
      const name = typeof body.name === "string" ? body.name.trim() : agent.name;
      const description = typeof body.description === "string" ? body.description.trim() : agent.description;
      const instructions = typeof body.instructions === "string" ? body.instructions.trim() : agent.instructions;
      const modelId = typeof body.modelId === "string" ? body.modelId.trim() : agent.model_id;
      const apiKeyIds = body.apiKeyIds === undefined ? agent.api_key_ids : body.apiKeyIds;
      const permissions = body.permissions === undefined
        ? agent.permissions as unknown as Record<string, unknown>
        : body.permissions as Record<string, unknown>;
      if (!name || name.length > 80 || description.length > 1000 || instructions.length > 8000) {
        return error("Agent settings are invalid or too long.", 400);
      }
      if (!/^[\w./:-]{1,160}$/.test(modelId)) return error("Enter a valid OpenRouter model ID.", 400);
      if (!Array.isArray(apiKeyIds) || apiKeyIds.length > 20 || apiKeyIds.some((id) => typeof id !== "string")) {
        return error("The selected API keys are invalid.", 400);
      }
      const existingKeyIds = new Set(listApiKeys().map((key) => key.id));
      if (apiKeyIds.some((id) => !existingKeyIds.has(id))) return error("A selected API key no longer exists.", 400);
      const permissionNames: (keyof AgentPermissions)[] = [
        "allowWebAccess", "allowShellExecution", "allowFileModification", "allowFileCreation", "allowFolderCreation",
      ];
      if (permissionNames.some((key) => typeof permissions[key] !== "boolean")) {
        return error("Choose a value for each agent permission.", 400);
      }
      const validatedPermissions = Object.fromEntries(
        permissionNames.map((key) => [key, permissions[key]]),
      ) as unknown as AgentPermissions;
      return json({ agent: updateAgent(segments[2]!, {
        name, description, instructions, modelId,
        apiKeyIds: [...new Set(apiKeyIds as string[])],
        permissions: validatedPermissions,
      }) });
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "agents" && method === "DELETE") {
      const agent = getAgent(segments[2]!);
      if (!agent) return error("Agent not found.", 404);
      const activeTask = listConversations(agent.id)
        .flatMap((conversation) => listTasks(conversation.id))
        .find((task) => ["queued", "running", "waiting_approval"].includes(task.status));
      if (activeTask) return error("This agent has an active task. Stop it or wait for it to finish before deleting the agent.", 409);
      return deleteAgent(agent.id) ? json({ deleted: true }) : error("Agent could not be deleted.", 500);
    }

    if (segments.length === 4 && segments[0] === "api" && segments[1] === "agents" && segments[3] === "schedules") {
      const agent = getAgent(segments[2]!);
      if (!agent) return error("Agent not found.", 404);
      if (method === "GET") {
        return json({ schedules: listScheduledJobs(agent.id).map((schedule) => ({
          ...schedule,
          runs: listScheduledJobRuns(schedule.id, 10),
        })) });
      }
      if (method === "POST") {
        const body = await readJson(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const frequency = body.frequency;
        const timeLocal = typeof body.timeLocal === "string" ? body.timeLocal : "";
        const timezone = typeof body.timezone === "string" ? body.timezone : "";
        const weekday = body.weekday === null ? null : typeof body.weekday === "number" ? body.weekday : null;
        const permissions = body.permissions as Record<string, unknown> | undefined;
        const permissionNames: (keyof AgentPermissions)[] = [
          "allowWebAccess", "allowShellExecution", "allowFileModification", "allowFileCreation", "allowFolderCreation",
        ];
        if (!name || name.length > 80 || !prompt || prompt.length > 10_000) return error("Enter a schedule name and a prompt under 10,000 characters.", 400);
        if (frequency !== "daily" && frequency !== "weekly") return error("Choose a daily or weekly schedule.", 400);
        if (frequency === "weekly" && (weekday === null || !Number.isInteger(weekday) || weekday < 0 || weekday > 6)) return error("Choose a weekday for a weekly schedule.", 400);
        if (!isValidTimeZone(timezone)) return error("Choose a valid time zone.", 400);
        if (!permissions || permissionNames.some((key) => typeof permissions[key] !== "boolean")) return error("Choose each scheduled task permission.", 400);
        try {
          const scheduleFrequency = frequency as ScheduleFrequency;
          const nextRunAt = nextScheduledRun({ frequency: scheduleFrequency, timeLocal, weekday, timeZone: timezone });
          const conversation = createConversation(agent.id, `Schedule: ${name}`);
          const schedule = createScheduledJob({
            agentId: agent.id,
            conversationId: conversation.id,
            name,
            prompt,
            frequency: scheduleFrequency,
            timeLocal,
            weekday: scheduleFrequency === "weekly" ? weekday : null,
            timezone,
            permissions: Object.fromEntries(permissionNames.map((key) => [key, permissions[key]])) as unknown as AgentPermissions,
            nextRunAt,
          });
          return json({ schedule: { ...schedule, runs: [] } }, 201);
        } catch (cause) {
          return error(cause instanceof Error ? cause.message : "Could not create this schedule.", 400);
        }
      }
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "schedules") {
      const schedule = getScheduledJob(segments[2]!);
      if (!schedule) return error("Scheduled job not found.", 404);
      if (method === "GET") return json({ schedule, runs: listScheduledJobRuns(schedule.id, 20) });
      if (method === "DELETE") return deleteScheduledJob(schedule.id) ? json({ deleted: true }) : error("Scheduled job not found.", 404);
      if (method === "POST") {
        const body = await readJson(request);
        if (body.action !== "pause" && body.action !== "resume") return error("Choose pause or resume.", 400);
        try {
          const nextRunAt = body.action === "resume"
            ? nextScheduledRun({ frequency: schedule.frequency, timeLocal: schedule.time_local, weekday: schedule.weekday, timeZone: schedule.timezone })
            : null;
          return json({ schedule: setScheduledJobEnabled(schedule.id, body.action === "resume", nextRunAt) });
        } catch (cause) {
          return error(cause instanceof Error ? cause.message : "Could not update this schedule.", 400);
        }
      }
      if (method === "PATCH") {
        const body = await readJson(request);
        const name = typeof body.name === "string" ? body.name.trim() : schedule.name;
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : schedule.prompt;
        const frequency = body.frequency === "daily" || body.frequency === "weekly" ? body.frequency : schedule.frequency;
        const timeLocal = typeof body.timeLocal === "string" ? body.timeLocal : schedule.time_local;
        const timezone = typeof body.timezone === "string" ? body.timezone : schedule.timezone;
        const weekday = body.weekday === null ? null : typeof body.weekday === "number" ? body.weekday : schedule.weekday;
        const permissions = body.permissions === undefined ? schedule.permissions as unknown as Record<string, unknown> : body.permissions as Record<string, unknown>;
        const permissionNames: (keyof AgentPermissions)[] = [
          "allowWebAccess", "allowShellExecution", "allowFileModification", "allowFileCreation", "allowFolderCreation",
        ];
        if (!name || name.length > 80 || !prompt || prompt.length > 10_000) return error("Enter a schedule name and a prompt under 10,000 characters.", 400);
        if (!isValidTimeZone(timezone) || permissionNames.some((key) => typeof permissions[key] !== "boolean")) return error("The time zone or permission settings are invalid.", 400);
        try {
          const nextRunAt = nextScheduledRun({ frequency, timeLocal, weekday, timeZone: timezone });
          const updated = updateScheduledJob({
            id: schedule.id, name, prompt, frequency, timeLocal,
            weekday: frequency === "weekly" ? weekday : null,
            timezone,
            permissions: Object.fromEntries(permissionNames.map((key) => [key, permissions[key]])) as unknown as AgentPermissions,
            nextRunAt,
          });
          return json({ schedule: updated, runs: listScheduledJobRuns(schedule.id, 20) });
        } catch (cause) {
          return error(cause instanceof Error ? cause.message : "Could not update this schedule.", 400);
        }
      }
    }

    if (segments.length === 4 && segments[0] === "api" && segments[1] === "agents" && segments[3] === "memories") {
      const agent = getAgent(segments[2]!);
      if (!agent) return error("Agent not found.", 404);
      if (method === "GET") return json({ memories: listAgentMemories(agent.id) });
      if (method === "POST") {
        const body = await readJson(request);
        if (typeof body.content !== "string" || (body.important !== undefined && typeof body.important !== "boolean")) {
          return error("Memory content or importance setting is invalid.", 400);
        }
        try {
          return json({ memory: createAgentMemory(agent.id, body.content, body.important === true) }, 201);
        } catch (cause) {
          return error(cause instanceof Error ? cause.message : "Could not save this memory.", 400);
        }
      }
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "memories") {
      if (method === "PATCH") {
        const body = await readJson(request);
        const agentId = typeof body.agentId === "string" ? body.agentId : "";
        const agent = getAgent(agentId);
        if (!agent) return error("Agent not found.", 404);
        if (typeof body.content !== "string" || typeof body.important !== "boolean") {
          return error("Memory content or importance setting is invalid.", 400);
        }
        try {
          return json({ memory: updateAgentMemory(agent.id, segments[2]!, body.content, body.important) });
        } catch (cause) {
          return error(cause instanceof Error ? cause.message : "Could not update this memory.", 400);
        }
      }
      if (method === "DELETE") {
        const agentId = url.searchParams.get("agentId") ?? "";
        return deleteAgentMemory(agentId, segments[2]!) ? json({ deleted: true }) : error("Memory not found.", 404);
      }
    }

    if (segments.length === 4 && segments[0] === "api" && segments[1] === "agents" && segments[3] === "conversations") {
      const agent = getAgent(segments[2]!);
      if (!agent) return error("Agent not found.", 404);
      if (method === "GET") return json({ conversations: listConversations(agent.id) });
      if (method === "POST") {
        const body = await readJson(request);
        const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
        return json({ conversation: createConversation(agent.id, title) }, 201);
      }
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "conversations") {
      const conversation = getConversation(segments[2]!);
      if (!conversation) return error("Conversation not found.", 404);

      if (method === "GET") {
        return json({
          conversation,
          messages: listMessages(conversation.id),
          tasks: listTasks(conversation.id),
        });
      }

      if (method === "POST") {
        const body = await readJson(request);
        const content = typeof body.content === "string" ? body.content.trim() : "";
        if (!content || content.length > 20_000) {
          return error("Message is required and must be under 20,000 characters.", 400);
        }

        const active = listTasks(conversation.id).find((task) =>
          task.status === "queued" || task.status === "running" || task.status === "waiting_approval",
        );
        if (active) return error("This conversation already has an active task.", 409);

        const message = createMessage({
          conversationId: conversation.id,
          sender: "user",
          source: "web",
          content,
        });
        const task = createTask({
          agentId: conversation.agent_id,
          conversationId: conversation.id,
          goal: content,
          workspacePath: process.cwd(),
        });
        addTaskEvent({ taskId: task.id, eventType: "queued", message: "Task queued from the local web interface." });

        try {
          await launchTaskWorker(task.id);
        } catch (cause) {
          const reason = cause instanceof Error ? cause.message : String(cause);
          updateTaskStatus({ taskId: task.id, status: "failed", error: reason });
          addTaskEvent({ taskId: task.id, eventType: "failed", message: reason });
          createTaskNotification({ taskId: task.id, type: "failed", title: "Task could not start", message: "StingClaw could not start the worker. Open task details to see the error." });
        }

        return json({ message, task: getTask(task.id) }, 202);
      }
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "tasks") {
      const task = getTask(segments[2]!);
      if (!task) return error("Task not found.", 404);

      if (method === "GET") {
        const actions = task.status === "waiting_approval"
          ? listTaskActions(task.id).filter((action) => action.status === "pending")
          : [];
        return json({ task, events: listTaskEvents(task.id), actions, delegatedTasks: listChildTasks(task.id) });
      }

      if (method === "POST" && segments[2] && segments.length === 3) {
        const body = await readJson(request);
        const action = body.action;

        if (action === "approve" || action === "reject") {
          if (task.status !== "waiting_approval") return error("Task is not waiting for approval.", 409);
          const tracker = new ActionTracker();
          tracker.restore(listTaskActions(task.id));
          const pending = tracker.getPendingMutations();
          if (pending.length === 0) return error("No pending operations to review.", 409);

          if (action === "reject") {
            for (const item of pending) tracker.updateStatus(item.id, "rejected", false);
            recordTaskApproval(task.id, tracker.getActions(), "completed", task.result, null);
            addTaskEvent({ taskId: task.id, eventType: "approval_rejected", message: "The proposed changes were rejected." });
            markTaskNotificationsRead(task.id);
            return json({ task: getTask(task.id) });
          }

          for (const item of pending) tracker.updateStatus(item.id, "approved", true);
          recordTaskApproval(task.id, tracker.getActions(), "running", task.result, process.pid);
          addTaskEvent({ taskId: task.id, eventType: "applying_approved_changes", message: "Applying approved changes from the web interface." });

          const config = defaultAgentConfig();
          config.codebasePath = task.workspace_path || process.cwd();
          const executor = new ToolExecutor(tracker, config);
          let result: ReturnType<ToolExecutor["applyApprovedFromTracker"]>;
          try {
            result = executor.applyApprovedFromTracker();
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            updateTaskStatus({ taskId: task.id, status: "failed", result: task.result, error: message });
            addTaskEvent({ taskId: task.id, eventType: "failed", message });
            markTaskNotificationsRead(task.id);
            createTaskNotification({ taskId: task.id, type: "failed", title: "Approved changes could not be applied", message: "StingClaw could not apply the approved changes. Open task details to see the error." });
            return json({ task: getTask(task.id), error: message }, 500);
          } finally {
            executor.clearStaging();
          }

          if (result.failed.length) {
            const message = result.failed.map((item) => `${item.target}: ${item.error}`).join("\n");
            updateTaskStatus({ taskId: task.id, status: "failed", result: task.result, error: message });
            addTaskEvent({ taskId: task.id, eventType: "failed", message });
            markTaskNotificationsRead(task.id);
            createTaskNotification({ taskId: task.id, type: "failed", title: "Approved changes could not be applied", message: "StingClaw could not apply the approved changes. Open task details to see the error." });
          } else {
            updateTaskStatus({ taskId: task.id, status: "completed", result: task.result });
            addTaskEvent({
              taskId: task.id,
              eventType: "completed",
              message: `Approved operations applied: ${result.applied.join(", ") || "none"}.`,
            });
            markTaskNotificationsRead(task.id);
            createTaskNotification({ taskId: task.id, type: "completed", title: "Approved changes applied", message: "Your approved changes were applied." });
          }
          return json({ task: getTask(task.id), applied: result.applied, failed: result.failed });
        }

        if (action === "retry") {
          try {
            retryTask(task.id);
            addTaskEvent({ taskId: task.id, eventType: "retry_started", message: "Task queued for retry." });
            await launchTaskWorker(task.id);
            return json({ task: getTask(task.id) }, 202);
          } catch (cause) {
            return error(cause instanceof Error ? cause.message : String(cause), 409);
          }
        }

        if (action === "stop") {
          if (task.status === "queued") {
            updateTaskStatus({ taskId: task.id, status: "cancelled", error: "Stopped before the worker started." });
            addTaskEvent({ taskId: task.id, eventType: "cancelled", message: "Stopped before the worker started." });
            return json({ task: getTask(task.id) });
          }
          if (task.status !== "running" || !task.worker_pid) return error("Task cannot be stopped in its current state.", 409);
          try {
            process.kill(task.worker_pid, "SIGTERM");
            return json({ task: getTask(task.id) }, 202);
          } catch {
            const message = "Worker is no longer running. Retry the task if needed.";
            updateTaskStatus({ taskId: task.id, status: "failed", error: message });
            addTaskEvent({ taskId: task.id, eventType: "failed", message });
            return json({ task: getTask(task.id) });
          }
        }

        return error("Unknown task action.", 400);
      }
    }

    return error("Not found.", 404);
  } catch (cause) {
    if (cause instanceof SyntaxError || (cause instanceof Error && cause.message.includes("Request body"))) {
      return error(cause.message, 400);
    }
    console.error(cause);
    return error("The local server could not complete that request.", 500);
  }
}

export function startWebServer(port = Number(process.env.PORT ?? 3210), onBackgroundHandoff = true): Server<undefined> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port between 1 and 65535.");
  }

  const server = serve<undefined>({
    hostname: "127.0.0.1",
    port,
    fetch: async (request): Promise<Response> => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return handleApi(request, port, onBackgroundHandoff ? async () => {
          await launchBackendInBackground();
          setTimeout(() => {
            server.stop(true);
            process.exit(0);
          }, 600);
        } : undefined);
      }
      if (request.method !== "GET") return error("Method not allowed.", 405);
      if (!isAllowedHost(request, port)) return error("Local requests only.", 403);
      return staticResponse(url.pathname) ?? error("Not found.", 404);
    },
  });

  console.log(`StingClaw web interface: http://127.0.0.1:${server.port}`);
  console.log("Keep this process running while you use the local interface.");
  return server;
}
